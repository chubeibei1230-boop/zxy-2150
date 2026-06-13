from django.http import JsonResponse, HttpRequest
from common.decorators import require_role
from common.utils import success_response, error_response, paginated_response, parse_datetime
from repositories import supervision_repository, user_repository
from services.supervision_engine import (
    supervision_engine,
    SOURCE_LABELS,
    RISK_LABELS,
    STATUS_LABELS,
    STATUS_PENDING,
    STATUS_ASSIGNED,
    STATUS_PROCESSING,
    STATUS_RESOLVED,
    STATUS_CLOSED,
    STATUS_DISMISSED,
)
import datetime


@require_role(['admin', 'operator', 'auditor'])
def supervisions_list(request: HttpRequest) -> JsonResponse:
    if request.method != 'GET':
        return JsonResponse(error_response('方法不允许', code=405), status=405)

    page = int(request.GET.get('page', 1))
    page_size = int(request.GET.get('page_size', 10))
    source_type = request.GET.get('source_type')
    risk = request.GET.get('risk')
    status = request.GET.get('status')
    assignee_id = request.GET.get('assignee_id')
    keyword = request.GET.get('keyword')
    date_from = request.GET.get('date_from')
    date_to = request.GET.get('date_to')

    all_items = supervision_repository.list()

    if source_type:
        all_items = [s for s in all_items if s.get('source_type') == source_type]
    if risk:
        all_items = [s for s in all_items if s.get('risk') == risk]
    if status:
        if status == 'active':
            all_items = [s for s in all_items if s.get('status') in [STATUS_PENDING, STATUS_ASSIGNED, STATUS_PROCESSING]]
        else:
            all_items = [s for s in all_items if s.get('status') == status]
    if assignee_id:
        all_items = [s for s in all_items if s.get('assignee_id') == assignee_id]
    if keyword:
        keyword_lower = keyword.lower()
        all_items = [
            s for s in all_items
            if keyword_lower in str(s.get('visit_info', {}).get('repair_order_no', '')).lower()
            or keyword_lower in str(s.get('visit_info', {}).get('user_name', '')).lower()
            or keyword_lower in str(s.get('visit_info', {}).get('user_phone', '')).lower()
            or keyword_lower in str(s.get('description', '')).lower()
        ]
    if date_from:
        try:
            from_dt = parse_datetime(date_from)
            all_items = [s for s in all_items if parse_datetime(s.get('created_at', '')) >= from_dt]
        except (ValueError, TypeError):
            pass
    if date_to:
        try:
            to_dt = parse_datetime(date_to)
            if len(date_to) == 10:
                to_dt = to_dt + datetime.timedelta(days=1) - datetime.timedelta(microseconds=1)
            all_items = [s for s in all_items if parse_datetime(s.get('created_at', '')) <= to_dt]
        except (ValueError, TypeError):
            pass

    def sort_key(s):
        risk_map = {'high': 0, 'medium': 1, 'low': 2}
        status_map = {'pending': 0, 'assigned': 1, 'processing': 2, 'resolved': 3, 'closed': 4, 'dismissed': 5}
        risk_order = risk_map.get(s.get('risk', 'medium'), 1)
        status_order = status_map.get(s.get('status', 'pending'), 0)
        created_at = s.get('created_at', '')
        return (status_order, risk_order, created_at)

    all_items.sort(key=sort_key, reverse=False)

    total = len(all_items)
    start = (page - 1) * page_size
    end = start + page_size
    paginated_items = all_items[start:end]
    total_pages = (total + page_size - 1) // page_size

    enriched = []
    for s in paginated_items:
        item = dict(s)
        item['source_type_label'] = SOURCE_LABELS.get(s.get('source_type'), s.get('source_type'))
        item['risk_label'] = RISK_LABELS.get(s.get('risk'), s.get('risk'))
        item['status_label'] = STATUS_LABELS.get(s.get('status'), s.get('status'))
        enriched.append(item)

    return JsonResponse(paginated_response(
        enriched, total, page, page_size, total_pages
    ))


@require_role(['admin', 'operator', 'auditor'])
def supervisions_detail(request: HttpRequest, pk: str) -> JsonResponse:
    if request.method != 'GET':
        return JsonResponse(error_response('方法不允许', code=405), status=405)

    item = supervision_repository.get_by_id(pk)
    if not item:
        return JsonResponse(error_response('督办事项不存在'), status=404)

    result = dict(item)
    result['source_type_label'] = SOURCE_LABELS.get(item.get('source_type'), item.get('source_type'))
    result['risk_label'] = RISK_LABELS.get(item.get('risk'), item.get('risk'))
    result['status_label'] = STATUS_LABELS.get(item.get('status'), item.get('status'))

    return JsonResponse(success_response(result))


@require_role(['admin', 'operator'])
def supervisions_generate(request: HttpRequest) -> JsonResponse:
    if request.method != 'POST':
        return JsonResponse(error_response('方法不允许', code=405), status=405)

    result = supervision_engine.generate_supervisions()
    return JsonResponse(success_response(result, '督办事项生成完成'))


@require_role(['admin', 'operator'])
def supervisions_follow_up(request: HttpRequest, pk: str) -> JsonResponse:
    if request.method != 'POST':
        return JsonResponse(error_response('方法不允许', code=405), status=405)

    item = supervision_repository.get_by_id(pk)
    if not item:
        return JsonResponse(error_response('督办事项不存在'), status=404)

    if item.get('status') in [STATUS_RESOLVED, STATUS_CLOSED, STATUS_DISMISSED]:
        return JsonResponse(error_response('该事项已结束，无法跟进'), status=400)

    body = getattr(request, 'json_body', {})
    note = body.get('note', '')
    action = body.get('action', 'note')

    if not note:
        return JsonResponse(error_response('请填写跟进说明'), status=400)

    operator_info = request.user_info
    updated = supervision_engine.add_progress(
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
def supervisions_resolve(request: HttpRequest, pk: str) -> JsonResponse:
    if request.method != 'POST':
        return JsonResponse(error_response('方法不允许', code=405), status=405)

    item = supervision_repository.get_by_id(pk)
    if not item:
        return JsonResponse(error_response('督办事项不存在'), status=404)

    if item.get('status') in [STATUS_RESOLVED, STATUS_CLOSED, STATUS_DISMISSED]:
        return JsonResponse(error_response('该事项已结束'), status=400)

    body = getattr(request, 'json_body', {})
    note = body.get('note', '')

    if not note:
        return JsonResponse(error_response('请填写解决说明'), status=400)

    operator_info = request.user_info
    updated = supervision_engine.resolve_supervision(
        pk,
        operator_info.get('user_id'),
        operator_info.get('username'),
        note,
    )

    if not updated:
        return JsonResponse(error_response('操作失败'), status=500)

    return JsonResponse(success_response(updated, '事项已解决'))


@require_role(['admin'])
def supervisions_reassign(request: HttpRequest, pk: str) -> JsonResponse:
    if request.method != 'POST':
        return JsonResponse(error_response('方法不允许', code=405), status=405)

    item = supervision_repository.get_by_id(pk)
    if not item:
        return JsonResponse(error_response('督办事项不存在'), status=404)

    if item.get('status') in [STATUS_RESOLVED, STATUS_CLOSED, STATUS_DISMISSED]:
        return JsonResponse(error_response('该事项已结束，无法转派'), status=400)

    body = getattr(request, 'json_body', {})
    new_assignee_id = body.get('assignee_id')
    note = body.get('note', '')

    if not new_assignee_id:
        return JsonResponse(error_response('请指定新责任人'), status=400)

    new_assignee = user_repository.get_by_id(new_assignee_id)
    if not new_assignee:
        return JsonResponse(error_response('指定用户不存在'), status=400)

    operator_info = request.user_info
    updated = supervision_engine.reassign_supervision(
        pk,
        operator_info.get('user_id'),
        operator_info.get('username'),
        new_assignee_id,
        new_assignee.get('name', ''),
        note,
    )

    if not updated:
        return JsonResponse(error_response('转派失败'), status=500)

    return JsonResponse(success_response(updated, '事项已转派'))


@require_role(['admin'])
def supervisions_close(request: HttpRequest, pk: str) -> JsonResponse:
    if request.method != 'POST':
        return JsonResponse(error_response('方法不允许', code=405), status=405)

    item = supervision_repository.get_by_id(pk)
    if not item:
        return JsonResponse(error_response('督办事项不存在'), status=404)

    if item.get('status') in [STATUS_RESOLVED, STATUS_CLOSED, STATUS_DISMISSED]:
        return JsonResponse(error_response('该事项已结束'), status=400)

    body = getattr(request, 'json_body', {})
    note = body.get('note', '')

    if not note:
        return JsonResponse(error_response('请填写关闭原因'), status=400)

    operator_info = request.user_info
    updated = supervision_engine.close_supervision(
        pk,
        operator_info.get('user_id'),
        operator_info.get('username'),
        note,
    )

    if not updated:
        return JsonResponse(error_response('操作失败'), status=500)

    return JsonResponse(success_response(updated, '事项已关闭'))


@require_role(['admin'])
def supervisions_dismiss(request: HttpRequest, pk: str) -> JsonResponse:
    if request.method != 'POST':
        return JsonResponse(error_response('方法不允许', code=405), status=405)

    item = supervision_repository.get_by_id(pk)
    if not item:
        return JsonResponse(error_response('督办事项不存在'), status=404)

    if item.get('status') in [STATUS_RESOLVED, STATUS_CLOSED, STATUS_DISMISSED]:
        return JsonResponse(error_response('该事项已结束'), status=400)

    body = getattr(request, 'json_body', {})
    note = body.get('note', '')

    if not note:
        return JsonResponse(error_response('请填写无需处理的原因'), status=400)

    operator_info = request.user_info
    updated = supervision_engine.dismiss_supervision(
        pk,
        operator_info.get('user_id'),
        operator_info.get('username'),
        note,
    )

    if not updated:
        return JsonResponse(error_response('操作失败'), status=500)

    return JsonResponse(success_response(updated, '事项已标记无需处理'))


@require_role(['admin', 'operator', 'auditor'])
def supervisions_stats(request: HttpRequest) -> JsonResponse:
    if request.method != 'GET':
        return JsonResponse(error_response('方法不允许', code=405), status=405)
    stats = supervision_engine.get_supervision_stats()
    return JsonResponse(success_response(stats))
