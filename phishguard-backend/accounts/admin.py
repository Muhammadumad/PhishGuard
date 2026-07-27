# accounts/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, SecurityEvent


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display    = ["email", "username", "role", "is_active", "date_joined"]
    list_filter     = ["role", "is_active", "is_staff"]
    search_fields   = ["email", "username"]
    ordering        = ["-date_joined"]
    fieldsets       = (
        (None,           {"fields": ("email", "username", "password")}),
        ("Role",         {"fields": ("role", "is_active", "is_staff", "is_superuser")}),
        ("Permissions",  {"fields": ("groups", "user_permissions")}),
    )
    add_fieldsets   = (
        (None, {"classes": ("wide",), "fields": ("email", "username", "password1", "password2", "role")}),
    )


@admin.register(SecurityEvent)
class SecurityEventAdmin(admin.ModelAdmin):
    list_display = ["created_at", "event_type", "email", "ip_address", "success"]
    list_filter = ["event_type", "success", "created_at"]
    search_fields = ["email", "username", "ip_address"]
    ordering = ["-created_at"]