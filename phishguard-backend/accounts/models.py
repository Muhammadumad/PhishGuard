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


class AuditLog(models.Model):
    """
    Enterprise Audit Log table recording all security, scanning, user management,
    and administrative events across PhishGuard.
    """
    CATEGORY_CHOICES = [
        ("auth", "Authentication"),
        ("scan", "Threat Scanning"),
        ("blacklist", "Blacklist Management"),
        ("report", "Reports & Flagging"),
        ("account", "Account Management"),
        ("system", "System Events"),
    ]

    SEVERITY_CHOICES = [
        ("info", "Information"),
        ("warning", "Warning"),
        ("critical", "Critical Security Alert"),
    ]

    STATUS_CHOICES = [
        ("success", "Success"),
        ("failure", "Failure"),
        ("blocked", "Blocked / Throttle"),
    ]

    id = models.BigAutoField(primary_key=True)
    category = models.CharField(max_length=32, choices=CATEGORY_CHOICES, default="system", db_index=True)
    event_type = models.CharField(max_length=64, db_index=True)
    severity = models.CharField(max_length=16, choices=SEVERITY_CHOICES, default="info", db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="success", db_index=True)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    user_email = models.EmailField(max_length=150, blank=True, default="")
    user_role = models.CharField(max_length=20, blank=True, default="")

    ip_address = models.GenericIPAddressField(null=True, blank=True, db_index=True)
    user_agent = models.CharField(max_length=300, blank=True, default="")
    request_path = models.CharField(max_length=255, blank=True, default="")
    request_method = models.CharField(max_length=10, blank=True, default="")

    target_resource = models.CharField(max_length=255, blank=True, default="")
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "audit_logs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["category", "created_at"], name="idx_audit_cat_date"),
            models.Index(fields=["event_type", "created_at"], name="idx_audit_evt_date"),
            models.Index(fields=["severity", "created_at"], name="idx_audit_sev_date"),
            models.Index(fields=["user", "created_at"], name="idx_audit_usr_date"),
            models.Index(fields=["ip_address", "created_at"], name="idx_audit_ip_date"),
        ]

    def __str__(self):
        return f"[{self.severity.upper()}] {self.category}/{self.event_type} by {self.user_email or 'anon'} @ {self.created_at:%Y-%m-%d %H:%M:%S}"


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


class ErrorLog(models.Model):
    """
    Enterprise Error Log model for PhishGuard.
    Captures unhandled exceptions, 500 server crashes, and API failures.
    """
    SEVERITY_CHOICES = [
        ("warning", "Warning"),
        ("error", "Error"),
        ("critical", "Critical"),
    ]

    id = models.BigAutoField(primary_key=True)
    exception_class = models.CharField(max_length=150, db_index=True)
    message = models.TextField()
    traceback = models.TextField()
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default="error", db_index=True)
    status_code = models.IntegerField(default=500, db_index=True)
    request_path = models.CharField(max_length=255, db_index=True)
    request_method = models.CharField(max_length=10, default="GET")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="error_logs",
    )
    user_email = models.CharField(max_length=150, blank=True, default="")
    ip_address = models.GenericIPAddressField(null=True, blank=True, db_index=True)
    user_agent = models.TextField(blank=True, default="")
    extra_data = models.JSONField(default=dict, blank=True)
    is_resolved = models.BooleanField(default=False, db_index=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resolved_error_logs",
    )
    resolution_notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "error_logs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["severity", "created_at"], name="idx_err_sev_date"),
            models.Index(fields=["exception_class", "created_at"], name="idx_err_cls_date"),
            models.Index(fields=["is_resolved", "created_at"], name="idx_err_res_date"),
            models.Index(fields=["status_code", "created_at"], name="idx_err_st_date"),
        ]

    def __str__(self):
        status_str = "RESOLVED" if self.is_resolved else "UNRESOLVED"
        return f"[{self.severity.upper()} - {status_str}] {self.exception_class}: {self.message[:50]} @ {self.created_at:%Y-%m-%d %H:%M:%S}"


class SiteVisit(models.Model):
    """
    TABLE: site_visits
    Tracks every HTTP request to PhishGuard — both anonymous and authenticated.
    Powers the real-time admin monitoring dashboard.
    """
    DEVICE_CHOICES = [
        ("desktop", "Desktop"),
        ("mobile",  "Mobile"),
        ("tablet",  "Tablet"),
        ("bot",     "Bot / Crawler"),
        ("unknown", "Unknown"),
    ]

    id           = models.BigAutoField(primary_key=True)
    # Who made the request
    user         = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="site_visits",
    )
    user_email   = models.EmailField(max_length=150, blank=True, default="")
    session_key  = models.CharField(max_length=64, blank=True, default="", db_index=True)

    # Request details
    ip_address   = models.GenericIPAddressField(null=True, blank=True, db_index=True)
    path         = models.CharField(max_length=500, blank=True, default="", db_index=True)
    method       = models.CharField(max_length=10, blank=True, default="GET")
    status_code  = models.IntegerField(null=True, blank=True)
    response_ms  = models.IntegerField(null=True, blank=True)  # response time in ms

    # Browser / Device info (parsed from User-Agent)
    user_agent   = models.TextField(blank=True, default="")
    browser      = models.CharField(max_length=100, blank=True, default="")
    os           = models.CharField(max_length=100, blank=True, default="")
    device_type  = models.CharField(max_length=20, choices=DEVICE_CHOICES, default="unknown")

    # Geo info (fetched async from ip-api.com)
    country      = models.CharField(max_length=100, blank=True, default="")
    country_code = models.CharField(max_length=5, blank=True, default="")
    city         = models.CharField(max_length=100, blank=True, default="")
    region       = models.CharField(max_length=100, blank=True, default="")
    isp          = models.CharField(max_length=200, blank=True, default="")

    # Referrer
    referer      = models.TextField(blank=True, default="")

    timestamp    = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "site_visits"
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["ip_address", "timestamp"],  name="idx_sv_ip_time"),
            models.Index(fields=["user", "timestamp"],        name="idx_sv_user_time"),
            models.Index(fields=["path", "timestamp"],        name="idx_sv_path_time"),
            models.Index(fields=["device_type"],              name="idx_sv_device"),
            models.Index(fields=["country_code"],             name="idx_sv_country"),
        ]

    def __str__(self):
        who = self.user_email or self.ip_address or "unknown"
        return f"{who} → {self.path} @ {self.timestamp:%Y-%m-%d %H:%M:%S}"