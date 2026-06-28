-- 2ElBul production hardening.
-- Run after schema.sql, sources-and-bots.sql, bot-sync.sql and price-history.sql.

alter table public.products enable row level security;
alter table public.listings enable row level security;
alter table public.favorites enable row level security;
alter table public.sources enable row level security;
alter table public.bot_runs enable row level security;
alter table public.price_history enable row level security;

alter table public.listings
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists first_seen_at timestamptz null,
  add column if not exists last_seen_at timestamptz null,
  add column if not exists inactive_at timestamptz null;

update public.listings
set first_seen_at = coalesce(first_seen_at, created_at, now())
where first_seen_at is null;

update public.listings
set last_seen_at = coalesce(last_seen_at, created_at, now())
where last_seen_at is null
  and source_id is not null;

alter table public.listings
  drop constraint if exists listings_status_check;

alter table public.listings
  add constraint listings_status_check
  check (status in ('pending', 'published', 'rejected', 'active', 'inactive'));

drop policy if exists "Products are publicly readable" on public.products;
create policy "Products are publicly readable"
  on public.products
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Listings are publicly readable" on public.listings;
create policy "Listings are publicly readable"
  on public.listings
  for select
  to anon, authenticated
  using (status in ('published', 'active'));

drop policy if exists "Users can read their favorites" on public.favorites;
create policy "Users can read their favorites"
  on public.favorites
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can add their favorites" on public.favorites;
create policy "Users can add their favorites"
  on public.favorites
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can remove their favorites" on public.favorites;
create policy "Users can remove their favorites"
  on public.favorites
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Public can read price history" on public.price_history;
create policy "Public can read price history"
  on public.price_history
  for select
  to anon, authenticated
  using (
    listing_id is null
    or exists (
      select 1
      from public.listings
      where listings.id = price_history.listing_id
        and listings.status in ('published', 'active')
    )
  );

-- sources and bot_runs intentionally have RLS enabled with no public policy.
-- Admin pages and bot routes access these tables only with the server-side
-- SUPABASE_SERVICE_ROLE_KEY client.
