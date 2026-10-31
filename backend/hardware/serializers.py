"""
Serializers for hardware API responses.
"""

from rest_framework import serializers


class CategoryMetaSerializer(serializers.Serializer):
    label = serializers.CharField()
    icon = serializers.CharField()
    short = serializers.CharField()
    filterable = serializers.BooleanField(required=False, default=False)
    multiSelect = serializers.BooleanField(required=False, default=False)


class CategorySerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()
    icon = serializers.CharField()
    short = serializers.CharField()
    filterable = serializers.BooleanField(required=False, default=False)
    multiSelect = serializers.BooleanField(required=False, default=False)


class ComponentSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()

    class Meta:
        fields = ['id', 'name']

    def to_representation(self, instance):
        return instance


class FilterOptionSerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()


class FilterConfigSerializer(serializers.Serializer):
    cpu = FilterOptionSerializer(many=True, required=False)
    gpu = FilterOptionSerializer(many=True, required=False)
    ram = FilterOptionSerializer(many=True, required=False)
    motherboard = FilterOptionSerializer(many=True, required=False)
    storage = FilterOptionSerializer(many=True, required=False)


class ValidationErrorSerializer(serializers.Serializer):
    detail = serializers.CharField()
