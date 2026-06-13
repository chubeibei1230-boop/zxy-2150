import datetime
from typing import List, Dict, Any, Optional, Tuple
from common.utils import format_datetime, parse_datetime
from repositories import (
    visit_repository,
    warning_repository,
    warning_rule_repository,
    threshold_repository,
)


WARNING_TYPE_LONG_PENDING = 'long_pending'
WARNING_TYPE_LOW_SATISFACTION = 'low_satisfaction'
WARNING_TYPE_UNREACHABLE_MANY = 'unreachable_many'
WARNING_TYPE_REPROCESS_TIMEOUT = 'reprocess_timeout'

WARNING_STATUS_ACTIVE = 'active'
WARNING_STATUS_PROCESSING = 'processing'
WARNING_STATUS_RESOLVED = 'resolved'
WARNING_STATUS_IGNORED = 'ignored'

WARNING_LEVEL_HIGH = 'high'
WARNING_LEVEL_MEDIUM = 'medium'
WARNING_LEVEL_LOW = 'low'

WARNING_TYPE_LABELS = {
    WARNING_TYPE_LONG_PENDING: '长期未处理',
    WARNING_TYPE_LOW_SATISFACTION: '满意度偏低',
    WARNING_TYPE_UNREACHABLE_MANY: '无法联系次数偏多',
    WARNING_TYPE_REPROCESS_TIMEOUT: '二次处理超时未关闭',
}

WARNING_LEVEL_LABELS = {
    WARNING_LEVEL_HIGH: '高',
    WARNING_LEVEL_MEDIUM: '中',
    WARNING_LEVEL_LOW: '低',
}

WARNING_LEVEL_COLORS = {
    WARNING_LEVEL_HIGH: '#FF4D4F',
    WARNING_LEVEL_MEDIUM: '#FAAD14',
    WARNING_LEVEL_LOW: '#1677FF',
}


class WarningEngine:
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

    @staticmethod
    def _get_reprocess_timestamp(visit: Dict[str, Any]) -> Optional[datetime.datetime]:
        timeline = visit.get('status_timeline', [])
        for event in reversed(timeline):
            if event.get('status') == 'reprocess':
                return WarningEngine._parse_dt(event.get('timestamp'))
        return None

    @staticmethod
    def _get_unreachable_count(visit: Dict[str, Any]) -> int:
        count = visit.get('unreachable_count', 0)
        if count:
            return count
        timeline = visit.get('status_timeline', [])
        return sum(1 for e in timeline if e.get('status') == 'unreachable')

    @classmethod
    def check_long_pending(cls, visit: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        if visit.get('status') != 'pending':
            return False, None
        rule = warning_rule_repository.get_by_type(WARNING_TYPE_LONG_PENDING)
        threshold = threshold_repository.get()
        default_pending_days = threshold.get('warning_pending_days', 3)
        pending_days = default_pending_days
        if rule:
            rule_pending_days = rule.get('params', {}).get('pending_days')
            if rule_pending_days and rule_pending_days > 0:
                pending_days = rule_pending_days
        created_at = cls._parse_dt(visit.get('created_at'))
        if not created_at:
            return False, None
        days_passed = cls._days_between(cls._now(), created_at)
        if days_passed >= pending_days:
            reminder = rule.get('reminder_text') if rule else f'已超过{pending_days}天未处理'
            return True, reminder
        return False, None

    @classmethod
    def check_low_satisfaction(cls, visit: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        satisfaction = visit.get('satisfaction')
        if satisfaction is None:
            return False, None
        rule = warning_rule_repository.get_by_type(WARNING_TYPE_LOW_SATISFACTION)
        threshold = threshold_repository.get()
        default_sat = threshold.get('warning_low_satisfaction', 3)
        sat_threshold = default_sat
        if rule:
            rule_sat = rule.get('params', {}).get('satisfaction_threshold')
            if rule_sat and rule_sat > 0 and rule_sat <= 5:
                sat_threshold = rule_sat
        if satisfaction <= sat_threshold:
            reminder = rule.get('reminder_text') if rule else f'满意度为{satisfaction}分，低于标准'
            return True, reminder
        return False, None

    @classmethod
    def check_unreachable_many(cls, visit: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        unreachable_count = cls._get_unreachable_count(visit)
        rule = warning_rule_repository.get_by_type(WARNING_TYPE_UNREACHABLE_MANY)
        threshold = threshold_repository.get()
        default_count = threshold.get('warning_unreachable_count', 2)
        count_threshold = default_count
        if rule:
            rule_count = rule.get('params', {}).get('unreachable_count')
            if rule_count and rule_count > 0:
                count_threshold = rule_count
        if unreachable_count >= count_threshold:
            reminder = rule.get('reminder_text') if rule else f'已无法联系{unreachable_count}次'
            return True, reminder
        return False, None

    @classmethod
    def check_reprocess_timeout(cls, visit: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        if visit.get('status') != 'reprocess':
            return False, None
        reprocess_at = cls._get_reprocess_timestamp(visit)
        if not reprocess_at:
            return False, None
        rule = warning_rule_repository.get_by_type(WARNING_TYPE_REPROCESS_TIMEOUT)
        threshold = threshold_repository.get()
        default_days = threshold.get('warning_reprocess_days', 3)
        reprocess_days = default_days
        if rule:
            rule_days = rule.get('params', {}).get('reprocess_days')
            if rule_days and rule_days > 0:
                reprocess_days = rule_days
        days_passed = cls._days_between(cls._now(), reprocess_at)
        if days_passed >= reprocess_days:
            reminder = rule.get('reminder_text') if rule else f'二次处理已超过{reprocess_days}天未关闭'
            return True, reminder
        return False, None

    @classmethod
    def detect_visit_warnings(cls, visit: Dict[str, Any]) -> List[Dict[str, Any]]:
        detected = []
        checks = [
            (WARNING_TYPE_LONG_PENDING, cls.check_long_pending),
            (WARNING_TYPE_LOW_SATISFACTION, cls.check_low_satisfaction),
            (WARNING_TYPE_UNREACHABLE_MANY, cls.check_unreachable_many),
            (WARNING_TYPE_REPROCESS_TIMEOUT, cls.check_reprocess_timeout),
        ]
        for warning_type, check_fn in checks:
            rule = warning_rule_repository.get_by_type(warning_type)
            if rule and not rule.get('enabled', True):
                continue
            triggered, reminder = check_fn(visit)
            if triggered:
                level = rule.get('level') if rule else WARNING_LEVEL_MEDIUM
                priority = rule.get('priority', 99) if rule else 99
                detected.append({
                    'warning_type': warning_type,
                    'warning_rule_id': rule.get('id') if rule else None,
                    'level': level,
                    'priority': priority,
                    'reminder_text': reminder or WARNING_TYPE_LABELS.get(warning_type, ''),
                    'detail': cls._build_detail(visit, warning_type),
                })
        return detected

    @classmethod
    def _build_detail(cls, visit: Dict[str, Any], warning_type: str) -> Dict[str, Any]:
        detail = {}
        if warning_type == WARNING_TYPE_LONG_PENDING:
            created_at = cls._parse_dt(visit.get('created_at'))
            if created_at:
                detail['pending_days'] = cls._days_between(cls._now(), created_at)
        elif warning_type == WARNING_TYPE_LOW_SATISFACTION:
            detail['satisfaction'] = visit.get('satisfaction')
        elif warning_type == WARNING_TYPE_UNREACHABLE_MANY:
            detail['unreachable_count'] = cls._get_unreachable_count(visit)
        elif warning_type == WARNING_TYPE_REPROCESS_TIMEOUT:
            reprocess_at = cls._get_reprocess_timestamp(visit)
            if reprocess_at:
                detail['reprocess_days'] = cls._days_between(cls._now(), reprocess_at)
        return detail

    @classmethod
    def sync_visit_info(cls, visit_id: str) -> None:
        visit = visit_repository.get_by_id(visit_id)
        if not visit:
            return
        visit_info = cls._extract_visit_info(visit)
        warnings = warning_repository.list_by_visit_id(visit_id)
        now = format_datetime()
        for warning in warnings:
            if warning.get('status') in [WARNING_STATUS_ACTIVE, WARNING_STATUS_PROCESSING]:
                warning_repository.update(warning['id'], {
                    'visit_info': visit_info,
                    'updated_at': now,
                })

    @classmethod
    def refresh_visit_warnings(cls, visit_id: str) -> Dict[str, Any]:
        visit = visit_repository.get_by_id(visit_id)
        if not visit:
            return {'created': 0, 'updated': 0, 'resolved': 0, 'total_active': 0}
        
        cls.sync_visit_info(visit_id)
        
        existing_warnings = warning_repository.list_by_visit_id(visit_id)
        existing_map = {
            w.get('warning_type'): w
            for w in existing_warnings
            if w.get('status') in [WARNING_STATUS_ACTIVE, WARNING_STATUS_PROCESSING]
        }
        now = format_datetime()
        created = 0
        resolved = 0
        updated = 0

        detected = cls.detect_visit_warnings(visit)
        detected_types = {d['warning_type'] for d in detected}

        for warning_data in detected:
            warning_type = warning_data['warning_type']
            existing = existing_map.get(warning_type)
            if existing:
                new_detail = warning_data.get('detail', {})
                old_detail = existing.get('detail', {})
                new_level = warning_data.get('level')
                old_level = existing.get('level')
                new_priority = warning_data.get('priority')
                old_priority = existing.get('priority')
                new_reminder = warning_data.get('reminder_text')
                old_reminder = existing.get('reminder_text')
                has_change = (
                    new_detail != old_detail
                    or new_level != old_level
                    or new_priority != old_priority
                    or new_reminder != old_reminder
                )
                if has_change:
                    warning_repository.update(existing['id'], {
                        'detail': new_detail,
                        'level': new_level,
                        'priority': new_priority,
                        'reminder_text': new_reminder,
                        'updated_at': now,
                    })
                    updated += 1
                existing_map.pop(warning_type, None)
            else:
                warning_repository.create({
                    'visit_id': visit_id,
                    'visit_info': cls._extract_visit_info(visit),
                    'warning_type': warning_data['warning_type'],
                    'warning_rule_id': warning_data.get('warning_rule_id'),
                    'level': warning_data['level'],
                    'priority': warning_data['priority'],
                    'reminder_text': warning_data.get('reminder_text'),
                    'detail': warning_data.get('detail', {}),
                    'status': WARNING_STATUS_ACTIVE,
                    'follow_up_records': [],
                    'created_at': now,
                    'updated_at': now,
                    'resolved_at': None,
                    'resolved_by': None,
                    'resolved_note': None,
                })
                created += 1

        for remaining in existing_map.values():
            warning_repository.update(remaining['id'], {
                'status': WARNING_STATUS_RESOLVED,
                'resolved_at': now,
                'resolved_by': 'system',
                'resolved_note': '预警条件不再满足，系统自动解除',
                'updated_at': now,
            })
            resolved += 1

        visit_warnings = warning_repository.list_by_visit_id(visit_id)
        active_visit_warnings = [w for w in visit_warnings if w.get('status') in [WARNING_STATUS_ACTIVE, WARNING_STATUS_PROCESSING]]
        escalated = cls._process_timeouts(active_visit_warnings)

        return {
            'created': created,
            'updated': updated,
            'resolved': resolved,
            'escalated': escalated,
            'total_active': len(warning_repository.list_active()),
        }

    @classmethod
    def refresh_all_warnings(cls) -> Dict[str, Any]:
        visits = visit_repository.list()
        existing_warnings = warning_repository.list()
        existing_map = {
            (w.get('visit_id'), w.get('warning_type')): w
            for w in existing_warnings
            if w.get('status') in [WARNING_STATUS_ACTIVE, WARNING_STATUS_PROCESSING]
        }
        now = format_datetime()
        created = 0
        resolved = 0
        updated = 0

        for visit in visits:
            visit_id = visit.get('id')
            detected = cls.detect_visit_warnings(visit)
            detected_types = {d['warning_type'] for d in detected}

            for warning_data in detected:
                key = (visit_id, warning_data['warning_type'])
                existing = existing_map.get(key)
                if existing:
                    new_detail = warning_data.get('detail', {})
                    old_detail = existing.get('detail', {})
                    new_level = warning_data.get('level')
                    old_level = existing.get('level')
                    new_priority = warning_data.get('priority')
                    old_priority = existing.get('priority')
                    new_reminder = warning_data.get('reminder_text')
                    old_reminder = existing.get('reminder_text')
                    has_change = (
                        new_detail != old_detail
                        or new_level != old_level
                        or new_priority != old_priority
                        or new_reminder != old_reminder
                    )
                    if has_change:
                        warning_repository.update(existing['id'], {
                            'detail': new_detail,
                            'level': new_level,
                            'priority': new_priority,
                            'reminder_text': new_reminder,
                            'updated_at': now,
                        })
                        updated += 1
                    existing_map.pop(key, None)
                else:
                    warning_repository.create({
                        'visit_id': visit_id,
                        'visit_info': cls._extract_visit_info(visit),
                        'warning_type': warning_data['warning_type'],
                        'warning_rule_id': warning_data.get('warning_rule_id'),
                        'level': warning_data['level'],
                        'priority': warning_data['priority'],
                        'reminder_text': warning_data.get('reminder_text'),
                        'detail': warning_data.get('detail', {}),
                        'status': WARNING_STATUS_ACTIVE,
                        'follow_up_records': [],
                        'created_at': now,
                        'updated_at': now,
                        'resolved_at': None,
                        'resolved_by': None,
                        'resolved_note': None,
                    })
                    created += 1

        for remaining in existing_map.values():
            if visit_repository.get_by_id(remaining.get('visit_id')):
                warning_repository.update(remaining['id'], {
                    'status': WARNING_STATUS_RESOLVED,
                    'resolved_at': now,
                    'resolved_by': 'system',
                    'resolved_note': '预警条件不再满足，系统自动解除',
                    'updated_at': now,
                })
                resolved += 1

        active_warnings = warning_repository.list_active()
        escalated = cls._process_timeouts(active_warnings)

        return {
            'created': created,
            'updated': updated,
            'resolved': resolved,
            'escalated': escalated,
            'total_active': len(warning_repository.list_active()),
        }

    @staticmethod
    def _extract_visit_info(visit: Dict[str, Any]) -> Dict[str, Any]:
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
    def add_follow_up(cls, warning_id: str, operator_id: str, operator_name: str, note: str, action: str = 'note') -> Optional[Dict[str, Any]]:
        warning = warning_repository.get_by_id(warning_id)
        if not warning:
            return None
        now = format_datetime()
        records = warning.get('follow_up_records', [])
        records.append({
            'timestamp': now,
            'operator_id': operator_id,
            'operator_name': operator_name,
            'action': action,
            'note': note,
        })
        update_data = {
            'follow_up_records': records,
            'updated_at': now,
        }
        if action != 'note':
            update_data['status'] = WARNING_STATUS_PROCESSING
        return warning_repository.update(warning_id, update_data)

    @classmethod
    def resolve_warning(cls, warning_id: str, operator_id: str, operator_name: str, note: str) -> Optional[Dict[str, Any]]:
        now = format_datetime()
        return warning_repository.update(warning_id, {
            'status': WARNING_STATUS_RESOLVED,
            'resolved_at': now,
            'resolved_by': operator_id,
            'resolved_note': note,
            'updated_at': now,
        })

    @classmethod
    def ignore_warning(cls, warning_id: str, operator_id: str, operator_name: str, note: str) -> Optional[Dict[str, Any]]:
        now = format_datetime()
        return warning_repository.update(warning_id, {
            'status': WARNING_STATUS_IGNORED,
            'resolved_at': now,
            'resolved_by': operator_id,
            'resolved_note': note,
            'updated_at': now,
        })

    @classmethod
    def _check_follow_up_timeout(cls, warning: Dict[str, Any]) -> Tuple[bool, Optional[str], Optional[str]]:
        if warning.get('status') not in [WARNING_STATUS_ACTIVE, WARNING_STATUS_PROCESSING]:
            return False, None, None

        threshold = threshold_repository.get()
        follow_up_days = threshold.get('warning_follow_up_days', 1)
        escalation_days = threshold.get('warning_escalation_days', 2)

        now = cls._now()
        last_activity = cls._parse_dt(warning.get('updated_at'))
        if not last_activity:
            return False, None, None

        days_passed = cls._days_between(now, last_activity)
        current_level = warning.get('level', WARNING_LEVEL_MEDIUM)

        if days_passed >= escalation_days and current_level != WARNING_LEVEL_HIGH:
            return True, WARNING_LEVEL_HIGH, f'预警已超过{escalation_days}天未跟进，自动升级为高级别'
        elif days_passed >= follow_up_days and current_level == WARNING_LEVEL_LOW:
            return True, WARNING_LEVEL_MEDIUM, f'预警已超过{follow_up_days}天未跟进，自动升级为中级别'

        return False, None, None

    @classmethod
    def _process_timeouts(cls, warnings: List[Dict[str, Any]]) -> int:
        now = format_datetime()
        escalated = 0

        for warning in warnings:
            should_escalate, new_level, reason = cls._check_follow_up_timeout(warning)
            if should_escalate and new_level:
                records = warning.get('follow_up_records', [])
                records.append({
                    'timestamp': now,
                    'operator_id': 'system',
                    'operator_name': '系统',
                    'action': 'escalate',
                    'note': reason or '系统自动升级预警级别',
                })
                warning_repository.update(warning['id'], {
                    'level': new_level,
                    'follow_up_records': records,
                    'updated_at': now,
                })
                escalated += 1

        return escalated

    @classmethod
    def get_warning_stats(cls) -> Dict[str, Any]:
        all_warnings = warning_repository.list()
        active = [w for w in all_warnings if w.get('status') in [WARNING_STATUS_ACTIVE, WARNING_STATUS_PROCESSING]]

        stats = {
            'total': len(all_warnings),
            'active_count': len(active),
            'processing_count': sum(1 for w in active if w.get('status') == WARNING_STATUS_PROCESSING),
            'by_type': {},
            'by_level': {},
            'by_handler': {},
        }

        for wt in WARNING_TYPE_LABELS:
            stats['by_type'][wt] = sum(1 for w in active if w.get('warning_type') == wt)

        for lv in [WARNING_LEVEL_HIGH, WARNING_LEVEL_MEDIUM, WARNING_LEVEL_LOW]:
            stats['by_level'][lv] = sum(1 for w in active if w.get('level') == lv)

        for w in active:
            handler_name = w.get('visit_info', {}).get('handler_name', '未分配')
            stats['by_handler'][handler_name] = stats['by_handler'].get(handler_name, 0) + 1

        return stats


warning_engine = WarningEngine()
