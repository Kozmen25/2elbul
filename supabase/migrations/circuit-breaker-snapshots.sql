-- SPRINT P-15.1 Phase 2: Circuit Breaker Persistence
-- Creates circuit_breaker_snapshots table for Supabase-backed state persistence.
-- Follows the same conventions as recovery-infrastructure.sql.

-- =============================================================================
-- Table: circuit_breaker_snapshots
-- =============================================================================

create table if not exists public.circuit_breaker_snapshots (
  source_slug text not null,
  state text not null
    constraint circuit_breaker_snapshots_state_check
      check (state in ('closed', 'open', 'half_open')),
  failure_count integer not null default 0,
  trip_count integer not null default 0,
  last_failure_at timestamptz,
  last_success_at timestamptz,
  opened_at timestamptz,
  last_tested_at timestamptz,
  next_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint circuit_breaker_snapshots_pkey primary key (source_slug)
);

-- Indexes for circuit_breaker_snapshots
create index if not exists idx_circuit_breaker_snapshots_state
  on public.circuit_breaker_snapshots(state);
create index if not exists idx_circuit_breaker_snapshots_next_attempt
  on public.circuit_breaker_snapshots(next_attempt_at)
  where state = 'open';

-- Trigger for updated_at
drop trigger if exists circuit_breaker_snapshots_set_updated_at
  on public.circuit_breaker_snapshots;
create trigger circuit_breaker_snapshots_set_updated_at
  before update on public.circuit_breaker_snapshots
  for each row
  execute function public.set_updated_at();
