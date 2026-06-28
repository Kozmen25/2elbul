-- 2ElBul automatic bot scheduler settings.
-- Run this after sources-and-bots.sql on existing projects.

alter table public.sources
  add column if not exists integration_type text not null default 'manual',
  add column if not exists fetch_limit int not null default 10,
  add column if not exists bot_import_mode text not null default 'pending',
  add column if not exists cron_enabled boolean not null default false,
  add column if not exists last_run_at timestamptz null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sources_integration_type_check'
  ) then
    alter table public.sources
      add constraint sources_integration_type_check
      check (integration_type in ('manual', 'scrape', 'api'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'sources_fetch_limit_check'
  ) then
    alter table public.sources
      add constraint sources_fetch_limit_check
      check (fetch_limit between 1 and 1000);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'sources_bot_import_mode_check'
  ) then
    alter table public.sources
      add constraint sources_bot_import_mode_check
      check (bot_import_mode in ('pending', 'published'));
  end if;
end $$;

update public.sources
set fetch_limit = product_limit
where product_limit is not null;

update public.sources
set bot_import_mode = bot_listing_status
where bot_listing_status in ('pending', 'published');

update public.sources
set integration_type = 'scrape'
where slug in (
  'easycep',
  'getmobil',
  'hepsiburada-yenilenmis',
  'teknosa-yenilenmis',
  'mediamarkt-yenilenmis',
  'yenilenmis-market'
);

update public.sources
set scrape_url = 'https://easycep.com/kategori/cep-telefonu-1'
where slug = 'easycep'
  and (scrape_url is null or scrape_url = '');

update public.sources
set scrape_url = 'https://getmobil.com/satin-al/cep-telefonu/'
where slug = 'getmobil'
  and (scrape_url is null or scrape_url = '');

update public.sources
set scrape_url = 'https://www.hepsiburada.com/ara?q=yenilenmi%C5%9F'
where slug = 'hepsiburada-yenilenmis'
  and (scrape_url is null or scrape_url = '');

update public.sources
set scrape_url = 'https://www.teknosa.com/arama/?s=yenilenmi%C5%9F'
where slug = 'teknosa-yenilenmis'
  and (scrape_url is null or scrape_url = '');

update public.sources
set scrape_url = 'https://www.mediamarkt.com.tr/tr/search.html?query=yenilenmi%C5%9F'
where slug = 'mediamarkt-yenilenmis'
  and (scrape_url is null or scrape_url = '');

update public.sources
set scrape_url = 'https://www.yenilenmismarket.com/'
where slug = 'yenilenmis-market'
  and (scrape_url is null or scrape_url = '');
