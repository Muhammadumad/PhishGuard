# scanner/security.py — SSRF Protection & URL Security Shield
import socket
import ipaddress
import logging
from urllib.parse import urlparse

logger = logging.getLogger("scanner")

# Private and internal IP subnets that should never be requested by outbound scanner
BLOCKED_IP_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),          # Current network (only valid as source)
    ipaddress.ip_network("10.0.0.0/8"),         # RFC 1918 Private-Use
    ipaddress.ip_network("100.64.0.0/10"),      # Carrier-grade NAT
    ipaddress.ip_network("127.0.0.0/8"),        # Loopback
    ipaddress.ip_network("169.254.0.0/16"),     # Link-Local (including Cloud Metadata 169.254.169.254)
    ipaddress.ip_network("172.16.0.0/12"),      # RFC 1918 Private-Use
    ipaddress.ip_network("192.0.0.0/24"),       # IETF Protocol Assignments
    ipaddress.ip_network("192.0.2.0/24"),       # TEST-NET-1
    ipaddress.ip_network("192.88.99.0/24"),     # 6to4 Relay Anycast
    ipaddress.ip_network("192.168.0.0/16"),     # RFC 1918 Private-Use
    ipaddress.ip_network("198.18.0.0/15"),      # Network Interconnect Benchmarking
    ipaddress.ip_network("198.51.100.0/24"),   # TEST-NET-2
    ipaddress.ip_network("203.0.113.0/24"),     # TEST-NET-3
    ipaddress.ip_network("224.0.0.0/4"),        # Multicast
    ipaddress.ip_network("240.0.0.0/4"),        # Reserved for Future Use
    ipaddress.ip_network("255.255.255.255/32"), # Limited Broadcast
    
    # IPv6 blocked ranges
    ipaddress.ip_network("::1/128"),            # IPv6 Loopback
    ipaddress.ip_network("::/128"),             # IPv6 Unspecified
    ipaddress.ip_network("fc00::/7"),           # IPv6 Unique Local Address
    ipaddress.ip_network("fe80::/10"),          # IPv6 Link-Local
]


class SSRFShield:
    """
    Prevents Server-Side Request Forgery (SSRF) by validating target hostnames
    and resolving IPs prior to initiating outbound HTTP socket connections.
    """

    @staticmethod
    def is_ip_blocked(ip_str: str) -> bool:
        """Return True if the IP string belongs to any private or reserved network."""
        try:
            ip_obj = ipaddress.ip_address(ip_str.strip())
        except ValueError:
            return True  # Block invalid IP strings by default

        if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_reserved or ip_obj.is_multicast:
            return True

        for network in BLOCKED_IP_NETWORKS:
            if ip_obj in network:
                return True

        return False

    @classmethod
    def validate_hostname(cls, hostname: str) -> tuple[bool, str, list[str]]:
        """
        Resolve a hostname to IP addresses and check if all resolved IPs are safe.
        Returns: (is_safe: bool, reason_if_blocked: str, resolved_ips: list[str])
        """
        host = (hostname or "").strip().lower()
        if not host:
            return False, "Empty hostname provided", []

        # Remove port if present
        if ":" in host and not host.startswith("["):
            host = host.split(":")[0]

        # Check if direct IP literal
        try:
            ip_obj = ipaddress.ip_address(host)
            if cls.is_ip_blocked(str(ip_obj)):
                return False, f"Target IP '{host}' is in a private or restricted range", [str(ip_obj)]
            return True, "", [str(ip_obj)]
        except ValueError:
            pass  # It's a standard domain name

        # Resolve domain name via DNS
        try:
            addr_info = socket.getaddrinfo(host, None)
            resolved_ips = sorted({res[4][0] for res in addr_info if res and res[4]})
        except socket.gaierror as e:
            return False, f"DNS resolution failed for hostname '{host}': {str(e)}", []
        except Exception as e:
            return False, f"Hostname resolution error for '{host}': {str(e)}", []

        if not resolved_ips:
            return False, f"No IP addresses resolved for domain '{host}'", []

        blocked_ips = [ip for ip in resolved_ips if cls.is_ip_blocked(ip)]
        if blocked_ips:
            logger.warning(f"SSRF Shield blocked target '{host}' resolving to internal IPs: {blocked_ips}")
            return False, f"Domain '{host}' resolves to internal IP space ({', '.join(blocked_ips)})", resolved_ips

        return True, "", resolved_ips

    @classmethod
    def validate_url(cls, url: str) -> tuple[bool, str, str, list[str]]:
        """
        Full URL validation for outbound scanners.
        Returns: (is_safe: bool, error_message: str, hostname: str, resolved_ips: list)
        """
        try:
            parsed = urlparse(url)
            if parsed.scheme not in {"http", "https"}:
                return False, f"Unsupported scheme '{parsed.scheme}'. Only HTTP/HTTPS allowed", "", []

            hostname = parsed.hostname
            if not hostname:
                return False, "Invalid URL structure (missing hostname)", "", []

            is_safe, error, ips = cls.validate_hostname(hostname)
            return is_safe, error, hostname, ips

        except Exception as e:
            return False, f"URL parsing error: {str(e)}", "", []
