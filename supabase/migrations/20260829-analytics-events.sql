-- 2026-08-29 — Privacy-safe site analytics events (server-side only).
--
-- PRIVACY (§13-14): only coarse, aggregate-safe fields are stored here.
--   - user_id is nullable and recorded only when the server already knows it
--     from the authenticated session.
--   - traffic_source / device_type are coarse categories derived server-side
--     from Referer + User-Agent at collection time — never the raw header, never
--     IP, never the UA string.
-- No client tracker, no anonymous_session_id, no precise device, no geo, no UTM.
-- Anon and public clients have no policy access; only the service role writes.

create table if not exists public.analytics_events (
  id             bigint generated always as identity primary key,
  event_name     text not null,
  user_id        uuid references auth.users(id) on delete set null,
  path           text,
  product_id     bigint,
  search_query   text,
  traffic_source text,
  device_type    text,
  created_at     timestamptz not null default now()
);

create index if not exists analytics_events_name_created_idx
  on public.analytics_events (event_name, created_at);

alter table public.analytics_events enable row level security;
