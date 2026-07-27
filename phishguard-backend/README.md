# PhishGuard Backend

> Django backend for the PhishGuard project — threat detection and scanning services.

**Prerequisites:** Python 3.8+, virtualenv, and dependencies in `requirements.txt`.

**Quick start:**

1. Create and activate a virtual environment:

```bash
python -m venv venv
# Windows PowerShell
.\venv\Scripts\Activate.ps1
# or on cmd: venv\Scripts\activate
```

2. Install dependencies and run migrations:

```bash
pip install -r requirements.txt
python manage.py migrate
```

3. Run the development server:

```bash
python manage.py runserver
```

**Notes:**

- Add any sensitive keys to a `.env` file (ignored via `.gitignore`).
- See `scanner/thresholds.json` for analyzer thresholds.
