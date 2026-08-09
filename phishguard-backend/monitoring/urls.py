# monitoring/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path("stats/",     views.MonitoringStatsView.as_view(),    name="monitoring_stats"),
    path("stats",      views.MonitoringStatsView.as_view()),
    path("live/",      views.MonitoringLiveView.as_view(),     name="monitoring_live"),
    path("live",       views.MonitoringLiveView.as_view()),
    path("visitors/",  views.MonitoringVisitorsView.as_view(), name="monitoring_visitors"),
    path("visitors",   views.MonitoringVisitorsView.as_view()),
    path("searches/",  views.MonitoringSearchesView.as_view(), name="monitoring_searches"),
    path("searches",   views.MonitoringSearchesView.as_view()),
    path("users/",     views.MonitoringUsersView.as_view(),    name="monitoring_users"),
    path("users",      views.MonitoringUsersView.as_view()),
    path("geo/",       views.MonitoringGeoView.as_view(),      name="monitoring_geo"),
    path("geo",        views.MonitoringGeoView.as_view()),
    path("timeline/",  views.MonitoringTimelineView.as_view(), name="monitoring_timeline"),
    path("timeline",   views.MonitoringTimelineView.as_view()),
]
