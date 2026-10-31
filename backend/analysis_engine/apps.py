"""
Analysis engine app configuration.
"""

from django.apps import AppConfig


class AnalysisEngineConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'analysis_engine'
    verbose_name = 'Analysis Engine'
