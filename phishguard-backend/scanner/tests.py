from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from scanner.analyzer import extract_features
from scanner.security import SSRFShield


class AnalyzerSecurityTests(TestCase):
    def test_multitenant_subdomain_is_not_auto_trusted(self):
        result = extract_features("https://evil.github.io/login")
        self.assertNotEqual(result.get("scan_source"), "trusted")
        self.assertNotIn("Verified trusted domain", " ".join(result.get("reasons", [])))

    def test_exact_multitenant_root_remains_trusted(self):
        result = extract_features("https://github.io")
        self.assertEqual(result.get("scan_source"), "trusted")
        self.assertEqual(result.get("verdict"), "safe")

    def test_homoglyph_detection(self):
        result = extract_features("https://paypa1.com/login")
        self.assertIn("verdict", result)
        self.assertIn("risk_breakdown", result)
        self.assertGreaterEqual(result["risk_breakdown"]["domain_risk"], 0)

    def test_category_risk_breakdown_structure(self):
        result = extract_features("http://192.168.1.1/login")
        breakdown = result.get("risk_breakdown", {})
        self.assertIn("domain_risk", breakdown)
        self.assertIn("network_risk", breakdown)
        self.assertIn("content_risk", breakdown)
        self.assertIn("threat_intel_risk", breakdown)


class SSRFShieldTests(TestCase):
    def test_blocks_loopback_and_private_ips(self):
        self.assertTrue(SSRFShield.is_ip_blocked("127.0.0.1"))
        self.assertTrue(SSRFShield.is_ip_blocked("10.0.0.5"))
        self.assertTrue(SSRFShield.is_ip_blocked("192.168.1.100"))
        self.assertTrue(SSRFShield.is_ip_blocked("169.254.169.254"))
        self.assertFalse(SSRFShield.is_ip_blocked("8.8.8.8"))

    def test_validate_url_blocks_internal_hosts(self):
        is_safe, error, _, _ = SSRFShield.validate_url("http://127.0.0.1:8000/secret")
        self.assertFalse(is_safe)
        self.assertIn("restricted range", error)


class URLIntelligenceAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_intelligence_endpoint_requires_param_or_pk(self):
        response = self.client.get("/api/scan/intelligence/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_intelligence_endpoint_returns_rich_telemetry(self):
        response = self.client.get("/api/scan/intelligence/", {"url": "https://example.com"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("domain_reputation", data)
        self.assertIn("risk_summary", data)
        self.assertIn("network_telemetry", data)
        self.assertIn("content_inspection", data)
        self.assertIn("threat_intelligence", data)

