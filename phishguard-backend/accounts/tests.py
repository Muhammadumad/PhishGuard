from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from accounts.models import AuditLog, User
from accounts.audit_logger import log_audit_event, extract_client_ip

User = get_user_model()


class AuditLoggerUnitTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="auditor@phishguard.test",
            username="auditor",
            password="Password123!",
            role="admin",
        )

    def test_log_audit_event_creates_record(self):
        log_audit_event(
            category="auth",
            event_type="login_success",
            severity="info",
            status="success",
            target="user@example.com",
            details={"provider": "jwt"},
            user=self.user,
        )

        log = AuditLog.objects.filter(event_type="login_success").first()
        self.assertIsNotNone(log)
        self.assertEqual(log.category, "auth")
        self.assertEqual(log.severity, "info")
        self.assertEqual(log.user_email, "auditor@phishguard.test")
        self.assertEqual(log.details.get("provider"), "jwt")

    def test_client_ip_extraction(self):
        class MockRequest:
            META = {"HTTP_X_FORWARDED_FOR": "203.0.113.195, 10.0.0.1", "REMOTE_ADDR": "127.0.0.1"}

        ip = extract_client_ip(MockRequest())
        self.assertEqual(ip, "203.0.113.195")


class AuditLogAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            email="admin@phishguard.test",
            username="adminuser",
            password="AdminPassword123!",
        )
        self.regular_user = User.objects.create_user(
            email="user@phishguard.test",
            username="regularuser",
            password="UserPassword123!",
            role="user",
        )

        # Seed audit log records
        log_audit_event(category="scan", event_type="url_scanned", severity="info", status="success", target="https://example.com", user=self.admin)
        log_audit_event(category="auth", event_type="login_failed", severity="warning", status="failure", target="user@test.com", details={"reason": "bad_password"})

    def test_regular_user_cannot_access_audit_logs(self):
        from django.urls import reverse
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get(reverse("audit_logs"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_query_audit_logs_with_filters(self):
        from django.urls import reverse
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(reverse("audit_logs"), {"category": "scan"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["results"][0]["event_type"], "url_scanned")

    def test_audit_log_stats_endpoint(self):
        from django.urls import reverse
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(reverse("audit_log_stats"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("total_events", data)
        self.assertIn("category_breakdown", data)
        self.assertIn("severity_breakdown", data)

    def test_audit_log_export_csv_and_cef(self):
        from django.urls import reverse
        self.client.force_authenticate(user=self.admin)
        
        # Test CSV export
        url = reverse("audit_log_export")
        csv_res = self.client.get(f"{url}?format=csv")
        self.assertEqual(csv_res.status_code, status.HTTP_200_OK)
        self.assertEqual(csv_res["Content-Type"], "text/csv")
        self.assertIn("Category,Event Type", csv_res.content.decode())

        # Test CEF export
        cef_res = self.client.get(f"{url}?format=cef")
        self.assertEqual(cef_res.status_code, status.HTTP_200_OK)
        self.assertIn("CEF:0|PhishGuard|AuditEngine", cef_res.content.decode())
