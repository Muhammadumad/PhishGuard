# core/exception_handler.py
"""
Global DRF exception handler.
Ensures ALL errors — including unexpected 500s — return JSON, never HTML.
"""
import traceback
import logging

from rest_framework.views import exception_handler
from rest_framework.response import Response

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    request = context.get("request") if context else None

    # First, try DRF's built-in handler (handles APIException, AuthenticationFailed, etc.)
    response = exception_handler(exc, context)

    if response is not None:
        # DRF handled it — make sure the body is always {"error": "..."} shaped
        if not isinstance(response.data, dict):
            response.data = {"error": str(response.data)}
        elif "detail" in response.data and "error" not in response.data:
            response.data["error"] = str(response.data["detail"])
        return response

    # DRF did NOT handle it — this is an unexpected server error (Python exception)
    from accounts.error_monitoring import capture_exception
    capture_exception(exc, request=request, severity="critical", status_code=500)

    logger.exception("Unhandled exception in view: %s", exc)
    traceback.print_exc()

    return Response(
        {"error": f"Internal server error: {type(exc).__name__}: {exc}"},
        status=500,
    )
