-- Duplicate listing groups: the same item posted on several platforms.
--
-- A group is a set of published listings of ONE product that lib/duplicate-engine
-- (listing-identity rules) judged to be the same physical item. Members share
-- the same duplicate_group_id; a listing without a duplicate has NULL.
--
-- Nothing is deleted or hidden in the table: every platform keeps its own
-- listing (so "this item is on 3 platforms" stays known). The application
-- shows one entry per group and counts a group once, and so does the price
-- view below.
--
-- The column is written by the application (after each source sync / import,
-- and by the daily /api/cron/regroup-duplicates); the sync function
-- sync_source_listings does not touch it.

alter table public.listings
  add column if not exists duplicate_group_id uuid null;

create index if not exists listings_duplicate_group_idx
  on public.listings (duplicate_group_id)
  where duplicate_group_id is not null;

comment on column public.listings.duplicate_group_id is
  'Shared by listings of the same product judged to be the same item on different platforms; NULL when the listing has no duplicate. Written by lib/duplicate-engine/group-repository.ts.';

-- One row per product, counting every duplicate group once (its cheapest
-- listing represents it). Columns and meaning are unchanged, so the category
-- counts, related-product cards and price stats become duplicate-free
-- without code changes.
create or replace view public.product_price_stats
with (security_invoker = true)
as
with representative as (
  select distinct on (listing.product_id, coalesce(listing.duplicate_group_id::text, listing.id::text))
    listing.product_id,
    listing.price,
    coalesce(listing.last_seen_at, listing.created_at) as seen_at
  from public.listings listing
  where listing.product_id is not null
    and listing.price > 0
    and listing.status in ('published', 'active')
  order by
    listing.product_id,
    coalesce(listing.duplicate_group_id::text, listing.id::text),
    listing.price asc,
    listing.id asc
)
select
  representative.product_id,
  count(*)::int as listing_count,
  min(representative.price) as min_price,
  max(representative.price) as max_price,
  round(avg(representative.price), 2) as avg_price,
  percentile_cont(0.5) within group (order by representative.price)::numeric as median_price,
  array_agg(representative.price order by representative.price) as prices,
  max(representative.seen_at) as last_seen_at
from representative
group by representative.product_id;

comment on view public.product_price_stats is
  'One row per product with price aggregates over published/active listings; a duplicate group counts once (its cheapest listing). See lib/product-detail.ts getRelatedProducts.';
