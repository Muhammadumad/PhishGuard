# accounts/error_monitoring.py
"""
Fail-safe Error Capture Engine for PhishGuard.
Captures unhandled exceptions and logs them into the database without crashing the application.
"""
import traceback
import logging
from accounts.audit_logger import extract_client_ip

logger = logging.getLogger("accounts.error_monitoring")


def capture_exception(exc, request=None, severity="error", status_code=500, extra=None):
    """
    Captures an exception and records it into the `ErrorLog` database table.
    Swallows all exceptions inside the logger itself so monitoring never breaks APIs.
    """
    try:
        from accounts.models import ErrorLog
        
        tb_str = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__)) if exc.__traceback__ else str(exc)
        exc_class = type(exc).__name__
        msg = str(exc) or exc_class
        
        path = ""
        method = "GET"
        user = None
        user_email = ""
        ip = ""
        ua = ""

        if request is not None:
            path = getattr(request, "path", "")[:255]
            method = getattr(request, "method", "GET")
            ip = extract_client_ip(request)
            
            # User Agent
            meta = getattr(request, "META", {})
            ua = meta.get("HTTP_USER_AGENT", "")[:500] if meta else ""
            
            # User info
            req_user = getattr(request, "user", None)
            if req_user and getattr(req_user, "is_authenticated", False):
                user = req_user
                user_email = getattr(req_user, "email", "") or getattr(req_user, "username", "")

        error_entry = ErrorLog.objects.create(
            exception_class=exc_class,
            message=msg,
            traceback=tb_str,
            severity=severity,
            status_code=status_code,
            request_path=path,
            request_method=method,
            user=user,
            user_email=user_email,
            ip_address=ip or None,
            user_agent=ua,
            extra_data=extra or {},
        )
        logger.info("Captured ErrorLog ID=%s class=%s path=%s", error_entry.id, exc_class, path)
        return error_entry

    except Exception as e:
        logger.exception("Failed to record error log entry: %s", e)
        return None
