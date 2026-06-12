from django.http import JsonResponse, HttpRequest
from common.decorators import require_role
from common.utils import success_response, error_response, format_datetime
from repositories import rule_repository


@require_role(['admin', 'operator', 'auditor', 'user'])
def rules_list(request: HttpRequest) -> JsonResponse:
    if request.method == 'GET':
        rules = rule_repository.list()
        rules = [r for r in rules if not r.get('deleted', False)]
        return JsonResponse(success_response(rules))

    if request.method == 'POST':
        if request.user_info.get('role') != 'admin':
            return JsonResponse(error_response('权限不足，无法访问该资源'), status=403)
        body = getattr(request, 'json_body', {})
        name = body.get('name')
        description = body.get('description', '')
        category_ids = body.get('category_ids', [])
        days_after_completion = body.get('days_after_completion')
        satisfaction_threshold = body.get('satisfaction_threshold')
        check_repeat_repair = body.get('check_repeat_repair', False)
        priority = body.get('priority', 99)
        reminder_text = body.get('reminder_text', '')
        enabled = body.get('enabled', True)

        if not name:
            return JsonResponse(error_response('规则名称不能为空'), status=400)

        now = format_datetime()
        new_rule = rule_repository.create({
            'name': name,
            'description': description,
            'category_ids': category_ids,
            'days_after_completion': days_after_completion,
            'satisfaction_threshold': satisfaction_threshold,
            'check_repeat_repair': check_repeat_repair,
            'priority': priority,
            'reminder_text': reminder_text,
            'enabled': enabled,
            'deleted': False,
            'created_at': now,
            'updated_at': now
        })

        return JsonResponse(success_response(new_rule, '创建成功'))

    return JsonResponse(error_response('方法不允许', code=405), status=405)


@require_role(['admin', 'operator', 'auditor', 'user'])
def rules_detail(request: HttpRequest, pk: str) -> JsonResponse:
    rule = rule_repository.get_by_id(pk)
    if not rule or rule.get('deleted', False):
        return JsonResponse(error_response('规则不存在'), status=404)

    if request.method == 'GET':
        return JsonResponse(success_response(rule))

    if request.method == 'PUT':
        if request.user_info.get('role') != 'admin':
            return JsonResponse(error_response('权限不足，无法访问该资源'), status=403)
        body = getattr(request, 'json_body', {})
        name = body.get('name', rule['name'])
        description = body.get('description', rule.get('description', ''))
        category_ids = body.get('category_ids', rule.get('category_ids', []))
        days_after_completion = body.get('days_after_completion', rule.get('days_after_completion'))
        satisfaction_threshold = body.get('satisfaction_threshold', rule.get('satisfaction_threshold'))
        check_repeat_repair = body.get('check_repeat_repair', rule.get('check_repeat_repair', False))
        priority = body.get('priority', rule.get('priority', 99))
        reminder_text = body.get('reminder_text', rule.get('reminder_text', ''))
        enabled = body.get('enabled', rule.get('enabled', True))

        if not name:
            return JsonResponse(error_response('规则名称不能为空'), status=400)

        updated = rule_repository.update(pk, {
            'name': name,
            'description': description,
            'category_ids': category_ids,
            'days_after_completion': days_after_completion,
            'satisfaction_threshold': satisfaction_threshold,
            'check_repeat_repair': check_repeat_repair,
            'priority': priority,
            'reminder_text': reminder_text,
            'enabled': enabled,
            'updated_at': format_datetime()
        })

        return JsonResponse(success_response(updated, '更新成功'))

    if request.method == 'DELETE':
        if request.user_info.get('role') != 'admin':
            return JsonResponse(error_response('权限不足，无法访问该资源'), status=403)
        success = rule_repository.soft_delete(pk)
        if not success:
            return JsonResponse(error_response('删除失败'), status=500)
        return JsonResponse(success_response(None, '删除成功'))

    return JsonResponse(error_response('方法不允许', code=405), status=405)
