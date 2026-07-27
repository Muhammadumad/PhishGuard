import datetime
import hashlib
import ipaddress
import socket
import ssl
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

from django.core.cache import cache

try:
    from celery import shared_task
except ModuleNotFoundError:
    def shared_task(*decorator_args, **decorator_kwargs):
        def decorator(function):
            function.delay = function
            return function

        if decorator_args and callable(decorator_args[0]) and not decorator_kwargs:
            return decorator(decorator_args[0])
        return decorator

from .models import URL as URLModel, ScanResult, BlacklistedDomain
from .analyzer import extract_features, _load_thresholds


TRACKING_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "fbclid", "gclid", "msclkid", "ref", "referrer", "source",
    "_ga", "_gl", "mc_cid", "mc_eid",
}


def strip_tracking_params(url_str):
    try:
        parsed = urlparse(url_str)
        if not parsed.query:
            return url_str
        params = parse_qs(parsed.query, keep_blank_values=True)
        clean = {k: v for k, v in params.items() if k.lower() not in TRACKING_PARAMS}
        new_qs = urlencode(clean, doseq=True)
        return urlunparse(parsed._replace(query=new_qs))
    except Exception:
        return url_str


def _parse_cert_time(value):
    if not value:
        return None
    try:
        return datetime.datetime.strptime(value, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=datetime.timezone.utc)
    except Exception:
        return None


def _compute_verdict(score):
    suspicious_threshold, phishing_threshold = _load_thresholds()
    if score >= phishing_threshold:
        return "phishing"
    if score >= suspicious_threshold:
        return "suspicious"
    return "safe"


@shared_task(bind=True)
def process_url_scan(self, url_id, use_live_signals=True):
    """Background worker: analyze URL and persist ScanResult, update URL.status."""
    try:
        url_obj = URLModel.objects.get(id=url_id)
    except URLModel.DoesNotExist:
        return {"error": "URL not found", "url_id": url_id}

    # mark processing
    try:
        from django.utils import timezone
        url_obj.status = "processing"
        url_obj.processing_started_at = timezone.now()
        url_obj.save(update_fields=["status", "processing_started_at"])
    except Exception:
        pass

    raw_url = (url_obj.url or "").strip()
    normalized_url = raw_url if raw_url.lower().startswith("http") else "https://" + raw_url
    url_clean = strip_tracking_params(normalized_url)

    parsed = urlparse(url_clean)
    domain = (parsed.netloc or "").lower()
    domain = __import__('re').sub(r":\d+$", "", domain)
    bare_domain = __import__('re').sub(r"^www\.", "", domain)

    # blacklist match
    labels = [part for part in bare_domain.split(".") if part]
    candidates = [".".join(labels[i:]) for i in range(len(labels))] if labels else []
    blacklist_match = BlacklistedDomain.objects.filter(domain__in=candidates).order_by("-date_added").first()
    is_blacklisted = bool(blacklist_match)

    # cache key based on normalized URL
    normalized_for_cache = url_clean.strip().lower()
    cache_key = f"scan_v5:{hashlib.sha256(normalized_for_cache.encode()).hexdigest()}"
    cached = None
    try:
        cached = cache.get(cache_key)
    except Exception:
        cached = None

    if cached and not is_blacklisted:
        features = cached
    else:
        features = extract_features(url_clean)

        # optional live signals (DNS/TLS)
        if use_live_signals:
            cache_key_ls = f"live_signals:{(parsed.hostname or '').strip().lower()}:{parsed.scheme}"
            try:
                cached_ls = cache.get(cache_key_ls)
            except Exception:
                cached_ls = None
            if cached_ls is not None:
                risk_delta = int(cached_ls.get("risk_delta", 0))
                features["risk_score"] = min(100, int(features.get("risk_score", 0)) + risk_delta)
                features["confidence_score"] = float(features.get("risk_score", 0))
                features["reasons"] = list(features.get("reasons", [])) + list(cached_ls.get("reasons", []))
                features["verdict"] = _compute_verdict(features["risk_score"])
            else:
                # compute live signals
                reasons = []
                risk_delta = 0
                host = (parsed.hostname or "").strip().lower()
                if host:
                    try:
                        infos = socket.getaddrinfo(host, None)
                        ips = sorted({row[4][0] for row in infos if row and row[4]})
                        if ips:
                            private_hits = 0
                            for ip in ips:
                                try:
                                    ip_obj = ipaddress.ip_address(ip)
                                except ValueError:
                                    continue
                                if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local:
                                    private_hits += 1
                            if private_hits:
                                risk_delta += 12
                                reasons.append("Domain resolves to private or non-public IP space")
                    except Exception:
                        pass

                    if parsed.scheme == "https":
                        try:
                            context = ssl.create_default_context()
                            with socket.create_connection((host, 443), timeout=3) as sock:
                                with context.wrap_socket(sock, server_hostname=host) as tls_sock:
                                    cert = tls_sock.getpeercert()

                            not_before = _parse_cert_time(cert.get("notBefore"))
                            not_after = _parse_cert_time(cert.get("notAfter"))
                            now = datetime.datetime.now(datetime.timezone.utc)

                            if not_before and not_after:
                                cert_lifetime = (not_after - not_before).days
                                days_to_expiry = (not_after - now).days
                                if cert_lifetime <= 30:
                                    risk_delta += 8
                                    reasons.append("TLS certificate has very short validity window")
                                if days_to_expiry <= 7:
                                    risk_delta += 10
                                    reasons.append("TLS certificate is close to expiry")
                        except ssl.SSLCertVerificationError:
                            risk_delta += 18
                            reasons.append("TLS certificate verification failed")
                        except Exception:
                            pass

                if risk_delta > 0:
                    try:
                        cache.set(cache_key_ls, {"risk_delta": risk_delta, "reasons": reasons}, timeout=3600)
                    except Exception:
                        pass
                    features["risk_score"] = min(100, int(features.get("risk_score", 0)) + risk_delta)
                    features["confidence_score"] = float(features.get("risk_score", 0))
                    features["reasons"] = list(features.get("reasons", [])) + reasons
                    features["verdict"] = _compute_verdict(features["risk_score"])

        if is_blacklisted:
            features["verdict"] = "phishing"
            features["confidence_score"] = 100.0
            features["risk_score"] = 100
            features["scan_source"] = "blacklist"
            if not any("blacklist" in r.lower() for r in features.get("reasons", [])):
                matched_domain = blacklist_match.domain if blacklist_match else bare_domain
                feats_reasons = features.get("reasons", [])
                feats_reasons.insert(0, f"Domain '{bare_domain}' matches blacklisted domain '{matched_domain}'")
                features["reasons"] = feats_reasons

        try:
            cache.set(cache_key, features, timeout=86400)
        except Exception:
            pass

    # Persist ScanResult
    verdict_to_status = {"safe": "safe", "suspicious": "suspicious", "phishing": "phishing"}

    scan_result = ScanResult.objects.create(
        url=url_obj,
        url_length=features.get("url_length", 0),
        domain_length=features.get("domain_length", 0),
        path_length=features.get("path_length", 0),
        num_dots=features.get("num_dots", 0),
        num_hyphens=features.get("num_hyphens", 0),
        num_subdomains=features.get("num_subdomains", 0),
        num_query_params=features.get("num_query_params", 0),
        has_at_symbol=features.get("has_at_symbol", False),
        has_ip_address=features.get("has_ip_address", False),
        uses_https=features.get("uses_https", True),
        has_double_slash_redirect=features.get("has_double_slash_redirect", False),
        has_suspicious_tld=features.get("has_suspicious_tld", False),
        is_shortened=features.get("is_shortened", False),
        has_suspicious_keywords=features.get("has_suspicious_keywords", False),
        num_suspicious_keywords=features.get("num_suspicious_keywords", 0),
        has_hex_encoding=features.get("has_hex_encoding", False),
        has_punycode=features.get("has_punycode", False),
        verdict=features.get("verdict", "safe"),
        confidence_score=features.get("confidence_score", 0.0),
        risk_score=features.get("risk_score", 0),
        reasons=features.get("reasons", []),
    )

    # update URL status
    try:
        url_obj.status = verdict_to_status.get(scan_result.verdict, "pending")
        url_obj.save(update_fields=["status"])
    except Exception:
        pass

    # Update DB cache for dedupe
    try:
        from .models import CachedScan
        CachedScan.objects.update_or_create(
            normalized_hash=hashlib.sha256(normalized_for_cache.encode()).hexdigest(),
            defaults={
                "normalized_url": normalized_for_cache,
                "verdict": scan_result.verdict,
                "confidence_score": scan_result.confidence_score,
                "risk_score": scan_result.risk_score,
                "data": features,
                "reasons": scan_result.reasons,
            },
        )
    except Exception:
        pass

    return {"url_id": url_id, "verdict": scan_result.verdict, "risk_score": scan_result.risk_score}
