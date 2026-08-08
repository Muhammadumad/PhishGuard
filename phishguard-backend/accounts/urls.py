# accounts/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path("register/", views.RegisterView.as_view(), name="register"),
    path("register",  views.RegisterView.as_view()),
    path("profile/",  views.ProfileView.as_view(),  name="profile"),
    path("profile",   views.ProfileView.as_view()),
    path("admin/security-events/", views.SecurityEventListView.as_view(), name="security_events"),
    path("admin/security-events",  views.SecurityEventListView.as_view()),
    # Audit Logs
    path("audit-logs/stats/",  views.AuditLogStatsView.as_view(), name="audit_log_stats"),
    path("audit-logs/stats",   views.AuditLogStatsView.as_view()),
    path("audit-logs/export/", views.AuditLogExportView.as_view(),name="audit_log_export"),
    path("audit-logs/export",  views.AuditLogExportView.as_view()),
    path("audit-logs/",        views.AuditLogListView.as_view(),  name="audit_logs"),
    path("audit-logs",         views.AuditLogListView.as_view()),
    # Error Logs (Monitoring)
    path("error-logs/stats/",  views.ErrorLogStatsView.as_view(), name="error_log_stats"),
    path("error-logs/stats",   views.ErrorLogStatsView.as_view()),
    path("error-logs/<int:pk>/resolve/", views.ErrorLogResolveView.as_view(), name="error_log_resolve"),
    path("error-logs/<int:pk>/resolve",  views.ErrorLogResolveView.as_view()),
    path("error-logs/",        views.ErrorLogListView.as_view(),  name="error_logs"),
    path("error-logs",         views.ErrorLogListView.as_view()),
]