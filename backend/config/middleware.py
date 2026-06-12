import json
import jwt
from django.http import JsonResponse
from django.conf import settings


PUBLIC_PATHS = [
    '/api/auth/login',
]


class JsonBodyMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method in ['POST', 'PUT', 'PATCH'] and request.content_type == 'application/json':
            try:
                request.json_body = json.loads(request.body)
            except json.JSONDecodeError:
                request.json_body = {}
        else:
            request.json_body = {}
        return self.get_response(request)


class JWTAuthMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path in PUBLIC_PATHS:
            return self.get_response(request)

        if request.method == 'OPTIONS':
            return self.get_response(request)

        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return JsonResponse({'detail': '未提供认证令牌'}, status=401)

        token = auth_header[7:]
        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET,
                algorithms=[settings.JWT_ALGORITHM]
            )
            request.user_info = payload
        except jwt.ExpiredSignatureError:
            return JsonResponse({'detail': '认证令牌已过期'}, status=401)
        except jwt.InvalidTokenError:
            return JsonResponse({'detail': '无效的认证令牌'}, status=401)

        return self.get_response(request)
