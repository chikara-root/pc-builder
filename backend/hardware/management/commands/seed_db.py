import json
import os
from django.core.management.base import BaseCommand
from django.conf import settings
from hardware.models import Category, Component

class Command(BaseCommand):
    help = 'Seeds the database with hardware data from mock_database.json'

    def handle(self, *args, **options):
        json_path = os.path.join(settings.BASE_DIR, 'hardware', 'mock_database.json')
        
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        category_meta = data.get('category_meta', {})
        mock_database = data.get('mock_database', {})

        self.stdout.write('Seeding categories...')
        for key, meta in category_meta.items():
            Category.objects.update_or_create(
                key=key,
                defaults={
                    'label': meta['label'],
                    'icon': meta['icon'],
                    'short': meta['short'],
                    'filterable': meta.get('filterable', False),
                    'multi_select': meta.get('multiSelect', False),
                }
            )

        self.stdout.write('Seeding components...')
        for cat_key, items in mock_database.items():
            category = Category.objects.get(key=cat_key)
            for item in items:
                item_id = item.pop('id')
                name = item.pop('name')
                Component.objects.update_or_create(
                    id=item_id,
                    defaults={
                        'category': category,
                        'name': name,
                        'specs': item
                    }
                )

        self.stdout.write(self.style.SUCCESS('Successfully seeded database'))
