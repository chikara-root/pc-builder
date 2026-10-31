"""Main URL configuration for the PC Builder backend."""

from pathlib import Path

from django.conf import settings
from django.contrib import admin
from django.http import FileResponse
from django.urls import include, path

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


def home(request):
    """Serve the frontend homepage."""
    index_file = Path(settings.BASE_DIR).parent / "index.html"
    return FileResponse(
        index_file.open("rb"),
        content_type="text/html; charset=utf-8",
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def api_root(request):
    """API health check and root info."""
    return Response({
        "name": "PC Builder & Hardware Analysis API",
        "version": "1.0.0",
        "status": "active",
        "endpoints": {
            "hardware": "/api/hardware/",
            "analysis": "/api/analysis/",
        },
    })


urlpatterns = [
    path("", home, name="home"),
    path("admin/", admin.site.urls),
    path("api/", api_root, name="api-root"),
    path("api/hardware/", include("hardware.urls")),
    path("api/analysis/", include("analysis_engine.urls")),
]