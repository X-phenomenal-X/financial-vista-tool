-- Restore the core tables the app expects but the database never had.
--
-- An audit of the live schema found nine tables referenced throughout the
-- app that do not exist. Six of them are created by the earlier migration
-- 20260805012731, which failed on a missing trigger function and so was
-- never applied; that file is now fixed and owns those six.
--
-- The three below had no migration at all — they exist only in the
-- generated types, so this reconstructs them from that contract. Without
-- them, Goals, Automations/reminders and the Profile screen query tables
-- that aren't there.
--
-- Every statement is guarded, so this is safe to run against a database
-- where some or all of them already exist.

-- ---------------------------------------------------------------- profiles
-- Keyed by user_id rather than a synthetic id: there is exactly one profile
-- per account, and the app always looks it up by user.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  email text,
  currency text not null default 'CAD',
  timezone text not null default 'America/Toronto',
  is_owner boolean not null default false,
  notifications_browser boolean not null default false,
  -- Set once the starter data has been written, so seeding never repeats.
  seeded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------- goals
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  kind text not null default 'custom',
  target_amount numeric not null default 0,
  current_amount numeric not null default 0,
  active boolean not null default true,
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists goals_user_id_idx on public.goals (user_id);

-- --------------------------------------------------------------- reminders
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  kind text not null default 'custom',
  due_at timestamptz not null,
  recurrence text not null default 'none',
  completed boolean not null default false,
  paused boolean not null default false,
  notify_browser boolean not null default true,
  snoozed_until timestamptz,
  last_fired_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reminders_user_id_idx on public.reminders (user_id);
create index if not exists reminders_due_at_idx on public.reminders (due_at);


-- --------------------------------------------------------------- privileges
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.goals to authenticated;
grant select, insert, update, delete on public.reminders to authenticated;

-- ------------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.goals enable row level security;
alter table public.reminders enable row level security;

do $$
declare t text;
begin
  foreach t in array array['profiles','goals','reminders'] loop
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = t
    ) then
      execute format(
        'create policy %I on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
        'Users manage own ' || t, t
      );
    end if;
  end loop;
end $$;

-- --------------------------------------------------------------- updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','goals','reminders'] loop
    if not exists (
      select 1 from pg_trigger
      where tgname = t || '_set_updated_at' and tgrelid = format('public.%I', t)::regclass
    ) then
      execute format(
        'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
        t || '_set_updated_at', t
      );
    end if;
  end loop;
end $$;

-- ------------------------------------------------------- profile on signup
-- seed.ts does `update profiles set seeded = true where user_id = ...`, so it
-- assumes a row already exists. Without this trigger that update silently
-- matches nothing and the app has no profile to read.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'display_name', null))
  on conflict (user_id) do nothing;
  return new;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created') then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end $$;

-- Backfill anyone who signed up before the trigger existed.
insert into public.profiles (user_id, email)
select u.id, u.email from auth.users u
on conflict (user_id) do nothing;
