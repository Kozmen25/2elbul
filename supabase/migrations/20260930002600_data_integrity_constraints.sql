-- Data integrity: referential links, value checks and updated_at upkeep
-- that the schema was missing. Every rule below was checked against live
-- data first (no existing row violates it), so nothing is rewritten.

-- 1) Foreign keys for id columns that had none. ON DELETE SET NULL keeps
--    operational/analytics history when a source or product is removed.
alter table public.analytics_events
  drop constraint if exists analytics_events_product_id_fkey,
  add constraint analytics_events_product_id_fkey
    foreign key (product_id) references public.products(id) on delete set null;

alter table public.alert_snapshots
  drop constraint if exists alert_snapshots_source_id_fkey,
  add constraint alert_snapshots_source_id_fkey
    foreign key (source_id) references public.sources(id) on delete set null;

alter table public.dead_letter_queue
  drop constraint if exists dead_letter_queue_source_id_fkey,
  add constraint dead_letter_queue_source_id_fkey
    foreign key (source_id) references public.sources(id) on delete set null;

alter table public.recovery_metrics
  drop constraint if exists recovery_metrics_source_id_fkey,
  add constraint recovery_metrics_source_id_fkey
    foreign key (source_id) references public.sources(id) on delete set null;

-- Covering indexes for the new foreign keys (alert_snapshots.source_id
-- already has idx_alert_snapshots_source_id).
create index if not exists analytics_events_product_id_idx
  on public.analytics_events (product_id);
create index if not exists dead_letter_queue_source_id_idx
  on public.dead_letter_queue (source_id);
create index if not exists recovery_metrics_source_id_idx
  on public.recovery_metrics (source_id);

-- 2) Value checks.
alter table public.price_history
  drop constraint if exists price_history_price_check,
  add constraint price_history_price_check check (price > 0);

alter table public.listings
  drop constraint if exists listings_currency_check,
  add constraint listings_currency_check check (currency ~ '^[A-Z]{3}$');

-- 3) updated_at was never maintained on these tables (no trigger), so it
--    only ever held the insert time.
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row
  execute function public.set_updated_at();
