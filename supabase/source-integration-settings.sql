alter table public.sources
  add column if not exists api_url text null,
  add column if not exists scrape_url text null,
  add column if not exists cron_enabled boolean not null default false,
  add column if not exists cron_schedule text not null default '0 */6 * * *',
  add column if not exists product_limit int not null default 100,
  add column if not exists last_success timestamptz null;

alter table public.sources
  drop constraint if exists sources_product_limit_check;

alter table public.sources
  add constraint sources_product_limit_check
  check (product_limit between 1 and 1000);

create index if not exists sources_cron_enabled_idx
  on public.sources(cron_enabled)
  where cron_enabled = true;
