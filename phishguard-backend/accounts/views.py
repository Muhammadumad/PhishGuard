# accounts/views.py — FIXED: UserSerializer defined inline (serializers.py was deleted)
import traceback
import logging
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.contrib.auth.password_validation import validate_password
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import serializers

import csv
import io
import datetime
from django.db.models import Count, Q
from django.utils import timezone
from .models import SecurityEvent, AuditLog
from .audit_logger import log_audit_event

logger = logging.getLogger("accounts")
User = get_user_model()

# ── Inline UserSerializer — replaces the deleted serializers.py ──────────────
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model  = User
        fields = ["id", "email", "username", "role", "is_active", "date_joined", "last_login"]
        read_only_fields = ["id", "role", "is_active", "date_joined", "last_login"]


class SecurityEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = SecurityEvent
        fields = ["id", "event_type", "email", "username", "ip_address", "success", "details", "created_at"]
        read_only_fields = fields


class AuditLogSerializer(serializers.ModelSerializer):
    user_email_display = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            "id", "category", "event_type", "severity", "status",
            "user", "user_email", "user_email_display", "user_role",
            "ip_address", "user_agent", "request_path", "request_method",
            "target_resource", "details", "created_at",
        ]
        read_only_fields = fields

    def get_user_email_display(self, obj):
        return obj.user_email or (obj.user.email if obj.user else "Anonymous")


def _safe_log(event_type, request=None, **kwargs):
    """Log a security event & audit log entry — fail-safe error isolation."""
    try:
        SecurityEvent.objects.create(event_type=event_type, **kwargs)
    except Exception:
        pass

    try:
        severity = "info"
        status_val = "success" if kwargs.get("success", True) else "failure"
        if "failed" in event_type or "locked" in event_type:
            severity = "warning"
        
        target = kwargs.get("email") or kwargs.get("username") or ""
        log_audit_event(
            request=request,
            category="auth",
            event_type=event_type,
            severity=severity,
            status=status_val,
            target=target,
            details=kwargs.get("details") or {"email": kwargs.get("email"), "username": kwargs.get("username")},
            user=kwargs.get("user"),
        )
    except Exception:
        pass


# ── Register ──────────────────────────────────────────────────────────────────
class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "register"

    def post(self, request):
        ip = (request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
              or request.META.get("REMOTE_ADDR", "unknown"))
        email    = (request.data.get("email")    or "").strip()
        username = (request.data.get("username") or email).strip()
        password = (request.data.get("password") or "")

        try:
            if not email:
                return Response({"error": "Email is required"}, status=400)
            if not password:
                return Response({"error": "Password is required"}, status=400)
            if len(password) < 8:
                return Response({"error": "Password must be at least 8 characters"}, status=400)

            try:
                validate_password(password)
            except ValidationError as err:
                return Response({"error": " ".join(err.messages)}, status=400)

            if User.objects.filter(email=email).exists():
                return Response({"error": "This email is already registered"}, status=400)

            # Ensure username is unique
            base_username = username or email
            candidate = base_username
            suffix = 2
            while User.objects.filter(username=candidate).exists():
                candidate = f"{base_username}{suffix}"
                suffix += 1
            username = candidate

            user = User.objects.create_user(
                email=email,
                username=username,
                password=password,
            )

            _safe_log("register_success", email=user.email, username=user.username,
                      ip_address=ip, user=user, success=True)

            return Response({
                "id":       user.id,
                "email":    user.email,
                "username": user.username,
                "role":     user.role,
            }, status=201)

        except Exception as e:
            traceback.print_exc()
            logger.exception("Registration failed: %s", e)
            _safe_log("register_failed", email=email, username=username,
                      ip_address=ip, success=False, details={"reason": "server_error", "error": str(e)})
            return Response({"error": f"Registration failed: {str(e)}"}, status=500)


# ── Profile ───────────────────────────────────────────────────────────────────
class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)


class SecurityEventListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != "admin":
            return Response({"error": "Admin access required"}, status=403)

        try:
            limit = min(100, max(1, int(request.query_params.get("limit", 25))))
        except ValueError:
            limit = 25

        event_type = request.query_params.get("event_type")
        qs = SecurityEvent.objects.select_related("user").all()
        if event_type:
            qs = qs.filter(event_type=event_type)

        data = SecurityEventSerializer(qs[:limit], many=True).data
        return Response({"count": qs.count(), "results": data})


class AuditLogListView(APIView):
    """
    GET /api/accounts/audit-logs/ (Admin only)
    Query parameters:
    - category, event_type, severity, status, user_id, ip_address
    - search (matches target_resource, user_email, request_path, event_type)
    - start_date, end_date (ISO 8601 YYYY-MM-DD)
    - page, page_size
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, format=None):
        if not request.user or not (getattr(request.user, "role", "") == "admin" or getattr(request.user, "is_superuser", False)):
            return Response({"error": "Admin permission required"}, status=403)

        qs = AuditLog.objects.select_related("user").all()

        params = getattr(request, "query_params", request.GET)
        category = params.get("category")
        event_type = params.get("event_type")
        severity = params.get("severity")
        status_filter = params.get("status")
        user_id = params.get("user_id")
        ip_address = params.get("ip_address")
        search = params.get("search")
        start_date = params.get("start_date")
        end_date = params.get("end_date")

        if category:
            qs = qs.filter(category=category)
        if event_type:
            qs = qs.filter(event_type=event_type)
        if severity:
            qs = qs.filter(severity=severity)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if user_id:
            qs = qs.filter(user_id=user_id)
        if ip_address:
            qs = qs.filter(ip_address=ip_address)

        if search:
            qs = qs.filter(
                Q(target_resource__icontains=search) |
                Q(user_email__icontains=search) |
                Q(request_path__icontains=search) |
                Q(event_type__icontains=search)
            )

        if start_date:
            qs = qs.filter(created_at__gte=start_date)
        if end_date:
            qs = qs.filter(created_at__lte=end_date)

        try:
            page = max(1, int(params.get("page", 1)))
            page_size = min(100, max(1, int(params.get("page_size", 25))))
        except ValueError:
            page, page_size = 1, 25

        total_count = qs.count()
        start = (page - 1) * page_size
        end = start + page_size

        serializer = AuditLogSerializer(qs[start:end], many=True)
        return Response({
            "count": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": (total_count + page_size - 1) // page_size if page_size else 1,
            "results": serializer.data,
        })


class AuditLogStatsView(APIView):
    """
    GET /api/accounts/audit-logs/stats/ (Admin only)
    Returns breakdown of audit events by category, severity, status, and top IP addresses.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user or not (getattr(request.user, "role", "") == "admin" or getattr(request.user, "is_superuser", False)):
            return Response({"error": "Admin permission required"}, status=403)

        total_events = AuditLog.objects.count()
        category_counts = list(AuditLog.objects.values("category").annotate(count=Count("id")).order_by("-count"))
        severity_counts = list(AuditLog.objects.values("severity").annotate(count=Count("id")).order_by("-count"))
        status_counts = list(AuditLog.objects.values("status").annotate(count=Count("id")).order_by("-count"))

        top_ips = list(
            AuditLog.objects.exclude(ip_address__isnull=True)
            .values("ip_address")
            .annotate(count=Count("id"))
            .order_by("-count")[:5]
        )

        top_events = list(
            AuditLog.objects.values("event_type", "category")
            .annotate(count=Count("id"))
            .order_by("-count")[:5]
        )

        return Response({
            "total_events": total_events,
            "category_breakdown": category_counts,
            "severity_breakdown": severity_counts,
            "status_breakdown": status_counts,
            "top_source_ips": top_ips,
            "top_event_types": top_events,
        })


class AuditLogExportView(APIView):
    """
    GET /api/accounts/audit-logs/export/?format=csv|json|cef (Admin only)
    Exports audit logs for SIEM & compliance archiving.
    """
    permission_classes = [IsAuthenticated]

    def perform_content_negotiation(self, request, force=False):
        from rest_framework.renderers import JSONRenderer
        return (JSONRenderer(), "application/json")

    def finalize_response(self, request, response, *args, **kwargs):
        from django.http import HttpResponse
        if isinstance(response, HttpResponse) and not isinstance(response, Response):
            return response
        return super().finalize_response(request, response, *args, **kwargs)

    def get(self, request, format=None):
        if not request.user or not (getattr(request.user, "role", "") == "admin" or getattr(request.user, "is_superuser", False)):
            return Response({"error": "Admin permission required"}, status=403)

        params = getattr(request, "query_params", request.GET)
        fmt = (format or params.get("format", "json")).lower()
        limit = min(5000, max(1, int(params.get("limit", 1000))))

        qs = AuditLog.objects.select_related("user").all()[:limit]

        if fmt == "csv":
            from django.http import HttpResponse
            response = HttpResponse(content_type="text/csv")
            response["Content-Disposition"] = 'attachment; filename="phishguard_audit_logs.csv"'
            writer = csv.writer(response)
            writer.writerow([
                "ID", "Timestamp", "Category", "Event Type", "Severity", "Status",
                "User Email", "User Role", "IP Address", "Method", "Path", "Target", "Details"
            ])
            for item in qs:
                writer.writerow([
                    item.id,
                    item.created_at.isoformat() if item.created_at else "",
                    item.category,
                    item.event_type,
                    item.severity,
                    item.status,
                    item.user_email or (item.user.email if item.user else ""),
                    item.user_role,
                    item.ip_address or "",
                    item.request_method,
                    item.request_path,
                    item.target_resource,
                    str(item.details),
                ])
            return response

        elif fmt == "cef":
            from django.http import HttpResponse
            cef_lines = []
            for item in qs:
                sev_num = "3" if item.severity == "info" else ("6" if item.severity == "warning" else "9")
                email_str = item.user_email or (item.user.email if item.user else "anon")
                cef = f"CEF:0|PhishGuard|AuditEngine|2.0.0|{item.event_type.upper()}|{item.category.upper()} Event|{sev_num}|src={item.ip_address or ''} suser={email_str} request={item.request_path} msg={item.target_resource}"
                cef_lines.append(cef)

            response = HttpResponse("\n".join(cef_lines), content_type="text/plain")
            response["Content-Disposition"] = 'attachment; filename="phishguard_audit_logs.cef"'
            return response

        # Default JSON format
        serializer = AuditLogSerializer(qs, many=True)
        return Response({
            "count": len(qs),
            "format": "json",
            "audit_logs": serializer.data,
        })