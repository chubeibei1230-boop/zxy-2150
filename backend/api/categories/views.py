from django.http import JsonResponse, HttpRequest
from common.decorators import require_role
from common.utils import success_response, error_response, format_datetime
from repositories import category_repository


@require_role(['admin', 'operator', 'auditor', 'user'])
def categories_list(request: HttpRequest) -> JsonResponse:
    if request.method == 'GET':
        categories = category_repository.list()
        return JsonResponse(success_response(categories))

    if request.method == 'POST':
        if request.user_info.get('role') != 'admin':
            return JsonResponse(error_response('权限不足，无法访问该资源'), status=403)
        body = getattr(request, 'json_body', {})
        name = body.get('name')
        description = body.get('description', '')
        enabled = body.get('enabled', True)

        if not name:
            return JsonResponse(error_response('类别名称不能为空'), status=400)

        existing = category_repository.list({'name': name})
        if existing:
            return JsonResponse(error_response('该类别名称已存在'), status=400)

        now = format_datetime()
        new_category = category_repository.create({
            'name': name,
            'description': description,
            'enabled': enabled,
            'created_at': now,
            'updated_at': now
        })

        return JsonResponse(success_response(new_category, '创建成功'))

    return JsonResponse(error_response('方法不允许', code=405), status=405)


@require_role(['admin', 'operator', 'auditor', 'user'])
def categories_detail(request: HttpRequest, pk: str) -> JsonResponse:
    category = category_repository.get_by_id(pk)
    if not category:
        return JsonResponse(error_response('类别不存在'), status=404)

    if request.method == 'GET':
        return JsonResponse(success_response(category))

    if request.method == 'PUT':
        if request.user_info.get('role') != 'admin':
            return JsonResponse(error_response('权限不足，无法访问该资源'), status=403)
        body = getattr(request, 'json_body', {})
        name = body.get('name', category['name'])
        description = body.get('description', category.get('description', ''))
        enabled = body.get('enabled', category.get('enabled', True))

        if not name:
            return JsonResponse(error_response('类别名称不能为空'), status=400)

        existing = category_repository.list({'name': name})
        existing = [c for c in existing if c['id'] != pk]
        if existing:
            return JsonResponse(error_response('该类别名称已存在'), status=400)

        updated = category_repository.update(pk, {
            'name': name,
            'description': description,
            'enabled': enabled,
            'updated_at': format_datetime()
        })

        return JsonResponse(success_response(updated, '更新成功'))

    if request.method == 'DELETE':
        if request.user_info.get('role') != 'admin':
            return JsonResponse(error_response('权限不足，无法访问该资源'), status=403)
        success = category_repository.delete(pk)
        if not success:
            return JsonResponse(error_response('删除失败'), status=500)
        return JsonResponse(success_response(None, '删除成功'))

    return JsonResponse(error_response('方法不允许', code=405), status=405)
