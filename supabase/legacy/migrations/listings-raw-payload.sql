-- Ensure source sync can persist adapter raw payloads.
-- Safe to run multiple times.

alter table public.listings
  add column if not exists raw_payload jsonb null;
