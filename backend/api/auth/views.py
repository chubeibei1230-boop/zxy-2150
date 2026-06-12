from django.http import JsonResponse, HttpRequest
from common.decorators import require_role
from common.utils import success_response, error_response, generate_jwt, verify_password
from repositories import user_repository


def login_view(request: HttpRequest) -> JsonResponse:
    if request.method != 'POST':
        return JsonResponse(error_response('方法不允许', code=405), status=405)

    body = getattr(request, 'json_body', {})
    username = body.get('username')
    password = body.get('password')

    if not username or not password:
        return JsonResponse(error_response('用户名和密码不能为空'), status=400)

    user = user_repository.get_by_username(username)
    if not user:
        return JsonResponse(error_response('用户名或密码错误'), status=401)

    if not user.get('enabled', True):
        return JsonResponse(error_response('该用户已被禁用'), status=403)

    if not verify_password(password, user.get('password_hash', '')):
        return JsonResponse(error_response('用户名或密码错误'), status=401)

    token = generate_jwt(user['id'], user['username'], user['role'])

    user_info = {
        'id': user['id'],
        'username': user['username'],
        'name': user['name'],
        'role': user['role'],
        'enabled': user['enabled'],
        'created_at': user['created_at']
    }

    return JsonResponse(success_response({
        'token': token,
        'user': user_info
    }, '登录成功'))


@require_role(['admin', 'operator', 'auditor', 'user'])
def me_view(request: HttpRequest) -> JsonResponse:
    user_info = request.user_info
    user = user_repository.get_by_id(user_info['user_id'])

    if not user:
        return JsonResponse(error_response('用户不存在'), status=404)

    user_data = {
        'id': user['id'],
        'username': user['username'],
        'name': user['name'],
        'role': user['role'],
        'enabled': user['enabled'],
        'created_at': user['created_at']
    }

    return JsonResponse(success_response(user_data))
