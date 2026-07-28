-- SPRINT P-15.1 Phase 2: AlertStore Persistence
-- Creates alert_snapshots table for Supabase-backed AlertStore.
-- Follows the same conventions as recovery-infrastructure.sql.

-- =============================================================================
-- Table: alert_snapshots
-- =============================================================================

create table if not exists public.alert_snapshots (
  id uuid not null default gen_random_uuid(),
  type text not null
    constraint alert_snapshots_type_check
      check (type in ('consecutive_failures','timeout','http_error','cloudflare_detected','captcha_detected','empty_import','abnormal_duplicate_rate','source_unavailable')),
  severity text not null
    constraint alert_snapshots_severity_check
      check (severity in ('critical','warning','info')),
  status text not null default 'active'
    constraint alert_snapshots_status_check
      check (status in ('active','acknowledged','resolved','silenced')),
  title text not null,
  message text not null,
  source_id bigint,
  source_name text,
  metadata jsonb not null default '{}'::jsonb,
  triggered_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by text,
  resolved_at timestamptz,
  expires_at timestamptz,
  count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint alert_snapshots_pkey primary key (id)
);

-- Indexes for alert_snapshots
create index if not exists idx_alert_snapshots_status on public.alert_snapshots(status);
create index if not exists idx_alert_snapshots_severity on public.alert_snapshots(severity);
create index if not exists idx_alert_snapshots_type on public.alert_snapshots(type);
create index if not exists idx_alert_snapshots_source_id on public.alert_snapshots(source_id);
create index if not exists idx_alert_snapshots_triggered_at on public.alert_snapshots(triggered_at desc);
create index if not exists idx_alert_snapshots_active on public.alert_snapshots(status)
  where status in ('active', 'acknowledged');

-- Trigger for updated_at
drop trigger if exists alert_snapshots_set_updated_at on public.alert_snapshots;
create trigger alert_snapshots_set_updated_at
  before update on public.alert_snapshots
  for each row
  execute function public.set_updated_at();
