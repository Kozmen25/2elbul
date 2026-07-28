-- User notifications table for in-app notification system.
-- Supports price alert triggers and future notification types.

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  metadata jsonb null default '{}'::jsonb,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

alter table public.user_notifications
  add column if not exists metadata jsonb null default '{}'::jsonb,
  add column if not exists read_at timestamptz null;

alter table public.user_notifications
  alter column user_id set not null,
  alter column type set not null,
  alter column title set not null,
  alter column body set not null default '';

create index if not exists user_notifications_user_read_idx
  on public.user_notifications(user_id, read_at)
  where read_at is null;

create index if not exists user_notifications_user_created_idx
  on public.user_notifications(user_id, created_at desc);

alter table public.user_notifications enable row level security;

drop policy if exists "Users can read their own notifications" on public.user_notifications;
create policy "Users can read their own notifications"
  on public.user_notifications
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own notifications" on public.user_notifications;
create policy "Users can update their own notifications"
  on public.user_notifications
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
