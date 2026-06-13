import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings
from common.json_store import JsonStore


class SupervisionRepository(JsonStore):
    def __init__(self):
        file_path = os.path.join(settings.DATA_DIR, 'supervisions.json')
        super().__init__(file_path, key_name='supervisions')

    def list_by_visit_id(self, visit_id: str):
        items = self.list()
        return [s for s in items if s.get('visit_id') == visit_id]

    def list_active(self):
        items = self.list()
        return [s for s in items if s.get('status') in ['pending', 'assigned', 'processing']]

    def list_by_assignee(self, assignee_id: str):
        items = self.list()
        return [s for s in items if s.get('assignee_id') == assignee_id and s.get('status') in ['pending', 'assigned', 'processing']]

    def list_by_source(self, source_type: str):
        items = self.list()
        return [s for s in items if s.get('source_type') == source_type]


supervision_repository = SupervisionRepository()
