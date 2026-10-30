-- Per-product price aggregates over live listings.
--
-- Related-product cards on /product/[slug] (lib/product-detail.ts,
-- getRelatedProducts) used to download every published listing in the table
-- on each page view and group prices in JavaScript. That transfer grows with
-- the whole catalogue, and PostgREST's row cap would silently truncate it —
-- producing wrong averages once the table outgrows the cap.
--
-- This view groups in the database and returns one row per product. `prices`
-- (sorted) is included so the application keeps a single implementation of
-- the outlier-aware statistics (calculateMarketStats in lib/price-insights.ts);
-- the plain aggregates serve callers that only need raw numbers.
--
-- security_invoker: the view runs with the caller's privileges, so the
-- listings RLS policies (anon sees only published/active rows) still apply.

create or replace view public.product_price_stats
with (security_invoker = true)
as
select
  listing.product_id,
  count(*)::int as listing_count,
  min(listing.price) as min_price,
  max(listing.price) as max_price,
  round(avg(listing.price), 2) as avg_price,
  percentile_cont(0.5) within group (order by listing.price)::numeric as median_price,
  array_agg(listing.price order by listing.price) as prices,
  max(coalesce(listing.last_seen_at, listing.created_at)) as last_seen_at
from public.listings listing
where listing.product_id is not null
  and listing.price > 0
  and listing.status in ('published', 'active')
group by listing.product_id;

comment on view public.product_price_stats is
  'One row per product with price aggregates over published/active listings. See lib/product-detail.ts getRelatedProducts.';

-- Serves the view's filter + grouping without touching the heap for price.
create index if not exists listings_product_status_price_idx
  on public.listings (product_id, status, price);
