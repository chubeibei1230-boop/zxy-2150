from django.http import JsonResponse, HttpRequest
from common.decorators import require_role
from common.utils import success_response
from repositories import visit_repository, warning_repository, supervision_repository
from services.warning_engine import WARNING_TYPE_LABELS, WARNING_LEVEL_LABELS
from services.supervision_engine import SOURCE_LABELS, RISK_LABELS
from datetime import datetime, timedelta
import urllib.parse

PROGRESS_STAGE_LABELS = {
    'pending': '待处理',
    'contacting': '联系中',
    'following_up': '跟进中',
    'resolving': '处理中',
    'closed': '已闭环',
}


def _get_progress_stage(item_type: str, status: str, is_overdue: bool, follow_up_count: int = 0) -> str:
    if item_type == 'visit':
        if status == 'pending':
            return 'pending' if not is_overdue else 'pending'
        elif status == 'contacted':
            return 'resolving'
        elif status == 'reprocess':
            return 'following_up'
        elif status == 'unreachable':
            return 'contacting'
        elif status == 'closed':
            return 'closed'
    elif item_type == 'warning':
        if status == 'active':
            return 'pending' if follow_up_count == 0 else 'following_up'
        elif status == 'processing':
            return 'resolving'
        elif status == 'resolved':
            return 'closed'
    elif item_type == 'supervision':
        if status == 'pending':
            return 'pending'
        elif status == 'assigned':
            return 'following_up'
        elif status == 'processing':
            return 'resolving' if follow_up_count > 0 else 'following_up'
        elif status in ['resolved', 'closed', 'dismissed']:
            return 'closed'
    return 'pending'


@require_role(['admin', 'operator', 'auditor'])
def workbench_stats(request: HttpRequest) -> JsonResponse:
    today = datetime.now().date()
    today_start = datetime.combine(today, datetime.min.time())

    all_visits = visit_repository.list()
    all_warnings = warning_repository.list()
    all_supervisions = supervision_repository.list()

    today_pending_visits = sum(
        1 for v in all_visits
        if v.get('status') == 'pending'
        and datetime.fromisoformat(v.get('created_at', '2000-01-01T00:00:00')) >= today_start
    )
    active_warnings = [w for w in all_warnings if w.get('status') in ['active', 'processing']]
    active_supervisions = [s for s in all_supervisions if s.get('status') in ['pending', 'assigned', 'processing']]

    high_risk_warnings = sum(1 for w in active_warnings if w.get('level') == 'high')
    high_risk_supervisions = sum(1 for s in active_supervisions if s.get('risk') == 'high')
    high_risk_count = high_risk_warnings + high_risk_supervisions

    now = datetime.now()
    overdue_visits = sum(
        1 for v in all_visits
        if v.get('status') == 'pending'
        and (now - datetime.fromisoformat(v.get('created_at', '2000-01-01T00:00:00'))).days >= 3
    )
    overdue_warnings = sum(
        1 for w in active_warnings
        if (now - datetime.fromisoformat(w.get('created_at', '2000-01-01T00:00:00'))).days >= 2
    )
    overdue_supervisions = sum(
        1 for s in active_supervisions
        if (now - datetime.fromisoformat(s.get('created_at', '2000-01-01T00:00:00'))).days >= 3
    )
    overdue_count = overdue_visits + overdue_warnings + overdue_supervisions

    closed_visits = sum(1 for v in all_visits if v.get('status') in ['closed', 'contacted'])
    resolved_warnings = sum(1 for w in all_warnings if w.get('status') in ['resolved', 'ignored'])
    closed_supervisions = sum(1 for s in all_supervisions if s.get('status') in ['resolved', 'closed', 'dismissed'])
    closed_count = closed_visits + resolved_warnings + closed_supervisions

    pending_visit_count = sum(1 for v in all_visits if v.get('status') == 'pending')
    reprocess_visit_count = sum(1 for v in all_visits if v.get('status') == 'reprocess')
    unreachable_visit_count = sum(1 for v in all_visits if v.get('status') == 'unreachable')

    stats = {
        'today_pending': today_pending_visits,
        'high_risk': high_risk_count,
        'overdue': overdue_count,
        'closed': closed_count,
        'pending_visits': pending_visit_count,
        'active_warnings': len(active_warnings),
        'active_supervisions': len(active_supervisions),
        'reprocess_visits': reprocess_visit_count,
        'unreachable_visits': unreachable_visit_count,
        'overdue_visits': overdue_visits,
        'overdue_warnings': overdue_warnings,
        'overdue_supervisions': overdue_supervisions,
        'today_closed': sum(
            1 for v in all_visits
            if v.get('status') in ['closed', 'contacted']
            and datetime.fromisoformat(v.get('updated_at', '2000-01-01T00:00:00')) >= today_start
        ) + sum(
            1 for w in all_warnings
            if w.get('status') in ['resolved', 'ignored']
            and w.get('resolved_at') and datetime.fromisoformat(w.get('resolved_at', '2000-01-01T00:00:00')) >= today_start
        ) + sum(
            1 for s in all_supervisions
            if s.get('status') in ['resolved', 'closed', 'dismissed']
            and s.get('resolved_at') and datetime.fromisoformat(s.get('resolved_at', '2000-01-01T00:00:00')) >= today_start
        ),
    }

    return JsonResponse(success_response(stats))


@require_role(['admin', 'operator', 'auditor'])
def workbench_items(request: HttpRequest) -> JsonResponse:
    item_type = request.GET.get('item_type', 'all')
    handler_id = request.GET.get('handler_id')
    risk = request.GET.get('risk')
    status = request.GET.get('status')
    keyword = request.GET.get('keyword')
    date_from = request.GET.get('date_from')
    date_to = request.GET.get('date_to')
    is_overdue_filter = request.GET.get('is_overdue')
    page = int(request.GET.get('page', 1))
    page_size = int(request.GET.get('page_size', 10))

    if keyword:
        keyword = urllib.parse.unquote(keyword).lower()

    all_items = []

    if item_type in ['all', 'visit']:
        visits = visit_repository.list()
        for v in visits:
            if v.get('status') in ['pending', 'reprocess', 'unreachable']:
                visit_created = datetime.fromisoformat(v.get('created_at', '2000-01-01T00:00:00'))
                now = datetime.now()
                days_pending = (now - visit_created).days

                item_risk = 'low'
                if v.get('status') == 'reprocess':
                    item_risk = 'high'
                elif v.get('status') == 'unreachable' and (v.get('unreachable_count', 0) >= 2):
                    item_risk = 'medium'
                elif days_pending >= 3:
                    item_risk = 'medium'

                is_overdue = days_pending >= 3

                searchable = ' '.join([
                    str(v.get('repair_order_no', '')),
                    str(v.get('user_name', '')),
                    str(v.get('user_phone', '')),
                    str(v.get('address', '')),
                    str(v.get('repair_content', '')),
                ]).lower()

                all_items.append({
                    'id': f'visit_{v["id"]}',
                    'item_type': 'visit',
                    'item_type_label': '回访待办',
                    'source_id': v['id'],
                    'visit_id': v['id'],
                    'title': v.get('reminder_text') or f"回访待办 - {v.get('category_name', '')}",
                    'risk': item_risk,
                    'risk_label': '高风险' if item_risk == 'high' else '中风险' if item_risk == 'medium' else '低风险',
                    'status': v.get('status'),
                    'status_label': _get_visit_status_label(v.get('status')),
                    'is_overdue': is_overdue,
                    'progress_stage': _get_progress_stage('visit', v.get('status'), is_overdue),
                    'progress_stage_label': PROGRESS_STAGE_LABELS.get(_get_progress_stage('visit', v.get('status'), is_overdue), '待处理'),
                    'unreachable_count': v.get('unreachable_count', 0),
                    'satisfaction': v.get('satisfaction'),
                    'handler_id': v.get('handler_id'),
                    'handler_name': v.get('handler_name'),
                    'repair_order_no': v.get('repair_order_no'),
                    'category_name': v.get('category_name'),
                    'user_name': v.get('user_name'),
                    'user_phone': v.get('user_phone'),
                    'address': v.get('address'),
                    'repair_content': v.get('repair_content'),
                    'created_at': v.get('created_at'),
                    'updated_at': v.get('updated_at'),
                    '_searchable': searchable,
                    '_created_at': visit_created,
                })

    if item_type in ['all', 'warning']:
        warnings = warning_repository.list()
        for w in warnings:
            if w.get('status') in ['active', 'processing']:
                visit_info = w.get('visit_info', {})
                warning_created = datetime.fromisoformat(w.get('created_at', '2000-01-01T00:00:00'))
                now = datetime.now()
                days_pending = (now - warning_created).days
                is_overdue = days_pending >= 2

                searchable = ' '.join([
                    str(visit_info.get('repair_order_no', '')),
                    str(visit_info.get('user_name', '')),
                    str(visit_info.get('user_phone', '')),
                    str(visit_info.get('repair_content', '')),
                    str(w.get('reminder_text', '')),
                ]).lower()

                all_items.append({
                    'id': f'warning_{w["id"]}',
                    'item_type': 'warning',
                    'item_type_label': '异常预警',
                    'source_id': w['id'],
                    'visit_id': w.get('visit_id'),
                    'warning_id': w['id'],
                    'title': w.get('reminder_text', ''),
                    'risk': w.get('level', 'low'),
                    'risk_label': WARNING_LEVEL_LABELS.get(w.get('level'), w.get('level')),
                    'status': w.get('status'),
                    'status_label': _get_warning_status_label(w.get('status')),
                    'is_overdue': is_overdue,
                    'progress_stage': _get_progress_stage('warning', w.get('status'), is_overdue, len(w.get('follow_up_records', []))),
                    'progress_stage_label': PROGRESS_STAGE_LABELS.get(_get_progress_stage('warning', w.get('status'), is_overdue, len(w.get('follow_up_records', []))), '待处理'),
                    'warning_type': w.get('warning_type'),
                    'warning_type_label': WARNING_TYPE_LABELS.get(w.get('warning_type'), w.get('warning_type')),
                    'unreachable_count': visit_info.get('unreachable_count', 0),
                    'satisfaction': visit_info.get('satisfaction'),
                    'handler_id': visit_info.get('handler_id'),
                    'handler_name': visit_info.get('handler_name'),
                    'repair_order_no': visit_info.get('repair_order_no'),
                    'category_name': visit_info.get('category_name'),
                    'user_name': visit_info.get('user_name'),
                    'user_phone': visit_info.get('user_phone'),
                    'address': visit_info.get('address'),
                    'repair_content': visit_info.get('repair_content'),
                    'created_at': w.get('created_at'),
                    'updated_at': w.get('updated_at'),
                    '_searchable': searchable,
                    '_created_at': warning_created,
                })

    if item_type in ['all', 'supervision']:
        supervisions = supervision_repository.list()
        for s in supervisions:
            if s.get('status') in ['pending', 'assigned', 'processing']:
                visit_info = s.get('visit_info', {})
                supervision_created = datetime.fromisoformat(s.get('created_at', '2000-01-01T00:00:00'))
                now = datetime.now()
                days_pending = (now - supervision_created).days
                is_overdue = days_pending >= 3

                searchable = ' '.join([
                    str(visit_info.get('repair_order_no', '')),
                    str(visit_info.get('user_name', '')),
                    str(visit_info.get('user_phone', '')),
                    str(visit_info.get('repair_content', '')),
                    str(s.get('description', '')),
                ]).lower()

                all_items.append({
                    'id': f'supervision_{s["id"]}',
                    'item_type': 'supervision',
                    'item_type_label': '异常督办',
                    'source_id': s['id'],
                    'visit_id': s.get('visit_id'),
                    'supervision_id': s['id'],
                    'title': s.get('description', ''),
                    'risk': s.get('risk', 'low'),
                    'risk_label': RISK_LABELS.get(s.get('risk'), s.get('risk')),
                    'status': s.get('status'),
                    'status_label': _get_supervision_status_label(s.get('status')),
                    'is_overdue': is_overdue,
                    'progress_stage': _get_progress_stage('supervision', s.get('status'), is_overdue, len(s.get('progress_records', []))),
                    'progress_stage_label': PROGRESS_STAGE_LABELS.get(_get_progress_stage('supervision', s.get('status'), is_overdue, len(s.get('progress_records', []))), '待处理'),
                    'source_type': s.get('source_type'),
                    'source_type_label': SOURCE_LABELS.get(s.get('source_type'), s.get('source_type')),
                    'assignee_id': s.get('assignee_id'),
                    'assignee_name': s.get('assignee_name'),
                    'unreachable_count': s.get('source_detail', {}).get('unreachable_count', 0) if s.get('source_type') == 'unreachable' else visit_info.get('unreachable_count', 0),
                    'satisfaction': visit_info.get('satisfaction'),
                    'handler_id': visit_info.get('handler_id'),
                    'handler_name': visit_info.get('handler_name'),
                    'repair_order_no': visit_info.get('repair_order_no'),
                    'category_name': visit_info.get('category_name'),
                    'user_name': visit_info.get('user_name'),
                    'user_phone': visit_info.get('user_phone'),
                    'address': visit_info.get('address'),
                    'repair_content': visit_info.get('repair_content'),
                    'created_at': s.get('created_at'),
                    'updated_at': s.get('updated_at'),
                    '_searchable': searchable,
                    '_created_at': supervision_created,
                })

    filtered_items = []
    for item in all_items:
        if handler_id and item.get('handler_id') != handler_id and item.get('assignee_id') != handler_id:
            continue
        if risk and item.get('risk') != risk:
            continue
        if status and item.get('status') != status:
            continue
        if keyword and keyword not in item.get('_searchable', ''):
            continue
        if is_overdue_filter is not None and is_overdue_filter != '':
            if is_overdue_filter.lower() in ['true', '1']:
                if not item.get('is_overdue'):
                    continue
            elif is_overdue_filter.lower() in ['false', '0']:
                if item.get('is_overdue'):
                    continue
        if date_from:
            try:
                df = datetime.fromisoformat(date_from)
                if item.get('_created_at') < df:
                    continue
            except ValueError:
                pass
        if date_to:
            try:
                dt = datetime.fromisoformat(date_to + 'T23:59:59')
                if item.get('_created_at') > dt:
                    continue
            except ValueError:
                pass
        filtered_items.append(item)

    risk_priority = {'high': 0, 'medium': 1, 'low': 2}
    filtered_items.sort(key=lambda x: (risk_priority.get(x.get('risk', 'low'), 3), x.get('_created_at')))

    total = len(filtered_items)
    total_pages = (total + page_size - 1) // page_size
    start = (page - 1) * page_size
    end = start + page_size
    paginated_items = filtered_items[start:end]

    result_items = []
    for item in paginated_items:
        clean_item = {k: v for k, v in item.items() if not k.startswith('_')}
        result_items.append(clean_item)

    return JsonResponse(success_response({
        'items': result_items,
        'total': total,
        'page': page,
        'page_size': page_size,
        'total_pages': total_pages,
    }))


def _get_visit_status_label(status: str) -> str:
    labels = {
        'pending': '待回访',
        'contacted': '已联系',
        'reprocess': '需二次处理',
        'closed': '已关闭',
        'unreachable': '无法联系',
    }
    return labels.get(status, status)


def _get_warning_status_label(status: str) -> str:
    labels = {
        'active': '进行中',
        'processing': '处理中',
        'resolved': '已解除',
        'ignored': '已忽略',
    }
    return labels.get(status, status)


def _get_supervision_status_label(status: str) -> str:
    labels = {
        'pending': '待分派',
        'assigned': '已分派',
        'processing': '处理中',
        'resolved': '已解决',
        'closed': '已关闭',
        'dismissed': '无需处理',
    }
    return labels.get(status, status)
