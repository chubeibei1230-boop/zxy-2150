export interface User {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'operator' | 'auditor' | 'user';
  enabled: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  created_at: string;
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  category_ids: string[];
  days_after_completion: number;
  satisfaction_threshold: number;
  check_repeat_repair: boolean;
  reminder_text: string;
  priority: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface MatchedRuleSnapshot {
  rule_id: string;
  rule_name: string;
  rule_description: string;
  reminder_text: string;
  matched_at: string;
}

export interface StatusEvent {
  status: string;
  operator_id: string;
  operator_name: string;
  remark: string;
  timestamp: string;
}

export type VisitStatus = 'pending' | 'contacted' | 'reprocess' | 'closed' | 'unreachable';

export interface Visit {
  id: string;
  repair_order_id: string;
  repair_order_no: string;
  category_id: string;
  category_name: string;
  user_name: string;
  user_phone: string;
  address: string;
  repair_content: string;
  handler_id: string;
  handler_name: string;
  completed_at: string;
  status: VisitStatus;
  satisfaction: number | null;
  visit_result: string | null;
  unresolved_note: string | null;
  unreachable_reason: string | null;
  unreachable_count: number;
  matched_rules: MatchedRuleSnapshot[];
  status_timeline: StatusEvent[];
  created_at: string;
  updated_at: string;
}

export type WarningType = 'long_pending' | 'low_satisfaction' | 'unreachable_many' | 'reprocess_timeout';
export type WarningLevel = 'high' | 'medium' | 'low';
export type WarningStatus = 'active' | 'processing' | 'resolved' | 'ignored';

export interface WarningDetail {
  pending_days?: number;
  satisfaction?: number;
  unreachable_count?: number;
  reprocess_days?: number;
  [key: string]: any;
}

export interface FollowUpRecord {
  timestamp: string;
  operator_id: string;
  operator_name: string;
  action: string;
  note: string;
}

export interface Warning {
  id: string;
  visit_id: string;
  visit_info: {
    repair_order_no: string;
    category_name: string;
    user_name: string;
    user_phone: string;
    address: string;
    repair_content: string;
    handler_id: string;
    handler_name: string;
    status: VisitStatus;
    satisfaction: number | null;
    completed_at: string;
    created_at: string;
  };
  warning_type: WarningType;
  warning_type_label?: string;
  warning_rule_id: string | null;
  level: WarningLevel;
  level_label?: string;
  priority: number;
  reminder_text: string;
  detail: WarningDetail;
  status: WarningStatus;
  follow_up_records: FollowUpRecord[];
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolved_note: string | null;
}

export interface WarningFilter {
  warning_type?: WarningType;
  level?: WarningLevel;
  status?: WarningStatus | 'active';
  handler_id?: string;
  keyword?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

export interface WarningRule {
  id: string;
  type: WarningType;
  type_label?: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  params: {
    pending_days?: number;
    satisfaction_threshold?: number;
    unreachable_count?: number;
    reprocess_days?: number;
    [key: string]: any;
  };
  reminder_text: string;
  level: WarningLevel;
  level_label?: string;
  created_at: string;
  updated_at: string;
}

export interface WarningStats {
  total: number;
  active_count: number;
  processing_count: number;
  by_type: Record<WarningType, number>;
  by_level: Record<WarningLevel, number>;
  by_handler: Record<string, number>;
}

export const WARNING_TYPE_OPTIONS: { value: WarningType; label: string }[] = [
  { value: 'long_pending', label: '长期未处理' },
  { value: 'low_satisfaction', label: '满意度偏低' },
  { value: 'unreachable_many', label: '无法联系次数偏多' },
  { value: 'reprocess_timeout', label: '二次处理超时未关闭' },
];

export const WARNING_LEVEL_OPTIONS: { value: WarningLevel; label: string; color: string }[] = [
  { value: 'high', label: '高', color: 'red' },
  { value: 'medium', label: '中', color: 'orange' },
  { value: 'low', label: '低', color: 'blue' },
];

export const WARNING_STATUS_OPTIONS: { value: WarningStatus | 'active'; label: string; color: string }[] = [
  { value: 'active', label: '进行中', color: 'processing' },
  { value: 'processing', label: '处理中', color: 'blue' },
  { value: 'resolved', label: '已解除', color: 'success' },
  { value: 'ignored', label: '已忽略', color: 'default' },
];

export interface VisitFilter {
  keyword?: string;
  category_id?: string;
  handler_id?: string;
  status?: string;
  satisfaction_min?: number;
  satisfaction_max?: number;
  date_from?: string;
  date_to?: string;
  rule_id?: string;
  unreachable_reason?: string;
  page?: number;
  page_size?: number;
}

export interface ProcessVisitRequest {
  status: 'contacted' | 'reprocess' | 'closed' | 'unreachable';
  satisfaction?: number;
  visit_result?: string;
  unresolved_note?: string;
  unreachable_reason?: string;
  remark?: string;
}

export interface DashboardStats {
  pending_count: number;
  reprocess_rate: number;
  avg_satisfaction: number;
  total_visits: number;
  unreachable_reasons: { reason: string; count: number }[];
  rule_hit_ranking: { rule_id: string; rule_name: string; hit_count: number }[];
  status_distribution: { status: string; count: number }[];
  warning_active_count: number;
  warning_processing_count: number;
  warning_total: number;
  warning_by_type: { type: string; label: string; count: number }[];
  warning_by_level: { level: string; label: string; count: number }[];
  warning_by_handler: { handler_name: string; count: number }[];
  supervision_exception_count: number;
  supervision_processing_count: number;
  supervision_assigned_count: number;
  supervision_pending_count: number;
  supervision_closed_count: number;
  supervision_resolved_count: number;
  supervision_dismissed_count: number;
  supervision_high_risk_ratio: number;
  supervision_total: number;
  supervision_by_source: { source: string; label: string; count: number }[];
  supervision_by_risk: { risk: string; label: string; count: number }[];
  supervision_by_assignee: { assignee_name: string; count: number }[];
}

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export const STATUS_OPTIONS: { value: VisitStatus; label: string; color: string }[] = [
  { value: 'pending', label: '待回访', color: 'orange' },
  { value: 'contacted', label: '已联系', color: 'blue' },
  { value: 'reprocess', label: '需二次处理', color: 'red' },
  { value: 'closed', label: '已关闭', color: 'green' },
  { value: 'unreachable', label: '无法联系', color: 'default' },
];

export const UNREACHABLE_REASONS: { value: string; label: string }[] = [
  { value: 'phone_off', label: '电话关机' },
  { value: 'no_answer', label: '无人接听' },
  { value: 'rejected', label: '用户拒接' },
  { value: 'wrong_number', label: '号码错误' },
  { value: 'other', label: '其他原因' },
];

export type SupervisionSourceType = 'dissatisfied' | 'reprocess' | 'unreachable' | 'overdue';
export type SupervisionRisk = 'high' | 'medium' | 'low';
export type SupervisionStatus = 'pending' | 'assigned' | 'processing' | 'resolved' | 'closed' | 'dismissed';

export interface SupervisionSourceDetail {
  satisfaction?: number;
  unresolved_note?: string;
  unreachable_count?: number;
  unreachable_reason?: string;
  overdue_days?: number;
  [key: string]: any;
}

export interface SupervisionProgressRecord {
  timestamp: string;
  operator_id: string;
  operator_name: string;
  action: string;
  note: string;
}

export interface Supervision {
  id: string;
  visit_id: string;
  visit_info: {
    repair_order_no: string;
    category_name: string;
    user_name: string;
    user_phone: string;
    address: string;
    repair_content: string;
    handler_id: string;
    handler_name: string;
    status: VisitStatus;
    satisfaction: number | null;
    completed_at: string;
    created_at: string;
  };
  source_type: SupervisionSourceType;
  source_type_label?: string;
  risk: SupervisionRisk;
  risk_label?: string;
  source_detail: SupervisionSourceDetail;
  description: string;
  status: SupervisionStatus;
  status_label?: string;
  assignee_id: string | null;
  assignee_name: string | null;
  progress_records: SupervisionProgressRecord[];
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolved_note: string | null;
}

export interface SupervisionFilter {
  source_type?: SupervisionSourceType;
  risk?: SupervisionRisk;
  status?: SupervisionStatus | 'active';
  assignee_id?: string;
  keyword?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

export interface SupervisionStats {
  total: number;
  exception_count: number;
  processing_count: number;
  assigned_count: number;
  pending_count: number;
  closed_count: number;
  resolved_count: number;
  dismissed_count: number;
  by_source: Record<SupervisionSourceType, number>;
  by_risk: Record<SupervisionRisk, number>;
  by_assignee: Record<string, number>;
  high_risk_ratio: number;
}

export const SUPERVISION_SOURCE_OPTIONS: { value: SupervisionSourceType; label: string }[] = [
  { value: 'dissatisfied', label: '用户不满意' },
  { value: 'reprocess', label: '需二次处理' },
  { value: 'unreachable', label: '无法联系' },
  { value: 'overdue', label: '超期未回访' },
];

export const SUPERVISION_RISK_OPTIONS: { value: SupervisionRisk; label: string; color: string }[] = [
  { value: 'high', label: '高风险', color: 'red' },
  { value: 'medium', label: '中风险', color: 'orange' },
  { value: 'low', label: '低风险', color: 'blue' },
];

export const SUPERVISION_STATUS_OPTIONS: { value: SupervisionStatus | 'active'; label: string; color: string }[] = [
  { value: 'pending', label: '待分派', color: 'default' },
  { value: 'assigned', label: '已分派', color: 'processing' },
  { value: 'processing', label: '处理中', color: 'blue' },
  { value: 'resolved', label: '已解决', color: 'success' },
  { value: 'closed', label: '已关闭', color: 'default' },
  { value: 'dismissed', label: '无需处理', color: 'default' },
  { value: 'active', label: '进行中', color: 'orange' },
];
