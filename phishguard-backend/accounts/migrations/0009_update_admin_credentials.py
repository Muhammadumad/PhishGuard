# accounts/migrations/0009_update_admin_credentials.py
#
# Run automatically by Render on next deploy via: python manage.py migrate
# Updates the admin account to new credentials.
#
from django.db import migrations
from django.contrib.auth.hashers import make_password


def update_admin_credentials(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    new_password = make_password("laferrari_017.")

    # ── Remove old admin@phishguard.com and replace with uberman@gmail.com ──
    old = User.objects.filter(email="admin@phishguard.com").first()
    if old:
        old.email       = "uberman@gmail.com"
        old.username    = "uberman"
        old.password    = new_password
        old.role        = "admin"
        old.is_staff    = True
        old.is_superuser = True
        old.is_active   = True
        old.save()

    # ── Ensure uberman@gmail.com exists (create if not already) ─────────────
    admin, created = User.objects.get_or_create(
        email="uberman@gmail.com",
        defaults={
            "username":     "uberman",
            "password":     new_password,
            "role":         "admin",
            "is_staff":     True,
            "is_superuser": True,
            "is_active":    True,
        },
    )
    if not created:
        # Always sync the password and role in case it drifted
        admin.username    = "uberman"
        admin.password    = new_password
        admin.role        = "admin"
        admin.is_staff    = True
        admin.is_superuser = True
        admin.is_active   = True
        admin.save()


def reverse_func(apps, schema_editor):
    pass  # Non-destructive; nothing to reverse


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0008_backfill_site_visits"),
    ]

    operations = [
        migrations.RunPython(update_admin_credentials, reverse_func),
    ]
