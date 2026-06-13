from django.http import JsonResponse, HttpRequest
from common.decorators import require_role
from common.utils import success_response, error_response, paginated_response, parse_datetime
from repositories import warning_repository, warning_rule_repository
from services.warning_engine import (
    warning_engine,
    WARNING_STATUS_ACTIVE,
    WARNING_STATUS_PROCESSING,
    WARNING_STATUS_RESOLVED,
    WARNING_STATUS_IGNORED,
    WARNING_TYPE_LABELS,
    WARNING_LEVEL_LABELS,
)
import datetime


@require_role(['admin', 'operator', 'auditor'])
def warnings_list(request: HttpRequest) -> JsonResponse:
    if request.method != 'GET':
        return JsonResponse(error_response('方法不允许', code=405), status=405)

    page = int(request.GET.get('page', 1))
    page_size = int(request.GET.get('page_size', 10))
    warning_type = request.GET.get('warning_type')
    level = request.GET.get('level')
    status = request.GET.get('status')
    handler_id = request.GET.get('handler_id')
    keyword = request.GET.get('keyword')
    date_from = request.GET.get('date_from')
    date_to = request.GET.get('date_to')

    all_warnings = warning_repository.list()

    if warning_type:
        all_warnings = [w for w in all_warnings if w.get('warning_type') == warning_type]
    if level:
        all_warnings = [w for w in all_warnings if w.get('level') == level]
    if status:
        if status == 'active':
            all_warnings = [w for w in all_warnings if w.get('status') in [WARNING_STATUS_ACTIVE, WARNING_STATUS_PROCESSING]]
        else:
            all_warnings = [w for w in all_warnings if w.get('status') == status]
    if handler_id:
        all_warnings = [w for w in all_warnings if w.get('visit_info', {}).get('handler_id') == handler_id]
    if keyword:
        keyword_lower = keyword.lower()
        all_warnings = [
            w for w in all_warnings
            if keyword_lower in str(w.get('visit_info', {}).get('repair_order_no', '')).lower()
            or keyword_lower in str(w.get('visit_info', {}).get('user_name', '')).lower()
            or keyword_lower in str(w.get('visit_info', {}).get('user_phone', '')).lower()
            or keyword_lower in str(w.get('reminder_text', '')).lower()
        ]
    if date_from:
        try:
            from_dt = parse_datetime(date_from)
            all_warnings = [w for w in all_warnings if parse_datetime(w.get('created_at', '')) >= from_dt]
        except (ValueError, TypeError):
            pass
    if date_to:
        try:
            to_dt = parse_datetime(date_to)
            if len(date_to) == 10:
                to_dt = to_dt + datetime.timedelta(days=1) - datetime.timedelta(microseconds=1)
            all_warnings = [w for w in all_warnings if parse_datetime(w.get('created_at', '')) <= to_dt]
        except (ValueError, TypeError):
            pass

    def sort_key(w):
        priority_map = {'high': 0, 'medium': 1, 'low': 2}
        level_order = priority_map.get(w.get('level', 'medium'), 1)
        priority_val = w.get('priority', 99)
        created_at = w.get('created_at', '')
        return (level_order, priority_val, created_at)

    all_warnings.sort(key=sort_key, reverse=False)

    total = len(all_warnings)
    start = (page - 1) * page_size
    end = start + page_size
    paginated_items = all_warnings[start:end]
    total_pages = (total + page_size - 1) // page_size

    enriched = []
    for w in paginated_items:
        item = dict(w)
        item['warning_type_label'] = WARNING_TYPE_LABELS.get(w.get('warning_type'), w.get('warning_type'))
        item['level_label'] = WARNING_LEVEL_LABELS.get(w.get('level'), w.get('level'))
        enriched.append(item)

    return JsonResponse(paginated_response(
        enriched, total, page, page_size, total_pages
    ))


@require_role(['admin', 'operator', 'auditor'])
def warnings_detail(request: HttpRequest, pk: str) -> JsonResponse:
    if request.method != 'GET':
        return JsonResponse(error_response('方法不允许', code=405), status=405)

    warning = warning_repository.get_by_id(pk)
    if not warning:
        return JsonResponse(error_response('预警记录不存在'), status=404)

    result = dict(warning)
    result['warning_type_label'] = WARNING_TYPE_LABELS.get(warning.get('warning_type'), warning.get('warning_type'))
    result['level_label'] = WARNING_LEVEL_LABELS.get(warning.get('level'), warning.get('level'))

    return JsonResponse(success_response(result))


@require_role(['admin', 'operator'])
def warnings_refresh(request: HttpRequest) -> JsonResponse:
    if request.method != 'POST':
        return JsonResponse(error_response('方法不允许', code=405), status=405)

    result = warning_engine.refresh_all_warnings()
    return JsonResponse(success_response(result, '预警刷新完成'))


@require_role(['admin', 'operator'])
def warnings_follow_up(request: HttpRequest, pk: str) -> JsonResponse:
    if request.method != 'POST':
        return JsonResponse(error_response('方法不允许', code=405), status=405)

    warning = warning_repository.get_by_id(pk)
    if not warning:
        return JsonResponse(error_response('预警记录不存在'), status=404)

    body = getattr(request, 'json_body', {})
    note = body.get('note', '')
    action = body.get('action', 'note')

    if not note:
        return JsonResponse(error_response('请填写跟进备注'), status=400)

    operator_info = request.user_info
    updated = warning_engine.add_follow_up(
        pk,
        operator_info.get('user_id'),
        operator_info.get('username'),
        note,
        action,
    )

    if not updated:
        return JsonResponse(error_response('跟进失败'), status=500)

    return JsonResponse(success_response(updated, '跟进记录已添加'))


@require_role(['admin', 'operator'])
def warnings_resolve(request: HttpRequest, pk: str) -> JsonResponse:
    if request.method != 'POST':
        return JsonResponse(error_response('方法不允许', code=405), status=405)

    warning = warning_repository.get_by_id(pk)
    if not warning:
        return JsonResponse(error_response('预警记录不存在'), status=404)

    body = getattr(request, 'json_body', {})
    note = body.get('note', '')

    if not note:
        return JsonResponse(error_response('请填写处理说明'), status=400)

    operator_info = request.user_info
    updated = warning_engine.resolve_warning(
        pk,
        operator_info.get('user_id'),
        operator_info.get('username'),
        note,
    )

    if not updated:
        return JsonResponse(error_response('处理失败'), status=500)

    return JsonResponse(success_response(updated, '预警已解除'))


@require_role(['admin', 'operator'])
def warnings_ignore(request: HttpRequest, pk: str) -> JsonResponse:
    if request.method != 'POST':
        return JsonResponse(error_response('方法不允许', code=405), status=405)

    warning = warning_repository.get_by_id(pk)
    if not warning:
        return JsonResponse(error_response('预警记录不存在'), status=404)

    body = getattr(request, 'json_body', {})
    note = body.get('note', '')

    if not note:
        return JsonResponse(error_response('请填写忽略原因'), status=400)

    operator_info = request.user_info
    updated = warning_engine.ignore_warning(
        pk,
        operator_info.get('user_id'),
        operator_info.get('username'),
        note,
    )

    if not updated:
        return JsonResponse(error_response('操作失败'), status=500)

    return JsonResponse(success_response(updated, '预警已忽略'))


@require_role(['admin', 'operator', 'auditor'])
def warnings_stats(request: HttpRequest) -> JsonResponse:
    if request.method != 'GET':
        return JsonResponse(error_response('方法不允许', code=405), status=405)
    stats = warning_engine.get_warning_stats()
    return JsonResponse(success_response(stats))


@require_role(['admin', 'operator', 'auditor'])
def warning_rules_list(request: HttpRequest) -> JsonResponse:
    if request.method == 'GET':
        rules = warning_rule_repository.list()
        enriched = []
        for r in rules:
            item = dict(r)
            item['type_label'] = WARNING_TYPE_LABELS.get(r.get('type'), r.get('type'))
            item['level_label'] = WARNING_LEVEL_LABELS.get(r.get('level'), r.get('level'))
            enriched.append(item)
        return JsonResponse(success_response(enriched))

    if request.method == 'POST':
        if request.user_info.get('role') != 'admin':
            return JsonResponse(error_response('权限不足'), status=403)
        body = getattr(request, 'json_body', {})
        now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat()
        new_rule = warning_rule_repository.create({
            'type': body.get('type'),
            'name': body.get('name'),
            'description': body.get('description', ''),
            'enabled': body.get('enabled', True),
            'priority': body.get('priority', 99),
            'params': body.get('params', {}),
            'reminder_text': body.get('reminder_text', ''),
            'level': body.get('level', 'medium'),
            'created_at': now,
            'updated_at': now,
        })
        return JsonResponse(success_response(new_rule, '创建成功'))

    return JsonResponse(error_response('方法不允许', code=405), status=405)


@require_role(['admin', 'operator', 'auditor'])
def warning_rules_detail(request: HttpRequest, pk: str) -> JsonResponse:
    rule = warning_rule_repository.get_by_id(pk)
    if not rule:
        return JsonResponse(error_response('规则不存在'), status=404)

    if request.method == 'GET':
        result = dict(rule)
        result['type_label'] = WARNING_TYPE_LABELS.get(rule.get('type'), rule.get('type'))
        result['level_label'] = WARNING_LEVEL_LABELS.get(rule.get('level'), rule.get('level'))
        return JsonResponse(success_response(result))

    if request.method in ['PUT', 'POST']:
        if request.user_info.get('role') != 'admin':
            return JsonResponse(error_response('权限不足'), status=403)
        body = getattr(request, 'json_body', {})
        now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat()
        old_type = rule.get('type')
        new_type = body.get('type', old_type)
        update_data = {
            'type': new_type,
            'name': body.get('name', rule.get('name')),
            'description': body.get('description', rule.get('description', '')),
            'enabled': body.get('enabled', rule.get('enabled', True)),
            'priority': body.get('priority', rule.get('priority', 99)),
            'params': body.get('params', rule.get('params', {})),
            'reminder_text': body.get('reminder_text', rule.get('reminder_text', '')),
            'level': body.get('level', rule.get('level', 'medium')),
            'updated_at': now,
        }
        updated = warning_rule_repository.update(pk, update_data)
        return JsonResponse(success_response(updated, '更新成功'))

    if request.method == 'DELETE':
        if request.user_info.get('role') != 'admin':
            return JsonResponse(error_response('权限不足'), status=403)
        success = warning_rule_repository.delete(pk)
        if not success:
            return JsonResponse(error_response('删除失败'), status=500)
        return JsonResponse(success_response(None, '删除成功'))

    return JsonResponse(error_response('方法不允许', code=405), status=405)


@require_role(['admin'])
def warning_rules_delete(request: HttpRequest, pk: str) -> JsonResponse:
    if request.method != 'POST':
        return JsonResponse(error_response('方法不允许', code=405), status=405)
    
    rule = warning_rule_repository.get_by_id(pk)
    if not rule:
        return JsonResponse(error_response('规则不存在'), status=404)
    
    success = warning_rule_repository.delete(pk)
    if not success:
        return JsonResponse(error_response('删除失败'), status=500)
    return JsonResponse(success_response(None, '删除成功'))
