import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings
from common.json_store import JsonStore


class CategoryRepository(JsonStore):
    def __init__(self):
        file_path = os.path.join(settings.DATA_DIR, 'categories.json')
        super().__init__(file_path, key_name='categories')


category_repository = CategoryRepository()
