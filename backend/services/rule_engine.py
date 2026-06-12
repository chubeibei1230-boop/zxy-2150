import datetime
from typing import List, Dict, Any, Optional
from common.utils import format_datetime


class RuleEngine:
    @staticmethod
    def _parse_datetime(dt_str: Optional[str]) -> Optional[datetime.datetime]:
        if not dt_str:
            return None
        try:
            return datetime.datetime.fromisoformat(dt_str)
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _days_between(dt1: datetime.datetime, dt2: datetime.datetime) -> int:
        return abs((dt1.date() - dt2.date()).days)

    @classmethod
    def _check_category_match(cls, repair_order: Dict[str, Any], rule: Dict[str, Any]) -> bool:
        category_ids = rule.get('category_ids', [])
        if not category_ids:
            return True
        order_category_id = repair_order.get('category_id')
        return order_category_id in category_ids

    @classmethod
    def _check_days_threshold(
        cls,
        repair_order: Dict[str, Any],
        rule: Dict[str, Any],
        current_time: datetime.datetime
    ) -> bool:
        days_threshold = rule.get('days_after_completion')
        if days_threshold is None:
            return True
        completed_at_str = repair_order.get('completed_at')
        completed_at = cls._parse_datetime(completed_at_str)
        if not completed_at:
            return False
        days_passed = cls._days_between(current_time, completed_at)
        return days_passed >= days_threshold

    @classmethod
    def _check_satisfaction(
        cls,
        repair_order: Dict[str, Any],
        rule: Dict[str, Any],
        all_visits: List[Dict[str, Any]]
    ) -> bool:
        threshold = rule.get('satisfaction_threshold')
        if threshold is None:
            return True
        order_id = repair_order.get('id')
        related_visits = [
            v for v in all_visits
            if v.get('repair_order_id') == order_id and v.get('satisfaction') is not None
        ]
        if not related_visits:
            return True
        latest_satisfaction = max(
            related_visits,
            key=lambda v: cls._parse_datetime(v.get('updated_at', '')) or datetime.datetime.min
        ).get('satisfaction')
        if latest_satisfaction is None:
            return True
        return latest_satisfaction <= threshold

    @classmethod
    def _check_repeat_repair(
        cls,
        repair_order: Dict[str, Any],
        rule: Dict[str, Any],
        all_visits: List[Dict[str, Any]],
        current_time: datetime.datetime
    ) -> bool:
        check_repeat = rule.get('check_repeat_repair', False)
        if not check_repeat:
            return True
        user_phone = repair_order.get('user_phone')
        category_id = repair_order.get('category_id')
        order_id = repair_order.get('id')
        if not user_phone or not category_id:
            return False
        recent_visits = [
            v for v in all_visits
            if v.get('user_phone') == user_phone
            and v.get('category_id') == category_id
            and v.get('repair_order_id') != order_id
        ]
        for visit in recent_visits:
            visit_created = cls._parse_datetime(visit.get('created_at', ''))
            if visit_created and cls._days_between(current_time, visit_created) <= 30:
                return True
        return False

    @classmethod
    def match_rules(
        cls,
        repair_order: Dict[str, Any],
        categories: List[Dict[str, Any]],
        rules: List[Dict[str, Any]],
        all_visits: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        matched_rules = []
        current_time = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8)))

        for rule in rules:
            if not rule.get('enabled', True):
                continue

            category_match = cls._check_category_match(repair_order, rule)
            if not category_match:
                continue

            days_match = cls._check_days_threshold(repair_order, rule, current_time)
            if not days_match:
                continue

            satisfaction_match = cls._check_satisfaction(repair_order, rule, all_visits)
            if not satisfaction_match:
                continue

            repeat_match = cls._check_repeat_repair(repair_order, rule, all_visits, current_time)
            if rule.get('check_repeat_repair', False) and not repeat_match:
                continue

            matched_rules.append({
                'rule_id': rule.get('id'),
                'rule_name': rule.get('name'),
                'rule_description': rule.get('description'),
                'reminder_text': rule.get('reminder_text'),
                'matched_at': format_datetime(current_time)
            })

        return matched_rules
