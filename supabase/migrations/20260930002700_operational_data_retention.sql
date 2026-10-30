-- Retention for append-only operational tables, run nightly by pg_cron.
--
-- These tables grow with every request / bot run and had no cleanup. Windows
-- are several times longer than anything the app reads (admin analytics shows
-- at most 30 days; recovery/bot dashboards show recent runs).
--
-- Deliberately NOT purged — they are the platform's market data:
--   price_history, search_events, listings, products.
-- User-owned rows (notifications, saved searches, favorites) are not touched.

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
  v_analytics int;
  v_recovery int;
  v_bot_runs int;
  v_dlq int;
  v_alerts int;
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

  return jsonb_build_object(
    'analytics_events', v_analytics,
    'recovery_metrics', v_recovery,
    'bot_runs', v_bot_runs,
    'dead_letter_queue', v_dlq,
    'alert_snapshots', v_alerts
  );
end;
$$;

-- Maintenance only: never callable through /rest/v1/rpc.
revoke execute on function public.purge_expired_operational_data() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;

-- cron.schedule with a job name replaces an existing job of that name,
-- so re-running this file is safe. 03:30 UTC = 06:30 Europe/Istanbul.
select cron.schedule(
  'purge-expired-operational-data',
  '30 3 * * *',
  'select public.purge_expired_operational_data()'
);
