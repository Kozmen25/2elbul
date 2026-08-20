-- 2ElBul account center: minimal profiles table + avatars storage bucket.
-- Adds the identity surface for /hesabim (Aşama 1) without touching listings,
-- search, PUE, taxonomy, matcher, confidence, opportunity or market pipeline.

-- 1) Profiles table (minimal profile identity, per rule 9).
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  location text,
  bio text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

create index if not exists profiles_updated_at_idx
  on public.profiles (updated_at);

alter table public.profiles enable row level security;

drop policy if exists "Users can read their profile" on public.profiles;
create policy "Users can read their profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their profile" on public.profiles;
create policy "Users can insert their profile"
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 2) Avatars storage bucket. Public read so avatars render without auth;
-- object management is owner-only (object paths are keyed by user id).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatar objects are publicly readable" on storage.objects;
create policy "Avatar objects are publicly readable"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their avatars" on storage.objects;
create policy "Users can upload their avatars"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'avatars' and owner_id = (select auth.uid()));

drop policy if exists "Users can update their avatars" on storage.objects;
create policy "Users can update their avatars"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'avatars' and owner_id = (select auth.uid()))
  with check (bucket_id = 'avatars' and owner_id = (select auth.uid()));

drop policy if exists "Users can delete their avatars" on storage.objects;
create policy "Users can delete their avatars"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'avatars' and owner_id = (select auth.uid()));
