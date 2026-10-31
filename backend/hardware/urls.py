"""
URLs for hardware API.
"""

from django.urls import path
from . import views

urlpatterns = [
    path('categories/', views.categories_list, name='categories-list'),
    path('categories/<str:category_key>/components/', views.category_components, name='category-components'),
    path('categories/<str:category_key>/filters/', views.category_filter_options, name='category-filters'),
    path('categories/<str:category_key>/components/<str:component_id>/', views.component_detail, name='component-detail'),
]
