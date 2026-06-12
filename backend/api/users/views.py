from django.http import JsonResponse, HttpRequest
from common.decorators import require_role
from common.utils import success_response, error_response, format_datetime, hash_password
from repositories import user_repository


@require_role(['admin'])
def users_list(request: HttpRequest) -> JsonResponse:
    if request.method == 'GET':
        users = user_repository.list()
        users = [{
            'id': u['id'],
            'username': u['username'],
            'name': u['name'],
            'role': u['role'],
            'enabled': u['enabled'],
            'created_at': u['created_at']
        } for u in users]
        return JsonResponse(success_response(users))

    if request.method == 'POST':
        body = getattr(request, 'json_body', {})
        username = body.get('username')
        password = body.get('password')
        name = body.get('name')
        role = body.get('role')
        enabled = body.get('enabled', True)

        if not username or not password or not name or not role:
            return JsonResponse(error_response('用户名、密码、姓名、角色不能为空'), status=400)

        valid_roles = ['admin', 'operator', 'auditor']
        if role not in valid_roles:
            return JsonResponse(error_response('无效的角色值'), status=400)

        existing = user_repository.get_by_username(username)
        if existing:
            return JsonResponse(error_response('该用户名已存在'), status=400)

        password_hash = hash_password(password)
        now = format_datetime()

        new_user = user_repository.create({
            'username': username,
            'password_hash': password_hash,
            'name': name,
            'role': role,
            'enabled': enabled,
            'created_at': now
        })

        user_data = {
            'id': new_user['id'],
            'username': new_user['username'],
            'name': new_user['name'],
            'role': new_user['role'],
            'enabled': new_user['enabled'],
            'created_at': new_user['created_at']
        }

        return JsonResponse(success_response(user_data, '创建成功'))

    return JsonResponse(error_response('方法不允许', code=405), status=405)


@require_role(['admin'])
def users_detail(request: HttpRequest, pk: str) -> JsonResponse:
    user = user_repository.get_by_id(pk)
    if not user:
        return JsonResponse(error_response('用户不存在'), status=404)

    if request.method == 'GET':
        user_data = {
            'id': user['id'],
            'username': user['username'],
            'name': user['name'],
            'role': user['role'],
            'enabled': user['enabled'],
            'created_at': user['created_at']
        }
        return JsonResponse(success_response(user_data))

    if request.method == 'PUT':
        body = getattr(request, 'json_body', {})
        name = body.get('name', user['name'])
        role = body.get('role', user['role'])
        enabled = body.get('enabled', user.get('enabled', True))

        valid_roles = ['admin', 'operator', 'auditor']
        if role not in valid_roles:
            return JsonResponse(error_response('无效的角色值'), status=400)

        updated = user_repository.update(pk, {
            'name': name,
            'role': role,
            'enabled': enabled
        })

        user_data = {
            'id': updated['id'],
            'username': updated['username'],
            'name': updated['name'],
            'role': updated['role'],
            'enabled': updated['enabled'],
            'created_at': updated['created_at']
        }

        return JsonResponse(success_response(user_data, '更新成功'))

    if request.method == 'DELETE':
        current_user_id = request.user_info.get('user_id')
        if current_user_id == pk:
            return JsonResponse(error_response('不能删除当前登录用户'), status=400)

        success = user_repository.delete(pk)
        if not success:
            return JsonResponse(error_response('删除失败'), status=500)
        return JsonResponse(success_response(None, '删除成功'))

    return JsonResponse(error_response('方法不允许', code=405), status=405)


@require_role(['admin'])
def users_reset_password(request: HttpRequest, pk: str) -> JsonResponse:
    if request.method != 'POST':
        return JsonResponse(error_response('方法不允许', code=405), status=405)

    user = user_repository.get_by_id(pk)
    if not user:
        return JsonResponse(error_response('用户不存在'), status=404)

    body = getattr(request, 'json_body', {})
    new_password = body.get('new_password')

    if not new_password or len(new_password) < 6:
        return JsonResponse(error_response('新密码不能为空且长度不能少于6位'), status=400)

    password_hash = hash_password(new_password)
    user_repository.update(pk, {'password_hash': password_hash})

    return JsonResponse(success_response(None, '密码重置成功'))
