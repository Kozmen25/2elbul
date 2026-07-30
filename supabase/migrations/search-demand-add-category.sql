-- Add category column to search_demands and bot_queue tables
-- Needed for Accessory Intelligence Engine (Sprint P-18)
-- Category is nullable — populated when the search demand is category-specific (e.g. "Aksesuar")

alter table public.search_demands
  add column if not exists category text;

alter table public.bot_queue
  add column if not exists category text;

comment on column public.search_demands.category is 'Product category filter (e.g. Aksesuar) — set when demand is category-specific';
comment on column public.bot_queue.category   is 'Product category filter (e.g. Aksesuar) — passed through from search_demands';
