# accounts/migrations/0007_seed_admin_users.py
from django.db import migrations
from django.contrib.auth.hashers import make_password


def create_or_update_admin_users(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    hashed_password = make_password("Admin12345!")

    # 1. Dedicated Admin Account
    admin1, created = User.objects.get_or_create(
        email="admin@phishguard.com",
        defaults={
            "username": "admin_phishguard",
            "password": hashed_password,
            "role": "admin",
            "is_staff": True,
            "is_superuser": True,
            "is_active": True,
        },
    )
    admin1.password = hashed_password
    admin1.role = "admin"
    admin1.is_staff = True
    admin1.is_superuser = True
    admin1.is_active = True
    admin1.save()

    # 2. Primary Owner Admin Account
    admin2, created = User.objects.get_or_create(
        email="muhammadumaf.com@gmail.com",
        defaults={
            "username": "simply-hammer",
            "password": hashed_password,
            "role": "admin",
            "is_staff": True,
            "is_superuser": True,
            "is_active": True,
        },
    )
    admin2.password = hashed_password
    admin2.role = "admin"
    admin2.is_staff = True
    admin2.is_superuser = True
    admin2.is_active = True
    admin2.save()


def reverse_func(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0006_add_site_visit_model"),
    ]

    operations = [
        migrations.RunPython(create_or_update_admin_users, reverse_func),
    ]
