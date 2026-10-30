-- Per-kind notification preferences.
--
-- profiles.email_notifications stays the master switch for e-mail copies.
-- notification_settings holds the finer choice per notification kind and
-- channel, e.g.
--   { "price_drop": { "in_app": true, "email": false }, "saved_search": { "in_app": false } }
-- A missing kind or channel means "on", so existing users keep receiving
-- everything until they change something.
--
-- Kinds (see lib/notifications/preferences.ts):
--   price_alert  - a target price was reached
--   price_drop   - a followed product got cheaper
--   new_listing  - a followed product got a new, favourably priced listing
--   saved_search - a followed search found new listings
--
-- Written by the user through the account page (RLS: own row), read by the
-- daily checks with the service role.

alter table public.profiles
  add column if not exists notification_settings jsonb not null default '{}'::jsonb;

alter table public.profiles
  drop constraint if exists profiles_notification_settings_object_check;
alter table public.profiles
  add constraint profiles_notification_settings_object_check
  check (jsonb_typeof(notification_settings) = 'object');

comment on column public.profiles.notification_settings is
  'Per kind and channel (in_app / email) notification choices; missing = on. See lib/notifications/preferences.ts.';
