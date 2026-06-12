import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings
from common.json_store import JsonStore


class VisitRepository(JsonStore):
    def __init__(self):
        file_path = os.path.join(settings.DATA_DIR, 'visits.json')
        super().__init__(file_path, key_name='visits')

    def list_by_user_phone_and_category(self, user_phone: str, category_id: str, exclude_order_id: str = None):
        visits = self.list()
        result = []
        for visit in visits:
            if visit.get('user_phone') == user_phone and visit.get('category_id') == category_id:
                if exclude_order_id and visit.get('repair_order_id') == exclude_order_id:
                    continue
                result.append(visit)
        return result


visit_repository = VisitRepository()
