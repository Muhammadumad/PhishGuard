# scanner/virustotal.py — VirusTotal v3 API Integration
import base64
import os
import requests
import logging
from django.core.cache import cache

logger = logging.getLogger("scanner")

VT_API_KEY = os.getenv("VIRUSTOTAL_API_KEY", "").strip()
VT_API_URL = "https://www.virustotal.com/api/v3/urls"
VT_CACHE_TTL = int(os.getenv("VT_CACHE_TTL", "3600"))  # Cache VT results for 1 hour
VT_REQUEST_TIMEOUT = float(os.getenv("VT_REQUEST_TIMEOUT", "2.5"))


def _url_to_vt_id(url: str) -> str:
    """Convert URL to VirusTotal base64 identifier format."""
    # VT v3 requires base64 without trailing '=' padding
    encoded = base64.urlsafe_b64encode(url.encode("utf-8")).decode("utf-8")
    return encoded.rstrip("=")


def check_virustotal(url: str) -> dict:
    """
    Query VirusTotal API v3 for URL analysis results.
    Returns dict with stats, malicous_count, suspicious_count, score_boost, and reasons.
    """
    if not VT_API_KEY:
        return {"enabled": False, "reason": "VirusTotal API key not configured"}

    cache_key = f"vt_scan_v1:{hashlib_sha256(url)}"
    cached_result = cache.get(cache_key)
    if cached_result is not None:
        return cached_result

    try:
        vt_id = _url_to_vt_id(url)
        headers = {
            "x-apikey": VT_API_KEY,
            "Accept": "application/json",
        }

        response = requests.get(
            f"{VT_API_URL}/{vt_id}",
            headers=headers,
            timeout=VT_REQUEST_TIMEOUT,
        )

        if response.status_code == 404:
            result = {
                "enabled": True,
                "found": False,
                "malicious": 0,
                "suspicious": 0,
                "harmless": 0,
                "undetected": 0,
                "score_boost": 0,
                "reasons": [],
            }
            cache.set(cache_key, result, VT_CACHE_TTL)
            return result

        if response.status_code != 200:
            logger.warning(f"VirusTotal API returned HTTP {response.status_code}")
            return {"enabled": True, "error": f"HTTP {response.status_code}"}

        data = response.json().get("data", {})
        attributes = data.get("attributes", {})
        stats = attributes.get("last_analysis_stats", {})

        malicious = stats.get("malicious", 0)
        suspicious = stats.get("suspicious", 0)
        harmless = stats.get("harmless", 0)
        total_engines = sum(stats.values()) or 1

        score_boost = 0
        reasons = []

        if malicious > 0:
            # Scale score boost according to engine detection ratio
            score_boost += min(60, 30 + (malicious * 10))
            reasons.append(f"VirusTotal: Flagged malicious by {malicious}/{total_engines} security vendors")
        elif suspicious > 0:
            score_boost += min(35, 15 + (suspicious * 8))
            reasons.append(f"VirusTotal: Flagged suspicious by {suspicious}/{total_engines} security vendors")

        result = {
            "enabled": True,
            "found": True,
            "malicious": malicious,
            "suspicious": suspicious,
            "harmless": harmless,
            "total_engines": total_engines,
            "score_boost": score_boost,
            "reasons": reasons,
            "scan_date": attributes.get("last_analysis_date"),
        }

        cache.set(cache_key, result, VT_CACHE_TTL)
        return result

    except requests.exceptions.Timeout:
        logger.warning("VirusTotal API request timed out")
        return {"enabled": True, "error": "Timeout"}
    except Exception as e:
        logger.error(f"VirusTotal check error: {str(e)}")
        return {"enabled": True, "error": str(e)}


def hashlib_sha256(text: str) -> str:
    import hashlib
    return hashlib.sha256(text.encode("utf-8")).hexdigest()
