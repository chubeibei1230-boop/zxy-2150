from functools import wraps
from typing import List, Callable
from django.http import JsonResponse, HttpRequest


VALID_ROLES = ['admin', 'operator', 'auditor']
WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']


def require_role(roles: List[str]) -> Callable:
    def decorator(view_func: Callable) -> Callable:
        @wraps(view_func)
        def _wrapped_view(request: HttpRequest, *args, **kwargs):
            if not hasattr(request, 'user_info'):
                return JsonResponse({
                    'code': 1,
                    'message': '未提供认证信息',
                    'data': None
                }, status=401)

            user_role = request.user_info.get('role', '')
            if user_role not in roles:
                return JsonResponse({
                    'code': 1,
                    'message': '权限不足，无法访问该资源',
                    'data': None
                }, status=403)

            if user_role == 'auditor' and request.method in WRITE_METHODS:
                return JsonResponse({
                    'code': 1,
                    'message': '审计员仅有查询权限，无法执行修改操作',
                    'data': None
                }, status=403)

            return view_func(request, *args, **kwargs)
        return _wrapped_view
    return decorator
