# gunicorn.conf.py — Production Gunicorn Configuration for PhishGuard
import multiprocessing
import os

# Server Socket
port = os.getenv("PORT", "8000")
bind = os.getenv("GUNICORN_BIND", f"0.0.0.0:{port}")
backlog = 2048

# Worker Processes
# Standard rule: (2 x cores) + 1, capped at 2 for free tier memory limits (512MB RAM)
cpu_workers = (multiprocessing.cpu_count() * 2 + 1)
workers = int(os.getenv("GUNICORN_WORKERS", min(cpu_workers, 2)))
worker_class = "gthread"
threads = int(os.getenv("GUNICORN_THREADS", 2))
worker_connections = 1000

# Process Naming
proc_name = "phishguard_backend"

# Timeout & Keepalive
timeout = int(os.getenv("GUNICORN_TIMEOUT", 120))
graceful_timeout = 30
keepalive = 5

# Max Requests (Worker recycling to prevent memory leaks)
max_requests = 1000
max_requests_jitter = 50

# Logging
accesslog = "-"  # stdout
errorlog = "-"   # stderr
loglevel = os.getenv("GUNICORN_LOG_LEVEL", "info")
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)sµs'

# Security & Limits
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190

# Preload application code (False on free tier to avoid DB initialization errors at boot)
preload_app = os.getenv("PRELOAD_APP", "False") == "True"
