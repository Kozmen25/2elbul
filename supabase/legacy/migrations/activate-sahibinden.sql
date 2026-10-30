-- ============================================================================
-- SPRINT P-14: Sahibinden Production Activation
-- Configuration-level blocker resolution.
--
-- Changes integration_type from 'manual' to 'scrape' so the source engine's
-- getSkipReason() no longer blocks sahibinden at the integration_type check
-- (engine.ts:129 — returns null when integration_type is 'scrape').
--
-- Also sets bot_listing_status, cron_enabled, and fetch_limit for production
-- readiness, following the same pattern as activate-production-sources.sql.
--
-- Note: This migration resolves configuration blockers only. The Cloudflare
-- anti-bot protection (Blocker 2) is an infrastructure blocker that requires
-- SCRAPINGFISH_API_KEY to be set in production environment.
--
-- Idempotent: each UPDATE includes the previous status in the WHERE clause.
-- ============================================================================

-- Step 1: Change integration_type to 'scrape'
UPDATE sources
SET integration_type = 'scrape'
WHERE slug = 'sahibinden'
  AND integration_type = 'manual';

-- Step 2: Set production listing status and cron
UPDATE sources
SET bot_listing_status = 'published',
    cron_enabled        = true,
    fetch_limit         = 30
WHERE slug = 'sahibinden'
  AND bot_listing_status = 'pending';

-- ============================================================================
-- Verification
-- ============================================================================
do $$
declare
  r record;
begin
  select slug, integration_type, bot_listing_status, cron_enabled, fetch_limit
  into r
  from sources
  where slug = 'sahibinden';

  if r.integration_type = 'scrape' and r.bot_listing_status = 'published'
     and r.cron_enabled = true and r.fetch_limit >= 10
  then
    raise info 'OK: sahibinden — integration_type=%, bot_listing_status=%, cron_enabled=%, fetch_limit=%',
      r.integration_type, r.bot_listing_status, r.cron_enabled, r.fetch_limit;
  else
    raise warning 'UNEXPECTED: sahibinden — integration_type=%, bot_listing_status=%, cron_enabled=%, fetch_limit=%',
      r.integration_type, r.bot_listing_status, r.cron_enabled, r.fetch_limit;
  end if;
end $$;
