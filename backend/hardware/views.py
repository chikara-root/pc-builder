"""
API views for hardware categories and components.
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .data_loader import (
    get_categories,
    get_category_meta,
    get_mock_database_items,
    get_item_by_id,
    filter_items,
    get_unique_filter_values,
    get_filter_config,
)
from .serializers import (
    CategorySerializer,
    ComponentSerializer,
    FilterConfigSerializer,
)


@api_view(['GET'])
@permission_classes([AllowAny])
def categories_list(request):
    """Retrieve all hardware categories with metadata."""
    meta = get_category_meta()
    categories_data = []
    for cat_key in get_categories():
        cat_meta = meta.get(cat_key, {})
        categories_data.append({
            'key': cat_key,
            'label': cat_meta.get('label', ''),
            'icon': cat_meta.get('icon', ''),
            'short': cat_meta.get('short', ''),
            'filterable': cat_meta.get('filterable', False),
            'multiSelect': cat_meta.get('multiSelect', False),
        })
    serializer = CategorySerializer(categories_data, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([AllowAny])
def category_components(request, category_key):
    """
    Retrieve components for a specific category.
    
    Query params:
        - manufacturer (for cpu/gpu)
        - family (for cpu)
        - gen (for cpu)
        - generation (for gpu)
        - type (for ram)
        - capacity_GB (for ram)
        - ramType (for motherboard)
        - interface (for storage)
        - type (for storage)
    """
    # Validate category exists
    valid_categories = get_categories()
    if category_key not in valid_categories:
        return Response(
            {'detail': f'Invalid category "{category_key}". Valid categories: {valid_categories}'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Build filters from query parameters
    filters = {}
    filter_config = get_filter_config()
    category_filters = filter_config.get(category_key, [])

    for f in category_filters:
        f_key = f['key']
        f_val = request.query_params.get(f_key)
        if f_val is not None and f_val != '':
            filters[f_key] = f_val

    # Apply filters
    items = filter_items(category_key, filters)
    serializer = ComponentSerializer(items, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([AllowAny])
def component_detail(request, category_key, component_id):
    """Retrieve a specific component by ID."""
    # Validate category
    valid_categories = get_categories()
    if category_key not in valid_categories:
        return Response(
            {'detail': f'Invalid category "{category_key}". Valid categories: {valid_categories}'},
            status=status.HTTP_400_BAD_REQUEST
        )

    item = get_item_by_id(category_key, component_id)
    if item is None:
        return Response(
            {'detail': f'Component "{component_id}" not found in category "{category_key}"'},
            status=status.HTTP_404_NOT_FOUND
        )

    serializer = ComponentSerializer(item)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([AllowAny])
def category_filter_options(request, category_key):
    """
    Retrieve available filter options for a category.
    Returns unique values for each filter field.
    """
    valid_categories = get_categories()
    if category_key not in valid_categories:
        return Response(
            {'detail': f'Invalid category "{category_key}". Valid categories: {valid_categories}'},
            status=status.HTTP_400_BAD_REQUEST
        )

    filter_config = get_filter_config()
    category_filters = filter_config.get(category_key, [])

    # Get applied filters from query params (for cross-filtering)
    applied_filters = {}
    for f in category_filters:
        f_val = request.query_params.get(f['key'])
        if f_val and f_val != '':
            applied_filters[f['key']] = f_val

    filter_options = {}
    for f in category_filters:
        f_key = f['key']
        # Build filters excluding the current field being queried
        other_filters = {k: v for k, v in applied_filters.items() if k != f_key}
        values = get_unique_filter_values(category_key, f_key, other_filters)
        filter_options[f_key] = {
            'label': f['label'],
            'options': values
        }

    return Response({'category': category_key, 'filters': filter_options})
