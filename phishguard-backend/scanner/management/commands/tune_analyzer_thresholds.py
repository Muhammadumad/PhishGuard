import json
from datetime import datetime, timezone
from pathlib import Path

from django.core.management.base import BaseCommand

from scanner.analyzer import (
    PHISHING_THRESHOLD,
    SUSPICIOUS_THRESHOLD,
    THRESHOLD_FILE,
)
from scanner.models import ScanResult

VALID_LABELS = ("safe", "suspicious", "phishing")


def predict(score: int, suspicious_threshold: int, phishing_threshold: int) -> str:
    if score >= phishing_threshold:
        return "phishing"
    if score >= suspicious_threshold:
        return "suspicious"
    return "safe"


def evaluate(rows, suspicious_threshold: int, phishing_threshold: int) -> dict:
    counts = {label: {"tp": 0, "fp": 0, "fn": 0} for label in VALID_LABELS}
    correct = 0

    for score, actual in rows:
        pred = predict(score, suspicious_threshold, phishing_threshold)
        if pred == actual:
            correct += 1
        for label in VALID_LABELS:
            if pred == label and actual == label:
                counts[label]["tp"] += 1
            elif pred == label and actual != label:
                counts[label]["fp"] += 1
            elif pred != label and actual == label:
                counts[label]["fn"] += 1

    per_class = {}
    f1_sum = 0.0
    for label in VALID_LABELS:
        tp = counts[label]["tp"]
        fp = counts[label]["fp"]
        fn = counts[label]["fn"]
        precision = tp / max(tp + fp, 1)
        recall = tp / max(tp + fn, 1)
        if precision + recall == 0:
            f1 = 0.0
        else:
            f1 = (2 * precision * recall) / (precision + recall)
        per_class[label] = {
            "precision": precision,
            "recall": recall,
            "f1": f1,
        }
        f1_sum += f1

    return {
        "accuracy": correct / max(len(rows), 1),
        "macro_f1": f1_sum / len(VALID_LABELS),
        "per_class": per_class,
    }


class Command(BaseCommand):
    help = "Tune suspicious/phishing thresholds from historical scan labels"

    def add_arguments(self, parser):
        parser.add_argument(
            "--min-samples",
            type=int,
            default=50,
            help="Minimum labeled rows required before tuning (default: 50)",
        )
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Save best thresholds into scanner/thresholds.json",
        )

    def handle(self, *args, **options):
        min_samples = options["min_samples"]
        apply_thresholds = options["apply"]

        rows = list(
            ScanResult.objects.exclude(url__status="pending")
            .filter(url__status__in=VALID_LABELS)
            .values_list("risk_score", "url__status")
        )

        total = len(rows)
        self.stdout.write("\n-- Analyzer Threshold Tuning --")
        self.stdout.write(f"Labeled samples: {total}")
        if total < min_samples:
            self.stdout.write(
                self.style.WARNING(
                    f"Need at least {min_samples} labeled samples for reliable tuning."
                )
            )
            self.stdout.write("Run scans and relabel statuses, then tune again.\n")
            return

        baseline = evaluate(rows, SUSPICIOUS_THRESHOLD, PHISHING_THRESHOLD)
        self.stdout.write(
            f"Baseline thresholds: suspicious={SUSPICIOUS_THRESHOLD}, phishing={PHISHING_THRESHOLD}"
        )
        self.stdout.write(
            f"Baseline accuracy={baseline['accuracy']:.3f}, macro_f1={baseline['macro_f1']:.3f}"
        )

        best = None
        for suspicious_threshold in range(15, 45):
            for phishing_threshold in range(max(55, suspicious_threshold + 1), 95):
                metrics = evaluate(rows, suspicious_threshold, phishing_threshold)
                candidate = (
                    metrics["macro_f1"],
                    metrics["accuracy"],
                    -abs(suspicious_threshold - SUSPICIOUS_THRESHOLD)
                    - abs(phishing_threshold - PHISHING_THRESHOLD),
                )
                if best is None or candidate > best["rank"]:
                    best = {
                        "rank": candidate,
                        "suspicious_threshold": suspicious_threshold,
                        "phishing_threshold": phishing_threshold,
                        "metrics": metrics,
                    }

        self.stdout.write(
            f"Best thresholds: suspicious={best['suspicious_threshold']}, phishing={best['phishing_threshold']}"
        )
        self.stdout.write(
            f"Best accuracy={best['metrics']['accuracy']:.3f}, macro_f1={best['metrics']['macro_f1']:.3f}"
        )

        for label in VALID_LABELS:
            pc = best["metrics"]["per_class"][label]
            self.stdout.write(
                f"  {label:<10} precision={pc['precision']:.3f} recall={pc['recall']:.3f} f1={pc['f1']:.3f}"
            )

        if not apply_thresholds:
            self.stdout.write("\nDry run only. Re-run with --apply to save tuned thresholds.\n")
            return

        payload = {
            "suspicious_threshold": best["suspicious_threshold"],
            "phishing_threshold": best["phishing_threshold"],
            "samples": total,
            "macro_f1": round(best["metrics"]["macro_f1"], 6),
            "accuracy": round(best["metrics"]["accuracy"], 6),
            "tuned_at": datetime.now(timezone.utc).isoformat(),
        }

        THRESHOLD_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        rel_path = Path("scanner") / THRESHOLD_FILE.name
        self.stdout.write(self.style.SUCCESS(f"\nSaved tuned thresholds to {rel_path}\n"))
