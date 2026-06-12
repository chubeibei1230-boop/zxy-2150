import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings
from common.json_store import JsonStore


class RuleRepository(JsonStore):
    def __init__(self):
        file_path = os.path.join(settings.DATA_DIR, 'rules.json')
        super().__init__(file_path, key_name='rules')

    def list_enabled(self):
        rules = self.list()
        return [rule for rule in rules if rule.get('enabled', True) and not rule.get('deleted', False)]

    def soft_delete(self, rule_id: str):
        return super().soft_delete(rule_id, {'enabled': False})


rule_repository = RuleRepository()
