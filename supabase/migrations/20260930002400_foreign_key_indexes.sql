-- Covering indexes for foreign keys flagged by the Supabase performance
-- advisor (unindexed_foreign_keys). Without them, deleting a referenced row
-- (auth user, source) scans the referencing table, and joins/filters on these
-- columns cannot use an index.

create index if not exists admin_roles_granted_by_idx
  on public.admin_roles (granted_by);

create index if not exists analytics_events_user_id_idx
  on public.analytics_events (user_id);

create index if not exists bot_queue_source_id_idx
  on public.bot_queue (source_id);

create index if not exists search_demands_user_id_idx
  on public.search_demands (user_id);
