-- Product follows: a one-click "follow this product" without a target price.
--
-- price_alerts needs a target price the user has to pick. A follow only asks
-- to be told when something changes: the daily check
-- (/api/cron/check-product-follows) notifies when the product's lowest visible
-- price falls, or when a new listing arrives below the price at the last check.
--
-- last_price is the baseline the next drop is measured against; it is kept by
-- the daily check (service role), users only create and delete their own rows.

create table if not exists public.product_follows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  last_price numeric(12, 2) null check (last_price is null or last_price > 0),
  last_checked_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint product_follows_user_product_key unique (user_id, product_id)
);

create index if not exists product_follows_product_id_idx
  on public.product_follows (product_id);

create index if not exists product_follows_user_created_idx
  on public.product_follows (user_id, created_at desc);

alter table public.product_follows enable row level security;

drop policy if exists "Users can read their product follows" on public.product_follows;
create policy "Users can read their product follows"
  on public.product_follows
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can follow products" on public.product_follows;
create policy "Users can follow products"
  on public.product_follows
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can unfollow products" on public.product_follows;
create policy "Users can unfollow products"
  on public.product_follows
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Same protection as enforce_price_alert_limit(): a cap per user, enforced in
-- the database so no client can bypass it.
create or replace function public.enforce_product_follow_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  max_follows constant int := 200;
begin
  if (
    select count(*) from public.product_follows where user_id = new.user_id
  ) >= max_follows then
    raise exception 'product follow limit reached (%)', max_follows
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_product_follow_limit() from public, anon, authenticated;

drop trigger if exists product_follows_enforce_limit on public.product_follows;
create trigger product_follows_enforce_limit
  before insert on public.product_follows
  for each row
  execute function public.enforce_product_follow_limit();
