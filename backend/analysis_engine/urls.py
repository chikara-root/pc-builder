"""
URLs for analysis engine API.
"""

from django.urls import path
from . import views

urlpatterns = [
    path('analyze/', views.analyze_configuration, name='analyze-configuration'),
    path('health/', views.analysis_health, name='analysis-health'),
]
