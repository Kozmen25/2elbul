# Sprint P-13 — Production Source Activation Report

**Date:** 2026-07-19  
**Plan Reference:** `docs/SPRINT-P12-SOURCE_EXPANSION_PLAN.md`  
**Status:** All targets activated, verified, and documented.

---

## 1. Activated Sources

| # | Source | Slug | Adapter Type | fetch_limit | Est. Listings/Day |
|---|--------|------|-------------|-------------:|------------------:|
| 1 | Getmobil | `getmobil` | Full (307 lines, dedicated) | 40 | ~30 |
| 2 | Yenilenmiş Market | `yenilenmis-market` | Commerce wrapper (19 lines) | 20 | ~20 |
| 3 | Teknosa Yenilenmiş | `teknosa-yenilenmis` | Commerce wrapper (19 lines) | 20 | ~40 |
| 4 | MediaMarkt Yenilenmiş | `mediamarkt-yenilenmis` | Commerce wrapper (19 lines) | 20 | ~30 |
| 5 | Hepsiburada Yenilenmiş | `hepsiburada-yenilenmis` | Commerce wrapper (19 lines) | 20 | ~60 |

**New listings/day:** ~180  
**Previous baseline (EasyCep only):** ~50/day  
**New total:** ~230/day (**4.6x increase**)

---

## 2. Configuration Changes

### Migration file
`supabase/migrations/activate-production-sources.sql`

All 5 sources received the same 3-field update, differing only in `fetch_limit`:

```sql
UPDATE sources SET
  bot_listing_status = 'published',
  cron_enabled        = true,
  fetch_limit         = 40  -- (20 for commerce wrappers)
WHERE slug = '<slug>' AND bot_listing_status = 'pending';
```

**Idempotency guard:** Each `UPDATE` includes `AND bot_listing_status = 'pending'`, so re-running has no effect.

### Verification block (inline PL/pgSQL)
After all UPDATEs, a `do $$` block asserts all 5 slugs have `bot_listing_status = 'published'`, `cron_enabled = true`, and `fetch_limit >= 20`. Mismatches raise a `WARNING`.

### Detailed per-source changes

| Slug | bot_listing_status (before → after) | cron_enabled (before → after) | fetch_limit (before → after) |
|------|-------------------------------------|-------------------------------|------------------------------|
| getmobil | `pending` → `published` | `false` → `true` | `10` → `40` |
| yenilenmis-market | `pending` → `published` | `false` → `true` | `10` → `20` |
| teknosa-yenilenmis | `pending` → `published` | `false` → `true` | `10` → `20` |
| mediamarkt-yenilenmis | `pending` → `published` | `false` → `true` | `10` → `20` |
| hepsiburada-yenilenmis | `pending` → `published` | `false` → `true` | `10` → `20` |

**Zero code changes.** No TypeScript/TSX files were modified. All infrastructure layers (source registry, adapter registration, circuit breakers, recovery wrappers, monitoring, admin UI, cron routes) were already wired for all 5 targets.

---

## 3. Pre-Activation Infrastructure Verification

### Source Registry (`lib/source-registry/registry.ts`)
- ✅ All 5 slugs registered in `SourceRegistryImpl` (`getAllActive()` returns all)
- ✅ Reliability scores pre-assigned: getmobil=90, yenilenmis-market=87, teknosa=86, mediamarkt=84, hepsiburada=85
- ✅ `initialize()` reads from `sources` table — no registration code change needed

### Adapter Registration (`lib/bots/connectors.ts`)
- ✅ `SCRAPE_FETCHERS` has 7 entries — all 5 targets wrapped with `withRecoveryPolicy()`
- ✅ `SCRAPE_READY_SLUGS = Object.keys(SCRAPE_FETCHERS)` — all 5 present
- ✅ `isSupportedScrapeSource(slug)` returns `true` for all 5
- ✅ `getStandardSourceAdapter()` resolves: getmobil → dedicated adapter, 4 commerce → generic connector wrapper → commerce.ts
- ✅ `realScrapeSourceSlugs` in admin UI (`app/admin/sources/source-manager.tsx`) includes all 5 (set of 6 slugs)

### DB Source Configuration (pre-activation)
- ✅ `is_active = true` for all 5
- ✅ `integration_type = 'scrape'` for all 5
- ✅ `bot_listing_status = 'pending'` for all 5 (changed to `published` by this sprint)

### Circuit Breaker Configs (`lib/recovery/circuit-breaker.ts`)
| Slug | Threshold | Half-Open Timeout |
|------|----------:|------------------:|
| getmobil | 5 failures | 30s |
| hepsiburada-yenilenmis | 3 failures | 60s |
| teknosa-yenilenmis | 3 failures | 60s |
| mediamarkt-yenilenmis | 3 failures | 60s |
| yenilenmis-market | 5 failures | 30s |

- ✅ All CLOSED (healthy) — verified via `POST /api/admin/recovery/circuit-breakers`

### Recovery Infrastructure
- ✅ `withRecoveryPolicy()` wraps all 5 `SCRAPE_FETCHERS` entries
- ✅ Dead Letter Queue table (`dead_letter_queue`) exists — empty
- ✅ RecoveryMetricsService connected in `source-runner.ts` — records on every success/failure

### Monitoring
- ✅ `collectMonitoringSummary()` reads from `bot_run_logs`, `source_run_logs`, `alert_history`
- ✅ AlertEngine has 11 rules: consecutive failures, timeout, HTTP error rate, Cloudflare, CAPTCHA, empty import, duplicate rate, source unavailable
- ✅ Admin endpoints available: `GET /api/monitoring/summary`, `GET /api/monitoring/snapshot`

### Admin UI
- ✅ Sources page: "Real Bot" button enabled for all 5 slugs
- ✅ `runRealBot()` server action → `isSupportedScrapeSource()` → `runSourceScrapeBot()` path confirmed working

### Cron Flow
- ✅ `GET /api/cron/daily` → `runSourceEngine()` → `loadSources()` → `getSkipReason()` — once `bot_listing_status='published'` and `cron_enabled=true`, `getSkipReason()` returns `null` (runnable)
- ✅ Process search queue route handles listings from all sources

---

## 4. Source Engine Compatibility Verification

The `getSkipReason()` function in `lib/source-engine/engine.ts` checks:

| Check | Pass condition | All 5 targets |
|-------|--------------|:------------:|
| `is_active` | `true` | ✅ |
| `isSupportedScrapeSource(slug)` | `true` (in SCRAPE_READY_SLUGS) | ✅ |
| `integration_type` | `'scrape'` | ✅ |
| `cron_enabled` | `true` | ✅ (set by this sprint) |
| `isSourceDueForRun()` | due based on cron schedule | ✅ (auto) |

**After activation**, `getSkipReason()` returns `null` for all 5 — they join EasyCep in the daily cron rotation.

The cron endpoint also runs the **search queue processor** (`processSearchQueue`) which picks up listings created by any source. The `process-search-queue` route already imports from `@/lib/bots/listing-sync` which uses `syncListingsForSource` — this function handles all sources generically.

---

## 5. Expected Listings Breakdown

| Source | Est./Day | Adapter Confidence | Key Signal |
|--------|---------:|-------------------|------------|
| EasyCep | ~50 | High (actively publishing) | Known baseline |
| Getmobil | ~30 | High | Dedicated adapter, JSON parsing |
| Yenilenmiş Market | ~20 | Medium | Commerce wrapper, JSON-LD parsing |
| Teknosa | ~40 | Medium | Commerce wrapper, major retailer |
| MediaMarkt | ~30 | Medium | Commerce wrapper, JSON-LD |
| Hepsiburada | ~60 | Medium | Commerce wrapper, highest volume |
| **Total** | **~230** | | |

**Seasonal variance:** ±20% depending on listing availability across sources. Hepsiburada may vary more due to anti-bot behavior.

---

## 6. Monitoring & Health

### Alert Rules Active
All 11 rules from `lib/monitoring/alert-engine.ts`:
- ConsecutiveFailureAlert (threshold: 3)
- TimeoutRateAlert (threshold: 20%)
- HttpErrorRateAlert (threshold: 30%)
- CloudflareDetectedAlert (instant)
- CaptchaDetectedAlert (instant)
- EmptyImportAlert (threshold: 1 consecutive)
- DuplicateRateHighAlert (threshold: 30%)
- SourceUnavailableAlert (threshold: 3 consecutive)
- ScrapeSuccessRateAlert (threshold: 60%)
- DataFreshnessAlert (threshold: 48 hours)
- TotalListingsDropAlert (threshold: 25% drop)

### Circuit Breaker States
All 5 sources: **CLOSED** (healthy). Break only after threshold failures (3 or 5 depending on source).

### Dead Letter Queue
Empty — no entries recorded during testing or activation.

### Health Score
Composite weighted score across all sources. With 6 active sources (EasyCep + 5 new), the platform health score reflects overall scraping success rate, data freshness, and error rates.

---

## 7. Remaining Blocked Sources

| Source | Slug | Reason | Blockers |
|--------|------|--------|----------|
| Sahibinden | `sahibinden` | Cloudflare anti-bot (requires ScrapingFish proxy), no unified adapter, missing `integration_type` | 3 |
| Satarız | `satariz` | No adapter — API integration only | 1 (no adapter) |
| Letgo | `letgo` | No adapter — API integration only | 1 (no adapter) |
| Facebook Marketplace | `facebook-marketplace` | No adapter — API integration only | 1 (no adapter) |
| Dolap | `dolap` | No adapter — API integration only | 1 (no adapter) |
| Gardrops | `gardrops` | No adapter — API integration only | 1 (no adapter) |

Sahibinden requires a separate sprint (P-14 or later) addressing ScrapingFish integration, Cloudflare bypass, and Sahibinden-specific adapter work. Satarız and peer-to-peer sources require `add-to-cart` integration_type which is explicitly out of scope for the current scrape-focused architecture.

---

## 8. Risk Observations

| Risk | Level | Mitigation |
|------|-------|------------|
| Anti-bot detection on commerce wrappers | **Low-Medium** | Circuit breakers per source (3-5 failures), `withRecoveryPolicy` auto-recovers. ScrapingFish fallback available per-source if needed. |
| Hepsiburada client-side rendering | **Medium** | Initial tests via `commerce.ts` use server-side HTML only. If inadequate, per-source fetch strategy or proxy can be added without adapter change (commerce.ts handles all 4 sources). |
| Getmobil JSON format changes | **Low** | Dedicated adapter isolates parsing logic. Circuit breaker + DLQ captures format errors immediately. |
| Rate limiting on any source | **Low** | Conservative `fetch_limit=20` initial. Can be raised per-source after observing success rates. |
| Duplicate detection on new listings | **None** | Existing duplicate engine works on `(source, external_id)` unique constraint. All sources provide stable `external_id`. |

---

## 9. Validation Summary

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ Pass (0 errors) |
| `npm test` (vitest) | ✅ 54/55 files pass (864 tests) — only pre-existing load test times out at scale=5000, unrelated to P-13 |
| `npm run build` | ✅ Pass (Turbopack, 64 routes compiled) |

SQL migration verified against idempotency pattern (each UPDATE guarded with `AND bot_listing_status = 'pending'`). PL/pgSQL verification block confirms post-activation state. No code changes were required — all infrastructure was pre-wired by P-12 audit.

---

## 10. Files Changed

| File | Type | Change |
|------|------|--------|
| `supabase/migrations/activate-production-sources.sql` | SQL (new) | 5 idempotent UPDATEs + PL/pgSQL verification block |
| `docs/SPRINT-P13-SOURCE_ACTIVATION_REPORT.md` | Docs (new) | This report |
| `supabase/migrations/products-add-category.sql` | SQL (new, from P-12) | category column for products |
| `supabase/migrations/products-backfill-category.sql` | SQL (new, from P-11.1) | category backfill (24 products) |
| `supabase/migrations/products-normalized-key.sql` | SQL (new) | normalized_key + unique index + trigger |
| `supabase/migrations/products-normalized-key-fix-v2.sql` | SQL (new) | RC fixes for PL/pgSQL key generation |
| `supabase/migrations/source-registry-reliability-score.sql` | SQL (new) | reliability_score column for source registry |
| `supabase/migrations/recovery-infrastructure.sql` | SQL (new) | dead_letter_queue table |

**Zero TypeScript/TSX files modified.** All activation was DB-state-only.

---

## Appendix: Migration Execution Order

```sql
-- 1. Foundation (pre-existing)
supabase/migrations/recovery-infrastructure.sql         -- dead_letter_queue
supabase/migrations/source-registry-reliability-score.sql -- reliability_score

-- 2. Product infrastructure (P-11, P-12)
supabase/migrations/products-add-category.sql            -- category column
supabase/migrations/products-backfill-category.sql       -- category backfill
supabase/migrations/products-normalized-key.sql          -- normalized_key
supabase/migrations/products-normalized-key-fix-v2.sql   -- RC fixes

-- 3. Source activation (this sprint)
supabase/migrations/activate-production-sources.sql      -- bot_listing_status + cron + fetch_limit
```
