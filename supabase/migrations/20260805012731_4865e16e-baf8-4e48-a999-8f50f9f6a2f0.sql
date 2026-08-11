-- This migration creates triggers that call public.tg_touch_updated_at(), but
-- nothing in the project ever defined it. Applying the file therefore failed
-- at the first trigger, which is why none of the six tables below exist in
-- the database. Defining it here, before first use, makes the migration
-- runnable.
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE TABLE public.statement_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL DEFAULT 'csv',
  file_size integer NOT NULL DEFAULT 0,
  doc_kind text NOT NULL DEFAULT 'bank',
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  debt_id uuid REFERENCES public.debts(id) ON DELETE SET NULL,
  statement_start date,
  statement_end date,
  detected jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  items_total integer NOT NULL DEFAULT 0,
  items_accepted integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.statement_imports TO authenticated;
GRANT ALL ON public.statement_imports TO service_role;
ALTER TABLE public.statement_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own statement_imports" ON public.statement_imports FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER statement_imports_touch BEFORE UPDATE ON public.statement_imports FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TABLE public.import_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  import_id uuid NOT NULL REFERENCES public.statement_imports(id) ON DELETE CASCADE,
  item_type text NOT NULL DEFAULT 'transaction',
  occurred_on date,
  description text,
  amount numeric NOT NULL DEFAULT 0,
  category text,
  tx_type text NOT NULL DEFAULT 'expense',
  confidence numeric NOT NULL DEFAULT 1,
  duplicate_of uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  decision text NOT NULL DEFAULT 'accept',
  raw text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_items TO authenticated;
GRANT ALL ON public.import_items TO service_role;
ALTER TABLE public.import_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own import_items" ON public.import_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.payday_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pay_date date NOT NULL,
  expected_pay numeric NOT NULL DEFAULT 0,
  starting_cash numeric NOT NULL DEFAULT 0,
  buffer numeric NOT NULL DEFAULT 500,
  spending_allowance numeric NOT NULL DEFAULT 0,
  extra_debt_payment numeric NOT NULL DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payday_plans TO authenticated;
GRANT ALL ON public.payday_plans TO service_role;
ALTER TABLE public.payday_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own payday_plans" ON public.payday_plans FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER payday_plans_touch BEFORE UPDATE ON public.payday_plans FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TABLE public.payday_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.payday_plans(id) ON DELETE CASCADE,
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'bill',
  debt_id uuid REFERENCES public.debts(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  actual_amount numeric,
  paid boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payday_plan_items TO authenticated;
GRANT ALL ON public.payday_plan_items TO service_role;
ALTER TABLE public.payday_plan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own payday_plan_items" ON public.payday_plan_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_id uuid REFERENCES public.reminders(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text,
  channel text NOT NULL DEFAULT 'in_app',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notification_log" ON public.notification_log FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  summary text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own audit_log" ON public.audit_log FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz,
  ADD COLUMN IF NOT EXISTS last_fired_at timestamptz,
  ADD COLUMN IF NOT EXISTS notify_browser boolean NOT NULL DEFAULT true;
