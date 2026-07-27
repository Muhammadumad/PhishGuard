import pymysql
pymysql.version_info = (2, 2, 1, "final", 0)
pymysql.install_as_MySQLdb()

# Ensure Celery app is loaded when Django starts (so autodiscover runs)
try:
	# Imported lazily to avoid import-time side effects during some management commands
	from .celery import app as celery_app  # noqa: F401
except Exception:
	celery_app = None