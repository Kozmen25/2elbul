-- SPRINT P-7: Retry & Recovery Infrastructure
-- Adds dead_letter_queue and recovery_metrics tables with indexes and triggers.

-- =============================================================================
-- Table 1: dead_letter_queue
-- =============================================================================

create table if not exists public.dead_letter_queue (
  id uuid not null default gen_random_uuid(),
  source_id bigint,
  source_slug text not null,
  queue_type text not null default 'scrape'
    constraint dead_letter_queue_queue_type_check
      check (queue_type in ('scrape', 'search_queue')),
  retry_count integer not null default 0,
  max_retries integer not null default 3,
  last_error text,
  error_category text not null default 'unknown'
    constraint dead_letter_queue_error_category_check
      check (error_category in ('network','timeout','http_server','http_client','rate_limit','auth','parser','schema','unknown')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    constraint dead_letter_queue_status_check
      check (status in ('pending','retrying','resolved','dead')),
  next_retry_at timestamptz,
  resolved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint dead_letter_queue_pkey primary key (id)
);

-- Indexes for dead_letter_queue
create index if not exists idx_dlq_source_slug on public.dead_letter_queue(source_slug);
create index if not exists idx_dlq_status on public.dead_letter_queue(status);
create index if not exists idx_dlq_error_category on public.dead_letter_queue(error_category);
create index if not exists idx_dlq_created_at on public.dead_letter_queue(created_at desc);
create index if not exists idx_dlq_next_retry_at on public.dead_letter_queue(next_retry_at)
  where status = 'pending';

-- =============================================================================
-- Table 2: recovery_metrics
-- =============================================================================

create table if not exists public.recovery_metrics (
  id uuid not null default gen_random_uuid(),
  source_id bigint,
  source_slug text not null,
  metric_type text not null
    constraint recovery_metrics_metric_type_check
      check (metric_type in ('cb_trip','cb_reset','cb_half_open','dlq_insert','dlq_retry','dlq_resolve','recovery_success','recovery_failure')),
  recorded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,

  constraint recovery_metrics_pkey primary key (id)
);

-- Indexes for recovery_metrics
create index if not exists idx_recovery_metrics_source_slug on public.recovery_metrics(source_slug);
create index if not exists idx_recovery_metrics_metric_type on public.recovery_metrics(metric_type);
create index if not exists idx_recovery_metrics_recorded_at on public.recovery_metrics(recorded_at desc);
create index if not exists idx_recovery_metrics_source_type on public.recovery_metrics(source_slug, metric_type);

-- =============================================================================
-- updated_at trigger (shared function)
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists dead_letter_queue_set_updated_at on public.dead_letter_queue;
create trigger dead_letter_queue_set_updated_at
  before update on public.dead_letter_queue
  for each row
  execute function public.set_updated_at();
