# accounts/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path("register/", views.RegisterView.as_view(), name="register"),
    path("profile/",  views.ProfileView.as_view(),  name="profile"),
    path("admin/security-events/", views.SecurityEventListView.as_view(), name="security_events"),
]