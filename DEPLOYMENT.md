# Deployment Guide — PC Builder & Hardware Analysis

This document describes how to deploy the PC Builder application to production.

---

## 1. Overview

| Component | Technology |
|-----------|------------|
| Frontend | Static HTML/CSS/JS (served by any static file server or CDN) |
| Backend | Django 5+ with Django REST Framework |
| WSGI Server | Gunicorn (production) |
| Database | SQLite (default) or PostgreSQL (optional) |

---

## 2. Pre-requisites

- Python 3.10+
- A WSGI server (Gunicorn recommended)
- A reverse proxy (Nginx recommended, for static files and TLS)

---

## 3. Environment Configuration

### 3.1 Create `.env` file

Copy the example and set production values:

```bash
cp .env.example .env
```

Edit `.env` with production values. **Never commit your real `.env` file.**

### 3.2 Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DJANGO_SECRET_KEY` | Django secret key (use `get_random_secret_key()`) | `your-secret-key-here` |
| `DJANGO_DEBUG` | Must be `False` in production | `False` |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated hostnames | `example.com,www.example.com` |
| `DJANGO_CORS_ALLOWED_ORIGINS` | CORS origins (your frontend domains) | `https://example.com,https://app.example.com` |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | CSRF trusted origins | `https://example.com,https://app.example.com` |

### 3.3 Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DJANGO_STATIC_ROOT` | `BASE_DIR/staticfiles` | Static files collection directory |
| `DJANGO_MEDIA_ROOT` | `BASE_DIR/media` | Media files directory |
| `DJANGO_SETTINGS_MODULE` | `pc_builder_backend.settings` | Set to `.settings_production` for production |

---

## 4. Backend Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd <repo-dir>

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate    # Linux/macOS
# venv\Scripts\activate      # Windows

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

---

## 5. Production Deployment Steps

### Step 1: Set `DJANGO_SETTINGS_MODULE`

```bash
export DJANGO_SETTINGS_MODULE=pc_builder_backend.settings_production
```

### Step 2: Apply Database Migrations

```bash
python manage.py migrate
```

### Step 3: Load Seed Data

```bash
python manage.py seed_db
```

Re-running this command is safe — it uses `update_or_create` and will not create duplicates.

### Step 4: Collect Static Files

```bash
python manage.py collectstatic --noinput
```

This copies all Django static files to the directory specified by `DJANGO_STATIC_ROOT` (default: `backend/staticfiles/`).

### Step 5: Run Django System Checks

```bash
python manage.py check --deploy
```

Fix any warnings that appear.

### Step 6: Health Check

```bash
python manage.py runserver 8000
# Visit http://127.0.0.1:8000/api/
# Visit http://127.0.0.1:8000/api/analysis/health/
```

### Step 7: Start Production Server (Gunicorn)

```bash
gunicorn --bind 0.0.0.0:8000 pc_builder_backend.wsgi:application
```

For a more robust setup, use `supervisor` or `systemd` to manage the Gunicorn process:

```bash
# Example with gunicorn and 4 workers
gunicorn --workers 4 --bind 0.0.0.0:8000 pc_builder_backend.wsgi:application
```

---

## 6. Frontend Deployment

The frontend is a static site (HTML + CSS + JS). You can deploy it to:

- Any static file hosting (Nginx, Apache, S3, etc.)
- A CDN
- The same server as the backend

### Option A: Serve via Nginx (Recommended)

```nginx
# Example Nginx configuration
server {
    listen 80;
    server_name example.com;

    # Frontend
    root /var/www/pc-builder/assets;
    index index.html;

    # API proxy to Django backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files
    location /static/ {
        alias /app/backend/staticfiles/;
    }

    try_files $uri $uri/ =404;
}
```

### Option B: Serve via Python HTTP Server (Development Only)

```bash
cd /path/to/frontend
python -m http.server 8080
```

Then open `http://localhost:8080/index.html`

---

## 7. API URL Configuration

The frontend reads the API base URL from a `<meta>` tag in the HTML:

```html
<meta name="api-base-url" content="http://localhost:8000/api">
```

To change the API URL for production, edit this meta tag in both `index.html` and `analysis.html`:

```html
<!-- Production: -->
<meta name="api-base-url" content="https://api.example.com/api">
```

Alternatively, you can inject it at runtime:

```html
<script>window.__API_BASE_URL__ = 'https://api.example.com/api';</script>
```

---

## 8. Database Management

### 8.1 SQLite (Default)

SQLite is used for local development. The database file is at `backend/db.sqlite3`.

### 8.2 PostgreSQL (Optional)

For production, PostgreSQL is recommended for better concurrency and reliability.

Set the environment variables:

```bash
DJANGO_DB_ENGINE=django.db.backends.postgresql
DJANGO_DB_NAME=pc_builder
DJANGO_DB_USER=pc_builder_user
DJANGO_DB_PASSWORD=your-password
DJANGO_DB_HOST=localhost
DJANGO_DB_PORT=5432
```

Then update `settings.py` or `settings_production.py` to read these:

```python
DATABASES = {
    'default': {
        'ENGINE': os.getenv('DJANGO_DB_ENGINE', 'django.db.backends.sqlite3'),
        'NAME': os.getenv('DJANGO_DB_NAME', BASE_DIR / 'db.sqlite3'),
        'USER': os.getenv('DJANGO_DB_USER', ''),
        'PASSWORD': os.getenv('DJANGO_DB_PASSWORD', ''),
        'HOST': os.getenv('DJANGO_DB_HOST', 'localhost'),
        'PORT': os.getenv('DJANGO_DB_PORT', '5432'),
    }
}
```

### 8.3 Database Backup and Restore

**SQLite:**

```bash
# Backup
cp backend/db.sqlite3 backend/db_backup.sqlite3

# Restore
cp backend/db_backup.sqlite3 backend/db.sqlite3
```

**PostgreSQL:**

```bash
# Backup
pg_dump -U pc_builder_user pc_builder > backup.sql

# Restore
psql -U pc_builder_user pc_builder < backup.sql
```

---

## 9. Health Check

After deployment, verify the system:

```bash
# Check API is responding
curl http://your-server:8000/api/

# Check health endpoint
curl http://your-server:8000/api/analysis/health/

# Check hardware data is available
curl http://your-server:8000/api/hardware/categories/

# Run Django deploy checks
python manage.py check --deploy
```

Expected responses:
- `/api/` → `{"name":"PC Builder & Hardware Analysis API","status":"active", ...}`
- `/api/analysis/health/` → `{"status":"healthy","required_categories":[...], ...}`
- `/api/hardware/categories/` → Array of 8 category objects

---

## 10. Troubleshooting

### Migration Errors

```bash
# Reset migrations (development only)
python manage.py migrate hardware zero
python manage.py migrate

# Re-seed
python manage.py seed_db
```

### Static Files Issues

```bash
# Clear and re-collect
rm -rf backend/staticfiles
python manage.py collectstatic --noinput
```

### CORS Issues

Check that your frontend origin is listed in `DJANGO_CORS_ALLOWED_ORIGINS` in `.env`.

### Debugging Production Issues

```bash
# Temporarily enable debug (NEVER in production)
export DJANGO_DEBUG=True
export DJANGO_SETTINGS_MODULE=pc_builder_backend.settings

# Check logs
python manage.py check --deploy
```

---

## 11. Security Checklist

Before going live, verify:

- [ ] `DJANGO_SECRET_KEY` is set and unique
- [ ] `DJANGO_DEBUG=False`
- [ ] `DJANGO_ALLOWED_HOSTS` includes your domain(s)
- [ ] CORS origins are restricted to known frontend domains
- [ ] HTTPS is enabled (via reverse proxy like Nginx)
- [ ] `SECURE_CONTENT_TYPE_NOSNIFF=True` (set in production settings)
- [ ] `SESSION_COOKIE_SECURE=True` (set in production settings)
- [ ] `CSRF_COOKIE_SECURE=True` (set in production settings)
- [ ] No hardcoded credentials in code
- [ ] `.env` file is not committed to version control (`.gitignore` includes `.env`)

---

## 12. Quick Start Commands Summary

```bash
# Production deployment
export DJANGO_SETTINGS_MODULE=pc_builder_backend.settings_production
python manage.py migrate
python manage.py seed_db
python manage.py collectstatic --noinput
python manage.py check --deploy
gunicorn --workers 4 --bind 0.0.0.0:8000 pc_builder_backend.wsgi:application
```
