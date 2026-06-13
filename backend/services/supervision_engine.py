import datetime
from typing import List, Dict, Any, Optional
from common.utils import format_datetime, parse_datetime
from repositories import visit_repository, supervision_repository


SOURCE_DISSATISFIED = 'dissatisfied'
SOURCE_REPROCESS = 'reprocess'
SOURCE_UNREACHABLE = 'unreachable'
SOURCE_OVERDUE = 'overdue'

SOURCE_LABELS = {
    SOURCE_DISSATISFIED: '用户不满意',
    SOURCE_REPROCESS: '需二次处理',
    SOURCE_UNREACHABLE: '无法联系',
    SOURCE_OVERDUE: '超期未回访',
}

STATUS_PENDING = 'pending'
STATUS_ASSIGNED = 'assigned'
STATUS_PROCESSING = 'processing'
STATUS_RESOLVED = 'resolved'
STATUS_CLOSED = 'closed'
STATUS_DISMISSED = 'dismissed'

STATUS_LABELS = {
    STATUS_PENDING: '待分派',
    STATUS_ASSIGNED: '已分派',
    STATUS_PROCESSING: '处理中',
    STATUS_RESOLVED: '已解决',
    STATUS_CLOSED: '已关闭',
    STATUS_DISMISSED: '无需处理',
}

RISK_HIGH = 'high'
RISK_MEDIUM = 'medium'
RISK_LOW = 'low'

RISK_LABELS = {
    RISK_HIGH: '高风险',
    RISK_MEDIUM: '中风险',
    RISK_LOW: '低风险',
}


class SupervisionEngine:
    @staticmethod
    def _now() -> datetime.datetime:
        return datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8)))

    @staticmethod
    def _parse_dt(dt_str: Optional[str]) -> Optional[datetime.datetime]:
        if not dt_str:
            return None
        try:
            return parse_datetime(dt_str)
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _days_between(dt1: datetime.datetime, dt2: datetime.datetime) -> int:
        return abs((dt1.date() - dt2.date()).days)

    @classmethod
    def _extract_visit_info(cls, visit: Dict[str, Any]) -> Dict[str, Any]:
        return {
            'repair_order_no': visit.get('repair_order_no'),
            'category_name': visit.get('category_name'),
            'user_name': visit.get('user_name'),
            'user_phone': visit.get('user_phone'),
            'address': visit.get('address'),
            'repair_content': visit.get('repair_content'),
            'handler_id': visit.get('handler_id'),
            'handler_name': visit.get('handler_name'),
            'status': visit.get('status'),
            'satisfaction': visit.get('satisfaction'),
            'completed_at': visit.get('completed_at'),
            'created_at': visit.get('created_at'),
        }

    @classmethod
    def _determine_risk(cls, source_type: str, visit: Dict[str, Any]) -> str:
        if source_type == SOURCE_OVERDUE:
            created_at = cls._parse_dt(visit.get('created_at'))
            if created_at:
                days = cls._days_between(cls._now(), created_at)
                if days >= 7:
                    return RISK_HIGH
                if days >= 3:
                    return RISK_MEDIUM
            return RISK_LOW
        if source_type == SOURCE_REPROCESS:
            satisfaction = visit.get('satisfaction')
            if satisfaction is not None and satisfaction <= 2:
                return RISK_HIGH
            return RISK_MEDIUM
        if source_type == SOURCE_DISSATISFIED:
            satisfaction = visit.get('satisfaction')
            if satisfaction is not None and satisfaction <= 1:
                return RISK_HIGH
            if satisfaction is not None and satisfaction <= 2:
                return RISK_MEDIUM
            return RISK_LOW
        if source_type == SOURCE_UNREACHABLE:
            count = visit.get('unreachable_count', 0)
            if count >= 3:
                return RISK_HIGH
            if count >= 2:
                return RISK_MEDIUM
            return RISK_LOW
        return RISK_LOW

    @classmethod
    def _build_source_detail(cls, source_type: str, visit: Dict[str, Any]) -> Dict[str, Any]:
        detail = {}
        if source_type == SOURCE_DISSATISFIED:
            detail['satisfaction'] = visit.get('satisfaction')
        elif source_type == SOURCE_REPROCESS:
            detail['satisfaction'] = visit.get('satisfaction')
            detail['unresolved_note'] = visit.get('unresolved_note')
        elif source_type == SOURCE_UNREACHABLE:
            detail['unreachable_count'] = visit.get('unreachable_count', 0)
            detail['unreachable_reason'] = visit.get('unreachable_reason')
        elif source_type == SOURCE_OVERDUE:
            created_at = cls._parse_dt(visit.get('created_at'))
            if created_at:
                detail['overdue_days'] = cls._days_between(cls._now(), created_at)
        return detail

    @classmethod
    def detect_visit_exceptions(cls, visit: Dict[str, Any]) -> List[Dict[str, Any]]:
        detected = []
        status = visit.get('status')

        if status == 'reprocess':
            detected.append({
                'source_type': SOURCE_REPROCESS,
                'risk': cls._determine_risk(SOURCE_REPROCESS, visit),
                'source_detail': cls._build_source_detail(SOURCE_REPROCESS, visit),
                'description': f"回访单 {visit.get('repair_order_no')} 需二次处理",
            })

        if status == 'unreachable':
            detected.append({
                'source_type': SOURCE_UNREACHABLE,
                'risk': cls._determine_risk(SOURCE_UNREACHABLE, visit),
                'source_detail': cls._build_source_detail(SOURCE_UNREACHABLE, visit),
                'description': f"回访单 {visit.get('repair_order_no')} 无法联系用户",
            })

        satisfaction = visit.get('satisfaction')
        if satisfaction is not None and satisfaction <= 3 and status in ['contacted', 'closed', 'reprocess']:
            detected.append({
                'source_type': SOURCE_DISSATISFIED,
                'risk': cls._determine_risk(SOURCE_DISSATISFIED, visit),
                'source_detail': cls._build_source_detail(SOURCE_DISSATISFIED, visit),
                'description': f"回访单 {visit.get('repair_order_no')} 用户不满意（满意度{sat_score_display(satisfaction)}分）",
            })

        if status == 'pending':
            created_at = cls._parse_dt(visit.get('created_at'))
            if created_at:
                days = cls._days_between(cls._now(), created_at)
                if days >= 3:
                    detected.append({
                        'source_type': SOURCE_OVERDUE,
                        'risk': cls._determine_risk(SOURCE_OVERDUE, visit),
                        'source_detail': cls._build_source_detail(SOURCE_OVERDUE, visit),
                        'description': f"回访单 {visit.get('repair_order_no')} 超期{days}天未回访",
                    })

        return detected

    @classmethod
    def generate_supervisions(cls) -> Dict[str, Any]:
        visits = visit_repository.list()
        existing = supervision_repository.list()
        active_map = {}
        for s in existing:
            if s.get('status') in [STATUS_PENDING, STATUS_ASSIGNED, STATUS_PROCESSING]:
                key = (s.get('visit_id'), s.get('source_type'))
                active_map[key] = s

        now = format_datetime()
        created = 0
        updated = 0
        resolved = 0

        detected_map = {}
        for visit in visits:
            visit_id = visit.get('id')
            exceptions = cls.detect_visit_exceptions(visit)
            for exc in exceptions:
                key = (visit_id, exc['source_type'])
                detected_map[key] = exc

        for key, exc in detected_map.items():
            visit_id = key[0]
            existing_item = active_map.get(key)
            if existing_item:
                new_risk = exc.get('risk')
                old_risk = existing_item.get('risk')
                new_detail = exc.get('source_detail', {})
                old_detail = existing_item.get('source_detail', {})
                new_desc = exc.get('description')
                old_desc = existing_item.get('description')
                has_change = new_risk != old_risk or new_detail != old_detail or new_desc != old_desc
                if has_change:
                    visit = visit_repository.get_by_id(visit_id)
                    visit_info = cls._extract_visit_info(visit) if visit else existing_item.get('visit_info', {})
                    supervision_repository.update(existing_item['id'], {
                        'risk': new_risk,
                        'source_detail': new_detail,
                        'description': new_desc,
                        'visit_info': visit_info,
                        'updated_at': now,
                    })
                    updated += 1
                active_map.pop(key, None)
            else:
                visit = visit_repository.get_by_id(visit_id)
                visit_info = cls._extract_visit_info(visit) if visit else {}
                handler_id = visit.get('handler_id') if visit else None
                handler_name = visit.get('handler_name') if visit else None
                supervision_repository.create({
                    'visit_id': visit_id,
                    'visit_info': visit_info,
                    'source_type': exc['source_type'],
                    'risk': exc['risk'],
                    'source_detail': exc.get('source_detail', {}),
                    'description': exc.get('description', ''),
                    'status': STATUS_PENDING,
                    'assignee_id': handler_id,
                    'assignee_name': handler_name,
                    'progress_records': [],
                    'created_at': now,
                    'updated_at': now,
                    'resolved_at': None,
                    'resolved_by': None,
                    'resolved_note': None,
                })
                created += 1

        for remaining in active_map.values():
            supervision_repository.update(remaining['id'], {
                'status': STATUS_CLOSED,
                'resolved_at': now,
                'resolved_by': 'system',
                'resolved_note': '异常条件已消除，系统自动关闭',
                'updated_at': now,
            })
            resolved += 1

        return {
            'created': created,
            'updated': updated,
            'resolved': resolved,
            'total_active': len(supervision_repository.list_active()),
        }

    @classmethod
    def add_progress(cls, supervision_id: str, operator_id: str, operator_name: str, note: str, action: str = 'note') -> Optional[Dict[str, Any]]:
        item = supervision_repository.get_by_id(supervision_id)
        if not item:
            return None
        now = format_datetime()
        records = item.get('progress_records', [])
        records.append({
            'timestamp': now,
            'operator_id': operator_id,
            'operator_name': operator_name,
            'action': action,
            'note': note,
        })
        update_data = {
            'progress_records': records,
            'updated_at': now,
        }
        if item.get('status') in [STATUS_PENDING, STATUS_ASSIGNED]:
            update_data['status'] = STATUS_PROCESSING
        return supervision_repository.update(supervision_id, update_data)

    @classmethod
    def resolve_supervision(cls, supervision_id: str, operator_id: str, operator_name: str, note: str) -> Optional[Dict[str, Any]]:
        now = format_datetime()
        item = supervision_repository.get_by_id(supervision_id)
        if not item:
            return None
        records = item.get('progress_records', [])
        records.append({
            'timestamp': now,
            'operator_id': operator_id,
            'operator_name': operator_name,
            'action': 'resolve',
            'note': note,
        })
        return supervision_repository.update(supervision_id, {
            'status': STATUS_RESOLVED,
            'progress_records': records,
            'resolved_at': now,
            'resolved_by': operator_id,
            'resolved_note': note,
            'updated_at': now,
        })

    @classmethod
    def reassign_supervision(cls, supervision_id: str, operator_id: str, operator_name: str, new_assignee_id: str, new_assignee_name: str, note: str) -> Optional[Dict[str, Any]]:
        now = format_datetime()
        item = supervision_repository.get_by_id(supervision_id)
        if not item:
            return None
        records = item.get('progress_records', [])
        records.append({
            'timestamp': now,
            'operator_id': operator_id,
            'operator_name': operator_name,
            'action': 'reassign',
            'note': f"转派给 {new_assignee_name}" + (f"：{note}" if note else ""),
        })
        return supervision_repository.update(supervision_id, {
            'assignee_id': new_assignee_id,
            'assignee_name': new_assignee_name,
            'status': STATUS_ASSIGNED,
            'progress_records': records,
            'updated_at': now,
        })

    @classmethod
    def close_supervision(cls, supervision_id: str, operator_id: str, operator_name: str, note: str) -> Optional[Dict[str, Any]]:
        now = format_datetime()
        item = supervision_repository.get_by_id(supervision_id)
        if not item:
            return None
        records = item.get('progress_records', [])
        records.append({
            'timestamp': now,
            'operator_id': operator_id,
            'operator_name': operator_name,
            'action': 'close',
            'note': note,
        })
        return supervision_repository.update(supervision_id, {
            'status': STATUS_CLOSED,
            'progress_records': records,
            'resolved_at': now,
            'resolved_by': operator_id,
            'resolved_note': note,
            'updated_at': now,
        })

    @classmethod
    def dismiss_supervision(cls, supervision_id: str, operator_id: str, operator_name: str, note: str) -> Optional[Dict[str, Any]]:
        now = format_datetime()
        item = supervision_repository.get_by_id(supervision_id)
        if not item:
            return None
        records = item.get('progress_records', [])
        records.append({
            'timestamp': now,
            'operator_id': operator_id,
            'operator_name': operator_name,
            'action': 'dismiss',
            'note': note,
        })
        return supervision_repository.update(supervision_id, {
            'status': STATUS_DISMISSED,
            'progress_records': records,
            'resolved_at': now,
            'resolved_by': operator_id,
            'resolved_note': note,
            'updated_at': now,
        })

    @classmethod
    def get_supervision_stats(cls) -> Dict[str, Any]:
        all_items = supervision_repository.list()
        active = [s for s in all_items if s.get('status') in [STATUS_PENDING, STATUS_ASSIGNED, STATUS_PROCESSING]]

        stats = {
            'total': len(all_items),
            'exception_count': len(active),
            'processing_count': sum(1 for s in active if s.get('status') == STATUS_PROCESSING),
            'assigned_count': sum(1 for s in active if s.get('status') == STATUS_ASSIGNED),
            'pending_count': sum(1 for s in active if s.get('status') == STATUS_PENDING),
            'closed_count': sum(1 for s in all_items if s.get('status') in [STATUS_RESOLVED, STATUS_CLOSED, STATUS_DISMISSED]),
            'resolved_count': sum(1 for s in all_items if s.get('status') == STATUS_RESOLVED),
            'dismissed_count': sum(1 for s in all_items if s.get('status') == STATUS_DISMISSED),
            'by_source': {},
            'by_risk': {},
            'by_assignee': {},
            'high_risk_ratio': 0,
        }

        for src in SOURCE_LABELS:
            stats['by_source'][src] = sum(1 for s in active if s.get('source_type') == src)

        for risk in [RISK_HIGH, RISK_MEDIUM, RISK_LOW]:
            stats['by_risk'][risk] = sum(1 for s in active if s.get('risk') == risk)

        for s in active:
            assignee_name = s.get('assignee_name') or '未分配'
            stats['by_assignee'][assignee_name] = stats['by_assignee'].get(assignee_name, 0) + 1

        if len(active) > 0:
            high_count = stats['by_risk'].get(RISK_HIGH, 0)
            stats['high_risk_ratio'] = round(high_count / len(active) * 100, 1)

        return stats


def sat_score_display(satisfaction):
    return satisfaction


supervision_engine = SupervisionEngine()
