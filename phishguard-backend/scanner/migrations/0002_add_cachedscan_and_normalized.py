from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('scanner', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='url',
            name='normalized_url',
            field=models.TextField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name='url',
            name='normalized_hash',
            field=models.CharField(blank=True, db_index=True, max_length=64, null=True),
        ),
        migrations.CreateModel(
            name='CachedScan',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('normalized_url', models.TextField(unique=True, db_index=True)),
                ('normalized_hash', models.CharField(unique=True, db_index=True, max_length=64)),
                ('verdict', models.CharField(max_length=20, db_index=True)),
                ('confidence_score', models.FloatField(default=0.0)),
                ('risk_score', models.IntegerField(default=0)),
                ('data', models.JSONField(default=dict)),
                ('reasons', models.JSONField(default=list)),
                ('scanned_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'cached_scans',
            },
        ),
    ]
