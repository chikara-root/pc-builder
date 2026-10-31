"""
Production settings for PC Builder backend.
Inherits from base settings, overrides for production use.
"""
from .settings import *
import os

# SECURITY WARNING: Don't run with DEBUG=True in production!
DEBUG = False

# SECURITY WARNING: Define the correct hosts in production
ALLOWED_HOSTS = os.getenv('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

# SECURITY WARNING: Use a strong, unique secret key in production
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY')

if not SECRET_KEY:
    raise RuntimeError(
        "DJANGO_SECRET_KEY environment variable must be set for production."
    )

# CORS: In production, only allow specific origins
# Override CORS_ALLOWED_ORIGINS from environment variable (comma-separated)
_cors_origins = os.getenv('DJANGO_CORS_ALLOWED_ORIGINS', '')
if _cors_origins:
    CORS_ALLOWED_ORIGINS = [origin.strip() for origin in _cors_origins.split(',') if origin.strip()]

# CSRF: Configure trusted origins for production
_default_csrf_origins = ['http://localhost:8000', 'http://localhost:8080', 'http://127.0.0.1:8000', 'http://127.0.0.1:8080']
_csrf_origins_from_env = [origin.strip() for origin in os.getenv('DJANGO_CSRF_TRUSTED_ORIGINS', '').split(',') if origin.strip()]
CSRF_TRUSTED_ORIGINS = _csrf_origins_from_env if _csrf_origins_from_env else _default_csrf_origins

# Secure cookies
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Static files (CSS, JavaScript, Images)
# Required for `collectstatic` in production
STATIC_ROOT = os.getenv('DJANGO_STATIC_ROOT', BASE_DIR / 'staticfiles')

# Media files
MEDIA_ROOT = os.getenv('DJANGO_MEDIA_ROOT', BASE_DIR / 'media')

# Override the base settings' MAILERS config with production SMTP settings
MAILERS = {
    'default': {
        'BACKEND': 'django.core.mail.backends.smtp.EmailBackend',
        'EMAIL_HOST': os.getenv('DJANGO_EMAIL_HOST', 'localhost'),
        'EMAIL_PORT': int(os.getenv('DJANGO_EMAIL_PORT', 587)),
        'EMAIL_USE_TLS': os.getenv('DJANGO_EMAIL_USE_TLS', 'True') == 'True',
        'EMAIL_HOST_USER': os.getenv('DJANGO_EMAIL_HOST_USER', ''),
        'EMAIL_HOST_PASSWORD': os.getenv('DJANGO_EMAIL_HOST_PASSWORD', ''),
    }
}

# Security settings
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = 'DENY'
# HSTS - enable if serving over SSL (set to 31536000 for 1 year in production with SSL)
SECURE_HSTS_SECONDS = int(os.getenv('DJANGO_HSTS_SECONDS', '0'))
SECURE_HSTS_INCLUDE_SUBDOMAINS = SECURE_HSTS_SECONDS > 0
SECURE_HSTS_PRELOAD = SECURE_HSTS_SECONDS > 0
# SSL redirect - enable when using HTTPS (set to True in production behind HTTPS)
SECURE_SSL_REDIRECT = os.getenv('DJANGO_SSL_REDIRECT', 'False') == 'True'

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
}
