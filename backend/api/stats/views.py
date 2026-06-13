from django.http import JsonResponse, HttpRequest
from common.decorators import require_role
from common.utils import success_response
from repositories import visit_repository, rule_repository
from services.warning_engine import warning_engine, WARNING_TYPE_LABELS, WARNING_LEVEL_LABELS
from collections import Counter


@require_role(['admin', 'operator', 'auditor'])
def dashboard_stats(request: HttpRequest) -> JsonResponse:
    all_visits = visit_repository.list()

    pending_count = sum(1 for v in all_visits if v.get('status') == 'pending')

    reprocess_count = sum(1 for v in all_visits if v.get('status') == 'reprocess')
    total_visits = len(all_visits)
    reprocess_rate = round(reprocess_count / total_visits * 100, 2) if total_visits > 0 else 0

    satisfied_visits = [v for v in all_visits if v.get('satisfaction') is not None]
    if satisfied_visits:
        avg_satisfaction = round(sum(v['satisfaction'] for v in satisfied_visits) / len(satisfied_visits), 2)
    else:
        avg_satisfaction = 0

    unreachable_visits = [v for v in all_visits if v.get('status') == 'unreachable']
    unreachable_reasons = Counter(v.get('unreachable_reason') for v in unreachable_visits if v.get('unreachable_reason'))
    unreachable_reasons_list = [
        {'reason': reason, 'count': count}
        for reason, count in unreachable_reasons.most_common()
    ]

    rule_hit_counter = Counter()
    rule_names = {}
    for visit in all_visits:
        matched_rules = visit.get('matched_rules', [])
        for rule in matched_rules:
            rule_id = rule.get('rule_id')
            rule_name = rule.get('rule_name')
            if rule_id and rule_name:
                rule_hit_counter[rule_id] += 1
                rule_names[rule_id] = rule_name

    rule_hit_ranking = [
        {'rule_id': rule_id, 'rule_name': rule_names.get(rule_id, rule_id), 'hit_count': count}
        for rule_id, count in rule_hit_counter.most_common()
    ]

    status_counter = Counter(v.get('status') for v in all_visits)
    status_distribution = [
        {'status': status, 'count': count}
        for status, count in status_counter.items()
    ]

    warning_stats = warning_engine.get_warning_stats()

    warning_by_type = []
    for wt, label in WARNING_TYPE_LABELS.items():
        warning_by_type.append({
            'type': wt,
            'label': label,
            'count': warning_stats.get('by_type', {}).get(wt, 0),
        })

    warning_by_level = []
    for lv, label in WARNING_LEVEL_LABELS.items():
        warning_by_level.append({
            'level': lv,
            'label': label,
            'count': warning_stats.get('by_level', {}).get(lv, 0),
        })

    warning_by_handler = [
        {'handler_name': k, 'count': v}
        for k, v in sorted(warning_stats.get('by_handler', {}).items(), key=lambda x: -x[1])
    ]

    stats = {
        'pending_count': pending_count,
        'reprocess_rate': reprocess_rate,
        'avg_satisfaction': avg_satisfaction,
        'total_visits': total_visits,
        'unreachable_reasons': unreachable_reasons_list,
        'rule_hit_ranking': rule_hit_ranking,
        'status_distribution': status_distribution,
        'warning_active_count': warning_stats.get('active_count', 0),
        'warning_processing_count': warning_stats.get('processing_count', 0),
        'warning_total': warning_stats.get('total', 0),
        'warning_by_type': warning_by_type,
        'warning_by_level': warning_by_level,
        'warning_by_handler': warning_by_handler,
    }

    return JsonResponse(success_response(stats))
