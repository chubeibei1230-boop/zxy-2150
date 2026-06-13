import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings
from common.json_store import JsonStore


class WarningRuleRepository(JsonStore):
    def __init__(self):
        file_path = os.path.join(settings.DATA_DIR, 'warning_rules.json')
        super().__init__(file_path, key_name='warning_rules')

    def list_enabled(self):
        rules = self.list()
        return [r for r in rules if r.get('enabled', True)]

    def get_by_type(self, warning_type: str):
        rules = self.list_enabled()
        for rule in rules:
            if rule.get('type') == warning_type:
                return rule
        return None


warning_rule_repository = WarningRuleRepository()
