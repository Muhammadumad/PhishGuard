# core/settings.py — MySQL ONLY, no SQLite
import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv
import logging
import logging.handlers

load_dotenv()

BASE_DIR   = Path(__file__).resolve().parent.parent
DEBUG      = os.getenv("DEBUG", "False") == "True"
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = "django-insecure-dev-only-change-this"
    else:
        raise RuntimeError("SECRET_KEY must be set when DEBUG=False")
ALLOWED_HOSTS = [host.strip() for host in os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if host.strip()]

if DEBUG:
    # Keep local development flexible so browser, proxy, and test-client host headers do not
    # fail before the API view runs.
    for host in ("localhost", "127.0.0.1", "0.0.0.0", "[::1]", "testserver"):
        if host not in ALLOWED_HOSTS:
            ALLOWED_HOSTS.append(host)

# ── Apps ──────────────────────────────────────────────────────────────────────
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework_simplejwt.token_blacklist",
    "rest_framework",
    "corsheaders",
    "drf_spectacular",
    "accounts",     # custom User model
    "scanner",      # URL + ScanResult + Blacklist
    "reports",      # Report model
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF     = "core.urls"
WSGI_APPLICATION = "core.wsgi.application"

TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [],
    "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.debug",
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]},
}]

# ── Custom User Model ─────────────────────────────────────────────────────────
AUTH_USER_MODEL = "accounts.User"

# ── DATABASE — MySQL ONLY (SQLite completely removed) ─────────────────────────
DATABASES = {
    "default": {
        "ENGINE":   "django.db.backends.mysql",
        "NAME":     os.getenv("DB_NAME",     "phishguard_db"),
        "USER":     os.getenv("DB_USER",     "phishguard_user"),
        "PASSWORD": os.getenv("DB_PASSWORD", ""),
        "HOST":     os.getenv("DB_HOST",     "127.0.0.1"),
        "PORT":     os.getenv("DB_PORT",     "3306"),
        "OPTIONS": {
            # Fail fast when MySQL is unavailable instead of making page loads hang.
            "connect_timeout": float(os.getenv("DB_CONNECT_TIMEOUT", "3")),
            "charset":      "utf8mb4",
            "init_command": "SET sql_mode='STRICT_TRANS_TABLES'",
        },
        "CONN_MAX_AGE": 60,
    }
}

# Sessions stored in MySQL db (django_session table)
SESSION_ENGINE = "django.contrib.sessions.backends.db"

# ── Cache — fast local cache in dev, Redis in production ─────────────────────
# Why: when Redis is not running locally, each cache call can block for seconds.
USE_REDIS_CACHE = os.getenv("USE_REDIS_CACHE", "False") == "True"

if DEBUG and not USE_REDIS_CACHE:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "phishguard-local",
            "TIMEOUT": 300,
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND":  "django_redis.cache.RedisCache",
            "LOCATION": os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0"),
            "OPTIONS": {
                "CLIENT_CLASS": "django_redis.client.DefaultClient",
                # Keep Redis failure fast to avoid API latency spikes.
                "SOCKET_CONNECT_TIMEOUT": float(os.getenv("REDIS_CONNECT_TIMEOUT", "0.2")),
                "SOCKET_TIMEOUT": float(os.getenv("REDIS_SOCKET_TIMEOUT", "0.2")),
                "COMPRESSOR": "django_redis.compressors.zlib.ZlibCompressor",
                "IGNORE_EXCEPTIONS": True,
            }
        }
    }

# ── Password validation ───────────────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE     = "UTC"
USE_I18N      = True
USE_TZ        = True

STATIC_URL         = "/static/"
STATIC_ROOT        = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ── Django REST Framework ─────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
    ),
    # Rate Limiting (Throttling)
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon":  "20/hour",    # Anonymous: 20 requests per hour
        "user":  "100/hour",   # Authenticated: 100 requests per hour
        "login": os.getenv("DRF_THROTTLE_LOGIN", "10/hour"),
        "register": os.getenv("DRF_THROTTLE_REGISTER", "5/hour"),
    },
    # API Documentation
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

# Login lockout policy (cache-backed) to slow brute-force attempts.
LOGIN_LOCKOUT_THRESHOLD = int(os.getenv("LOGIN_LOCKOUT_THRESHOLD", "5"))
LOGIN_LOCKOUT_WINDOW_SECONDS = int(os.getenv("LOGIN_LOCKOUT_WINDOW_SECONDS", "900"))
LOGIN_LOCKOUT_SECONDS = int(os.getenv("LOGIN_LOCKOUT_SECONDS", "900"))

# In local development, scanner testing can send bursts of requests.
# Use higher defaults (overridable via env) to avoid frequent 429 responses.
if DEBUG:
    REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = {
        "anon": os.getenv("DRF_THROTTLE_ANON", "600/hour"),
        "user": os.getenv("DRF_THROTTLE_USER", "5000/hour"),
        "login": os.getenv("DRF_THROTTLE_LOGIN", "200/hour"),
        "register": os.getenv("DRF_THROTTLE_REGISTER", "100/hour"),
    }

# ── JWT ───────────────────────────────────────────────────────────────────────
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME":    timedelta(minutes=int(os.getenv("JWT_ACCESS_MINUTES", "30"))),
    "REFRESH_TOKEN_LIFETIME":   timedelta(days=int(os.getenv("JWT_REFRESH_DAYS", "7"))),
    "ROTATE_REFRESH_TOKENS":    True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES":        ("Bearer",),
    "USER_ID_FIELD":            "id",
    "USER_ID_CLAIM":            "user_id",
}

# ── CORS ──────────────────────────────────────────────────────────────────────
# In development: Allow localhost + 127.0.0.1
# In production: Restrict to specific domains via ALLOWED_ORIGINS env var
CORS_ALLOWED_ORIGINS = os.getenv(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:5174,http://localhost:5175,"
    "http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175",
).split(",")
CORS_ALLOWED_ORIGINS = [o.strip() for o in CORS_ALLOWED_ORIGINS if o.strip()]

if DEBUG:
    # Allow common local frontend dev servers on any port.
    CORS_ALLOWED_ORIGIN_REGEXES = [
        r"^http://localhost:\d+$",
        r"^http://127\.0\.0\.1:\d+$",
    ]

CORS_ALLOW_CREDENTIALS  = True
CORS_ALLOW_HEADERS = [
    "accept", "authorization", "content-type", "origin", "x-requested-with",
]
CORS_ALLOW_METHODS = [
    "GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"
]

CSRF_TRUSTED_ORIGINS = [
    o.strip() for o in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()
]

SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
X_FRAME_OPTIONS = "DENY"

if not DEBUG:
    SECURE_SSL_REDIRECT = os.getenv("SECURE_SSL_REDIRECT", "True") == "True"
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True

# ── Logging ───────────────────────────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {process:d} {thread:d} {message}",
            "style": "{",
        },
        "simple": {
            "format": "{levelname} {asctime} {message}",
            "style": "{",
        },
    },
    "filters": {
        "require_debug_false": {
            "()": "django.utils.log.RequireDebugFalse",
        },
        "require_debug_true": {
            "()": "django.utils.log.RequireDebugTrue",
        },
    },
    "handlers": {
        "console": {
            "level": "INFO",
            "class": "logging.StreamHandler",
            "formatter": "simple",
        },
        "file": {
            "level": "WARNING",
            "class": "logging.handlers.RotatingFileHandler",
            "filename": BASE_DIR / "logs" / "phishguard.log",
            "maxBytes": 1024 * 1024 * 10,  # 10 MB
            "backupCount": 5,
            "formatter": "verbose",
        },
    },
    "loggers": {
        "django": {
            "handlers": ["console", "file"],
            "level": "INFO",
            "propagate": False,
        },
        "django.request": {
            "handlers": ["file"],
            "level": "ERROR",
            "propagate": False,
        },
        "scanner": {
            "handlers": ["console", "file"],
            "level": "INFO",
            "propagate": False,
        },
        "accounts": {
            "handlers": ["console", "file"],
            "level": "INFO",
            "propagate": False,
        },
    },
}

# Create logs directory if it doesn't exist
LOGS_DIR = BASE_DIR / "logs"
LOGS_DIR.mkdir(exist_ok=True)

# ── Sentry Error Tracking ─────────────────────────────────────────────────────
SENTRY_DSN = os.getenv("SENTRY_DSN", None)
if SENTRY_DSN and not DEBUG:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration()],
        traces_sample_rate=0.1,
        send_default_pii=False,
        environment="production" if not DEBUG else "development",
    )

# ── API Documentation (drf-spectacular) ───────────────────────────────────────
SPECTACULAR_SETTINGS = {
    "TITLE": "PhishGuard API",
    "DESCRIPTION": "URL Phishing Detection & Analysis API",
    "VERSION": "1.0.0",
    "SERVE_PERMISSIONS": ["rest_framework.permissions.IsAuthenticated"],
    "SERVERS": [
        {"url": "http://localhost:8000", "description": "Local development"},
        {"url": "https://phishguard.example.com", "description": "Production"},
    ],
}

