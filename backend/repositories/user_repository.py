import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings
from common.json_store import JsonStore


class UserRepository(JsonStore):
    def __init__(self):
        file_path = os.path.join(settings.DATA_DIR, 'users.json')
        super().__init__(file_path, key_name='users')

    def get_by_username(self, username: str):
        users = self.list()
        for user in users:
            if user.get('username') == username:
                return user
        return None


user_repository = UserRepository()
