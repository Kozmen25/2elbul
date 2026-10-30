-- Migration: Add products.attributes JSONB column for Product Intelligence v2
-- This stores AI-structured product attributes (brand, model, storage, ram, color,
-- condition, seller, warranty, price quality) for future AI consumption layer.
-- JSONB allows flexible schema evolution without additional migrations.
-- No NOT NULL constraint — backward compatible, existing rows get NULL.

alter table public.products
  add column if not exists attributes jsonb;

comment on column public.products.attributes is
  'Structured product attributes for AI consumption layer (brand, model, storage, ram, color, condition, seller, warranty, price quality). Populated by Product Intelligence v2 backfill.';

-- GIN index for future JSONB querying (e.g., attributes->>brand, attributes @> '{"condition":"Sıfır"}')
create index if not exists products_attributes_gin_idx
  on public.products using gin (attributes);
