from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import SecurityEvent


class AuthSecurityTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user_email = "security.user@example.com"
        self.user_password = "Sup3rStrongP@ss!"
        get_user_model().objects.create_user(
            email=self.user_email,
            username="security-user",
            password=self.user_password,
        )

    @override_settings(
        LOGIN_LOCKOUT_THRESHOLD=3,
        LOGIN_LOCKOUT_WINDOW_SECONDS=600,
        LOGIN_LOCKOUT_SECONDS=600,
    )
    def test_login_locks_after_repeated_failures(self):
        cache.clear()
        payload = {"email": self.user_email, "password": "wrong-password"}

        first = self.client.post("/api/token/", payload, format="json")
        second = self.client.post("/api/token/", payload, format="json")
        third = self.client.post("/api/token/", payload, format="json")

        self.assertEqual(first.status_code, 401)
        self.assertEqual(second.status_code, 401)
        self.assertEqual(third.status_code, 429)
        self.assertIn("Too many failed login attempts", third.data.get("error", ""))

        blocked_valid = self.client.post(
            "/api/token/",
            {"email": self.user_email, "password": self.user_password},
            format="json",
        )
        self.assertEqual(blocked_valid.status_code, 429)

    def test_register_rejects_common_weak_password(self):
        response = self.client.post(
            "/api/register/",
            {
                "email": "weak.pass@example.com",
                "username": "weak-pass",
                "password": "password123",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_login_success_writes_security_event(self):
        response = self.client.post(
            "/api/token/",
            {"email": self.user_email, "password": self.user_password},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            SecurityEvent.objects.filter(
                event_type="login_success",
                email=self.user_email,
                success=True,
            ).exists()
        )

    def test_admin_can_list_security_events(self):
        admin = get_user_model().objects.create_superuser(
            email="admin@example.com",
            username="admin-user",
            password="AdminStrongP@ss1",
        )
        self.client.force_authenticate(user=admin)
        response = self.client.get("/api/admin/security-events/?limit=5")
        self.assertEqual(response.status_code, 200)
        self.assertIn("results", response.data)
