export interface Profile {
  user_id: string;
  email: string | null;
  display_name: string | null;
  is_owner: boolean;
  currency: string;
  timezone: string;
  notifications_browser: boolean;
  seeded: boolean;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  kind: string;
  balance: number | string;
  sort_order: number;
}

export interface Debt {
  id: string;
  user_id: string;
  name: string;
  kind: string;
  balance: number | string;
  pending: number | string;
  apr: number | string;
  credit_limit: number | string | null;
  minimum_payment: number | string;
  minimum_estimated: boolean;
  due_date: string | null;
  status: string;
  priority: number;
  notes: string | null;
}

export interface BudgetCategory {
  id: string;
  user_id: string;
  name: string;
  planned: number | string;
  kind: string;
  sort_order: number;
}

export interface Transaction {
  id: string;
  user_id: string;
  occurred_on: string;
  type: string;
  category: string | null;
  account_id: string | null;
  debt_id: string | null;
  description: string | null;
  amount: number | string;
  need_want: string | null;
  cleared: boolean;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  kind: string;
  target_amount: number | string;
  current_amount: number | string;
  active: boolean;
  sort_order: number;
  notes: string | null;
}

export interface Reminder {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  due_at: string;
  recurrence: string;
  kind: string;
  completed: boolean;
  paused: boolean;
  snoozed_until: string | null;
  last_fired_at: string | null;
  notify_browser: boolean;
}
export interface StatementImport {
  id: string;
  user_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  doc_kind: string;
  account_id: string | null;
  debt_id: string | null;
  statement_start: string | null;
  statement_end: string | null;
  detected: Record<string, { value: number | string; confidence: number; raw: string }>;
  status: string;
  items_total: number;
  items_accepted: number;
  created_at: string;
}

export interface ImportItem {
  id: string;
  user_id: string;
  import_id: string;
  item_type: string;
  occurred_on: string | null;
  description: string | null;
  amount: number | string;
  category: string | null;
  tx_type: string;
  confidence: number | string;
  duplicate_of: string | null;
  decision: string;
  raw: string | null;
}

export interface PaydayPlan {
  id: string;
  user_id: string;
  pay_date: string;
  expected_pay: number | string;
  starting_cash: number | string;
  buffer: number | string;
  spending_allowance: number | string;
  extra_debt_payment: number | string;
  notes: string | null;
  status: string;
  created_at: string;
}

export interface PaydayPlanItem {
  id: string;
  user_id: string;
  plan_id: string;
  label: string;
  kind: string;
  debt_id: string | null;
  amount: number | string;
  actual_amount: number | string | null;
  paid: boolean;
  sort_order: number;
}

export interface NotificationEntry {
  id: string;
  user_id: string;
  reminder_id: string | null;
  title: string;
  body: string | null;
  channel: string;
  read: boolean;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  user_id: string;
  entity: string;
  entity_id: string | null;
  action: string;
  summary: string;
  details: Record<string, unknown>;
  created_at: string;
}
