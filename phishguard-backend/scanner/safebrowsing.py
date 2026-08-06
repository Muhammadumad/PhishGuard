# scanner/safebrowsing.py — Google Safe Browsing API v4 Client
import hashlib
import os
import requests
import logging
from django.core.cache import cache

logger = logging.getLogger("scanner")

GSB_API_KEY = os.getenv("GOOGLE_SAFE_BROWSING_API_KEY", "").strip()
GSB_API_URL = "https://safebrowsing.googleapis.com/v4/threatMatches:find"
GSB_CACHE_TTL = int(os.getenv("GSB_CACHE_TTL", "3600"))
GSB_REQUEST_TIMEOUT = float(os.getenv("GSB_REQUEST_TIMEOUT", "2.0"))


def check_google_safe_browsing(url: str) -> dict:
    """
    Query Google Safe Browsing API v4 for threat matches.
    Threat types: MALWARE, SOCIAL_ENGINEERING, UNWANTED_SOFTWARE, POTENTIALLY_HARMFUL_APPLICATION.
    """
    if not GSB_API_KEY:
        return {"enabled": False, "reason": "Google Safe Browsing API key not configured"}

    url_hash = hashlib.sha256(url.encode("utf-8")).hexdigest()
    cache_key = f"gsb_scan_v1:{url_hash}"
    cached_result = cache.get(cache_key)
    if cached_result is not None:
        return cached_result

    payload = {
        "client": {
            "clientId": "phishguard-threat-intel",
            "clientVersion": "1.0.0",
        },
        "threatInfo": {
            "threatTypes": [
                "MALWARE",
                "SOCIAL_ENGINEERING",
                "UNWANTED_SOFTWARE",
                "POTENTIALLY_HARMFUL_APPLICATION",
            ],
            "platformTypes": ["ANY_PLATFORM"],
            "threatEntryTypes": ["URL"],
            "threatEntries": [{"url": url}],
        },
    }

    try:
        response = requests.post(
            f"{GSB_API_URL}?key={GSB_API_KEY}",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=GSB_REQUEST_TIMEOUT,
        )

        if response.status_code != 200:
            logger.warning(f"Google Safe Browsing API returned HTTP {response.status_code}")
            return {"enabled": True, "error": f"HTTP {response.status_code}"}

        data = response.json()
        matches = data.get("matches", [])

        if not matches:
            result = {
                "enabled": True,
                "flagged": False,
                "matches": [],
                "score_boost": 0,
                "reasons": [],
            }
            cache.set(cache_key, result, GSB_CACHE_TTL)
            return result

        threat_types = list({m.get("threatType") for m in matches if m.get("threatType")})
        reasons = []
        score_boost = 0

        if "SOCIAL_ENGINEERING" in threat_types:
            score_boost = 70
            reasons.append("Google Safe Browsing: Confirmed Social Engineering / Phishing site")
        elif "MALWARE" in threat_types:
            score_boost = 70
            reasons.append("Google Safe Browsing: Confirmed Malware distribution site")
        else:
            score_boost = 50
            reasons.append(f"Google Safe Browsing: Flagged threat ({', '.join(threat_types)})")

        result = {
            "enabled": True,
            "flagged": True,
            "matches": threat_types,
            "score_boost": score_boost,
            "reasons": reasons,
        }

        cache.set(cache_key, result, GSB_CACHE_TTL)
        return result

    except requests.exceptions.Timeout:
        logger.warning("Google Safe Browsing API request timed out")
        return {"enabled": True, "error": "Timeout"}
    except Exception as e:
        logger.error(f"Google Safe Browsing check error: {str(e)}")
        return {"enabled": True, "error": str(e)}
