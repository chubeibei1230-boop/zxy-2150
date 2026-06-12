from django.http import JsonResponse, HttpRequest
from common.decorators import require_role
from common.utils import success_response, error_response, paginated_response, format_datetime, parse_datetime
from repositories import visit_repository, repair_order_repository, rule_repository, category_repository
from services.rule_engine import RuleEngine
import datetime


@require_role(['admin', 'operator', 'auditor', 'user'])
def visits_list(request: HttpRequest) -> JsonResponse:
    if request.method != 'GET':
        return JsonResponse(error_response('方法不允许', code=405), status=405)

    page = int(request.GET.get('page', 1))
    page_size = int(request.GET.get('page_size', 10))
    category_id = request.GET.get('category_id')
    handler_id = request.GET.get('handler_id')
    status = request.GET.get('status')
    satisfaction_min = request.GET.get('satisfaction_min')
    satisfaction_max = request.GET.get('satisfaction_max')
    date_from = request.GET.get('date_from')
    date_to = request.GET.get('date_to')
    keyword = request.GET.get('keyword')
    rule_id = request.GET.get('rule_id')
    unreachable_reason = request.GET.get('unreachable_reason')

    all_visits = visit_repository.list()

    if category_id:
        all_visits = [v for v in all_visits if v.get('category_id') == category_id]
    if handler_id:
        all_visits = [v for v in all_visits if v.get('handler_id') == handler_id]
    if status:
        all_visits = [v for v in all_visits if v.get('status') == status]
    if keyword:
        keyword_lower = keyword.lower()
        all_visits = [
            v for v in all_visits
            if keyword_lower in str(v.get('repair_order_no', '')).lower()
            or keyword_lower in str(v.get('user_name', '')).lower()
            or keyword_lower in str(v.get('user_phone', '')).lower()
            or keyword_lower in str(v.get('repair_content', '')).lower()
        ]
    if rule_id:
        all_visits = [
            v for v in all_visits
            if any(rule.get('rule_id') == rule_id for rule in v.get('matched_rules', []))
        ]
    if unreachable_reason:
        all_visits = [v for v in all_visits if v.get('unreachable_reason') == unreachable_reason]
    if satisfaction_min:
        min_val = int(satisfaction_min)
        all_visits = [v for v in all_visits if v.get('satisfaction') is not None and v.get('satisfaction') >= min_val]
    if satisfaction_max:
        max_val = int(satisfaction_max)
        all_visits = [v for v in all_visits if v.get('satisfaction') is not None and v.get('satisfaction') <= max_val]
    if date_from:
        try:
            from_dt = parse_datetime(date_from)
            all_visits = [v for v in all_visits if parse_datetime(v.get('created_at', '')) >= from_dt]
        except (ValueError, TypeError):
            pass
    if date_to:
        try:
            to_dt = parse_datetime(date_to)
            if len(date_to) == 10:
                to_dt = to_dt + datetime.timedelta(days=1) - datetime.timedelta(microseconds=1)
            all_visits = [v for v in all_visits if parse_datetime(v.get('created_at', '')) <= to_dt]
        except (ValueError, TypeError):
            pass

    all_visits.sort(key=lambda x: x.get('created_at', ''), reverse=True)

    total = len(all_visits)
    start = (page - 1) * page_size
    end = start + page_size
    paginated_items = all_visits[start:end]
    total_pages = (total + page_size - 1) // page_size

    return JsonResponse(paginated_response(
        paginated_items, total, page, page_size, total_pages
    ))


@require_role(['admin', 'operator', 'auditor', 'user'])
def visits_detail(request: HttpRequest, pk: str) -> JsonResponse:
    if request.method != 'GET':
        return JsonResponse(error_response('方法不允许', code=405), status=405)

    visit = visit_repository.get_by_id(pk)
    if not visit:
        return JsonResponse(error_response('回访记录不存在'), status=404)

    return JsonResponse(success_response(visit))


@require_role(['admin', 'operator', 'user'])
def visits_process(request: HttpRequest, pk: str) -> JsonResponse:
    if request.method not in ['POST', 'PUT']:
        return JsonResponse(error_response('方法不允许', code=405), status=405)

    visit = visit_repository.get_by_id(pk)
    if not visit:
        return JsonResponse(error_response('回访记录不存在'), status=404)

    body = getattr(request, 'json_body', {})
    new_status = body.get('status')
    satisfaction = body.get('satisfaction')
    visit_result = body.get('visit_result')
    unresolved_note = body.get('unresolved_note')
    unreachable_reason = body.get('unreachable_reason')
    remark = body.get('remark', '')

    valid_statuses = ['pending', 'contacted', 'reprocess', 'closed', 'unreachable']
    if new_status and new_status not in valid_statuses:
        return JsonResponse(error_response('无效的状态值'), status=400)

    if satisfaction is not None:
        try:
            satisfaction = int(satisfaction)
            if satisfaction < 1 or satisfaction > 5:
                return JsonResponse(error_response('满意度必须在1-5之间'), status=400)
        except (ValueError, TypeError):
            return JsonResponse(error_response('满意度必须是整数'), status=400)

    if new_status == 'unreachable' and not unreachable_reason:
        return JsonResponse(error_response('无法联系时必须提供原因'), status=400)

    old_status = visit.get('status')
    update_data = {}

    if new_status:
        update_data['status'] = new_status
    if satisfaction is not None:
        update_data['satisfaction'] = satisfaction
    if visit_result is not None:
        update_data['visit_result'] = visit_result
    if unresolved_note is not None:
        update_data['unresolved_note'] = unresolved_note
    if unreachable_reason is not None:
        update_data['unreachable_reason'] = unreachable_reason

    status_timeline = visit.get('status_timeline', [])
    operator_info = request.user_info
    now = format_datetime()

    if new_status and new_status != old_status:
        status_timeline.append({
            'status': new_status,
            'timestamp': now,
            'operator_id': operator_info.get('user_id'),
            'operator_name': operator_info.get('username'),
            'remark': remark
        })
        update_data['status_timeline'] = status_timeline

    update_data['updated_at'] = now

    updated = visit_repository.update(pk, update_data)

    return JsonResponse(success_response(updated, '处理成功'))


@require_role(['admin'])
def visits_generate_reminders(request: HttpRequest) -> JsonResponse:
    if request.method != 'POST':
        return JsonResponse(error_response('方法不允许', code=405), status=405)

    rules = sorted(rule_repository.list_enabled(), key=lambda r: r.get('priority', 99))
    categories = category_repository.list()
    visits = visit_repository.list()
    existing_order_ids = {v.get('repair_order_id') for v in visits}
    created = []
    now = format_datetime()

    for order in repair_order_repository.list():
        if order.get('id') in existing_order_ids:
            continue
        matched_rules = RuleEngine.match_rules(order, categories, rules, visits + created)
        if not matched_rules:
            continue

        first_status = 'pending'
        status_timeline = [{
            'status': first_status,
            'timestamp': now,
            'operator_id': 'system',
            'operator_name': '系统',
            'remark': '系统自动创建回访任务'
        }]

        new_visit = visit_repository.create({
            'repair_order_id': order.get('id'),
            'repair_order_no': order.get('order_no'),
            'category_id': order.get('category_id'),
            'category_name': order.get('category_name'),
            'user_name': order.get('user_name'),
            'user_phone': order.get('user_phone'),
            'address': order.get('address'),
            'repair_content': order.get('repair_content'),
            'handler_id': order.get('handler_id'),
            'handler_name': order.get('handler_name'),
            'completed_at': order.get('completed_at'),
            'status': first_status,
            'satisfaction': None,
            'visit_result': None,
            'unresolved_note': None,
            'unreachable_reason': None,
            'matched_rules': matched_rules,
            'status_timeline': status_timeline,
            'created_at': now,
            'updated_at': now
        })
        created.append(new_visit)

    return JsonResponse(success_response({'created_count': len(created), 'items': created}, '生成完成'))
