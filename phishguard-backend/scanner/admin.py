# scanner/admin.py
from django.contrib import admin
from .models import URL, ScanResult, BlacklistedDomain


@admin.register(URL)
class URLAdmin(admin.ModelAdmin):
    list_display  = ["url", "submitted_by", "status", "date_submitted"]
    list_filter   = ["status"]
    search_fields = ["url"]
    ordering      = ["-date_submitted"]


@admin.register(ScanResult)
class ScanResultAdmin(admin.ModelAdmin):
    list_display  = ["url", "verdict", "confidence_score", "risk_score", "scanned_at"]
    list_filter   = ["verdict"]
    ordering      = ["-scanned_at"]


@admin.register(BlacklistedDomain)
class BlacklistAdmin(admin.ModelAdmin):
    list_display  = ["domain", "reason", "source", "date_added"]
    list_filter   = ["source"]
    search_fields = ["domain"]
    ordering      = ["-date_added"]