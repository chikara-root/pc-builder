# PC Builder & Hardware Analysis

A full-stack web application for building PC configurations, checking hardware compatibility, and analyzing performance.

## Overview

- **Frontend**: Static HTML/CSS/JavaScript with Bootstrap and Chart.js
- **Backend**: Django REST Framework API
- **Database**: SQLite (development), PostgreSQL (optional for production)
- **Analysis Engine**: Python-based compatibility and performance analysis

## Screenshots

_(Add screenshots of the application UI here)_

## Features

- Hardware component browsing by category
- Interactive filters for narrowing down components
- Multi-select support for RAM and storage
- Real-time compatibility checking (sockets, RAM types, PSU wattage, etc.)
- Performance analysis with workload scores, bottleneck calculation, and FPS estimates
- Detailed power consumption analysis
- Local fallback when API is unavailable

## Requirements

- Python 3.10+
- Node.js (optional, for running JavaScript tests)

## Local Development Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd <repo-dir>
```

### 2. Set Up Virtual Environment

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate    # Windows
# source venv/bin/activate  # Linux/macOS
pip install -r ../requirements.txt
```

### 3. Configure Environment

```bash
cd ..
cp .env.example .env
# Edit .env as needed (default settings work for local development)
```

### 4. Initialize Database

```bash
cd backend
python manage.py migrate
python manage.py seed_db
```

This creates the SQLite database with 60 hardware components across 8 categories.

### 5. Start the Backend

```bash
# From the backend directory
python manage.py runserver 8000
```

The API will be available at `http://localhost:8000/api/`.

### 6. Start the Frontend

```bash
# From the project root directory
python -m http.server 8080
```

Open `http://localhost:8080/index.html` in your browser.

Alternatively, use VS Code Live Server (port 5500).

## Project Structure

```
mehrzad/
├── backend/                          # Django project
│   ├── pc_builder_backend/           # Django project settings
│   │   ├── settings.py               # Base development settings
│   │   ├── settings_production.py    # Production settings
│   │   ├── urls.py                   # URL routing
│   │   ├── wsgi.py                   # WSGI config
│   │   └── manage.py                 # Django management script
│   ├── hardware/                     # Hardware app
│   │   ├── models.py                 # Category and Component models
│   │   ├── data_loader.py            # Database/JSON data loading
│   │   ├── serializers.py            # API serializers
│   │   ├── views.py                  # API endpoints
│   │   ├── urls.py                   # Hardware URL routes
│   │   ├── mock_database.json        # Seed data (fallback)
│   │   └── management/commands/
│   │       └── seed_db.py            # Database seeding command
│   ├── analysis_engine/              # Analysis app
│   │   ├── analysis_service.py       # Python analysis logic
│   │   ├── views.py                  # Analysis API endpoints
│   │   ├── urls.py                   # Analysis URL routes
│   │   └── tests.py                  # Analysis tests
│   └── db.sqlite3                    # SQLite database (seeded)
├── assets/                           # Frontend static files
│   ├── css/                          # Stylesheets
│   └── js/
│       ├── api-config.js             # API URL configuration
│       ├── api-service.js            # API service wrapper
│       ├── mock-database.js          # Local fallback data
│       ├── analysis-engine.js        # Frontend analysis logic (Stage 4)
│       ├── ui-behavior.js            # UI behavior and state management
│       ├── charts-mock.js            # Chart.js rendering
│       ...
├── index.html                        # Frontend entry point
├── analysis.html                     # Analysis results page
├── requirements.txt                  # Python dependencies
├── .env.example                      # Environment variable template
├── .gitignore                        # Git ignore rules
├── DEPLOYMENT.md                     # Production deployment guide
└── README.md                         # This file
```

## API Endpoints

### Hardware

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/` | GET | API root and health info |
| `/api/hardware/categories/` | GET | List all hardware categories |
| `/api/hardware/categories/{category}/components/` | GET | List components in a category |
| `/api/hardware/categories/{category}/filters/` | GET | Get available filters for a category |
| `/api/hardware/categories/{category}/components/{id}/` | GET | Get specific component details |

### Analysis

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analysis/health/` | GET | Analysis engine health and required categories |
| `/api/analysis/analyze/` | POST | Analyze a PC configuration |

### Analysis Request

```json
POST /api/analysis/analyze/
Content-Type: application/json

{
  "selections": {
    "cpu": "cpu_i5_12400f",
    "gpu": "gpu_rt_4060_ti",
    "ram": ["ram_ddr4_3200_16"],
    "motherboard": "mobo_z690_atx",
    "storage": ["ssd_980_pro_1"],
    "psu": "psu_rm750x",
    "case": "case_4000d",
    "cooler": "cooler_nh_d15"
  }
}
```

### Analysis Response

```json
{
  "valid": true,
  "missingCategories": [],
  "blockingErrors": [],
  "warnings": [],
  "performance": {
    "cpu": {...},
    "gpu": {...},
    "workloadScores": {...},
    "bottleneck": {...},
    "powerConsumption": {...}
  }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DJANGO_SECRET_KEY` | (dev only) | Django secret key for sessions/auth |
| `DJANGO_DEBUG` | `True` | Enable/disable Django debug mode |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | Allowed host headers |
| `DJANGO_CORS_ALLOWED_ORIGINS` | (dev ports) | CORS allowed origins |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | (dev ports) | CSRF trusted origins |
| `DJANGO_SETTINGS_MODULE` | `pc_builder_backend.settings` | Settings module path |
| `DJANGO_STATIC_ROOT` | *(unset)* | Static files collection directory (production) |
| `DJANGO_MEDIA_ROOT` | *(unset)* | Media files directory (production) |

See `.env.example` for all available variables.

## Database

### Local Development (SQLite)

The SQLite database (`backend/db.sqlite3`) is seeded with 60 hardware components across 8 categories.

To re-seed (safe, idempotent):
```bash
python manage.py seed_db
```

### Production (PostgreSQL)

Optional PostgreSQL configuration via environment variables. See [DEPLOYMENT.md](DEPLOYMENT.md) for details.

### Database Backup (SQLite)

```bash
copy backend\db.sqlite3 backend\db_backup.sqlite3
```

## Running Tests

### Backend Tests

```bash
cd backend
python manage.py test
```

### Frontend Tests (Node.js)

```bash
node test-analysis-engine.js
node test-ui-integration.js
```

## Production Deployment

For production deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

### Quick Production Setup

```bash
export DJANGO_SETTINGS_MODULE=pc_builder_backend.settings_production
python manage.py migrate
python manage.py seed_db
python manage.py collectstatic --noinput
python manage.py check --deploy
gunicorn --workers 4 --bind 0.0.0.0:8000 pc_builder_backend.wsgi:application
```

## Architecture

### Backend (Django)

- **Hardware App**: Manages component data (CPU, GPU, RAM, etc.) with REST API endpoints
- **Analysis Engine**: Python port of the JavaScript analysis logic (compatibility checks, performance analysis)
- **Data Layer**: SQLite database with JSON fallback for cache

### Frontend

- **api-config.js**: Environment-aware API configuration
- **api-service.js**: API service wrapper functions
- **mock-database.js**: Local fallback hardware data
- **analysis-engine.js**: Client-side analysis engine (mirrors Django backend)
- **ui-behavior.js**: Main UI logic, state management, and event handling
- **charts-mock.js**: Chart.js visualization for analysis results

## License

_(Add license information here)_
