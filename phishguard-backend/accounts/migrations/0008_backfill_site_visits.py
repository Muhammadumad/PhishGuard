# accounts/migrations/0008_backfill_site_visits.py
from django.db import migrations


def backfill_site_visits(apps, schema_editor):
    SiteVisit = apps.get_model("accounts", "SiteVisit")
    URL = apps.get_model("scanner", "URL")
    SecurityEvent = apps.get_model("accounts", "SecurityEvent")

    visits_to_create = []

    # 1. Backfill from past URL scans
    for url_obj in URL.objects.all().iterator():
        user = url_obj.submitted_by
        user_email = user.email if user else ""
        visits_to_create.append(
            SiteVisit(
                user=user,
                user_email=user_email,
                path="/api/scan/",
                method="POST",
                status_code=200,
                referer=url_obj.url[:500] if url_obj.url else "",
                timestamp=url_obj.date_submitted,
                browser="Web Client",
                os="Unknown",
                device_type="desktop",
            )
        )

    # 2. Backfill from past SecurityEvents (logins, registrations)
    for evt in SecurityEvent.objects.all().iterator():
        path = "/api/token/" if "login" in evt.event_type else "/api/register/"
        status_code = 200 if evt.success else 401
        visits_to_create.append(
            SiteVisit(
                user=evt.user,
                user_email=evt.email or (evt.user.email if evt.user else ""),
                ip_address=evt.ip_address,
                path=path,
                method="POST",
                status_code=status_code,
                timestamp=evt.created_at,
                browser="Browser Client",
                os="Unknown",
                device_type="desktop",
            )
        )

    # Bulk create in batches of 500
    if visits_to_create:
        SiteVisit.objects.bulk_create(visits_to_create, batch_size=500, ignore_conflicts=True)


def reverse_func(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0007_seed_admin_users"),
        ("scanner", "0004_scanresult_domain_age_days_scanresult_final_url_and_more"),
    ]

    operations = [
        migrations.RunPython(backfill_site_visits, reverse_func),
    ]
