"""
API views for analysis engine - reuses Stage 4 analysis logic.
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .analysis_service import perform_analysis


@api_view(['POST'])
@permission_classes([AllowAny])
def analyze_configuration(request):
    """
    Analyze a PC configuration and return compatibility + performance results.
    
    Request body:
    {
        "selections": {
            "cpu": "cpu_i9_14900k",
            "gpu": "gpu_rtx_4070_ti",
            "ram": ["ram_ddr5_6400_32"],
            "motherboard": "mobo_z790_atx",
            "storage": ["ssd_980_pro_1"],
            "psu": "psu_rm750x",
            "case": "case_4000d",
            "cooler": "cooler_nh_d15"
        }
    }
    
    Returns structured analysis result with:
    - valid: whether config passes validation
    - missingCategories: list of missing required categories
    - blockingErrors: list of blocking compatibility errors
    - warnings: list of non-blocking warnings
    - performance: detailed analysis results if valid
    """
    data = request.data
    selections = data.get('selections', {})

    # Validate that selections is a dict
    if not isinstance(selections, dict):
        return Response(
            {'detail': 'Request must include a "selections" object'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        result = perform_analysis(selections)
        return Response(result)
    except Exception as e:
        return Response(
            {'detail': f'Error during analysis: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def analysis_health(request):
    """Health check for the analysis engine API."""
    from .analysis_service import get_required_categories
    return Response({
        'status': 'healthy',
        'required_categories': get_required_categories(),
        'engine_version': '1.0.0',
    })
