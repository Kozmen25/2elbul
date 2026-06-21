alter table public.sources
  add column if not exists bot_listing_status text not null default 'pending';

alter table public.sources
  drop constraint if exists sources_bot_listing_status_check;

alter table public.sources
  add constraint sources_bot_listing_status_check
  check (bot_listing_status in ('pending', 'published'));

update public.sources
set bot_listing_status = 'published'
where slug = 'easycep';
