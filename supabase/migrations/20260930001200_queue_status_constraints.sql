-- Queue status CHECK constraints.
--
-- Previously applied ad hoc by the deleted scripts/fix-queue-constraints.ts
-- (which ran raw SQL against the database with a hardcoded service key).
-- Recorded here so the schema is reproducible from migrations.
--
-- The allowed sets are the union of the original definitions in
-- supabase/search-demand-queue.sql and the values the application writes
-- today ('no_results', 'active'), so no existing row can violate them.
-- Idempotent: safe to run more than once.

alter table public.bot_queue
  drop constraint if exists bot_queue_status_check;

alter table public.bot_queue
  add constraint bot_queue_status_check
  check (status in ('pending', 'processing', 'completed', 'failed', 'skipped', 'no_results'));

alter table public.search_demands
  drop constraint if exists search_demands_status_check;

alter table public.search_demands
  add constraint search_demands_status_check
  check (status in ('pending', 'queued', 'active', 'processing', 'completed', 'failed', 'ignored', 'no_results'));
