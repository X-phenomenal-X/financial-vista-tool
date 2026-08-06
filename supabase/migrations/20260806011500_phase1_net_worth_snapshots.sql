-- Wealthpilot Phase 1: net worth analytics history

create table public.net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null default current_date,
  cash_total numeric(14,2) not null default 0,
  retirement_total numeric(14,2) not null default 0,
  other_assets_total numeric(14,2) not null default 0,
  high_interest_debt_total numeric(14,2) not null default 0,
  car_loan_total numeric(14,2) not null default 0,
  other_liabilities_total numeric(14,2) not null default 0,
  assets_total numeric(14,2) generated always as (cash_total + retirement_total + other_assets_total) stored,
  liabilities_total numeric(14,2) generated always as (high_interest_debt_total + car_loan_total + other_liabilities_total) stored,
  net_worth numeric(14,2) generated always as (
    cash_total + retirement_total + other_assets_total
    - high_interest_debt_total - car_loan_total - other_liabilities_total
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, snapshot_date)
);

create index net_worth_snapshots_user_date_idx
  on public.net_worth_snapshots (user_id, snapshot_date desc);

create trigger net_worth_snapshots_set_updated_at
before update on public.net_worth_snapshots
for each row execute function public.set_updated_at();

alter table public.net_worth_snapshots enable row level security;

create policy "Users manage own net worth snapshots"
on public.net_worth_snapshots
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

comment on table public.net_worth_snapshots is 'Daily per-user asset, liability, and net worth history used by Wealthpilot analytics.';