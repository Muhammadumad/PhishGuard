# reports/serializers.py
from rest_framework import serializers
from .models import Report


REASON_SUGGESTIONS = [
    "Brand impersonation and typosquatting",
    "Credential phishing attempt",
    "Malware distribution",
    "Suspicious redirect",
    "Scam or fraud link",
    "Other",
]


class ReportSerializer(serializers.ModelSerializer):
    """Serializer for Report creation and listing"""
    submitted_by         = serializers.StringRelatedField(read_only=True)
    reviewed_by          = serializers.StringRelatedField(read_only=True)
    url_string           = serializers.CharField(source="url.url", read_only=True)
    current_url_status   = serializers.CharField(source="url.status", read_only=True)
    reason_suggestions   = serializers.SerializerMethodField(read_only=True)

    def get_reason_suggestions(self, obj):
        return REASON_SUGGESTIONS
    
    class Meta:
        model  = Report
        fields = [
            "id", "url", "url_string", "current_url_status",
            "reason", "description", "reason_suggestions",
            "status", "submitted_by", "created_at", "updated_at",
            "reviewed_by", "admin_notes", "reviewed_at"
        ]
        read_only_fields = [
            "id", "submitted_by", "created_at", "updated_at",
            "reviewed_by", "admin_notes", "reviewed_at", "status"
        ]


class ReportAdminSerializer(serializers.ModelSerializer):
    """Serializer for admin review of reports — allows status updates"""
    submitted_by  = serializers.StringRelatedField(read_only=True)
    reviewed_by   = serializers.StringRelatedField(read_only=True)
    url_string    = serializers.CharField(source="url.url", read_only=True)
    url_status    = serializers.CharField(source="url.status", read_only=True)
    reason_suggestions = serializers.SerializerMethodField(read_only=True)

    def get_reason_suggestions(self, obj):
        return REASON_SUGGESTIONS
    
    class Meta:
        model  = Report
        fields = [
            "id", "url", "url_string", "url_status",
            "reason", "description", "reason_suggestions",
            "status", "submitted_by", "created_at", "updated_at",
            "reviewed_by", "admin_notes", "reviewed_at"
        ]
        read_only_fields = [
            "id", "submitted_by", "created_at", "updated_at",
            "url", "reason", "description"
        ]


class ReportStatisticsSerializer(serializers.Serializer):
    """Statistics for reports dashboard"""
    total_reports    = serializers.IntegerField(read_only=True)
    pending_reports  = serializers.IntegerField(read_only=True)
    confirmed_count  = serializers.IntegerField(read_only=True)
    false_positive_count = serializers.IntegerField(read_only=True)
    reasons_breakdown = serializers.DictField(read_only=True)
