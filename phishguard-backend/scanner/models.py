# scanner/models.py
# TABLE: urls, scan_results, blacklist
import re
from django.db import models
from django.conf import settings


class URL(models.Model):
    """
    TABLE: urls
    Stores every URL submitted for scanning.
    """
    STATUS_CHOICES = [
        ("queued",     "Queued"),
        ("pending",    "Pending"),
        ("safe",       "Safe"),
        ("suspicious", "Suspicious"),
        ("phishing",   "Phishing"),
    ]

    id             = models.BigAutoField(primary_key=True)
    url            = models.TextField()
    # Canonicalized form (tracking params removed, lowercased), used for dedupe
    normalized_url = models.TextField(null=True, blank=True, db_index=True)
    normalized_hash = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    submitted_by   = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,   # keep URL if user deleted
        null=True, blank=True,
        related_name="urls",
    )
    status         = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending", db_index=True)
    date_submitted = models.DateTimeField(auto_now_add=True)
    # Lifecycle tracking
    processing_started_at = models.DateTimeField(null=True, blank=True)
    failure_count = models.IntegerField(default=0)
    last_error = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "urls"
        ordering = ["-date_submitted"]
        indexes  = [
            models.Index(fields=["status"],                    name="idx_urls_status"),
            models.Index(fields=["date_submitted"],            name="idx_urls_submitted"),
            models.Index(fields=["submitted_by"],              name="idx_urls_user"),
            models.Index(fields=["status", "date_submitted"],  name="idx_urls_status_date"),
        ]

    def __str__(self):
        return f"{self.url[:80]} [{self.status}]"


class ScanResult(models.Model):
    """
    TABLE: scan_results
    ONE-TO-ONE with URL. Stores all 17 extracted features + verdict.
    """
    VERDICT_CHOICES = [
        ("safe",       "Safe"),
        ("suspicious", "Suspicious"),
        ("phishing",   "Phishing"),
    ]

    id     = models.BigAutoField(primary_key=True)
    url    = models.OneToOneField(
        URL,
        on_delete=models.CASCADE,    # delete result if URL deleted
        related_name="scan_result",
    )

    # ── Length Features ──────────────────────────────────
    url_length    = models.IntegerField(default=0)
    domain_length = models.IntegerField(default=0)
    path_length   = models.IntegerField(default=0)

    # ── Count Features ────────────────────────────────────
    num_dots             = models.IntegerField(default=0)
    num_hyphens          = models.IntegerField(default=0)
    num_subdomains       = models.IntegerField(default=0)
    num_query_params     = models.IntegerField(default=0)

    # ── Boolean Indicator Features ────────────────────────
    has_at_symbol            = models.BooleanField(default=False)
    has_ip_address           = models.BooleanField(default=False)
    uses_https               = models.BooleanField(default=True)
    has_double_slash_redirect= models.BooleanField(default=False)
    has_suspicious_tld       = models.BooleanField(default=False)
    is_shortened             = models.BooleanField(default=False)
    has_suspicious_keywords  = models.BooleanField(default=False)
    num_suspicious_keywords  = models.IntegerField(default=0)
    has_hex_encoding         = models.BooleanField(default=False)
    has_punycode             = models.BooleanField(default=False)

    # ── Result Fields ────────────────────────────────────
    verdict          = models.CharField(max_length=20, choices=VERDICT_CHOICES, db_index=True)
    confidence_score = models.FloatField(default=0.0)   # 0.0–100.0%
    risk_score       = models.IntegerField(default=0)   # 0–200 raw points
    reasons          = models.JSONField(default=list)   # ["reason1", "reason2"]
    scanned_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "scan_results"
        indexes  = [
            models.Index(fields=["verdict"],          name="idx_scan_verdict"),
            models.Index(fields=["confidence_score"], name="idx_scan_confidence"),
            models.Index(fields=["scanned_at"],       name="idx_scan_date"),
            models.Index(fields=["risk_score"],       name="idx_scan_score"),
        ]

    def __str__(self):
        return f"{self.url.url[:60]} → {self.verdict} ({self.confidence_score:.1f}%)"


class BlacklistedDomain(models.Model):
    """
    TABLE: blacklist
    Known malicious domains. Checked BEFORE analysis.
    Standalone — no foreign keys.
    """
    SOURCE_CHOICES = [
        ("seed",   "Seed Data"),
        ("admin",  "Admin Added"),
        ("report", "From Report"),
    ]

    id         = models.BigAutoField(primary_key=True)
    domain     = models.CharField(max_length=255, unique=True, db_index=True)
    reason     = models.CharField(max_length=255, blank=True, default="")
    source     = models.CharField(max_length=100, choices=SOURCE_CHOICES, default="manual")
    date_added = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "blacklist"
        indexes  = [
            models.Index(fields=["domain"],     name="idx_blacklist_domain"),
            models.Index(fields=["source"],     name="idx_blacklist_source"),
            models.Index(fields=["date_added"], name="idx_blacklist_date"),
        ]

    def __str__(self):
        return f"{self.domain} ({self.source})"


class CachedScan(models.Model):
    """
    DB-level cache of normalized URL analysis so identical URLs can be short-circuited
    without re-running feature extraction. The cache is updated by background workers.
    """
    id = models.BigAutoField(primary_key=True)
    normalized_url = models.TextField(unique=True, db_index=True)
    normalized_hash = models.CharField(max_length=64, unique=True, db_index=True)
    verdict = models.CharField(max_length=20, db_index=True)
    confidence_score = models.FloatField(default=0.0)
    risk_score = models.IntegerField(default=0)
    data = models.JSONField(default=dict)  # full feature set
    reasons = models.JSONField(default=list)
    scanned_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "cached_scans"

    def __str__(self):
        return f"CachedScan {self.normalized_hash[:8]} → {self.verdict} @ {self.scanned_at}"