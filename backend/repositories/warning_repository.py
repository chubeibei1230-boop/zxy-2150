import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings
from common.json_store import JsonStore


class WarningRepository(JsonStore):
    def __init__(self):
        file_path = os.path.join(settings.DATA_DIR, 'warnings.json')
        super().__init__(file_path, key_name='warnings')

    def list_by_visit_id(self, visit_id: str):
        warnings = self.list()
        return [w for w in warnings if w.get('visit_id') == visit_id]

    def list_active(self):
        warnings = self.list()
        return [w for w in warnings if w.get('status') in ['active', 'processing']]

    def list_by_type(self, warning_type: str):
        warnings = self.list()
        return [w for w in warnings if w.get('warning_type') == warning_type]


warning_repository = WarningRepository()
