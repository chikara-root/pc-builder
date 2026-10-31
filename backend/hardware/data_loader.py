"""
Data loader for hardware components.
Serves data from the SQLite database when available, falling back to JSON for cache.
"""

import json
import os
from functools import lru_cache
from typing import Any, Dict, List, Optional

from django.conf import settings
from django.db import DatabaseError

from hardware.models import Category, Component


def _load_mock_database() -> Dict[str, Any]:
    """Load the mock database from JSON file (fallback)."""
    json_path = os.path.join(settings.BASE_DIR, 'hardware', 'mock_database.json')
    with open(json_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def _get_categories_from_json() -> List[str]:
    return _load_mock_database()['categories']


def _get_category_meta_from_json() -> Dict[str, Any]:
    return _load_mock_database()['category_meta']


def get_categories() -> List[str]:
    """Get list of all hardware categories."""
    try:
        return list(Category.objects.values_list('key', flat=True))
    except (DatabaseError, Exception):
        return _get_categories_from_json()


def get_category_meta() -> Dict[str, Any]:
    """Get category metadata by key."""
    try:
        meta = {}
        for cat in Category.objects.all():
            meta[cat.key] = {
                'label': cat.label,
                'icon': cat.icon,
                'short': cat.short,
                'filterable': cat.filterable,
                'multiSelect': cat.multi_select,
            }
        return meta
    except (DatabaseError, Exception):
        return _get_category_meta_from_json()


def get_mock_database_items(category: str) -> List[Dict[str, Any]]:
    """Get all items for a specific category."""
    try:
        items = Component.objects.filter(category__key=category)
        return [dict(item.specs, id=item.id, name=item.name) for item in items]
    except (DatabaseError, Exception):
        return _load_mock_database()['mock_database'].get(category, [])


def get_filter_config() -> Dict[str, Any]:
    """Get filter configuration."""
    return _load_mock_database()['filter_config']


def get_item_by_id(category: str, item_id: str) -> Optional[Dict[str, Any]]:
    """Find a single item by ID within a category."""
    try:
        try:
            item = Component.objects.get(id=item_id, category__key=category)
            return dict(item.specs, id=item.id, name=item.name)
        except Component.DoesNotExist:
            return None
    except (DatabaseError, Exception):
        items = _load_mock_database()['mock_database'].get(category, [])
        for item in items:
            if item.get('id') == item_id:
                return item
        return None


def filter_items(category: str, filters: Dict[str, str]) -> List[Dict[str, Any]]:
    """
    Filter items in a category by the given filter criteria.
    Also applies cross-component compatibility filtering.
    """
    items = get_mock_database_items(category)
    if not filters:
        return items

    filtered = []
    for item in items:
        match = True
        for f_key, f_val in filters.items():
            if f_val and str(item.get(f_key, '')) != f_val:
                match = False
                break
        if match:
            filtered.append(item)

    return filtered


def get_unique_filter_values(category: str, field_key: str, applied_filters: Dict[str, str] = None) -> List[str]:
    """
    Get unique values for a filter field, optionally applying cross-component filters.
    """
    items = get_mock_database_items(category)

    if applied_filters:
        for f_key, f_val in applied_filters.items():
            if f_val:
                items = [item for item in items if str(item.get(f_key, '')) == f_val]

    values = set()
    for item in items:
        val = item.get(field_key)
        if val is not None and val != '':
            values.add(str(val))

    return sorted(list(values), key=lambda x: (x.isdigit(), x))


def parse_tdp(tdp_str: Optional[str]) -> int:
    """Parse TDP string to integer watts."""
    if not tdp_str:
        return 0
    num = int(''.join(filter(str.isdigit, str(tdp_str))))
    return num if num else 0
