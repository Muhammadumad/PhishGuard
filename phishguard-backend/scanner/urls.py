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
    path("scan",                     views.ScanView.as_view()),
    path("scan/async/",              views.AsyncScanView.as_view(),     name="async_scan"),
    path("scan/async",               views.AsyncScanView.as_view()),
    path("scan/task-status/<str:task_id>/", views.TaskStatusView.as_view(), name="task_status"),
    path("scan/bulk/",              views.BulkScanView.as_view(),      name="bulk_scan"),
    path("scan/bulk",               views.BulkScanView.as_view()),
    path("scan/bulk-csv/",          views.BulkCSVScanView.as_view(),   name="bulk_csv_scan"),
    path("scan/bulk-csv",           views.BulkCSVScanView.as_view()),
    path("scan/intelligence/",       views.URLIntelligenceView.as_view(),name="url_intelligence"),
    path("scan/intelligence",        views.URLIntelligenceView.as_view()),
    path("scan/<int:pk>/intelligence/", views.URLIntelligenceView.as_view(), name="scan_pk_intelligence"),
    path("scan/<int:pk>/intelligence",  views.URLIntelligenceView.as_view()),
    path("scan/<int:url_id>/",       views.ScanDetailView.as_view(),    name="scan_detail"),   # NEW v4
    path("scan/<int:url_id>",        views.ScanDetailView.as_view()),
    path("scan/<int:url_id>/delete/",views.DeleteScanView.as_view(),    name="delete_scan"),
    path("scan/<int:url_id>/delete", views.DeleteScanView.as_view()),

    # History, stats, analytics
    path("history/",                 views.HistoryView.as_view(),       name="history"),
    path("history",                  views.HistoryView.as_view()),
    path("stats/",                   views.StatsView.as_view(),         name="stats"),
    path("stats",                    views.StatsView.as_view()),
    path("analytics/",               views.AnalyticsView.as_view(),     name="analytics"),
    path("analytics",                views.AnalyticsView.as_view()),

    # Blacklist management
    path("blacklist/",               views.BlacklistView.as_view(),     name="blacklist"),
    path("blacklist",                views.BlacklistView.as_view()),
    path("blacklist/<int:domain_id>/",views.BlacklistDetailView.as_view(), name="blacklist_detail"),  # NEW v4
    path("blacklist/<int:domain_id>", views.BlacklistDetailView.as_view()),

    # SIEM / SOC Export
    path("export/siem/",             views.SIEMExportView.as_view(),    name="export_siem"),
    path("export/siem",              views.SIEMExportView.as_view()),
]