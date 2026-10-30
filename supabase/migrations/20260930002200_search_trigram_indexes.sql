-- Trigram indexes for substring search.
--
-- Search (app/search/page.tsx, /api/search/suggestions, /api/mobile/search,
-- /api/search/ai, saved-search cron) filters with `ILIKE '%term%'` on
-- products.name and listings.title. A leading wildcard cannot use a btree
-- index, so every search was a sequential scan whose cost grows linearly with
-- the listing count. pg_trgm GIN indexes serve `ILIKE '%term%'` directly,
-- with no application change.

create extension if not exists pg_trgm with schema extensions;

create index if not exists products_name_trgm_idx
  on public.products using gin (name extensions.gin_trgm_ops);

create index if not exists listings_title_trgm_idx
  on public.listings using gin (title extensions.gin_trgm_ops);
