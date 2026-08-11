-- Read-only audit of row-level security. Safe to run any time.
--
-- Paste into the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- Changes nothing; it only reports what is currently configured.
--
-- Every row should read "OK". Anything else is a table that either exposes
-- data to any authenticated user, or denies the app access entirely.

select
  c.relname as table_name,
  case when c.relrowsecurity then 'yes' else 'NO' end as rls_enabled,
  coalesce(p.policy_count, 0) as policies,
  case
    when not c.relrowsecurity then 'RISK - RLS is off, any signed-in user can read this table'
    when coalesce(p.policy_count, 0) = 0 then 'BROKEN - RLS on with no policy, denies all access'
    else 'OK'
  end as verdict,
  coalesce(p.policy_names, '-') as policy_names
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join (
  select tablename, count(*) as policy_count, string_agg(policyname, ', ') as policy_names
  from pg_policies
  where schemaname = 'public'
  group by tablename
) p on p.tablename = c.relname
where n.nspname = 'public'
  and c.relkind = 'r'
order by
  -- Problems first.
  case
    when not c.relrowsecurity then 0
    when coalesce(p.policy_count, 0) = 0 then 1
    else 2
  end,
  c.relname;
