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
}