# core/middleware.py
"""
PhishGuard Middleware Layer
1. ErrorMonitoringMiddleware  — captures unhandled 500/502/503 errors
2. RequestTrackingMiddleware  — logs every HTTP request into SiteVisit table
                                (runs in a background thread, never blocks the response)
"""
import time
import logging
import threading
import re

from accounts.error_monitoring import capture_exception

logger = logging.getLogger("core.middleware")

# ── Simple User-Agent parser (no external dependency) ─────────────────────────
_BOT_PATTERNS = re.compile(
    r"(bot|crawl|spider|slurp|mediapartners|facebookexternalhit|WhatsApp|Twitterbot"
    r"|LinkedInBot|Googlebot|Bingbot|YandexBot|DuckDuckBot|Baiduspider"
    r"|Sogou|Exabot|ia_archiver)",
    re.IGNORECASE,
)

def _parse_ua(ua: str) -> dict:
    """Extract browser, OS, and device type from a User-Agent string."""
    if not ua:
        return {"browser": "", "os": "", "device_type": "unknown"}

    # Detect bots first
    if _BOT_PATTERNS.search(ua):
        return {"browser": "Bot", "os": "", "device_type": "bot"}

    # Device type
    if re.search(r"(iPhone|Android.*Mobile|Windows Phone|BlackBerry|IEMobile)", ua, re.I):
        device_type = "mobile"
    elif re.search(r"(iPad|Android(?!.*Mobile)|Tablet|PlayBook|Silk)", ua, re.I):
        device_type = "tablet"
    else:
        device_type = "desktop"

    # Browser
    if re.search(r"Edg/", ua):
        browser = "Edge"
    elif re.search(r"OPR/|Opera", ua):
        browser = "Opera"
    elif re.search(r"Chrome/", ua) and "Chromium" not in ua:
        browser = "Chrome"
    elif re.search(r"Firefox/", ua):
        browser = "Firefox"
    elif re.search(r"Safari/", ua) and "Chrome" not in ua:
        browser = "Safari"
    elif re.search(r"MSIE|Trident", ua):
        browser = "IE"
    else:
        browser = "Other"

    # OS
    if re.search(r"Windows NT", ua):
        os_name = "Windows"
    elif re.search(r"Mac OS X", ua):
        os_name = "macOS"
    elif re.search(r"Android", ua):
        os_name = "Android"
    elif re.search(r"iPhone OS|iOS", ua):
        os_name = "iOS"
    elif re.search(r"Linux", ua):
        os_name = "Linux"
    else:
        os_name = "Other"

    return {"browser": browser, "os": os_name, "device_type": device_type}


# ── Async Geo Lookup ──────────────────────────────────────────────────────────
def _fetch_geo(ip: str, visit_id: int):
    """
    Called in a background thread.
    Fetches country/city from ip-api.com (free, no key needed) and
    updates the SiteVisit row.
    """
    if not ip or ip in ("127.0.0.1", "::1", "localhost"):
        return
    try:
        import urllib.request, json
        url = f"http://ip-api.com/json/{ip}?fields=status,country,countryCode,regionName,city,isp"
        with urllib.request.urlopen(url, timeout=3) as resp:
            data = json.loads(resp.read())
        if data.get("status") == "success":
            from accounts.models import SiteVisit
            SiteVisit.objects.filter(pk=visit_id).update(
                country=data.get("country", ""),
                country_code=data.get("countryCode", ""),
                region=data.get("regionName", ""),
                city=data.get("city", ""),
                isp=data.get("isp", ""),
            )
    except Exception:
        pass  # Never crash on geo lookup failure


# ── Paths to skip tracking ─────────────────────────────────────────────────────
_SKIP_PREFIXES = (
    "/static/", "/staticfiles/", "/favicon.ico",
    "/admin/jsi18n/", "/admin/autocomplete/",
    "/__debug__/",
)

def _should_skip(path: str) -> bool:
    return any(path.startswith(p) for p in _SKIP_PREFIXES)


# ── Background DB writer ───────────────────────────────────────────────────────
def _save_visit(data: dict):
    """Runs in a background thread — writes the SiteVisit row, never blocks."""
    try:
        from accounts.models import SiteVisit
        visit = SiteVisit.objects.create(**data)
        # Kick off geo-lookup in yet another thread
        if data.get("ip_address") and data["ip_address"] not in ("127.0.0.1", "::1"):
            threading.Thread(
                target=_fetch_geo,
                args=(data["ip_address"], visit.pk),
                daemon=True,
            ).start()
    except Exception:
        logger.exception("RequestTrackingMiddleware: failed to save SiteVisit")


# ── Middleware classes ─────────────────────────────────────────────────────────
class ErrorMonitoringMiddleware:
    """
    Captures unhandled 500/502/503 HTTP errors and unhandled exceptions
    at the middleware level.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            response = self.get_response(request)
        except Exception as exc:
            capture_exception(exc, request=request, severity="critical", status_code=500)
            raise exc

        # Also capture 5xx server responses generated by non-DRF Django views
        if response.status_code >= 500:
            capture_exception(
                Exception(f"HTTP {response.status_code} Server Error"),
                request=request,
                severity="error",
                status_code=response.status_code,
                extra={"status_code": response.status_code},
            )

        return response


class RequestTrackingMiddleware:
    """
    Silently records every HTTP request into the `site_visits` table.
    Runs DB writes in a daemon thread so the user never waits for it.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    @staticmethod
    def _get_ip(request) -> str:
        xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
        if xff:
            return xff.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "") or ""

    def __call__(self, request):
        if _should_skip(request.path):
            return self.get_response(request)

        start = time.time()
        response = self.get_response(request)
        elapsed_ms = int((time.time() - start) * 1000)

        try:
            ua = request.META.get("HTTP_USER_AGENT", "")
            ua_info = _parse_ua(ua)
            ip = self._get_ip(request)

            # Resolve user info
            user = None
            user_email = ""
            if hasattr(request, "user") and request.user and request.user.is_authenticated:
                user = request.user
                user_email = request.user.email

            session_key = ""
            try:
                if hasattr(request, "session") and request.session.session_key:
                    session_key = str(request.session.session_key)[:64]
            except Exception:
                pass

            data = {
                "user":        user,
                "user_email":  user_email,
                "session_key": session_key,
                "ip_address":  ip or None,
                "path":        request.path[:500],
                "method":      request.method[:10],
                "status_code": response.status_code,
                "response_ms": elapsed_ms,
                "user_agent":  ua[:1000],
                "browser":     ua_info["browser"],
                "os":          ua_info["os"],
                "device_type": ua_info["device_type"],
                "referer":     request.META.get("HTTP_REFERER", "")[:500],
                # Geo fields are filled in later by _fetch_geo()
                "country":     "",
                "country_code": "",
                "city":        "",
                "region":      "",
                "isp":         "",
            }

            threading.Thread(target=_save_visit, args=(data,), daemon=True).start()

        except Exception:
            logger.exception("RequestTrackingMiddleware: error building visit data")

        return response
