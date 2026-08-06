# ── Production Dockerfile for PhishGuard Backend (Django + Gunicorn) ──
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    default-libmysqlclient-dev \
    pkg-config \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements into a virtual environment
COPY requirements.txt .
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# --- Final Production Stage ---
FROM python:3.11-slim

WORKDIR /app

# Install runtime system libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    default-mysql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy virtualenv from builder stage
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Create non-root user for security
RUN groupadd -r phishguard && useradd -r -g phishguard -d /app -s /sbin/nologin phishguard

# Copy application source code
COPY --chown=phishguard:phishguard . /app

# Create staticfiles and logs directories with proper permissions
RUN mkdir -p /app/staticfiles /app/logs && \
    chown -R phishguard:phishguard /app

USER phishguard

EXPOSE 8000

# Healthcheck endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/api/auth/health/ || exit 1

CMD ["gunicorn", "--config", "gunicorn.conf.py", "core.wsgi:application"]
