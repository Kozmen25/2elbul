-- Search-triggered bot queue infrastructure.
-- Run after sources-and-bots.sql.

create table if not exists public.search_demands (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  normalized_query text not null,
  result_count integer not null default 0,
  user_id uuid null references auth.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'queued', 'processing', 'completed', 'failed', 'ignored')),
  requested_at timestamptz not null default now(),
  last_processed_at timestamptz null,
  process_count integer not null default 0,
  error_message text null
);

create table if not exists public.bot_queue (
  id uuid primary key default gen_random_uuid(),
  demand_id uuid not null references public.search_demands(id) on delete cascade,
  query text not null,
  normalized_query text not null,
  source_id bigint null references public.sources(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'skipped')),
  priority integer not null default 5,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  started_at timestamptz null,
  finished_at timestamptz null,
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists search_demands_normalized_query_idx
  on public.search_demands(normalized_query);

create index if not exists search_demands_status_idx
  on public.search_demands(status);

create index if not exists bot_queue_status_idx
  on public.bot_queue(status);

create index if not exists bot_queue_priority_created_at_idx
  on public.bot_queue(priority, created_at);

create index if not exists bot_queue_demand_source_idx
  on public.bot_queue(demand_id, source_id);

create or replace function public.set_bot_queue_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists bot_queue_set_updated_at on public.bot_queue;
create trigger bot_queue_set_updated_at
  before update on public.bot_queue
  for each row
  execute function public.set_bot_queue_updated_at();

alter table public.search_demands enable row level security;
alter table public.bot_queue enable row level security;

drop policy if exists "Users can read their search demands" on public.search_demands;
create policy "Users can read their search demands"
  on public.search_demands
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Anyone can create anonymous search demands" on public.search_demands;
create policy "Anyone can create anonymous search demands"
  on public.search_demands
  for insert
  to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));

-- bot_queue intentionally has RLS enabled with no public policies.
-- Server-side admin/service-role code creates and processes queue jobs.
