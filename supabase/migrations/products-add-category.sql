-- Add category column to products table
-- Code references: repository.ts:24, repository.ts:69, matcher.ts:210
-- This column is nullable — category is set when available during import

alter table public.products
  add column if not exists category text;

comment on column public.products.category is 'Product category (e.g. Telefon, Tablet, Bilgisayar) — set during import when available';
