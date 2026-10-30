-- Lock down SECURITY DEFINER functions and pin function search_paths.
--
-- Postgres grants EXECUTE on new functions to PUBLIC, and PostgREST exposes
-- every public-schema function at /rest/v1/rpc/<name>. These functions run
-- with the owner's privileges (bypassing RLS), so with the default grant
-- anyone holding the public anon key could call them:
--   sync_source_listings                 insert/update/deactivate any source's listings
--   backfill_price_history_from_listings write price_history rows
--   get_admin_platform_stats             read admin-only aggregates
--   handle_new_user_avatar               trigger function, never meant as an RPC
-- The application only calls them with the service-role client
-- (lib/bots/listing-sync.ts, app/admin/stats/page.tsx), so they are
-- restricted to service_role. Flagged by the Supabase security advisor.

revoke execute on function public.sync_source_listings(bigint, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.sync_source_listings(bigint, jsonb, boolean) to service_role;

revoke execute on function public.backfill_price_history_from_listings(integer, boolean) from public, anon, authenticated;
grant execute on function public.backfill_price_history_from_listings(integer, boolean) to service_role;

revoke execute on function public.get_admin_platform_stats() from public, anon, authenticated;
grant execute on function public.get_admin_platform_stats() to service_role;

revoke execute on function public.handle_new_user_avatar() from public, anon, authenticated;

-- A role-mutable search_path lets a caller shadow objects these functions
-- reference. Pin it (advisor: function_search_path_mutable).
alter function public.track_listing_price_change() set search_path = public;
alter function public.slugify_product_name(text) set search_path = public;
alter function public.set_product_slug() set search_path = public;
alter function public.set_listing_updated_at() set search_path = public;
alter function public.set_price_alerts_updated_at() set search_path = public;
alter function public.set_bot_queue_updated_at() set search_path = public;
alter function public.compute_normalized_key(text) set search_path = public;
alter function public.set_product_normalized_key() set search_path = public;
alter function public.set_updated_at() set search_path = public;
alter function public.set_saved_searches_updated_at() set search_path = public;
