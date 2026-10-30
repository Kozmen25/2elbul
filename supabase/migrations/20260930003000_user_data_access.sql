-- User data access: who may add listings, and who may read which ones.
--
-- 1) Listing submission was open to everyone.
--    Policy "Anyone can submit listings" let ANY request holding the public
--    anon key insert a listing with user_id null, and the column default
--    status is 'published' — so a stranger could publish fake listings that
--    immediately fed market prices. Submission is now limited to signed-in
--    users, for themselves, and always as 'pending' (an admin publishes it).
--    The app's own "add listing" form already sends status 'pending'.
--    Bots and imports use the service role, which bypasses RLS.
--
-- 2) Owners could not see their own submissions.
--    Listings are readable only when published/active, and the submit action
--    never set user_id, so a submitted listing vanished from "İlanlarım" and
--    the owner never saw "Onay bekliyor". Owners may now read their own
--    listings in every status.
--
-- 3) Favorites / price alerts pointing at a listing that later became
--    inactive silently disappeared from the user's pages. A user may now read
--    listings they favorited or watch with an alert, so the pages can show
--    them as "no longer listed".

drop policy if exists "Anyone can submit listings" on public.listings;
drop policy if exists "Signed-in users can submit their listings" on public.listings;
create policy "Signed-in users can submit their listings"
  on public.listings
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
  );

drop policy if exists "Users can read their own listings" on public.listings;
create policy "Users can read their own listings"
  on public.listings
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can read listings they follow" on public.listings;
create policy "Users can read listings they follow"
  on public.listings
  for select
  to authenticated
  using (
    exists (
      select 1 from public.favorites f
      where f.listing_id = listings.id and f.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.price_alerts a
      where a.listing_id = listings.id and a.user_id = (select auth.uid())
    )
  );

-- Ownership lookups ("İlanlarım") had an index; the follow policies need
-- lookups by listing_id on price_alerts (favorites.listing_id is indexed).
-- price_alerts_listing_id_idx already exists (see baseline).

-- 4) Cap active price alerts per user. The daily check loads every active
--    alert, so an unbounded table is an abuse vector; 50 is far above normal
--    use. Enforced here as well as in the app so no client can bypass it.
create or replace function public.enforce_price_alert_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  max_active constant int := 50;
begin
  if new.status = 'active' and (
    select count(*) from public.price_alerts
    where user_id = new.user_id and status = 'active' and id is distinct from new.id
  ) >= max_active then
    raise exception 'active price alert limit reached (%)', max_active
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_price_alert_limit() from public, anon, authenticated;

drop trigger if exists price_alerts_enforce_limit on public.price_alerts;
create trigger price_alerts_enforce_limit
  before insert or update of status on public.price_alerts
  for each row
  execute function public.enforce_price_alert_limit();
