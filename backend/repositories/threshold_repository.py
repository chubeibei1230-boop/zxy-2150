import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings


DEFAULT_THRESHOLD = {
    'default_visit_days': 7,
    'satisfaction_standard': 4,
    'max_unreachable_attempts': 3,
    'repeat_repair_days': 30,
    'warning_pending_days': 3,
    'warning_low_satisfaction': 3,
    'warning_unreachable_count': 2,
    'warning_reprocess_days': 3,
}


class ThresholdRepository:
    def __init__(self):
        self.file_path = os.path.join(settings.DATA_DIR, 'thresholds.json')
        self._ensure_file_exists()

    def _ensure_file_exists(self):
        if not os.path.exists(self.file_path):
            with open(self.file_path, 'w', encoding='utf-8') as f:
                json.dump({'thresholds': DEFAULT_THRESHOLD}, f, ensure_ascii=False, indent=2)

    def get(self):
        with open(self.file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return {**DEFAULT_THRESHOLD, **data.get('thresholds', {})}

    def update(self, values):
        updated = {**DEFAULT_THRESHOLD, **values}
        with open(self.file_path, 'w', encoding='utf-8') as f:
            json.dump({'thresholds': updated}, f, ensure_ascii=False, indent=2)
        return updated


threshold_repository = ThresholdRepository()
