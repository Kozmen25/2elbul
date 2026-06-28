alter table public.listings
  add column if not exists status text not null default 'published',
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists first_seen_at timestamptz null,
  add column if not exists last_seen_at timestamptz null,
  add column if not exists inactive_at timestamptz null;

update public.listings
set status = 'published'
where status is null;

alter table public.listings
  drop constraint if exists listings_status_check;

alter table public.listings
  add constraint listings_status_check
  check (status in ('pending', 'published', 'rejected', 'active', 'inactive'));

create index if not exists listings_status_created_at_idx
  on public.listings(status, created_at desc);
