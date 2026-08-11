-- Guarantee row-level security on the core financial tables.
--
-- These nine tables hold the actual money data but were created outside
-- version control (via the Supabase/Lovable dashboard), so the repo carried
-- no record of whether RLS was enabled on them. Everything else in
-- supabase/migrations already enables RLS explicitly; this closes the gap.
--
-- It matters more than usual here: the authenticated route guard reads the
-- locally stored session rather than validating against the server, so it
-- opens offline. That gate is UX only — RLS is the real boundary.
--
-- Safe to run whether or not RLS is already configured:
--   * ENABLE ROW LEVEL SECURITY is idempotent.
--   * The policy is only created when that table has none, so an existing
--     correct policy is left alone and access is never interrupted.
--   * Enabling RLS and creating the policy happen in one transaction, so the
--     tables are never left in the "RLS on, no policy" state that would deny
--     the app all access.

do $$
declare
  target text;
  core_tables text[] := array[
    'profiles',
    'accounts',
    'debts',
    'budget_categories',
    'transactions',
    'goals',
    'reminders',
    'audit_log',
    'notification_log'
  ];
begin
  foreach target in array core_tables loop
    -- Skip anything that isn't actually present rather than failing the run.
    if not exists (
      select 1 from pg_tables
      where schemaname = 'public' and tablename = target
    ) then
      raise notice 'skipping %: table not found', target;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', target);

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = target
    ) then
      execute format(
        -- %I on the policy name too: it is an identifier, not a string.
        'create policy %I on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
        'Users manage own ' || target,
        target
      );
      raise notice 'added owner-only policy to %', target;
    else
      raise notice '% already has policies; left unchanged', target;
    end if;
  end loop;
end $$;
