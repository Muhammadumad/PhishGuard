from django.test import TestCase

from scanner.analyzer import extract_features


class AnalyzerSecurityTests(TestCase):
    def test_multitenant_subdomain_is_not_auto_trusted(self):
        result = extract_features("https://evil.github.io/login")
        self.assertNotEqual(result.get("scan_source"), "trusted")
        self.assertNotIn("Verified trusted domain", " ".join(result.get("reasons", [])))

    def test_exact_multitenant_root_remains_trusted(self):
        result = extract_features("https://github.io")
        self.assertEqual(result.get("scan_source"), "trusted")
        self.assertEqual(result.get("verdict"), "safe")
