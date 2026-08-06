# accounts/authentication.py — DRF API Key Authentication
import hashlib
from django.utils import timezone
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from .models import APIKey


class APIKeyAuthentication(BaseAuthentication):
    """
    Allows authentication via `X-API-Key` header or `Authorization: Api-Key <raw_key>`.
    Example:
        X-API-Key: pg_live_9f83a21b4e5c...
    """

    def authenticate(self, request):
        raw_key = request.headers.get("X-API-Key")
        if not raw_key:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Api-Key "):
                raw_key = auth_header.split("Api-Key ")[1].strip()

        if not raw_key:
            return None  # Pass to next authentication class (SimpleJWT)

        prefix = raw_key[:12]
        key_hash = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

        try:
            api_key = APIKey.objects.select_related("user").get(
                key_prefix=prefix,
                key_hash=key_hash,
                is_active=True,
            )
        except APIKey.DoesNotExist:
            raise AuthenticationFailed("Invalid or inactive API key")

        if not api_key.user.is_active:
            raise AuthenticationFailed("User account disabled")

        # Touch last_used_at asynchronously / non-blocking
        try:
            api_key.last_used_at = timezone.now()
            api_key.save(update_fields=["last_used_at"])
        except Exception:
            pass

        return (api_key.user, api_key)
