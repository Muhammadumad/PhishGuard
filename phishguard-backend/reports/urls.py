# reports/urls.py
from django.urls import path
from .views import (
    ReportListCreateView,
    ReportDetailView,
    AdminReportListView,
    AdminReportDetailView,
    ReportStatisticsView,
)

urlpatterns = [
    # User report endpoints
    path("",                          ReportListCreateView.as_view(),   name="report-list-create"),
    path("<int:report_id>/",          ReportDetailView.as_view(),       name="report-detail"),
    
    # Admin report endpoints
    path("admin/",                    AdminReportListView.as_view(),    name="admin-report-list"),
    path("admin/<int:report_id>/",    AdminReportDetailView.as_view(),  name="admin-report-detail"),
    
    # Statistics
    path("stats/",                    ReportStatisticsView.as_view(),   name="report-stats"),
]