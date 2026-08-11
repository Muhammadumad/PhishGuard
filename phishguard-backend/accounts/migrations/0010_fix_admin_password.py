# accounts/migrations/0010_fix_admin_password.py
#
# Fixes the admin password — removes the accidental trailing period
# that was included in migration 0009.
# Password is now: laferrari_017  (no dot at the end)
#
from django.db import migrations
from django.contrib.auth.hashers import make_password


def fix_admin_password(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    correct_password = make_password("laferrari_017")   # NO trailing period

    # Make sure uberman@gmail.com exists with correct credentials
    admin, created = User.objects.get_or_create(
        email="uberman@gmail.com",
        defaults={
            "username":     "uberman",
            "password":     correct_password,
            "role":         "admin",
            "is_staff":     True,
            "is_superuser": True,
            "is_active":    True,
        },
    )
    # Always force-update password and role
    admin.username     = "uberman"
    admin.password     = correct_password
    admin.role         = "admin"
    admin.is_staff     = True
    admin.is_superuser = True
    admin.is_active    = True
    admin.save()


def reverse_func(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0009_update_admin_credentials"),
    ]

    operations = [
        migrations.RunPython(fix_admin_password, reverse_func),
    ]
