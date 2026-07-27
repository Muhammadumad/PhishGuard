# scanner/management/commands/update_blacklist.py
# ─────────────────────────────────────────────────────────────────────────────
# Django management command to import the PhishTank phishing database
# into the PhishGuard MySQL blacklist table.
#
# HOW TO RUN:
#   cd phishguard-backend
#   venv\Scripts\activate
#   python manage.py update_blacklist
#
# OPTIONS:
#   python manage.py update_blacklist --dry-run    (show what would be added, don't save)
#   python manage.py update_blacklist --limit 500  (only import first 500 domains)
#
# PhishTank provides free verified phishing URLs updated every hour.
# No API key required for the basic feed.
# ─────────────────────────────────────────────────────────────────────────────
import json
import urllib.request
import urllib.error
from urllib.parse import urlparse

from django.core.management.base import BaseCommand
from scanner.models import BlacklistedDomain

PHISHTANK_URL = "http://data.phishtank.com/data/online-valid.json"
BACKUP_DOMAINS = [
    # Fallback list if PhishTank is unreachable
    ("paypal-login-secure.net",         "PayPal phishing",          "seed"),
    ("amazon-account-alert.online",     "Amazon phishing",          "seed"),
    ("microsoft-verify-account.tk",     "Microsoft phishing",       "seed"),
    ("apple-id-confirm.ml",             "Apple phishing",           "seed"),
    ("google-account-locked.cf",        "Google phishing",          "seed"),
    ("bank-secure-login.xyz",           "Banking phishing",         "seed"),
    ("netflix-payment-required.top",    "Netflix phishing",         "seed"),
    ("instagram-badge-verify.gq",       "Instagram phishing",       "seed"),
    ("crypto-airdrop-free.tk",          "Crypto scam",              "seed"),
    ("win-free-prize-now.ml",           "Prize scam",               "seed"),
]


def extract_domain(url_str):
    """Extract bare domain from a URL string."""
    try:
        if not url_str.startswith(("http://", "https://")):
            url_str = "https://" + url_str
        parsed = urlparse(url_str)
        domain = parsed.netloc.lower()
        domain = domain.split(":")[0]            # remove port
        domain = domain.lstrip("www.")           # remove www.
        return domain.strip() or None
    except Exception:
        return None


class Command(BaseCommand):
    help = "Import PhishTank phishing feed into the blacklist table"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run", action="store_true",
            help="Show what would be added without saving to database",
        )
        parser.add_argument(
            "--limit", type=int, default=0,
            help="Maximum number of domains to import (0 = no limit)",
        )
        parser.add_argument(
            "--timeout", type=int, default=30,
            help="HTTP request timeout in seconds (default: 30)",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        limit   = options["limit"]
        timeout = options["timeout"]

        self.stdout.write("\n── PhishTank Blacklist Updater ──────────────────────────")
        if dry_run:
            self.stdout.write(self.style.WARNING("  DRY RUN — no changes will be saved"))
        self.stdout.write("")

        # ── Download PhishTank feed ───────────────────────────────────────────
        entries = []
        try:
            self.stdout.write(f"  Downloading PhishTank feed...")
            req = urllib.request.Request(
                PHISHTANK_URL,
                headers={"User-Agent": "PhishGuard-Updater/1.0"},
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode("utf-8")
            entries = json.loads(raw)
            self.stdout.write(self.style.SUCCESS(f"  Downloaded {len(entries):,} entries from PhishTank"))

        except urllib.error.URLError as e:
            self.stdout.write(self.style.ERROR(f"  Could not reach PhishTank: {e}"))
            self.stdout.write("  Falling back to built-in seed domains...")
            self._seed_fallback(dry_run)
            return
        except json.JSONDecodeError:
            self.stdout.write(self.style.ERROR("  Invalid JSON from PhishTank"))
            self._seed_fallback(dry_run)
            return

        # ── Extract unique domains ────────────────────────────────────────────
        domains_seen = set()
        domains_to_add = []

        for entry in entries:
            url_str = entry.get("url", "")
            if not url_str:
                continue

            domain = extract_domain(url_str)
            if not domain or domain in domains_seen:
                continue

            # Skip if already in database
            if BlacklistedDomain.objects.filter(domain=domain).exists():
                domains_seen.add(domain)
                continue

            domains_seen.add(domain)
            domains_to_add.append({
                "domain": domain,
                "reason": f"PhishTank verified phishing — {entry.get('phish_detail_url', '')}",
                "source": "report",
            })

            if limit and len(domains_to_add) >= limit:
                break

        self.stdout.write(f"  New domains to add: {len(domains_to_add):,}")
        self.stdout.write(f"  Already in blacklist: {BlacklistedDomain.objects.count():,}")

        if not domains_to_add:
            self.stdout.write(self.style.SUCCESS("\n  Blacklist is already up to date!"))
            return

        if dry_run:
            self.stdout.write(f"\n  [DRY RUN] Would add {len(domains_to_add)} domains:")
            for d in domains_to_add[:20]:
                self.stdout.write(f"    + {d['domain']}")
            if len(domains_to_add) > 20:
                self.stdout.write(f"    ... and {len(domains_to_add) - 20} more")
            return

        # ── Bulk insert ───────────────────────────────────────────────────────
        self.stdout.write("\n  Inserting into database...")
        batch_size = 500
        created = 0

        for i in range(0, len(domains_to_add), batch_size):
            batch = domains_to_add[i:i + batch_size]
            objs  = [
                BlacklistedDomain(
                    domain=d["domain"],
                    reason=d["reason"][:255],
                    source=d["source"],
                )
                for d in batch
            ]
            BlacklistedDomain.objects.bulk_create(objs, ignore_conflicts=True)
            created += len(batch)
            self.stdout.write(f"  Inserted batch {i // batch_size + 1} ({created}/{len(domains_to_add)})")

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(f"  Done! Added {created} new domains"))
        self.stdout.write(f"  Total blacklist size: {BlacklistedDomain.objects.count():,} domains")
        self.stdout.write("──────────────────────────────────────────────────────────\n")

    def _seed_fallback(self, dry_run):
        """Insert built-in fallback domains if PhishTank is unreachable."""
        self.stdout.write("\n  Seeding fallback domains...")
        created = skipped = 0
        for domain, reason, source in BACKUP_DOMAINS:
            if dry_run:
                self.stdout.write(f"  [DRY RUN] Would add: {domain}")
                continue
            obj, was_created = BlacklistedDomain.objects.get_or_create(
                domain=domain,
                defaults={"reason": reason, "source": source},
            )
            if was_created:
                created += 1
                self.stdout.write(f"  Added: {domain}")
            else:
                skipped += 1

        if not dry_run:
            self.stdout.write(self.style.SUCCESS(
                f"\n  Done — {created} added, {skipped} already existed"
            ))