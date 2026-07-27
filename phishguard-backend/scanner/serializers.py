# scanner/serializers.py
from rest_framework import serializers
from .models import URL, ScanResult, BlacklistedDomain


class ScanResultSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ScanResult
        fields = [
            "id", "url_id",
            # 17 features
            "url_length", "domain_length", "path_length",
            "num_dots", "num_hyphens", "num_subdomains", "num_query_params",
            "has_at_symbol", "has_ip_address", "uses_https",
            "has_double_slash_redirect", "has_suspicious_tld", "is_shortened",
            "has_suspicious_keywords", "num_suspicious_keywords",
            "has_hex_encoding", "has_punycode",
            # result
            "verdict", "confidence_score", "risk_score", "reasons", "scanned_at",
        ]
        read_only_fields = fields


class URLSerializer(serializers.ModelSerializer):
    scan_result  = ScanResultSerializer(read_only=True)
    submitted_by = serializers.StringRelatedField(read_only=True)
    time         = serializers.SerializerMethodField()

    class Meta:
        model  = URL
        fields = ["id", "url", "submitted_by", "status", "date_submitted", "time", "scan_result"]
        read_only_fields = fields

    def get_time(self, obj):
        from django.utils import timezone
        delta   = timezone.now() - obj.date_submitted
        seconds = int(delta.total_seconds())
        if seconds < 60:    return "just now"
        if seconds < 3600:  return f"{seconds // 60} min ago"
        if seconds < 86400: return f"{seconds // 3600} hr ago"
        if seconds < 172800:return "1 day ago"
        return f"{seconds // 86400} days ago"


class BlacklistSerializer(serializers.ModelSerializer):
    class Meta:
        model  = BlacklistedDomain
        fields = ["id", "domain", "reason", "source", "date_added"]
        read_only_fields = fields