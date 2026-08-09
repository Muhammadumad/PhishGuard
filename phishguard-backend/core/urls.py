# core/urls.py
import logging
import time
import hashlib
from django.contrib import admin
from django.conf import settings
from django.core.cache import cache
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from django.contrib.auth import authenticate
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

from accounts.models import SecurityEvent

logger = logging.getLogger("accounts")


class LoginView(APIView):
    """
    Simple login view — accepts email + password directly.
    No serializer complexity. Just works.
    """
    permission_classes = [AllowAny]
    throttle_scope = "login"

    @staticmethod
    def _client_ip(request):
        xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
        if xff:
            return xff.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "unknown")

    @staticmethod
    def _lock_key(email, ip):
        # Avoid storing raw account identifiers in cache keys.
        material = f"{email.lower()}|{ip}".encode("utf-8")
        digest = hashlib.sha256(material).hexdigest()
        return f"auth_lock:{digest}"

    @staticmethod
    def _remaining_lock_seconds(state, now_ts):
        lock_until = float(state.get("lock_until", 0))
        if lock_until <= now_ts:
            return 0
        return int(lock_until - now_ts)

    def _is_locked(self, key):
        now_ts = time.time()
        state = cache.get(key) or {}
        remaining = self._remaining_lock_seconds(state, now_ts)
        return remaining > 0, remaining

    def _record_failed_attempt(self, key):
        now_ts = time.time()
        window_seconds = max(60, int(getattr(settings, "LOGIN_LOCKOUT_WINDOW_SECONDS", 900)))
        lock_seconds = max(60, int(getattr(settings, "LOGIN_LOCKOUT_SECONDS", 900)))
        threshold = max(1, int(getattr(settings, "LOGIN_LOCKOUT_THRESHOLD", 5)))

        state = cache.get(key) or {}
        reset_at = float(state.get("reset_at", 0))
        if now_ts >= reset_at:
            state = {
                "count": 0,
                "reset_at": now_ts + window_seconds,
                "lock_until": 0,
            }

        state["count"] = int(state.get("count", 0)) + 1
        if state["count"] >= threshold:
            state["lock_until"] = now_ts + lock_seconds

        ttl = int(max(state.get("reset_at", now_ts), state.get("lock_until", now_ts)) - now_ts) + 5
        cache.set(key, state, timeout=max(60, ttl))
        return self._remaining_lock_seconds(state, now_ts)

    @staticmethod
    def _clear_lock_state(key):
        cache.delete(key)

    def _record_event(self, event_type, *, request, email, username="", success=False, details=None, user=None):
        ip = self._client_ip(request)
        try:
            SecurityEvent.objects.create(
                event_type=event_type,
                email=email,
                username=username,
                ip_address=ip,
                user=user,
                success=success,
                details=details or {},
            )
        except Exception:
            logger.exception("Failed to record security event: %s", event_type)

    def post(self, request):
        email    = (request.data.get("email") or request.data.get("username") or "").strip()
        password = (request.data.get("password") or "")

        ip = self._client_ip(request)
        lock_key = self._lock_key(email, ip)
        locked, remaining = self._is_locked(lock_key)
        if locked:
            wait_minutes = max(1, (remaining + 59) // 60)
            self._record_event(
                "login_locked",
                request=request,
                email=email,
                success=False,
                details={"remaining_seconds": remaining},
            )
            return Response(
                {"error": f"Too many failed login attempts. Try again in {wait_minutes} minute(s)."},
                status=429,
            )

        if not email or not password:
            return Response({"error": "Email and password are required"}, status=400)

        # authenticate() works with USERNAME_FIELD = "email"
        user = authenticate(request, username=email, password=password)

        if user is None:
            remaining = self._record_failed_attempt(lock_key)
            logger.warning("Login failed for provided identity from ip=%s", ip)
            self._record_event(
                "login_failed",
                request=request,
                email=email,
                success=False,
                details={"remaining_seconds": remaining},
            )
            if remaining > 0:
                wait_minutes = max(1, (remaining + 59) // 60)
                return Response(
                    {"error": f"Too many failed login attempts. Try again in {wait_minutes} minute(s)."},
                    status=429,
                )
            return Response({"detail": "No active account found with the given credentials"}, status=401)

        # Generate JWT tokens manually
        refresh = RefreshToken.for_user(user)
        self._clear_lock_state(lock_key)
        logger.info("Login successful for user_id=%s", user.id)
        self._record_event(
            "login_success",
            request=request,
            email=user.email,
            username=user.username,
            success=True,
            user=user,
        )

        return Response({
            "access":  str(refresh.access_token),
            "refresh": str(refresh),
        })


from django.http import JsonResponse

def health_check(request):
    return JsonResponse({"status": "ok", "service": "phishguard-api"})

urlpatterns = [
    # Health check — no auth required
    path("health/",            health_check),
    path("api/health/",        health_check),

    # Django Admin
    path("admin/",             admin.site.urls),
    
    # Authentication
    path("api/token/",         LoginView.as_view(),       name="token_obtain"),
    path("api/token",          LoginView.as_view()),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/token/refresh",  TokenRefreshView.as_view()),
    
    # API Documentation (drf-spectacular)
    path("api/schema/",        SpectacularAPIView.as_view(),        name="schema"),
    path("api/docs/",          SpectacularSwaggerView.as_view(url_name="schema"),     name="swagger-ui"),
    path("api/redoc/",         SpectacularRedocView.as_view(url_name="schema"),       name="redoc"),
    
    # App URLs
    path("api/accounts/",    include("accounts.urls")),
    path("api/scanner/",     include("scanner.urls")),
    path("api/reports/",     include("reports.urls")),
    path("api/monitoring/",  include("monitoring.urls")),  # ← Admin monitoring
    path("api/",             include("accounts.urls")),
    path("api/",             include("scanner.urls")),
]