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

from .models import SecurityEvent

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


def _safe_log(event_type, **kwargs):
    """Log a security event — silently swallow all errors so logging never breaks the API."""
    try:
        SecurityEvent.objects.create(event_type=event_type, **kwargs)
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