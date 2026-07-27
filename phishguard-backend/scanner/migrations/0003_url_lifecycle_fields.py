from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('scanner', '0002_add_cachedscan_and_normalized'),
    ]

    operations = [
        migrations.AddField(
            model_name='url',
            name='processing_started_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='url',
            name='failure_count',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='url',
            name='last_error',
            field=models.TextField(blank=True, null=True),
        ),
    ]
