export interface User {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'operator' | 'auditor';
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
  matched_rules: MatchedRuleSnapshot[];
  status_timeline: StatusEvent[];
  created_at: string;
  updated_at: string;
}

export interface VisitFilter {
  keyword?: string;
  category_id?: string;
  handler_id?: string;
  status?: string;
  satisfaction_min?: number;
  satisfaction_max?: number;
  date_from?: string;
  date_to?: string;
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
