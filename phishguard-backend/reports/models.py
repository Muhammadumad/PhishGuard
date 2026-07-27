from django.conf import settings
from django.db import models

from scanner.models import URL


class Report(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("reviewed", "Reviewed"),
        ("confirmed", "Confirmed"),
        ("false_positive", "False Positive"),
    ]

    id = models.BigAutoField(primary_key=True)
    url = models.ForeignKey(URL, on_delete=models.CASCADE, related_name="reports")
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="submitted_reports",
    )
    reason = models.CharField(max_length=120)
    description = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending", db_index=True)
    admin_notes = models.TextField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_reports",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "reports"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"], name="idx_reports_status"),
            models.Index(fields=["submitted_by"], name="idx_reports_user"),
            models.Index(fields=["url"], name="idx_reports_url"),
        ]

    def __str__(self):
        return f"Report #{self.id} - {self.status}"