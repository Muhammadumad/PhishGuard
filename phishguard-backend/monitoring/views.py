# monitoring/views.py
"""
PhishGuard Admin Monitoring API
All endpoints require IsAdminUser permission (role=admin or is_staff=True).

Endpoints:
  GET /api/monitoring/stats/      — Dashboard summary counters
  GET /api/monitoring/live/       — Last 100 site events (live feed)
  GET /api/monitoring/visitors/   — Paginated visitor list
  GET /api/monitoring/searches/   — Paginated URL scan history
  GET /api/monitoring/users/      — Registered users with activity stats
  GET /api/monitoring/geo/        — Visitor count by country
  GET /api/monitoring/timeline/   — Hourly scan/visit timeline
"""
import logging
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, Q, Avg, Max
from django.utils import timezone

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework import serializers

from accounts.models import SiteVisit, SecurityEvent
from scanner.models import URL, ScanResult

logger = logging.getLogger("monitoring")
User = get_user_model()


# ── Permission helper ──────────────────────────────────────────────────────────
class IsAdminOrStaff(IsAuthenticated):
    """Allow only users with role='admin' OR is_staff=True."""
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return request.user.is_staff or getattr(request.user, "role", "") == "admin"


# ── Serializers ────────────────────────────────────────────────────────────────
class SiteVisitSerializer(serializers.ModelSerializer):
    user_display = serializers.SerializerMethodField()

    class Meta:
        model = SiteVisit
        fields = [
            "id", "user_display", "user_email", "ip_address",
            "path", "method", "status_code", "response_ms",
            "browser", "os", "device_type",
            "country", "country_code", "city", "isp",
            "referer", "timestamp",
        ]

    def get_user_display(self, obj):
        if obj.user:
            return f"{obj.user.username} ({obj.user.email})"
        if obj.user_email:
            return obj.user_email
        return "Anonymous"


class URLScanSerializer(serializers.ModelSerializer):
    submitted_by_email = serializers.SerializerMethodField()
    verdict            = serializers.SerializerMethodField()
    confidence_score   = serializers.SerializerMethodField()

    class Meta:
        model = URL
        fields = [
            "id", "url", "submitted_by_email", "status",
            "verdict", "confidence_score", "date_submitted",
        ]

    def get_submitted_by_email(self, obj):
        if obj.submitted_by:
            return obj.submitted_by.email
        return "Anonymous"

    def get_verdict(self, obj):
        try:
            return obj.scan_result.verdict
        except Exception:
            return obj.status

    def get_confidence_score(self, obj):
        try:
            return round(obj.scan_result.confidence_score, 1)
        except Exception:
            return None


# ── Views ──────────────────────────────────────────────────────────────────────
class MonitoringStatsView(APIView):
    """GET /api/monitoring/stats/ — Dashboard summary counters."""
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        now = timezone.now()
        last_24h = now - timedelta(hours=24)
        last_7d  = now - timedelta(days=7)

        # Visit stats
        total_visits    = SiteVisit.objects.count()
        visits_24h      = SiteVisit.objects.filter(timestamp__gte=last_24h).count()
        unique_ips_24h  = (
            SiteVisit.objects.filter(timestamp__gte=last_24h)
            .values("ip_address").distinct().count()
        ) or SiteVisit.objects.values("ip_address").distinct().count()

        active_users_24h = (
            SiteVisit.objects.filter(timestamp__gte=last_24h, user__isnull=False)
            .values("user").distinct().count()
        ) or User.objects.filter(is_active=True).count()

        # Scan stats
        total_scans   = URL.objects.count()
        scans_24h     = URL.objects.filter(date_submitted__gte=last_24h).count()

        # Verdict counts — use 24h if present, else fallback to lifetime total so charts are populated
        if scans_24h > 0:
            phishing_cnt  = URL.objects.filter(date_submitted__gte=last_24h, status="phishing").count()
            safe_cnt      = URL.objects.filter(date_submitted__gte=last_24h, status="safe").count()
            suspicious_cnt= URL.objects.filter(date_submitted__gte=last_24h, status="suspicious").count()
        else:
            phishing_cnt  = URL.objects.filter(status="phishing").count()
            safe_cnt      = URL.objects.filter(status="safe").count()
            suspicious_cnt= URL.objects.filter(status="suspicious").count()

        # User stats
        total_users      = User.objects.count()
        new_users_7d     = User.objects.filter(date_joined__gte=last_7d).count()
        registered_scans = URL.objects.filter(submitted_by__isnull=False).count()
        anon_scans       = URL.objects.filter(submitted_by__isnull=True).count()

        # Device breakdown (24h or lifetime fallback)
        device_qs = SiteVisit.objects.filter(timestamp__gte=last_24h)
        if not device_qs.exists():
            device_qs = SiteVisit.objects.all()

        device_breakdown = dict(
            device_qs.values_list("device_type")
            .annotate(cnt=Count("id"))
            .values_list("device_type", "cnt")
        )
        if not device_breakdown:
            device_breakdown = {"desktop": total_visits}

        # Top countries (24h or lifetime fallback)
        geo_qs = SiteVisit.objects.filter(timestamp__gte=last_24h, country__gt="")
        if not geo_qs.exists():
            geo_qs = SiteVisit.objects.filter(country__gt="")

        top_countries = list(
            geo_qs.values("country", "country_code")
            .annotate(cnt=Count("id"))
            .order_by("-cnt")[:10]
        )

        return Response({
            "visits": {
                "total":        total_visits,
                "last_24h":     visits_24h or total_visits,
                "unique_ips":   unique_ips_24h,
                "active_users": active_users_24h,
            },
            "scans": {
                "total":      total_scans,
                "last_24h":   scans_24h or total_scans,
                "phishing":   phishing_cnt,
                "safe":       safe_cnt,
                "suspicious": suspicious_cnt,
            },
            "users": {
                "total":            total_users,
                "new_last_7d":      new_users_7d,
                "registered_scans": registered_scans,
                "anonymous_scans":  anon_scans,
            },
            "devices":       device_breakdown,
            "top_countries": top_countries,
        })


class MonitoringLiveView(APIView):
    """GET /api/monitoring/live/ — Last 100 site visits (live feed)."""
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        limit = min(int(request.query_params.get("limit", 100)), 500)
        visits = SiteVisit.objects.select_related("user").order_by("-timestamp")[:limit]
        serializer = SiteVisitSerializer(visits, many=True)
        return Response({"results": serializer.data, "count": len(serializer.data)})


class MonitoringVisitorsView(APIView):
    """GET /api/monitoring/visitors/ — Paginated visitor list with filtering."""
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        qs = SiteVisit.objects.select_related("user").order_by("-timestamp")

        # Filters
        ip     = request.query_params.get("ip")
        user_q = request.query_params.get("user")
        path   = request.query_params.get("path")
        device = request.query_params.get("device")
        since  = request.query_params.get("since")

        if ip:
            qs = qs.filter(ip_address__icontains=ip)
        if user_q:
            qs = qs.filter(
                Q(user_email__icontains=user_q) | Q(user__username__icontains=user_q)
            )
        if path:
            qs = qs.filter(path__icontains=path)
        if device:
            qs = qs.filter(device_type=device)
        if since:
            try:
                from dateutil.parser import parse as parse_dt
                qs = qs.filter(timestamp__gte=parse_dt(since))
            except Exception:
                pass

        # Pagination
        page     = max(int(request.query_params.get("page", 1)), 1)
        per_page = min(int(request.query_params.get("per_page", 50)), 200)
        total    = qs.count()
        start    = (page - 1) * per_page
        end      = start + per_page

        serializer = SiteVisitSerializer(qs[start:end], many=True)
        return Response({
            "count":    total,
            "page":     page,
            "per_page": per_page,
            "pages":    (total + per_page - 1) // per_page,
            "results":  serializer.data,
        })


class MonitoringSearchesView(APIView):
    """GET /api/monitoring/searches/ — All URL scans with user info."""
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        qs = URL.objects.select_related("submitted_by", "scan_result").order_by("-date_submitted")

        # Filters
        user_q  = request.query_params.get("user")
        verdict = request.query_params.get("verdict")
        url_q   = request.query_params.get("url")
        anon    = request.query_params.get("anonymous")

        if user_q:
            qs = qs.filter(
                Q(submitted_by__email__icontains=user_q)
                | Q(submitted_by__username__icontains=user_q)
            )
        if verdict:
            qs = qs.filter(status=verdict)
        if url_q:
            qs = qs.filter(url__icontains=url_q)
        if anon == "true":
            qs = qs.filter(submitted_by__isnull=True)
        elif anon == "false":
            qs = qs.filter(submitted_by__isnull=False)

        # Pagination
        page     = max(int(request.query_params.get("page", 1)), 1)
        per_page = min(int(request.query_params.get("per_page", 50)), 200)
        total    = qs.count()
        start    = (page - 1) * per_page
        end      = start + per_page

        serializer = URLScanSerializer(qs[start:end], many=True)
        return Response({
            "count":    total,
            "page":     page,
            "per_page": per_page,
            "pages":    (total + per_page - 1) // per_page,
            "results":  serializer.data,
        })


class MonitoringUsersView(APIView):
    """GET /api/monitoring/users/ — Registered users with scan & activity stats."""
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        now = timezone.now()
        last_24h = now - timedelta(hours=24)
        last_7d  = now - timedelta(days=7)

        users = (
            User.objects.annotate(
                total_scans=Count("urls", distinct=True),
                scans_7d=Count(
                    "urls",
                    filter=Q(urls__date_submitted__gte=last_7d),
                    distinct=True,
                ),
                last_scan=Max("urls__date_submitted"),
                last_visit=Max("site_visits__timestamp"),
                total_visits=Count("site_visits", distinct=True),
            )
            .order_by("-last_visit", "-total_scans")
        )

        search_q = request.query_params.get("q")
        if search_q:
            users = users.filter(
                Q(email__icontains=search_q) | Q(username__icontains=search_q)
            )

        # Pagination
        page     = max(int(request.query_params.get("page", 1)), 1)
        per_page = min(int(request.query_params.get("per_page", 50)), 200)
        total    = users.count()
        start    = (page - 1) * per_page
        end      = start + per_page

        results = []
        for u in users[start:end]:
            results.append({
                "id":           u.id,
                "email":        u.email,
                "username":     u.username,
                "role":         u.role,
                "is_active":    u.is_active,
                "date_joined":  u.date_joined,
                "last_login":   u.last_login,
                "last_scan":    u.last_scan,
                "last_visit":   u.last_visit,
                "total_scans":  u.total_scans,
                "scans_7d":     u.scans_7d,
                "total_visits": u.total_visits,
            })

        return Response({
            "count":    total,
            "page":     page,
            "per_page": per_page,
            "pages":    (total + per_page - 1) // per_page,
            "results":  results,
        })


class MonitoringGeoView(APIView):
    """GET /api/monitoring/geo/ — Visitor count by country."""
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        days = int(request.query_params.get("days", 7))
        since = timezone.now() - timedelta(days=days)

        geo_qs = SiteVisit.objects.filter(timestamp__gte=since, country__gt="")
        if not geo_qs.exists():
            geo_qs = SiteVisit.objects.filter(country__gt="")

        geo = list(
            geo_qs.values("country", "country_code")
            .annotate(visits=Count("id"), unique_ips=Count("ip_address", distinct=True))
            .order_by("-visits")[:50]
        )
        return Response({"days": days, "results": geo})


class MonitoringTimelineView(APIView):
    """GET /api/monitoring/timeline/ — Hourly timeline."""
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        now   = timezone.now()
        since = now - timedelta(hours=24)

        visit_qs = (
            SiteVisit.objects.filter(timestamp__gte=since)
            .values_list("timestamp", flat=True)
        )
        scan_qs = (
            URL.objects.filter(date_submitted__gte=since)
            .values_list("date_submitted", flat=True)
        )

        # Group into hourly buckets
        visit_buckets = {}
        for ts in visit_qs:
            key = ts.strftime("%Y-%m-%dT%H:00")
            visit_buckets[key] = visit_buckets.get(key, 0) + 1

        scan_buckets = {}
        for ts in scan_qs:
            key = ts.strftime("%Y-%m-%dT%H:00")
            scan_buckets[key] = scan_buckets.get(key, 0) + 1

        # Build 24 hour labels
        timeline = []
        for h in range(24, 0, -1):
            bucket_time = now - timedelta(hours=h)
            key = bucket_time.strftime("%Y-%m-%dT%H:00")
            label = bucket_time.strftime("%H:00")
            timeline.append({
                "hour":   key,
                "label":  label,
                "visits": visit_buckets.get(key, 0),
                "scans":  scan_buckets.get(key, 0),
            })

        return Response({"timeline": timeline})


import os
from django.conf import settings
from django.http import HttpResponse
from rest_framework.permissions import AllowAny

class DashboardView(APIView):
    """GET /monitoring/ or /api/monitoring/dashboard/ — Serves the monitoring UI directly in the browser."""
    permission_classes = [AllowAny]

    def get(self, request):
        html_path = settings.BASE_DIR / "monitoring_dashboard.html"
        if os.path.exists(html_path):
            with open(html_path, "r", encoding="utf-8") as f:
                content = f.read()
            return HttpResponse(content, content_type="text/html")
        return Response({"error": "Dashboard HTML file not found"}, status=404)

