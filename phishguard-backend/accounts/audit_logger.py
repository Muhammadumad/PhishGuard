# accounts/audit_logger.py — Centralized Enterprise Audit Logger
import logging
from typing import Any
from django.conf import settings

logger = logging.getLogger("accounts")


def extract_client_ip(request) -> str | None:
    """Extract client IP address handling X-Forwarded-For proxy headers."""
    if not request or not hasattr(request, "META"):
        return None
    
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        ip = x_forwarded_for.split(",")[0].strip()
        if ip:
            return ip
    
    return request.META.get("REMOTE_ADDR")


def log_audit_event(
    request=None,
    category: str = "system",
    event_type: str = "general_action",
    severity: str = "info",
    status: str = "success",
    target: str = "",
    details: dict[str, Any] | None = None,
    user=None,
):
    """
    Centralized, fail-safe audit logging helper.
    Records security, scan, administrative, and account activities to AuditLog database.
    Executing within an isolated try-except block guarantees audit logging never breaks API execution.
    """
    try:
        from .models import AuditLog

        current_user = user
        if not current_user and request and hasattr(request, "user") and request.user and request.user.is_authenticated:
            current_user = request.user

        user_email = ""
        user_role = ""
        if current_user:
            user_email = getattr(current_user, "email", "") or ""
            user_role = getattr(current_user, "role", "") or ""

        ip_address = extract_client_ip(request) if request else None
        user_agent = (request.META.get("HTTP_USER_AGENT", "")[:300]) if (request and hasattr(request, "META")) else ""
        request_path = (request.path[:255]) if (request and hasattr(request, "path")) else ""
        request_method = (request.method[:10]) if (request and hasattr(request, "method")) else ""

        AuditLog.objects.create(
            category=category,
            event_type=event_type,
            severity=severity,
            status=status,
            user=current_user if (current_user and getattr(current_user, "pk", None)) else None,
            user_email=user_email,
            user_role=user_role,
            ip_address=ip_address,
            user_agent=user_agent,
            request_path=request_path,
            request_method=request_method,
            target_resource=str(target)[:255] if target else "",
            details=details or {},
        )
    except Exception as e:
        logger.warning(f"AuditLog failed to record event '{event_type}': {str(e)}")
