# 🛡️ PhishGuard | Threat Intelligence Console

> **Real-Time Phishing Interdiction & Cyber Threat Intelligence System**  
> PhishGuard blocks malicious links before the click, enriches URL threat data with multi-vendor intelligence, and gives security analysts a decision path under pressure.

---

## 🌟 Key Features

- ⚡ **Sub-400ms URL Detection**: Rapid automated link scanning with instantaneous risk score calculation (0–100 scale).
- 🔍 **Multi-Layer Threat Intelligence**: Deep inspection of SPF/DKIM alignment, TLS certificate fingerprints, WHOIS domain age, and HTTP redirect chains.
- 📊 **Telemetry Analytics**: Dynamic Chart.js trends, risk band distributions, confidence metrics, and historical logs.
- 📦 **Batch Bulk Scanner**: Scan hundreds of URLs simultaneously with live progress bars and CSV export capabilities.
- 🖥️ **SOC Analyst Triage UI**: High-contrast, non-generic cybersecurity UI featuring live streaming threat feeds, glassmorphism cards, and interactive SVG score gauges.
- 🔒 **Enterprise Authentication**: JWT-based authentication (SimpleJWT), role-based access control (Admin / Analyst), and report escalation workflows.

---

## 🏗️ Architecture & Tech Stack

```
                     ┌─────────────────────────────────────────┐
                     │          React 19 + Vite Frontend       │
                     │  (Zustand, TanStack Query, Chart.js)    │
                     └────────────────────┬────────────────────┘
                                          │  REST API (JWT)
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │           Django REST Backend           │
                     │  (Risk Scoring, URL Enrichment Engine)  │
                     └────────────────────┬────────────────────┘
                                          │
                               ┌──────────┴──────────┐
                               ▼                     ▼
                     ┌──────────────────┐   ┌──────────────────┐
                     │ Redis + Celery   │   │ PostgreSQL/SQLite│
                     │ Async Task Queue │   │ Threat Audit Log │
                     └──────────────────┘   └──────────────────┘
```

### 💻 Technologies Used
- **Frontend**: React 19, Vite, React Router v7, Zustand, TanStack Query, Chart.js, Vanilla CSS Design System (Google Fonts: *Plus Jakarta Sans*, *Inter*, *JetBrains Mono*).
- **Backend**: Python 3.10+, Django 5.x, Django REST Framework, Celery, Redis, SQLite / PostgreSQL, SimpleJWT.

---

## 📁 Repository Structure

```
PhishGuard/
├── phishguard-frontend/         # Vite + React 19 Frontend Console
│   ├── src/
│   │   ├── api/                 # Axios API services (Auth & Scan endpoints)
│   │   ├── components/          # TopNavbar, Sidebar, AuthGuard, UI Cards
│   │   ├── pages/               # Landing, Dashboard, BulkScanner, History, Analytics, QA
│   │   ├── store/               # Zustand stores (Auth, Theme, Performance)
│   │   └── index.css            # High-contrast Cyber Design System
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── phishguard-backend/          # Django REST API & Intelligence Engine
│   ├── core/                    # Django settings & Celery config
│   ├── scanner/                 # Threat scanning app, models, views, tasks
│   ├── manage.py
│   └── requirements.txt
│
├── PROJECT_ANALYSIS.md
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Python**: v3.10 or higher
- **Git**

---

### 1️⃣ Backend Setup (Django)

```bash
# Navigate to backend directory
cd phishguard-backend

# Create and activate Python virtual environment
python -m venv venv

# Windows
.\venv\Scripts\activate
# Linux/macOS
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Start the Django development server
python manage.py runserver
```
Backend will run at: `http://localhost:8000/`

---

### 2️⃣ Frontend Setup (React + Vite)

```bash
# Open a new terminal and navigate to frontend directory
cd phishguard-frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
Frontend console will run at: `http://localhost:5174/` (or `http://localhost:5173/`)

---

## 📡 API Reference

| Endpoint | Method | Description | Auth Required |
|---|---|---|---|
| `/api/token/` | `POST` | Authenticate user & obtain JWT access token | ❌ No |
| `/api/token/refresh/` | `POST` | Refresh access token | ❌ No |
| `/api/scan/` | `POST` | Scan single URL for phishing threats | 🔒 Yes |
| `/api/bulk-scan/` | `POST` | Batch scan multiple URLs | 🔒 Yes |
| `/api/history/` | `GET` | Retrieve past scan audit logs | 🔒 Yes |
| `/api/stats/` | `GET` | Fetch real-time threat telemetry statistics | 🔒 Yes |

---

## 🎨 Design System & Aesthetics

PhishGuard features a custom-crafted **Cybersecurity Triage Theme**:
- **High-Contrast Typography**: Pure white headers (`#ffffff`), crisp slate copy (`#e2e8f0`), and JetBrains Mono data logs.
- **Micro-Interactions**: Hover elevation, subtle drop-shadow glows, animated score rings, and real-time streaming feed indicators.
- **Ergonomic Buttons**: Distinct primary call-to-actions, glassmorphism secondary controls, and crimson alert buttons.

---

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request:
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git checkout -b feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for details.
