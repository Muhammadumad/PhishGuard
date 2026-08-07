# scanner/views.py — v4 upgrade
# Changes vs original:
#  + ScanDetailView — GET /api/scan/<id>/ for URL detail page
#  + scan_source field saved to ScanResult
#  + Better error messages (URL too long vs invalid format)
#  + URL normalization strips common tracking params before scanning
#  + StatsView returns threat_rate percentage too
import datetime
import csv
import hashlib
import ipaddress
import io
import re
import socket
import ssl
import traceback
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse
from django.db.models import Count, Q
from django.utils import timezone
from django.core.cache import cache

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status

from .models import URL, ScanResult, BlacklistedDomain, CachedScan
from .serializers import URLSerializer, BlacklistSerializer
from .analyzer import extract_features, _load_thresholds
from .tasks import process_url_scan

BULK_SCAN_MAX_URLS = 100
LIVE_SIGNAL_CACHE_TTL = 3600

# Keep the default scan path fast. Live DNS/TLS enrichment stays opt-in.
ENABLE_LIVE_SIGNALS = False

# ── Tracking params to strip before scanning ──────────────────────────────────
TRACKING_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "fbclid", "gclid", "msclkid", "ref", "referrer", "source",
    "_ga", "_gl", "mc_cid", "mc_eid",
}


def _as_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)

def strip_tracking_params(url_str):
    """Remove common tracking query params from URL before analysis."""
    try:
        parsed = urlparse(url_str)
        if not parsed.query:
            return url_str
        params = parse_qs(parsed.query, keep_blank_values=True)
        clean  = {k: v for k, v in params.items() if k.lower() not in TRACKING_PARAMS}
        new_qs = urlencode(clean, doseq=True)
        return urlunparse(parsed._replace(query=new_qs))
    except Exception:
        return url_str


def find_blacklisted_domain_match(bare_domain):
    """Match exact domain or any parent domain present in blacklist."""
    cache_key = f"blacklist_match:{bare_domain}"
    try:
        cached = cache.get(cache_key)
    except Exception:
        cached = None
    if cached is not None:
        return cached

    labels = [part for part in bare_domain.split(".") if part]
    if not labels:
        return None

    candidates = [".".join(labels[i:]) for i in range(len(labels))]
    match = BlacklistedDomain.objects.filter(domain__in=candidates).order_by("-date_added").first()

    try:
        cache.set(cache_key, match, timeout=LIVE_SIGNAL_CACHE_TTL)
    except Exception:
        pass

    return match


def _parse_cert_time(value):
    """Parse cert date values returned by ssl.getpeercert()."""
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


def enrich_with_live_network_signals(url_clean, features):
    """
    Add optional DNS/TLS risk signals with fail-open behavior.
    No penalties are applied if network checks are unavailable.
    """
    parsed = urlparse(url_clean)
    host = (parsed.hostname or "").strip().lower()
    if not host:
        return features

    cache_key = f"live_signals:{host}:{parsed.scheme}"
    try:
        cached = cache.get(cache_key)
    except Exception:
        cached = None
    if cached is not None:
        updated = dict(features)
        risk_delta = int(cached.get("risk_delta", 0))
        updated["risk_score"] = min(100, int(updated.get("risk_score", 0)) + risk_delta)
        updated["confidence_score"] = float(updated["risk_score"])
        updated["reasons"] = list(updated.get("reasons", [])) + list(cached.get("reasons", []))
        updated["verdict"] = _compute_verdict(updated["risk_score"])
        return updated

    reasons = []
    risk_delta = 0

    # DNS signal: if host resolves to private/loopback/link-local IPs.
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

    # TLS signal: certificate quality/validity checks for HTTPS endpoints.
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

    if risk_delta <= 0:
        return features

    try:
        cache.set(cache_key, {"risk_delta": risk_delta, "reasons": reasons}, timeout=LIVE_SIGNAL_CACHE_TTL)
    except Exception:
        pass

    updated = dict(features)
    base_reasons = list(updated.get("reasons", []))
    updated["risk_score"] = min(100, int(updated.get("risk_score", 0)) + risk_delta)
    updated["confidence_score"] = float(updated["risk_score"])
    updated["reasons"] = base_reasons + reasons
    updated["verdict"] = _compute_verdict(updated["risk_score"])
    return updated


def _normalize_scan_input(raw_url):
    raw_url = (raw_url or "").strip()
    if not raw_url:
        return None, None, "URL is required"
    if len(raw_url) > 2000:
        return None, None, "URL too long — maximum 2000 characters"

    normalized_url = raw_url if re.match(r"^https?://", raw_url, re.I) else "https://" + raw_url
    url_clean = strip_tracking_params(normalized_url)
    return raw_url, url_clean, None


def _scan_single_url(request, raw_url, use_live_signals=True):
    """Scan one URL and persist URL + ScanResult rows."""
    raw_url, url_clean, error = _normalize_scan_input(raw_url)
    if error:
        return {"error": error, "input_url": raw_url}

    parsed = urlparse(url_clean)
    domain = parsed.netloc.lower()
    domain = re.sub(r":\d+$", "", domain)
    bare_domain = re.sub(r"^www\.", "", domain)

    blacklist_match = find_blacklisted_domain_match(bare_domain)
    is_blacklisted = bool(blacklist_match)

    normalized_for_cache = url_clean.strip().lower()
    normalized_hash = hashlib.sha256(normalized_for_cache.encode()).hexdigest()

    # Try DB-level cached scan first (freshness controlled by TTL)
    features = None
    try:
        cached_scan = CachedScan.objects.filter(normalized_hash=normalized_hash).first()
        if cached_scan and not is_blacklisted:
            # Treat DB cache as authoritative; translate stored data into features
            features = cached_scan.data
            features.setdefault("verdict", cached_scan.verdict)
            features.setdefault("confidence_score", cached_scan.confidence_score)
            features.setdefault("risk_score", cached_scan.risk_score)
            features.setdefault("reasons", cached_scan.reasons or [])
    except Exception:
        cached_scan = None

    if not features:
        # Fall back to in-process cache/compute
        cache_key = f"scan_v5:{normalized_hash}"
        cached = None
        try:
            cached = cache.get(cache_key)
        except Exception:
            pass

        if cached and not is_blacklisted:
            features = cached
        else:
            features = extract_features(url_clean)
            if use_live_signals:
                features = enrich_with_live_network_signals(url_clean, features)
            if is_blacklisted:
                features["verdict"] = "phishing"
                features["confidence_score"] = 100.0
                features["risk_score"] = 100
                features["scan_source"] = "blacklist"
                if not any("blacklist" in r.lower() for r in features["reasons"]):
                    matched_domain = blacklist_match.domain if blacklist_match else bare_domain
                    features["reasons"].insert(0, f"Domain '{bare_domain}' matches blacklisted domain '{matched_domain}'")
            try:
                cache.set(cache_key, features, timeout=86400)
            except Exception:
                pass

    user = request.user if (hasattr(request, "user") and request.user and request.user.is_authenticated) else None
    verdict_to_status = {"safe": "safe", "suspicious": "suspicious", "phishing": "phishing"}
    url_obj = URL.objects.create(
        url=raw_url,
        normalized_url=url_clean,
        normalized_hash=normalized_hash,
        submitted_by=user,
        status=verdict_to_status.get(features["verdict"], "pending"),
    )

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
        verdict=features["verdict"],
        confidence_score=features["confidence_score"],
        risk_score=features["risk_score"],
        reasons=features["reasons"],
    )

    payload = URLSerializer(url_obj).data
    payload["scan_result"] = URLSerializer(url_obj).data.get("scan_result")
    payload["input_url"] = raw_url
    payload["normalized_url"] = url_clean
    payload["risk_score"] = scan_result.risk_score
    payload["verdict"] = scan_result.verdict
    payload["reasons"] = scan_result.reasons
    return payload


def _scan_urls_batch(request, urls, use_live_signals=True):
    """Scan a list of URLs using the same persistence path as single scans."""
    results = []
    cache_by_normalized = {}
    created = 0
    duplicate_count = 0
    failed = 0
    user = request.user if (hasattr(request, "user") and request.user and request.user.is_authenticated) else None

    for index, raw_url in enumerate(urls):
        raw_url_str = "" if raw_url is None else str(raw_url)
        _, url_clean, error = _normalize_scan_input(raw_url_str)
        if error:
            failed += 1
            results.append({
                "index": index,
                "input_url": raw_url_str,
                "error": error,
            })
            continue

        normalized_key = url_clean.strip().lower()
        if normalized_key in cache_by_normalized:
            duplicate_count += 1
            duplicate_result = dict(cache_by_normalized[normalized_key])
            duplicate_result["index"] = index
            duplicate_result["duplicate"] = True
            results.append(duplicate_result)
            continue

        # Compute hash and check DB-level cached scan
        normalized_hash = hashlib.sha256(normalized_key.encode()).hexdigest()
        try:
            cached_scan = CachedScan.objects.filter(normalized_hash=normalized_hash).first()
        except Exception:
            cached_scan = None

        if cached_scan:
            # Create URL + ScanResult immediately from cached data
            try:
                url_obj = URL.objects.create(
                    url=raw_url_str,
                    normalized_url=url_clean,
                    normalized_hash=normalized_hash,
                    submitted_by=user,
                    status={"safe":"safe","suspicious":"suspicious","phishing":"phishing"}.get(cached_scan.verdict, "pending"),
                )

                scan_result = ScanResult.objects.create(
                    url=url_obj,
                    url_length=cached_scan.data.get("url_length", 0),
                    domain_length=cached_scan.data.get("domain_length", 0),
                    path_length=cached_scan.data.get("path_length", 0),
                    num_dots=cached_scan.data.get("num_dots", 0),
                    num_hyphens=cached_scan.data.get("num_hyphens", 0),
                    num_subdomains=cached_scan.data.get("num_subdomains", 0),
                    num_query_params=cached_scan.data.get("num_query_params", 0),
                    has_at_symbol=cached_scan.data.get("has_at_symbol", False),
                    has_ip_address=cached_scan.data.get("has_ip_address", False),
                    uses_https=cached_scan.data.get("uses_https", True),
                    has_double_slash_redirect=cached_scan.data.get("has_double_slash_redirect", False),
                    has_suspicious_tld=cached_scan.data.get("has_suspicious_tld", False),
                    is_shortened=cached_scan.data.get("is_shortened", False),
                    has_suspicious_keywords=cached_scan.data.get("has_suspicious_keywords", False),
                    num_suspicious_keywords=cached_scan.data.get("num_suspicious_keywords", 0),
                    has_hex_encoding=cached_scan.data.get("has_hex_encoding", False),
                    has_punycode=cached_scan.data.get("has_punycode", False),
                    verdict=cached_scan.verdict,
                    confidence_score=cached_scan.confidence_score,
                    risk_score=cached_scan.risk_score,
                    reasons=cached_scan.reasons,
                )

                payload = URLSerializer(url_obj).data
                payload["scan_result"] = ScanResult.objects.filter(url=url_obj).values().first()
                payload["input_url"] = raw_url_str
                payload["normalized_url"] = url_clean

                created += 1
                payload["index"] = index
                payload["duplicate"] = False
                cache_by_normalized[normalized_key] = payload
                results.append(payload)
                continue
            except Exception:
                # fall through to enqueue path if persistence fails
                pass

        # Not cached in DB: create queued URL and enqueue worker
        try:
            url_obj = URL.objects.create(
                url=raw_url_str,
                normalized_url=url_clean,
                normalized_hash=normalized_hash,
                submitted_by=user,
                status="queued",
            )
            try:
                process_url_scan.delay(url_obj.id, use_live_signals)
            except Exception:
                url_obj.status = "pending"
                url_obj.save(update_fields=["status"]) 

            payload = URLSerializer(url_obj).data
            payload["input_url"] = raw_url_str
            payload["normalized_url"] = url_clean
            payload["index"] = index
            payload["duplicate"] = False
            created += 1
            cache_by_normalized[normalized_key] = payload
            results.append(payload)
        except Exception:
            failed += 1
            results.append({
                "index": index,
                "input_url": raw_url_str,
                "error": "Failed to queue scan",
            })

    return {
        "total": len(urls),
        "created": created,
        "duplicates": duplicate_count,
        "failed": failed,
        "results": results,
    }


# ── Scan ──────────────────────────────────────────────────────────────────────
class ScanView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            use_live_signals = _as_bool(request.data.get("use_live_signals"), ENABLE_LIVE_SIGNALS)
            raw_url = request.data.get("url")
            payload = _scan_single_url(request, raw_url, use_live_signals=use_live_signals)
            if "error" in payload and payload["error"]:
                return Response({"error": payload["error"]}, status=status.HTTP_400_BAD_REQUEST)
            return Response(payload, status=status.HTTP_200_OK)

        except Exception:
            traceback.print_exc()
            return Response({"error": "Scan failed due to a server error"}, status=500)


class BulkScanView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            urls = request.data.get("urls")
            if not isinstance(urls, list):
                return Response({"error": "urls must be a list of URL strings"}, status=400)
            if not urls:
                return Response({"error": "urls list cannot be empty"}, status=400)
            if len(urls) > BULK_SCAN_MAX_URLS:
                return Response(
                    {"error": f"Maximum {BULK_SCAN_MAX_URLS} URLs allowed per bulk scan"},
                    status=400,
                )

            use_live_signals = _as_bool(request.data.get("use_live_signals"), ENABLE_LIVE_SIGNALS)
            batch = _scan_urls_batch(request, urls, use_live_signals=use_live_signals)
            return Response(batch, status=201)

        except Exception as e:
            traceback.print_exc()
            return Response({"error": "Bulk scan failed due to a server error"}, status=500)


class BulkCSVScanView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            upload = request.FILES.get("file") or request.FILES.get("csv_file")
            if not upload:
                return Response({"error": "CSV file is required (file or csv_file)"}, status=400)

            use_live_signals = _as_bool(request.data.get("use_live_signals"), ENABLE_LIVE_SIGNALS)
            try:
                raw_text = upload.read().decode("utf-8-sig")
            except UnicodeDecodeError:
                return Response({"error": "CSV file must be UTF-8 encoded"}, status=400)

            if not raw_text.strip():
                return Response({"error": "CSV file is empty"}, status=400)

            rows = []
            stream = io.StringIO(raw_text)
            sample = raw_text[:2048]
            try:
                has_header = csv.Sniffer().has_header(sample)
            except Exception:
                has_header = True

            if has_header:
                reader = csv.DictReader(stream)
                field_map = reader.fieldnames or []
                url_field = None
                for candidate in ("url", "URL", "link", "domain"):
                    if candidate in field_map:
                        url_field = candidate
                        break
                if url_field is None and field_map:
                    url_field = field_map[0]

                for row in reader:
                    value = row.get(url_field, "") if url_field else ""
                    rows.append(value)
            else:
                reader = csv.reader(stream)
                for row in reader:
                    if not row:
                        continue
                    rows.append(row[0])

            if len(rows) > BULK_SCAN_MAX_URLS:
                return Response(
                    {"error": f"Maximum {BULK_SCAN_MAX_URLS} URLs allowed per bulk scan"},
                    status=400,
                )

            batch = _scan_urls_batch(request, rows, use_live_signals=use_live_signals)
            batch["source"] = "csv"
            batch["filename"] = getattr(upload, "name", "uploaded.csv")
            return Response(batch, status=201)

        except Exception as e:
            traceback.print_exc()
            return Response({"error": "CSV bulk scan failed due to a server error"}, status=500)


# ── Scan Detail — GET /api/scan/<id>/ ─────────────────────────────────────────
class ScanDetailView(APIView):
    """
    Return full scan detail for a single URL scan including all 17+ features.
    Used by the URL detail page (/scan/:id).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, url_id):
        try:
            url_obj = URL.objects.select_related("scan_result").get(
                id=url_id,
                submitted_by=request.user,  # ownership check
            )
        except URL.DoesNotExist:
            return Response({"error": "Scan not found"}, status=404)

        data = URLSerializer(url_obj).data

        # Attach structured feature breakdown for the detail page
        sr = getattr(url_obj, "scan_result", None)
        if sr:
            data["feature_breakdown"] = [
                # Format: label, value, type (bool/int/float), weight_pts, fired
                {"label": "IP address in URL",          "value": sr.has_ip_address,            "type": "bool",  "pts": 30,  "fired": sr.has_ip_address},
                {"label": "Punycode homograph",          "value": sr.has_punycode,              "type": "bool",  "pts": 30,  "fired": sr.has_punycode},
                {"label": "Suspicious TLD",              "value": sr.has_suspicious_tld,        "type": "bool",  "pts": 25,  "fired": sr.has_suspicious_tld},
                {"label": "URL shortener",               "value": sr.is_shortened,              "type": "bool",  "pts": 30,  "fired": sr.is_shortened},
                {"label": "@ symbol trick",              "value": sr.has_at_symbol,             "type": "bool",  "pts": 20,  "fired": sr.has_at_symbol},
                {"label": "No HTTPS",                    "value": not sr.uses_https,            "type": "bool",  "pts": 10,  "fired": not sr.uses_https},
                {"label": "Hex/URL encoding",            "value": sr.has_hex_encoding,          "type": "bool",  "pts": 10,  "fired": sr.has_hex_encoding},
                {"label": "Double slash redirect",       "value": sr.has_double_slash_redirect, "type": "bool",  "pts": 5,   "fired": sr.has_double_slash_redirect},
                {"label": "Suspicious keywords",         "value": sr.has_suspicious_keywords,   "type": "bool",  "pts": 18,  "fired": sr.has_suspicious_keywords},
                {"label": "Keyword count",               "value": sr.num_suspicious_keywords,   "type": "int",   "pts": 0,   "fired": sr.num_suspicious_keywords > 0},
                {"label": "Subdomain depth",             "value": sr.num_subdomains,            "type": "int",   "pts": 15,  "fired": sr.num_subdomains > 2},
                {"label": "Hyphen count",                "value": sr.num_hyphens,               "type": "int",   "pts": 8,   "fired": sr.num_hyphens > 5},
                {"label": "Query parameters",            "value": sr.num_query_params,          "type": "int",   "pts": 5,   "fired": sr.num_query_params > 5},
                {"label": "URL length",                  "value": sr.url_length,                "type": "int",   "pts": 8,   "fired": sr.url_length > 100},
                {"label": "Domain length",               "value": sr.domain_length,             "type": "int",   "pts": 5,   "fired": sr.domain_length > 30},
                {"label": "Path length",                 "value": sr.path_length,               "type": "int",   "pts": 3,   "fired": sr.path_length > 50},
                {"label": "Dot count",                   "value": sr.num_dots,                  "type": "int",   "pts": 0,   "fired": sr.num_dots > 5},
            ]

        return Response(data)


# ── History ───────────────────────────────────────────────────────────────────
class HistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Optimize query with select_related and only fetch needed fields
        qs = URL.objects.filter(submitted_by=request.user).select_related(
            "scan_result"
        ).only(
            "id", "url", "status", "date_submitted",
            "scan_result__verdict", "scan_result__risk_score", "scan_result__confidence_score"
        )

        status_filter = request.query_params.get("status")
        if status_filter in ("safe", "suspicious", "phishing", "pending"):
            qs = qs.filter(status=status_filter)

        search = request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(url__icontains=search)

        sort_map = {
            "newest":   "-date_submitted",
            "oldest":    "date_submitted",
            "riskHigh": "-scan_result__risk_score",
            "riskLow":   "scan_result__risk_score",
        }
        qs = qs.order_by(
            sort_map.get(request.query_params.get("sort", "newest"), "-date_submitted")
        )

        try:
            page      = max(1, int(request.query_params.get("page", 1)))
            page_size = min(50, max(1, int(request.query_params.get("page_size", 10))))
        except ValueError:
            page, page_size = 1, 10

        # Cache count for this user to reduce DB load
        cache_key = f"history_count:{request.user.id}"
        total = cache.get(cache_key)
        if total is None:
            total = qs.count()
            cache.set(cache_key, total, timeout=300)  # 5 min cache
        
        offset = (page - 1) * page_size
        qs_page = qs[offset: offset + page_size]

        return Response({
            "results":     URLSerializer(qs_page, many=True).data,
            "total":       total,
            "page":        page,
            "page_size":   page_size,
            "total_pages": max(1, -(-total // page_size)),
        })


# ── Stats ─────────────────────────────────────────────────────────────────────
class StatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = URL.objects.filter(submitted_by=request.user)
        counts = qs.aggregate(
            total=Count("id"),
            phish=Count("id", filter=Q(status="phishing")),
            susp=Count("id", filter=Q(status="suspicious")),
            safe=Count("id", filter=Q(status="safe")),
        )
        total = counts["total"] or 0
        phish = counts["phish"] or 0
        susp = counts["susp"] or 0
        safe = counts["safe"] or 0
        threats = phish + susp
        return Response({
            "total":        total,
            "phishing":     phish,
            "suspicious":   susp,
            "safe":         safe,
            "threat_count": threats,
            "threat_rate":  round(threats / max(total, 1) * 100),  # NEW v4
        })


# ── Analytics ─────────────────────────────────────────────────────────────────
class AnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Cache expensive analytics for 5 minutes
        cache_key = f"analytics:{request.user.id}"
        cached_data = cache.get(cache_key)
        if cached_data:
            return Response(cached_data)
        
        qs       = URL.objects.filter(submitted_by=request.user)
        week_ago = timezone.now() - datetime.timedelta(days=7)

        # Daily breakdown
        daily_qs = (
            ScanResult.objects
            .filter(url__submitted_by=request.user, scanned_at__gte=week_ago)
            .values("scanned_at__date", "verdict")
            .annotate(count=Count("id"))
            .order_by("scanned_at__date")
        )
        days = {}
        for row in daily_qs:
            d = str(row["scanned_at__date"])
            if d not in days:
                days[d] = {"date": d, "phishing": 0, "suspicious": 0, "safe": 0}
            days[d][row["verdict"]] = row["count"]

        # Verdict breakdown
        by_verdict = list(
            ScanResult.objects
            .filter(url__submitted_by=request.user)
            .values("verdict")
            .annotate(count=Count("id"))
            .order_by("-count")
        )

        # Risk score distribution (0-100 scale)
        sr = ScanResult.objects.filter(url__submitted_by=request.user)
        score_dist = {
            "0-20":   sr.filter(risk_score__lte=20).count(),
            "21-40":  sr.filter(risk_score__gt=20, risk_score__lte=40).count(),
            "41-60":  sr.filter(risk_score__gt=40, risk_score__lte=60).count(),
            "61-80":  sr.filter(risk_score__gt=60, risk_score__lte=80).count(),
            "81-100": sr.filter(risk_score__gt=80, risk_score__lte=100).count(),
        }

        # Top threats
        top = list(
            ScanResult.objects
            .filter(url__submitted_by=request.user, verdict="phishing")
            .values("url__url", "risk_score", "verdict")
            .annotate(hits=Count("id"))
            .order_by("-risk_score")[:10]  # increased from 5 to 10
        )

        total   = qs.count()
        threats = qs.filter(status__in=["phishing", "suspicious"]).count()

        all_scores = list(sr.values_list("risk_score", flat=True)[:1000])
        avg_risk   = round(sum(all_scores) / len(all_scores)) if all_scores else 0

        response_data = {
            "daily":       list(days.values()),
            "by_verdict":  by_verdict,
            "score_dist":  score_dist,
            "top_threats": top,
            "summary": {
                "total":          total,
                "threats":        threats,
                "detection_rate": round(threats / max(total, 1) * 100),
                "avg_risk":       avg_risk,
            },
        }
        
        # Cache the expensive computed result for 5 minutes
        cache_key = f"analytics:{request.user.id}"
        try:
            cache.set(cache_key, response_data, timeout=300)
        except Exception:
            pass
        
        return Response(response_data)


# ── Delete ────────────────────────────────────────────────────────────────────
class DeleteScanView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, url_id):
        try:
            url = URL.objects.get(id=url_id, submitted_by=request.user)
            url.delete()
            return Response({"deleted": True})
        except URL.DoesNotExist:
            return Response({"error": "Scan not found or not yours"}, status=404)


# ── Blacklist ─────────────────────────────────────────────────────────────────
class BlacklistView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = BlacklistedDomain.objects.all().order_by("-date_added")
        return Response(BlacklistSerializer(qs, many=True).data)

    def post(self, request):
        """Admin only — add domain to blacklist."""
        if not request.user.is_staff:
            return Response({"error": "Admin access required"}, status=403)
        domain = (request.data.get("domain") or "").strip().lower()
        reason = (request.data.get("reason") or "").strip()
        if not domain:
            return Response({"error": "domain is required"}, status=400)
        obj, created = BlacklistedDomain.objects.get_or_create(
            domain=domain,
            defaults={"reason": reason, "source": "admin"},
        )
        try:
            cache.delete(f"blacklist_match:{domain}")
        except Exception:
            pass
        return Response(BlacklistSerializer(obj).data, status=201 if created else 200)


# ── Blacklist item delete ─────────────────────────────────────────────────────
class BlacklistDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, domain_id):
        if not request.user.is_staff:
            return Response({"error": "Admin access required"}, status=403)
        try:
            obj = BlacklistedDomain.objects.get(id=domain_id)
            try:
                cache.delete(f"blacklist_match:{obj.domain}")
            except Exception:
                pass
            obj.delete()
            return Response({"deleted": True})
        except BlacklistedDomain.DoesNotExist:
            return Response({"error": "Domain not found"}, status=404)


# ── Async Task Status Polling & Dispatch ──────────────────────────────────────
class AsyncScanView(APIView):
    """
    POST /api/scan/async/
    Enqueues URL analysis task to Celery worker and returns task_id & polling URL.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        raw_url = request.data.get("url")
        raw_url, url_clean, error = _normalize_scan_input(raw_url)
        if error:
            return Response({"error": error}, status=400)

        use_live_signals = _as_bool(request.data.get("use_live_signals"), ENABLE_LIVE_SIGNALS)
        user = request.user if (hasattr(request, "user") and request.user and request.user.is_authenticated) else None

        url_obj = URL.objects.create(
            url=raw_url,
            submitted_by=user,
            status="queued",
        )

        try:
            task = process_url_scan.delay(url_obj.id, use_live_signals)
            task_id = task.id
        except Exception as e:
            url_obj.status = "pending"
            url_obj.save(update_fields=["status"])
            return Response({"error": f"Failed to dispatch task: {str(e)}"}, status=500)

        return Response({
            "task_id": task_id,
            "url_id": url_obj.id,
            "status": "queued",
            "input_url": raw_url,
            "normalized_url": url_clean,
            "poll_url": f"/api/scan/task-status/{task_id}/",
        }, status=status.HTTP_202_ACCEPTED)


class TaskStatusView(APIView):
    """
    GET /api/scan/task-status/<task_id>/
    Polls status of asynchronous Celery task. Returns state and result payload when completed.
    """
    permission_classes = [AllowAny]

    def get(self, request, task_id):
        try:
            from celery.result import AsyncResult
            result = AsyncResult(task_id)

            response_data = {
                "task_id": task_id,
                "state": result.state,
                "ready": result.ready(),
                "successful": result.successful() if result.ready() else False,
            }

            if result.ready():
                if result.successful():
                    response_data["result"] = result.result
                else:
                    response_data["error"] = str(result.result)
            else:
                response_data["info"] = str(result.info) if result.info else "Task is processing in background"

            return Response(response_data, status=200)
        except Exception as e:
            return Response({"error": f"Failed to check task status: {str(e)}"}, status=500)


# ── SIEM / SOC Incident Log Export (CEF & JSON) ──────────────────────────────
class SIEMExportView(APIView):
    """
    GET /api/export/siem/?format=cef|json&verdict=phishing|suspicious
    Exports threat incidents for Splunk, Microsoft Sentinel, and SIEM ingesters.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        fmt = request.query_params.get("format", "json").lower()
        verdict_filter = request.query_params.get("verdict", "phishing")

        queryset = ScanResult.objects.select_related("url").filter(
            verdict__in=["phishing", "suspicious"] if verdict_filter == "all" else [verdict_filter]
        ).order_by("-scan_date")[:500]

        if fmt == "cef":
            from django.http import HttpResponse
            cef_lines = []
            for item in queryset:
                # CEF:Version|Device Vendor|Device Product|Device Version|Signature ID|Name|Severity|Extension
                sev = "10" if item.verdict == "phishing" else "6"
                reasons_str = "; ".join(item.reasons) if isinstance(item.reasons, list) else str(item.reasons)
                url_str = item.url.url if item.url else ""
                cef_line = f"CEF:0|PhishGuard|ThreatConsole|1.0.0|THREAT_DETECTED|Phishing URL Flagged|{sev}|request={url_str} riskScore={item.risk_score} verdict={item.verdict} msg={reasons_str}"
                cef_lines.append(cef_line)

            response = HttpResponse("\n".join(cef_lines), content_type="text/plain")
            response["Content-Disposition"] = 'attachment; filename="phishguard_threats.cef"'
            return response

        # Default JSON format
        incidents = []
        for item in queryset:
            incidents.append({
                "id": item.id,
                "url": item.url.url if item.url else "",
                "verdict": item.verdict,
                "risk_score": item.risk_score,
                "confidence_score": item.confidence_score,
                "reasons": item.reasons,
                "timestamp": item.scan_date.isoformat() if item.scan_date else None,
            })

        return Response({
            "count": len(incidents),
            "format": "json",
            "incidents": incidents,
        }, status=200)
