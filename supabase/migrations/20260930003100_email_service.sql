-- E-mail service: SMTP settings (managed from the admin panel), a delivery
-- log, and a per-user opt-out for notification e-mails.
--
-- Both new tables are service-role only (RLS on, no policies): the SMTP
-- password is stored encrypted (AES-256-GCM, key in EMAIL_SETTINGS_ENCRYPTION_KEY,
-- see lib/email/crypto.ts) and must never be readable with the public anon key.

-- 1) SMTP settings — exactly one row (id = 1).
create table if not exists public.email_settings (
  id                  smallint primary key default 1 check (id = 1),
  enabled             boolean not null default false,
  host                text,
  port                integer check (port is null or port between 1 and 65535),
  -- true: implicit TLS (port 465). false: plain connection upgraded with STARTTLS (port 587/25).
  secure              boolean not null default false,
  username            text,
  password_encrypted  text,
  from_email          text,
  from_name           text,
  reply_to            text,
  last_test_at        timestamptz,
  last_test_ok        boolean,
  last_test_error     text,
  updated_at          timestamptz not null default now(),
  updated_by          uuid references auth.users(id) on delete set null
);

insert into public.email_settings (id) values (1) on conflict (id) do nothing;

alter table public.email_settings enable row level security;

drop trigger if exists email_settings_set_updated_at on public.email_settings;
create trigger email_settings_set_updated_at
  before update on public.email_settings
  for each row
  execute function public.set_updated_at();

create index if not exists email_settings_updated_by_idx
  on public.email_settings (updated_by);

-- 2) Delivery log. Holds who/what/outcome only — never the message body, which
--    contains one-time links and tokens.
create table if not exists public.email_logs (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  to_email    text not null,
  template    text not null,
  subject     text not null,
  status      text not null check (status in ('sent', 'failed', 'skipped')),
  error       text,
  message_id  text,
  user_id     uuid references auth.users(id) on delete set null,
  -- where the send was triggered: Supabase auth hook, app code, admin test button
  source      text not null default 'app' check (source in ('auth_hook', 'app', 'admin_test'))
);

alter table public.email_logs enable row level security;

create index if not exists email_logs_created_at_idx on public.email_logs (created_at desc);
create index if not exists email_logs_status_created_at_idx on public.email_logs (status, created_at desc);
create index if not exists email_logs_user_id_idx on public.email_logs (user_id);

-- 3) Users can switch notification e-mails (price alerts, price drops) off.
--    In-app notifications are unaffected. Account e-mails (sign-up confirmation,
--    password reset) are always sent.
alter table public.profiles
  add column if not exists email_notifications boolean not null default true;

comment on column public.profiles.email_notifications is
  'Opt-out for notification e-mails (price alerts, price drops). Account e-mails ignore it.';

-- 4) Retention: keep 90 days of delivery logs with the other operational tables.
create or replace function public.purge_expired_operational_data()
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  analytics_retention   constant interval := interval '90 days';
  recovery_retention    constant interval := interval '90 days';
  bot_run_retention     constant interval := interval '180 days';
  closed_dlq_retention  constant interval := interval '30 days';
  resolved_alert_retention constant interval := interval '90 days';
  email_log_retention   constant interval := interval '90 days';
  v_analytics int;
  v_recovery int;
  v_bot_runs int;
  v_dlq int;
  v_alerts int;
  v_email int;
begin
  delete from public.analytics_events where created_at < now() - analytics_retention;
  get diagnostics v_analytics = row_count;

  delete from public.recovery_metrics where recorded_at < now() - recovery_retention;
  get diagnostics v_recovery = row_count;

  delete from public.bot_runs where created_at < now() - bot_run_retention;
  get diagnostics v_bot_runs = row_count;

  delete from public.dead_letter_queue
  where status in ('resolved', 'dead') and updated_at < now() - closed_dlq_retention;
  get diagnostics v_dlq = row_count;

  delete from public.alert_snapshots
  where status = 'resolved' and coalesce(resolved_at, updated_at) < now() - resolved_alert_retention;
  get diagnostics v_alerts = row_count;

  delete from public.email_logs where created_at < now() - email_log_retention;
  get diagnostics v_email = row_count;

  return jsonb_build_object(
    'analytics_events', v_analytics,
    'recovery_metrics', v_recovery,
    'bot_runs', v_bot_runs,
    'dead_letter_queue', v_dlq,
    'alert_snapshots', v_alerts,
    'email_logs', v_email
  );
end;
$$;

revoke execute on function public.purge_expired_operational_data() from public, anon, authenticated;
