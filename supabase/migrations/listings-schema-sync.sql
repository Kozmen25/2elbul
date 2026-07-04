-- Bring production listings schema in sync with source sync/import code.
-- Safe to run multiple times.

alter table public.listings
  add column if not exists product_id bigint,
  add column if not exists source_id bigint references public.sources(id) on delete set null,
  add column if not exists external_id text,
  add column if not exists title text,
  add column if not exists price numeric(12, 2),
  add column if not exists city text,
  add column if not exists location text,
  add column if not exists source text,
  add column if not exists url text,
  add column if not exists condition text,
  add column if not exists image_url text,
  add column if not exists status text default 'published',
  add column if not exists published_at timestamptz,
  add column if not exists imported_at timestamptz,
  add column if not exists first_seen_at timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists inactive_at timestamptz,
  add column if not exists updated_at timestamptz default now(),
  add column if not exists description text,
  add column if not exists old_price numeric(12, 2),
  add column if not exists previous_price numeric(12, 2),
  add column if not exists price_updated_at timestamptz,
  add column if not exists brand text,
  add column if not exists model text,
  add column if not exists storage text,
  add column if not exists ram text,
  add column if not exists color text,
  add column if not exists warranty text,
  add column if not exists seller_name text,
  add column if not exists source_type text,
  add column if not exists category text,
  add column if not exists product_key text,
  add column if not exists confidence_score numeric(5, 2),
  add column if not exists currency text default 'TRY',
  add column if not exists raw_payload jsonb,
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz default now();

alter table public.listings
  drop constraint if exists listings_status_check;

alter table public.listings
  add constraint listings_status_check
  check (status in ('pending', 'published', 'rejected', 'active', 'inactive'));

create unique index if not exists listings_source_id_external_id_key
  on public.listings(source_id, external_id)
  where source_id is not null and external_id is not null;

create unique index if not exists listings_source_id_url_key
  on public.listings(source_id, url)
  where source_id is not null;

create unique index if not exists listings_source_external_id_key
  on public.listings(source, external_id)
  where source is not null and external_id is not null;

create index if not exists listings_source_id_status_idx
  on public.listings(source_id, status);

create index if not exists listings_product_id_idx
  on public.listings(product_id);

create index if not exists listings_last_seen_at_idx
  on public.listings(last_seen_at desc);

create index if not exists listings_imported_at_idx
  on public.listings(imported_at desc);
