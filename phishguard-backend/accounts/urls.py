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
]