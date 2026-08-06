# accounts/models.py — COMPLETE FILE
# Simple custom user model — NO first_name/last_name to avoid migration issues
from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class UserManager(BaseUserManager):
    def create_user(self, email, username=None, password=None, **extra):
        if not email:
            raise ValueError("Email is required")
        email    = self.normalize_email(email)
        username = username or email
        user     = self.model(email=email, username=username, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, username=None, password=None, **extra):
        extra.setdefault("role",         "admin")
        extra.setdefault("is_staff",     True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("is_active",    True)
        return self.create_user(email, username, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ("user",  "User"),
        ("admin", "Admin"),
    ]

    id          = models.BigAutoField(primary_key=True)
    email       = models.EmailField(max_length=150, unique=True)
    username    = models.CharField(max_length=100, unique=True)
    role        = models.CharField(max_length=10, choices=ROLE_CHOICES, default="user")
    is_active   = models.BooleanField(default=True)
    is_staff    = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)
    last_login  = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD  = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        db_table = "users"
        indexes  = [
            models.Index(fields=["email"],    name="idx_users_email"),
            models.Index(fields=["username"], name="idx_users_username"),
            models.Index(fields=["role"],     name="idx_users_role"),
        ]

    def __str__(self):
        return f"{self.username} ({self.email})"


class SecurityEvent(models.Model):
    EVENT_CHOICES = [
        ("login_success", "Login Success"),
        ("login_failed", "Login Failed"),
        ("login_locked", "Login Locked"),
        ("register_success", "Register Success"),
        ("register_failed", "Register Failed"),
    ]

    id = models.BigAutoField(primary_key=True)
    event_type = models.CharField(max_length=32, choices=EVENT_CHOICES, db_index=True)
    email = models.EmailField(max_length=150, blank=True, default="")
    username = models.CharField(max_length=100, blank=True, default="")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="security_events",
    )
    success = models.BooleanField(default=False)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "security_events"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["event_type"], name="idx_sec_evt_type"),
            models.Index(fields=["created_at"], name="idx_sec_evt_date"),
            models.Index(fields=["ip_address"], name="idx_sec_evt_ip"),
        ]

    def __str__(self):
        return f"{self.event_type} @ {self.created_at:%Y-%m-%d %H:%M:%S}"


class APIKey(models.Model):
    """
    Enterprise API Key for automated SOC/SIEM integrations.
    Authenticated requests use `X-API-Key: pg_live_...` header.
    """
    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="api_keys",
    )
    name = models.CharField(max_length=100)
    key_prefix = models.CharField(max_length=12, db_index=True)
    key_hash = models.CharField(max_length=128, db_index=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "api_keys"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["key_prefix"], name="idx_apk_prefix"),
            models.Index(fields=["key_hash"], name="idx_apk_hash"),
        ]

    def __str__(self):
        return f"APIKey '{self.name}' ({self.key_prefix}...)"