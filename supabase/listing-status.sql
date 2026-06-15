alter table public.listings
  add column if not exists status text not null default 'published';

update public.listings
set status = 'published'
where status is null;

alter table public.listings
  drop constraint if exists listings_status_check;

alter table public.listings
  add constraint listings_status_check
  check (status in ('pending', 'published', 'rejected'));

create index if not exists listings_status_created_at_idx
  on public.listings(status, created_at desc);
