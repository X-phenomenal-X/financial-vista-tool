-- Foundation for Plaid bank sync.
--
-- Security shape, which is the whole point of splitting this across two
-- tables:
--
--   plaid_items         user-visible connection metadata. Owner-only RLS,
--                       same as every other table. Safe for the client to
--                       read so the UI can list connected institutions.
--
--   plaid_item_secrets  the Plaid access_token. RLS enabled with NO policy
--                       and privileges revoked, so neither anon nor
--                       authenticated can reach it under any circumstance.
--                       Only Edge Functions using the service_role key —
--                       which bypasses RLS — can read it.
--
-- A Plaid access_token is a long-lived bearer credential for a real bank
-- connection. Storing it beside ordinary data behind an owner-policy would
-- mean anyone holding the publishable key plus any auth bypass could read
-- it. Keeping it in a table the client literally has no grant on removes
-- that class of mistake instead of relying on us never querying it.

create table if not exists public.plaid_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  item_id text not null unique,
  institution_id text,
  institution_name text,
  -- active | login_required | error | disconnected
  status text not null default 'active',
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plaid_items_user_id_idx on public.plaid_items (user_id);

create table if not exists public.plaid_item_secrets (
  item_id text primary key references public.plaid_items (item_id) on delete cascade,
  access_token text not null,
  -- Cursor for /transactions/sync. Not secret, but it belongs with the token
  -- it is only ever used alongside, and the client has no use for it.
  transactions_cursor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Maps a Plaid account onto the local account or debt it represents, so
-- synced transactions land against the right balance. Exactly one of
-- account_id / debt_id should be set; neither means "not mapped yet", and
-- the UI asks the user to choose.
create table if not exists public.plaid_account_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  item_id text not null references public.plaid_items (item_id) on delete cascade,
  plaid_account_id text not null unique,
  plaid_account_name text,
  plaid_account_mask text,
  plaid_account_type text,
  plaid_account_subtype text,
  account_id uuid,
  debt_id uuid,
  sync_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plaid_account_links_single_target check (
    account_id is null or debt_id is null
  )
);

create index if not exists plaid_account_links_user_id_idx on public.plaid_account_links (user_id);
create index if not exists plaid_account_links_item_id_idx on public.plaid_account_links (item_id);

-- --------------------------------------------------------------------------
-- Row-level security
-- --------------------------------------------------------------------------

alter table public.plaid_items enable row level security;
alter table public.plaid_account_links enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'plaid_items'
  ) then
    create policy "Users manage own plaid items"
      on public.plaid_items for all to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'plaid_account_links'
  ) then
    create policy "Users manage own plaid account links"
      on public.plaid_account_links for all to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;
end $$;

-- Secrets: RLS on, deliberately no policy, and no grants. This is a
-- deny-by-default table reachable only via service_role.
alter table public.plaid_item_secrets enable row level security;
revoke all on public.plaid_item_secrets from anon, authenticated;

-- Keep updated_at honest.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['plaid_items', 'plaid_item_secrets', 'plaid_account_links'] loop
    if not exists (
      select 1 from pg_trigger
      where tgname = t || '_set_updated_at'
        and tgrelid = format('public.%I', t)::regclass
    ) then
      execute format(
        'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
        t || '_set_updated_at', t
      );
    end if;
  end loop;
end $$;
