create extension if not exists pgcrypto;

create table if not exists public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint null references public.products(id) on delete cascade,
  listing_id bigint null references public.listings(id) on delete cascade,
  target_price numeric not null check (target_price > 0),
  current_price numeric null,
  status text not null default 'active',
  triggered_at timestamptz null,
  last_checked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_alerts_product_or_listing_check
    check (product_id is not null or listing_id is not null),
  constraint price_alerts_status_check
    check (status in ('active', 'triggered', 'paused', 'cancelled'))
);

alter table public.price_alerts
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists product_id bigint references public.products(id) on delete cascade,
  add column if not exists listing_id bigint references public.listings(id) on delete cascade,
  add column if not exists target_price numeric,
  add column if not exists current_price numeric,
  add column if not exists status text default 'active',
  add column if not exists triggered_at timestamptz,
  add column if not exists last_checked_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

do $$
declare
  primary_key_name text;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'price_alerts'
      and column_name = 'id'
      and data_type <> 'uuid'
  ) then
    select conname
    into primary_key_name
    from pg_constraint
    where conrelid = 'public.price_alerts'::regclass
      and contype = 'p'
    limit 1;

    if primary_key_name is not null then
      execute format(
        'alter table public.price_alerts drop constraint %I',
        primary_key_name
      );
    end if;

    alter table public.price_alerts
      add column if not exists id_uuid uuid default gen_random_uuid();

    update public.price_alerts
    set id_uuid = gen_random_uuid()
    where id_uuid is null;

    alter table public.price_alerts
      alter column id_uuid set not null,
      drop column id;

    alter table public.price_alerts
      rename column id_uuid to id;

    alter table public.price_alerts
      add primary key (id);
  end if;
end;
$$;

alter table public.price_alerts
  alter column user_id set not null,
  alter column product_id drop not null,
  alter column target_price set not null,
  alter column status set not null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'price_alerts'
      and column_name = 'is_active'
  ) then
    execute $migrate$
      update public.price_alerts
      set status = case
        when coalesce(is_active, true) = true then 'active'
        else 'cancelled'
      end
      where status is null
    $migrate$;
  end if;
end;
$$;

alter table public.price_alerts
  drop constraint if exists price_alerts_product_or_listing_check,
  add constraint price_alerts_product_or_listing_check
    check (product_id is not null or listing_id is not null);

alter table public.price_alerts
  drop constraint if exists price_alerts_target_price_check,
  add constraint price_alerts_target_price_check
    check (target_price > 0);

alter table public.price_alerts
  drop constraint if exists price_alerts_status_check,
  add constraint price_alerts_status_check
    check (status in ('active', 'triggered', 'paused', 'cancelled'));

create index if not exists price_alerts_user_id_idx
  on public.price_alerts(user_id);

create index if not exists price_alerts_product_id_idx
  on public.price_alerts(product_id);

create index if not exists price_alerts_listing_id_idx
  on public.price_alerts(listing_id);

create index if not exists price_alerts_status_idx
  on public.price_alerts(status);

create unique index if not exists price_alerts_active_product_target_key
  on public.price_alerts(user_id, product_id, target_price)
  where status = 'active' and product_id is not null and listing_id is null;

create unique index if not exists price_alerts_active_listing_target_key
  on public.price_alerts(user_id, listing_id, target_price)
  where status = 'active' and listing_id is not null;

create or replace function public.set_price_alerts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists price_alerts_set_updated_at on public.price_alerts;
create trigger price_alerts_set_updated_at
  before update on public.price_alerts
  for each row
  execute function public.set_price_alerts_updated_at();

alter table public.price_alerts enable row level security;

drop policy if exists "Users can read their price alerts" on public.price_alerts;
create policy "Users can read their price alerts"
  on public.price_alerts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can add their price alerts" on public.price_alerts;
create policy "Users can add their price alerts"
  on public.price_alerts
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their price alerts" on public.price_alerts;
create policy "Users can update their price alerts"
  on public.price_alerts
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can remove their price alerts" on public.price_alerts;
create policy "Users can remove their price alerts"
  on public.price_alerts
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
