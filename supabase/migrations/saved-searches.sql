-- Saved searches table for user search subscriptions.
-- When new listings match a saved search, the user receives a notification.
--
-- frequency: instant = notify as soon as cron finds new matches
--            daily   = only check once per day
--            weekly  = only check once per week
-- filters: JSON object with optional {city, source, condition, minPrice, maxPrice}

create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  query text not null,
  filters jsonb null default '{}'::jsonb,
  frequency text not null default 'instant',
  last_notified_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_searches_frequency_check
    check (frequency in ('instant', 'daily', 'weekly'))
);

alter table public.saved_searches
  add column if not exists filters jsonb null default '{}'::jsonb,
  add column if not exists last_notified_at timestamptz null;

alter table public.saved_searches
  alter column user_id set not null,
  alter column query set not null,
  alter column frequency set not null default 'instant';

create index if not exists saved_searches_user_created_idx
  on public.saved_searches(user_id, created_at desc);

create index if not exists saved_searches_user_frequency_idx
  on public.saved_searches(user_id, frequency, last_notified_at)
  where frequency = 'instant';

create index if not exists saved_searches_query_idx
  on public.saved_searches(query);

-- Prevent duplicate saved searches per user+query+filters
create unique index if not exists saved_searches_user_query_filters_key
  on public.saved_searches(user_id, query, coalesce(filters::text, '{}'));

create or replace function public.set_saved_searches_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists saved_searches_set_updated_at on public.saved_searches;
create trigger saved_searches_set_updated_at
  before update on public.saved_searches
  for each row
  execute function public.set_saved_searches_updated_at();

alter table public.saved_searches enable row level security;

drop policy if exists "Users can read their saved searches" on public.saved_searches;
create policy "Users can read their saved searches"
  on public.saved_searches
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can add their saved searches" on public.saved_searches;
create policy "Users can add their saved searches"
  on public.saved_searches
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their saved searches" on public.saved_searches;
create policy "Users can update their saved searches"
  on public.saved_searches
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can remove their saved searches" on public.saved_searches;
create policy "Users can remove their saved searches"
  on public.saved_searches
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
