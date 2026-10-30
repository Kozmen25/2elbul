-- Add created_at to price_history for production verification and auditability.
-- Safe to run multiple times.

alter table public.price_history
  add column if not exists created_at timestamptz not null default now();
