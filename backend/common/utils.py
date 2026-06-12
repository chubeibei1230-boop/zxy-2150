import os
import sys
import datetime
from typing import Any, Dict, List, Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.hashers import make_password, check_password
import jwt
from django.conf import settings


def hash_password(password: str) -> str:
    return make_password(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return check_password(password, hashed_password)


def generate_jwt(user_id: str, username: str, role: str) -> str:
    payload = {
        'user_id': user_id,
        'username': username,
        'role': role,
        'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=settings.JWT_EXPIRE_HOURS),
        'iat': datetime.datetime.now(datetime.timezone.utc)
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_jwt(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def format_datetime(dt: Optional[datetime.datetime] = None) -> str:
    if dt is None:
        dt = datetime.datetime.now()
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.timezone(datetime.timedelta(hours=8)))
    return dt.isoformat()


def parse_datetime(dt_str: str) -> datetime.datetime:
    return datetime.datetime.fromisoformat(dt_str)


def success_response(data: Any = None, message: str = '操作成功') -> Dict[str, Any]:
    return {
        'code': 0,
        'message': message,
        'data': data
    }


def error_response(message: str = '操作失败', code: int = 1, data: Any = None) -> Dict[str, Any]:
    return {
        'code': code,
        'message': message,
        'data': data
    }


def paginated_response(
    items: List[Any],
    total: int,
    page: int,
    page_size: int,
    total_pages: int,
    message: str = '查询成功'
) -> Dict[str, Any]:
    return {
        'code': 0,
        'message': message,
        'data': {
            'items': items,
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': total_pages
        }
    }
