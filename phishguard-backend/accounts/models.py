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