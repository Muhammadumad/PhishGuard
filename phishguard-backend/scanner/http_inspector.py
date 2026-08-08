# scanner/http_inspector.py — Live HTTP Response & HTML Content Phishing Inspector
import re
import hashlib
import logging
from html.parser import HTMLParser
from urllib.parse import urlparse, urljoin
from .security import SSRFShield
from .api_client import ResilientAPIClient

logger = logging.getLogger("scanner")

MAX_REDIRECTS = 5
INSPECTOR_TIMEOUT = (2.0, 3.0)  # (connect, read) seconds
MAX_RESPONSE_BODY_BYTES = 512 * 1024  # Cap response body reading at 512KB for performance


class PhishingHTMLParser(HTMLParser):
    """Parses HTML content to detect credential harvesting forms and security red flags."""
    def __init__(self, base_url: str):
        super().__init__()
        self.base_url = base_url
        self.base_domain = urlparse(base_url).netloc.lower()
        
        self.title = ""
        self.in_title = False
        self.password_inputs = 0
        self.text_inputs = 0
        self.hidden_inputs = 0
        self.forms = []  # list of dicts: {"action": ..., "is_external": bool, "has_password": bool}
        self.current_form = None
        self.iframes = []
        self.has_zero_font = False
        self.external_scripts = 0
        self.favicon_url = None

    def handle_starttag(self, tag, attrs):
        attr_dict = {k.lower(): (v or "") for k, v in attrs}

        if tag == "title":
            self.in_title = True

        elif tag == "form":
            action = attr_dict.get("action", "")
            resolved_action = urljoin(self.base_url, action) if action else self.base_url
            action_domain = urlparse(resolved_action).netloc.lower()
            is_external = bool(action_domain and action_domain != self.base_domain)
            
            self.current_form = {
                "action": resolved_action,
                "is_external": is_external,
                "has_password": False,
                "has_text": False,
            }
            self.forms.append(self.current_form)

        elif tag == "input":
            input_type = attr_dict.get("type", "text").lower()
            if input_type == "password":
                self.password_inputs += 1
                if self.current_form:
                    self.current_form["has_password"] = True
            elif input_type in {"text", "email", "user", "username", "tel"}:
                self.text_inputs += 1
                if self.current_form:
                    self.current_form["has_text"] = True
            elif input_type == "hidden":
                self.hidden_inputs += 1

        elif tag == "iframe":
            src = attr_dict.get("src", "")
            if src:
                self.iframes.append(urljoin(self.base_url, src))

        elif tag == "script":
            src = attr_dict.get("src", "")
            if src and urlparse(urljoin(self.base_url, src)).netloc.lower() != self.base_domain:
                self.external_scripts += 1

        elif tag == "link":
            rel = attr_dict.get("rel", "").lower()
            if "icon" in rel or "shortcut" in rel:
                href = attr_dict.get("href", "")
                if href:
                    self.favicon_url = urljoin(self.base_url, href)

        # Style check for zero-font or hidden text tricks
        style = attr_dict.get("style", "").lower()
        if "font-size:0" in style or "font-size: 0" in style or "display:none" in style or "display: none" in style:
            if tag in {"p", "span", "div", "a", "b", "strong"}:
                self.has_zero_font = True

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        elif tag == "form":
            self.current_form = None

    def handle_data(self, data):
        if self.in_title:
            self.title += data


def inspect_url_content(target_url: str) -> dict:
    """
    Safely inspect live HTTP headers, redirect trail, and HTML content of a target URL.
    Enforces SSRF check at every redirect step.
    Returns structured content inspection results.
    """
    result = {
        "success": False,
        "final_url": target_url,
        "http_status_code": None,
        "redirect_chain": [],
        "headers": {},
        "page_title": "",
        "has_password_input": False,
        "has_external_form": False,
        "forms_count": 0,
        "security_headers": {
            "has_hsts": False,
            "has_csp": False,
            "has_xfo": False,
            "server_header": "",
        },
        "content_signals": [],
        "risk_boost": 0,
        "reasons": [],
    }

    current_url = target_url
    redirect_chain = []

    for _ in range(MAX_REDIRECTS):
        is_safe, error, hostname, _ = SSRFShield.validate_url(current_url)
        if not is_safe:
            result["reasons"].append(f"SSRF Shield: {error}")
            return result

        response = ResilientAPIClient.get(
            current_url,
            allow_redirects=False,
            timeout=INSPECTOR_TIMEOUT,
            stream=True,
        )

        if response is None:
            result["reasons"].append(f"Could not connect to {current_url[:60]}")
            return result

        status_code = response.status_code
        redirect_chain.append({"url": current_url, "status": status_code})
        result["http_status_code"] = status_code
        result["final_url"] = current_url

        # Check for HTTP redirect
        if status_code in {301, 302, 303, 307, 308}:
            location = response.headers.get("Location")
            if not location:
                break
            next_url = urljoin(current_url, location)
            if next_url == current_url:
                break
            current_url = next_url
            continue
        else:
            # Reached terminal destination
            break

    result["redirect_chain"] = redirect_chain
    result["success"] = True

    # Assess redirect chain risks
    if len(redirect_chain) > 3:
        result["risk_boost"] += 12
        result["reasons"].append(f"Excessive HTTP redirects detected ({len(redirect_chain)} hops)")

    # Security Headers analysis
    if response and hasattr(response, "headers"):
        headers_lower = {k.lower(): v for k, v in response.headers.items()}
        result["security_headers"]["server_header"] = headers_lower.get("server", "")
        
        has_hsts = "strict-transport-security" in headers_lower
        has_csp = "content-security-policy" in headers_lower
        has_xfo = "x-frame-options" in headers_lower

        result["security_headers"]["has_hsts"] = has_hsts
        result["security_headers"]["has_csp"] = has_csp
        result["security_headers"]["has_xfo"] = has_xfo

        if not has_hsts and urlparse(result["final_url"]).scheme == "https":
            result["risk_boost"] += 3
            result["reasons"].append("HTTPS site lacks HSTS security header")

    # Read response body for HTML analysis
    try:
        content_type = (response.headers.get("Content-Type") or "").lower()
        if "text/html" in content_type or "application/xhtml" in content_type or not content_type:
            raw_body = response.raw.read(MAX_RESPONSE_BODY_BYTES)
            html_text = raw_body.decode("utf-8", errors="ignore")

            parser = PhishingHTMLParser(result["final_url"])
            parser.feed(html_text)

            title = parser.title.strip()
            if len(title) > 200:
                title = title[:197] + "..."
            result["page_title"] = title

            result["has_password_input"] = parser.password_inputs > 0
            result["forms_count"] = len(parser.forms)

            # Check form submission targets
            external_forms = [f for f in parser.forms if f["is_external"]]
            if external_forms:
                result["has_external_form"] = True
                result["risk_boost"] += 25
                result["reasons"].append(f"HTML form submits data to external target ({external_forms[0]['action'][:60]})")

            if parser.password_inputs > 0:
                result["risk_boost"] += 10
                result["reasons"].append(f"Page contains sensitive credential input field ({parser.password_inputs} password field)")

            if parser.has_zero_font:
                result["risk_boost"] += 15
                result["reasons"].append("HTML obfuscation technique detected (hidden/zero-font text)")

    except Exception as e:
        logger.debug(f"HTML content parsing exception: {e}")

    return result
