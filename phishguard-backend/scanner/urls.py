# scanner/urls.py — v4 upgrade
# New routes:
#   GET  /api/scan/<id>/         — ScanDetailView (URL detail page)
#   POST /api/blacklist/         — add domain (admin only)
#   DELETE /api/blacklist/<id>/  — remove domain (admin only)
from django.urls import path
from . import views

urlpatterns = [
    # Core scan endpoints
    path("scan/",                    views.ScanView.as_view(),          name="scan"),
    path("scan/async/",              views.AsyncScanView.as_view(),     name="async_scan"),
    path("scan/task-status/<str:task_id>/", views.TaskStatusView.as_view(), name="task_status"),
    path("scan/bulk/",              views.BulkScanView.as_view(),      name="bulk_scan"),
    path("scan/bulk-csv/",          views.BulkCSVScanView.as_view(),   name="bulk_csv_scan"),
    path("scan/<int:url_id>/",       views.ScanDetailView.as_view(),    name="scan_detail"),   # NEW v4
    path("scan/<int:url_id>/delete/",views.DeleteScanView.as_view(),    name="delete_scan"),

    # History, stats, analytics
    path("history/",                 views.HistoryView.as_view(),       name="history"),
    path("stats/",                   views.StatsView.as_view(),         name="stats"),
    path("analytics/",               views.AnalyticsView.as_view(),     name="analytics"),

    # Blacklist management
    path("blacklist/",               views.BlacklistView.as_view(),     name="blacklist"),
    path("blacklist/<int:domain_id>/",views.BlacklistDetailView.as_view(), name="blacklist_detail"),  # NEW v4
]