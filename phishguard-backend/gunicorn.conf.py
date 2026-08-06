# gunicorn.conf.py — Production Gunicorn Configuration for PhishGuard
import multiprocessing
import os

# Server Socket
bind = os.getenv("GUNICORN_BIND", "0.0.0.0:8000")
backlog = 2048

# Worker Processes
# Standard rule: (2 x cores) + 1
workers = int(os.getenv("GUNICORN_WORKERS", multiprocessing.cpu_count() * 2 + 1))
worker_class = "gthread"
threads = int(os.getenv("GUNICORN_THREADS", 2))
worker_connections = 1000

# Process Naming
proc_name = "phishguard_backend"

# Timeout & Keepalive
timeout = int(os.getenv("GUNICORN_TIMEOUT", 60))
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

# Preload application code for lower memory usage across workers
preload_app = True
