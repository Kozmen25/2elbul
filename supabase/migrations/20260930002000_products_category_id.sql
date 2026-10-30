-- 2026-09-20 — Link products to the new categories table.
--
-- products.category (free text) is kept for backward compatibility (still
-- read/written by lib/normalization/engine.ts and other ingestion code).
-- category_id becomes the reliable, indexed, FK-backed reference used by
-- category pages and the homepage. Backfilled by
-- scripts/backfill-product-category-id.mjs (reuses the same matching logic
-- as the category pages, matchProductToRoute in lib/category-intelligence.ts,
-- so results are guaranteed consistent with what /category/[slug] shows).

alter table public.products
  add column if not exists category_id bigint references public.categories(id) on delete set null;

create index if not exists products_category_id_idx
  on public.products(category_id);

comment on column public.products.category_id is 'FK to public.categories (main category only). Backfilled by scripts/backfill-product-category-id.mjs; kept in sync going forward by lib/normalization/engine.ts.';
