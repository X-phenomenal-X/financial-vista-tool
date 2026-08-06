-- Wealthpilot Phase 0: recurring transaction foundation
-- Supports subscriptions, bill calendar, notifications, payday planning, and recurring income.

create extension if not exists pgcrypto;

create type public.recurring_transaction_kind as enum (
  'income',
  'expense',
  'transfer',
  'debt_payment',
  'subscription',
  'bill'
);

create type public.recurring_cadence as enum (
  'weekly',
  'biweekly',
  'semimonthly',
  'monthly',
  'quarterly',
  'semiannual',
  'annual',
  'custom'
);

create type public.recurring_source as enum (
  'manual',
  'statement_detection',
  'transaction_rule',
  'payday_plan',
  'import'
);

create table public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  merchant text,
  description text,
  kind public.recurring_transaction_kind not null default 'expense',
  amount numeric(14,2) not null check (amount >= 0),
  currency char(3) not null default 'CAD' check (currency = upper(currency)),
  cadence public.recurring_cadence not null,
  custom_interval_days integer check (
    (cadence = 'custom' and custom_interval_days is not null and custom_interval_days > 0)
    or (cadence <> 'custom' and custom_interval_days is null)
  ),
  next_due_date date not null,
  start_date date,
  end_date date,
  category text,
  source public.recurring_source not null default 'manual',
  account_id uuid,
  debt_id uuid,
  goal_id uuid,
  autopay boolean not null default false,
  reminder_days_before integer[] not null default array[7, 3, 1],
  is_active boolean not null default true,
  last_generated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_dates_valid check (
    (start_date is null or end_date is null or end_date >= start_date)
    and (end_date is null or end_date >= next_due_date)
  )
);

create index recurring_transactions_user_due_idx
  on public.recurring_transactions (user_id, next_due_date)
  where is_active = true;

create index recurring_transactions_user_kind_idx
  on public.recurring_transactions (user_id, kind);

create index recurring_transactions_user_merchant_idx
  on public.recurring_transactions (user_id, lower(merchant))
  where merchant is not null;

create table public.recurring_transaction_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recurring_transaction_id uuid not null references public.recurring_transactions(id) on delete cascade,
  due_date date not null,
  expected_amount numeric(14,2) not null check (expected_amount >= 0),
  actual_amount numeric(14,2) check (actual_amount is null or actual_amount >= 0),
  status text not null default 'scheduled' check (status in ('scheduled','paid','skipped','overdue','cancelled')),
  linked_transaction_id uuid,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recurring_transaction_id, due_date)
);

create index recurring_occurrences_user_due_idx
  on public.recurring_transaction_occurrences (user_id, due_date, status);

create table public.transaction_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  priority integer not null default 100,
  is_active boolean not null default true,
  match_field text not null check (match_field in ('merchant','description','amount','account','category')),
  match_operator text not null check (match_operator in ('contains','equals','starts_with','ends_with','regex','greater_than','less_than')),
  match_value text not null,
  action jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transaction_rules_user_priority_idx
  on public.transaction_rules (user_id, is_active, priority);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger recurring_transactions_set_updated_at
before update on public.recurring_transactions
for each row execute function public.set_updated_at();

create trigger recurring_occurrences_set_updated_at
before update on public.recurring_transaction_occurrences
for each row execute function public.set_updated_at();

create trigger transaction_rules_set_updated_at
before update on public.transaction_rules
for each row execute function public.set_updated_at();

create or replace function public.next_recurring_date(
  current_date_value date,
  cadence_value public.recurring_cadence,
  interval_days integer default null
)
returns date
language sql
immutable
set search_path = public
as $$
  select case cadence_value
    when 'weekly' then current_date_value + 7
    when 'biweekly' then current_date_value + 14
    when 'semimonthly' then
      case
        when extract(day from current_date_value) < 15
          then make_date(extract(year from current_date_value)::int, extract(month from current_date_value)::int, 15)
        else (date_trunc('month', current_date_value) + interval '1 month')::date
      end
    when 'monthly' then (current_date_value + interval '1 month')::date
    when 'quarterly' then (current_date_value + interval '3 months')::date
    when 'semiannual' then (current_date_value + interval '6 months')::date
    when 'annual' then (current_date_value + interval '1 year')::date
    when 'custom' then current_date_value + coalesce(interval_days, 1)
  end;
$$;

alter table public.recurring_transactions enable row level security;
alter table public.recurring_transaction_occurrences enable row level security;
alter table public.transaction_rules enable row level security;

create policy "Users manage own recurring transactions"
on public.recurring_transactions
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users manage own recurring occurrences"
on public.recurring_transaction_occurrences
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users manage own transaction rules"
on public.transaction_rules
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

comment on table public.recurring_transactions is 'Canonical recurring financial events used by subscriptions, bills, income, transfers, debt payments, reminders, and payday planning.';
comment on table public.recurring_transaction_occurrences is 'Generated or reconciled instances of recurring transactions for calendars, alerts, and payment history.';
comment on table public.transaction_rules is 'Per-user rules for classifying transactions and detecting recurring activity.';
