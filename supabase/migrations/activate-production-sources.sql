-- ============================================================================
-- SPRINT P-13: Production Source Activation
-- Activates Getmobil + 4 commerce wrapper sources for live scraping.
--
-- Idempotent: each UPDATE includes the previous status in the WHERE clause so
-- re-running is safe. The verification block raises a WARNING (not ERROR) for
-- any source that didn't match the expected post-activation state.
--
-- Activation order (matching sprint plan):
--   1. getmobil              (P0, zero-code, full adapter)
--   2. yenilenmis-market     (P1, lowest anti-bot risk)
--   3. teknosa-yenilenmis    (P1, medium anti-bot risk)
--   4. mediamarkt-yenilenmis (P1, low-medium anti-bot risk)
--   5. hepsiburada-yenilenmis (P1, highest anti-bot risk among commerce)
-- ============================================================================

-- Phase A: Getmobil
UPDATE sources
SET bot_listing_status = 'published',
    cron_enabled        = true,
    fetch_limit         = 40
WHERE slug = 'getmobil'
  AND bot_listing_status = 'pending';

-- Phase B: Yenilenmiş Market
UPDATE sources
SET bot_listing_status = 'published',
    cron_enabled        = true,
    fetch_limit         = 20
WHERE slug = 'yenilenmis-market'
  AND bot_listing_status = 'pending';

-- Phase C: Teknosa
UPDATE sources
SET bot_listing_status = 'published',
    cron_enabled        = true,
    fetch_limit         = 20
WHERE slug = 'teknosa-yenilenmis'
  AND bot_listing_status = 'pending';

-- Phase D: MediaMarkt
UPDATE sources
SET bot_listing_status = 'published',
    cron_enabled        = true,
    fetch_limit         = 20
WHERE slug = 'mediamarkt-yenilenmis'
  AND bot_listing_status = 'pending';

-- Phase E: Hepsiburada
UPDATE sources
SET bot_listing_status = 'published',
    cron_enabled        = true,
    fetch_limit         = 20
WHERE slug = 'hepsiburada-yenilenmis'
  AND bot_listing_status = 'pending';

-- ============================================================================
-- Verification
-- ============================================================================
do $$
declare
  expected_slugs text[] := array[
    'getmobil',
    'yenilenmis-market',
    'teknosa-yenilenmis',
    'mediamarkt-yenilenmis',
    'hepsiburada-yenilenmis'
  ];
  r record;
begin
  for r in
    select slug, bot_listing_status, cron_enabled, fetch_limit
    from sources
    where slug = any(expected_slugs)
    order by slug
  loop
    if r.bot_listing_status = 'published' and r.cron_enabled = true and r.fetch_limit >= 20 then
      raise info 'OK: % — bot_listing_status=%, cron_enabled=%, fetch_limit=%',
        r.slug, r.bot_listing_status, r.cron_enabled, r.fetch_limit;
    else
      raise warning 'UNEXPECTED: % — bot_listing_status=%, cron_enabled=%, fetch_limit=%',
        r.slug, r.bot_listing_status, r.cron_enabled, r.fetch_limit;
    end if;
  end loop;
end $$;
