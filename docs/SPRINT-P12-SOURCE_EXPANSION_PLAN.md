# Sprint P-12 — Source Expansion Audit & Activation Roadmap

**Date:** 2026-07-19  
**Status:** Audit complete — no code changes  
**Scope:** All 10 configured sources in the database, all adapter implementations, all scraper infrastructure

---

## Executive Summary

The platform has **10 configured sources** in the database, **3 with working scrapers**, and only **1 actively publishing** (EasyCep). This audit classifies every source across 8 dimensions and produces a ranked activation roadmap.

**Quick wins (zero new code):** Getmobil, Yenilenmiş Market, Teknosa, MediaMarkt — all have working adapters, just need DB status changes and testing.

**Blockers:** Letgo and Facebook Marketplace have no adapters and face extreme anti-bot difficulty. Satarız has no adapter but lower anti-bot risk.

**High-value target:** Sahibinden has a full 318-line adapter but is blocked by Cloudflare anti-bot and missing integration_type configuration.

---

## 1. Source Classification Matrix

| # | Source | Slug | Type | Status | Reliability | Adapter | Antibot | Est. Listings/Day | Priority |
|---|--------|------|------|--------|-------------|---------|---------|------------------:|----------|
| 1 | EasyCep | easycep | refurbished | **Production Ready** | 92 | Full (228 lines) | None | ~50 | Active |
| 2 | Getmobil | getmobil | refurbished | **Needs Status Change** | 90 | Full (307 lines) | None | ~30 | P0 |
| 3 | Yenilenmiş Market | yenilenmis-market | refurbished | **Needs Testing** | 87 | Commerce wrapper | Low | ~20 | P1 |
| 4 | Teknosa Yenilenmiş | teknosa-yenilenmis | refurbished | **Needs Testing** | 86 | Commerce wrapper | Medium | ~40 | P1 |
| 5 | Hepsiburada Yenilenmiş | hepsiburada-yenilenmis | refurbished | **Needs Testing** | 85 | Commerce wrapper | Medium-High | ~60 | P1 |
| 6 | MediaMarkt Yenilenmiş | mediamarkt-yenilenmis | refurbished | **Needs Testing** | 84 | Commerce wrapper | Medium | ~30 | P1 |
| 7 | Sahibinden | sahibinden | marketplace | **Blocked (Config + Anti-bot)** | 68 | Full (318 lines) | Hard (CF) | ~200+ | P2 |
| 8 | Satarız | satariz | refurbished | **Blocked (No Adapter)** | 65 | None | Unknown | ~10 | P3 |
| 9 | Letgo | letgo | marketplace | **Blocked (No Adapter)** | 60 | None | Very Hard | ~100+ | P4 |
| 10 | Facebook Marketplace | facebook-marketplace | marketplace | **Blocked (No Adapter)** | 58 | None | Extreme | ~200+ | P5 |

---

## 2. Active Source — Production Ready

### EasyCep (easycep)
- **Current state:** `bot_listing_status = published`, `is_active = true`, integration_type = scrape
- **Adapter:** `lib/bots/adapters/easycep.ts` (228 lines) — standalone parser with JSON-LD + DOM fallback
- **Unified adapter:** `lib/unified-source-engine/adapters/easycep-unified.ts` — fully registered
- **SCRAPE_FETCHER:** Yes, wrapped with `withRecoveryPolicy` (5 failures, 30s half-open)
- **Reliability score:** 92
- **Anti-bot:** None — direct HTML fetch works reliably
- **Parsing quality:** HIGH — JSON-LD structured data with `@type: Product`, SHA1 external_id from URL
- **Estimated daily output:** ~50 listings per run
- **Maintenance cost:** LOW — stable JSON-LD schema, no anti-bot changes expected
- **Recommendation:** Already in production. Monitor via existing alerts. No changes needed.

---

## 3. Near-Activation Sources — Need Status Changes Only

### Getmobil (getmobil)
- **Current state:** `bot_listing_status = pending`, `is_active = true`, `integration_type = scrape` (set by bot-scheduler.sql)
- **Adapter:** `lib/bots/adapters/getmobil.ts` (307 lines) — JSON-LD with `@graph`/`ProductGroup` support, URL validation
- **Unified adapter:** `lib/unified-source-engine/adapters/getmobil-unified.ts` — fully registered
- **SCRAPE_FETCHER:** Yes, wrapped with `withRecoveryPolicy` (5 failures, 30s half-open)
- **Reliability score:** 90
- **Anti-bot:** None — direct HTML fetch works
- **Parsing quality:** HIGH — JSON-LD structured data
- **Estimated daily output:** ~30 listings per run
- **Effort to activate:** **MINIMAL** — only requires setting `bot_listing_status = 'published'` in the DB
- **Risk:** LOW — adapter already tested and battle-hardened alongside EasyCep
- **Blockers:** None. The adapter, SCRAPE_FETCHER, unified adapter, and circuit breaker are all in place. Only DB status prevents production runs.
- **Recommendation:** Activate immediately. This is the highest-ROI zero-code-change source.

#### Required changes to activate:
```sql
-- 1. Set bot_listing_status to published
UPDATE sources SET bot_listing_status = 'published' WHERE slug = 'getmobil';

-- 2. Enable cron (optional, for scheduled runs)
UPDATE sources SET cron_enabled = true WHERE slug = 'getmobil';

-- 3. Set fetch_limit (recommended: start with 30-40)
UPDATE sources SET fetch_limit = 40 WHERE slug = 'getmobil';
```

Then run a real test from the admin UI to verify before enabling cron.

---

## 4. Commerce Wrapper Sources — Need Testing

These four sources share the shared commerce adapter (`lib/bots/adapters/commerce.ts`, 467 lines). They all follow the same pattern: fetch category page HTML → parse JSON-LD + DOM cards → deduplicate → validate images.

### Yenilenmiş Market (yenilenmis-market)
- **Current state:** `bot_listing_status = pending`, `integration_type = scrape`
- **Scrape URL:** `https://www.yenilenmismarket.com/`
- **Reliability:** 87
- **Anti-bot:** LOW — smaller site, likely no Cloudflare
- **Estimated daily:** ~20 listings
- **Effort:** LOW — test one run, check parsing quality, then activate
- **Risk:** LOW — shared adapter handles structural changes via fallback chain
- **Known unknowns:** Whether the homepage URL returns sufficient product listings (it's the root domain, not a category page)

### Teknosa Yenilenmiş (teknosa-yenilenmis)
- **Current state:** `bot_listing_status = pending`, `integration_type = scrape`
- **Scrape URL:** `https://www.teknosa.com/arama/?s=yenilenmi%C5%9F`
- **Reliability:** 86
- **Anti-bot:** MEDIUM — major Turkish retailer. May have rate limiting or bot detection.
- **Estimated daily:** ~40 listings
- **Effort:** LOW — test one run, check for anti-bot blocks
- **Risk:** MEDIUM — anti-bot detection may require ScrapingFish proxy integration

### Hepsiburada Yenilenmiş (hepsiburada-yenilenmis)
- **Current state:** `bot_listing_status = pending`, `integration_type = scrape`
- **Scrape URL:** `https://www.hepsiburada.com/ara?q=yenilenmi%C5%9F`
- **Reliability:** 85
- **Anti-bot:** MEDIUM-HIGH — one of Turkey's largest e-commerce sites. Likely has sophisticated bot detection.
- **Estimated daily:** ~60 listings
- **Effort:** LOW to test, potentially MEDIUM if anti-bot is triggered
- **Risk:** MEDIUM-HIGH — may require ScrapingFish proxy; search results page may differ from product listing pages
- **Note:** Hepsiburada uses client-side rendering for parts of their search results, which may reduce parseable HTML from the initial server response

### MediaMarkt Yenilenmiş (mediamarkt-yenilenmis)
- **Current state:** `bot_listing_status = pending`, `integration_type = scrape`
- **Scrape URL:** `https://www.mediamarkt.com.tr/tr/search.html?query=yenilenmi%C5%9F`
- **Reliability:** 84
- **Anti-bot:** MEDIUM — major retailer, but MediaMarkt generally has weaker anti-bot than Hepsiburada
- **Estimated daily:** ~30 listings
- **Effort:** LOW to test
- **Risk:** LOW-MEDIUM — search page structure may change

### Commerce Wrapper Activation Plan

For all four sources, the activation sequence is identical:

1. Run a real test from admin UI (1-2 runs per source)
2. Inspect parsed listing quality — check title, price, image extraction
3. If results are clean, set `bot_listing_status = 'published'` and `cron_enabled = true`
4. Start with `fetch_limit = 20` and ramp up over 1 week
5. Monitor `bot_runs` table and alert engine for error spikes

Recommended order: **Yenilenmiş Market → Teknosa → MediaMarkt → Hepsiburada** (least to most anti-bot risk).

---

## 5. Source With Existing Adapter — Configuration Blocked

### Sahibinden (sahibinden)
- **Current state:** `bot_listing_status = pending`, `is_active = true`, **`integration_type` is NOT set to `'scrape'`**
- **Adapter:** `lib/bots/adapters/sahibinden.ts` (318 lines) — standalone parser with Cloudflare detection, ScrapingFish proxy support, 18 brand regex patterns
- **Unified adapter:** ❌ **MISSING** — no entry in `lib/unified-source-engine/adapters/`
- **SCRAPE_FETCHER:** ✅ Yes, wrapped with `withRecoveryPolicy` (3 failures, 45s half-open)
- **Admin UI block:** Excluded from `realScrapeSourceSlugs` in `source-manager.tsx` — "real test" button is disabled
- **Reliability score:** 68
- **Anti-bot difficulty:** **HIGH** — Cloudflare protection detected. Adapter has proxy support but it's gated behind `SCRAPINGFISH_API_KEY` env var
- **Parsing quality:** MEDIUM — DOM-based parsing (no JSON-LD), category listing parser works (`data-id` attribute), product page parser now has external_id (fixed in P-11.1)
- **Estimated daily:** ~200+ listings (Turkey's largest classifieds platform)
- **Business value:** **VERY HIGH** — the broadest inventory of used phones in Turkey
- **Total blocked by:** 3 distinct blockers

#### Blocker 1 — Missing integration_type
The `bot-scheduler.sql` migration only sets `integration_type = 'scrape'` for the 6 refurbished sources. Sahibinden was intentionally excluded.

**Fix:** `UPDATE sources SET integration_type = 'scrape' WHERE slug = 'sahibinden';`

#### Blocker 2 — Cloudflare Anti-Bot
The adapter already handles this (line ~70 in sahibinden.ts checks for Cloudflare challenge page), but the ScrapingFish proxy integration needs to be validated end-to-end. The `anti-bot-proxy.ts` file exists at `lib/bots/anti-bot-proxy.ts` and uses ScrapingFish API when `SCRAPINGFISH_API_KEY` is set.

**Fix:** Ensure `SCRAPINGFISH_API_KEY` env var is configured in production, then run a real test.

#### Blocker 3 — No Unified Adapter
Unlike EasyCep and Getmobil, Sahibinden has no unified source adapter. The `getStandardSourceAdapter()` fallback chain falls through to wrapping the connector in `createStandardSourceAdapter()` (generic wrapper). This works but is less robust.

**Fix:** Create `lib/unified-source-engine/adapters/sahibinden-unified.ts` following the easycep/getmobil pattern.

#### Recommendation
Sahibinden activation requires 3 separate tracks:
1. **Immediate (config):** Set `integration_type = 'scrape'` — zero code, zero risk
2. **Short-term (infra):** Validate ScrapingFish proxy in production with a manual test run
3. **Medium-term (code):** Build unified adapter, then unblock admin UI `realScrapeSourceSlugs`

**Risk:** If ScrapingFish proxy cost is prohibitive at scale, Sahibinden may need a different approach (e.g., rotating proxies or reduced crawl frequency).

---

## 6. Sources Without Adapters — Blocked

### Satarız (satariz)
- **Current state:** `bot_listing_status = pending`, `integration_type` not set
- **Adapter:** ❌ **NONE** — no file exists in `lib/bots/adapters/`
- **SCRAPE_FETCHER:** ❌ NOT registered
- **Circuit breaker:** NOT configured — no entry in `CircuitBreakerRegistry`
- **Reliability score:** 65 (default — no reliability data)
- **Anti-bot difficulty:** UNKNOWN — site would need investigation
- **Estimated daily:** ~10-20 listings (newer/smaller platform)
- **Effort to build:** MEDIUM — would need a new adapter file (~100-200 lines), likely can use commerce.ts or create a standalone parser
- **Business value:** MEDIUM — additional refurbished inventory
- **Recommendation:** Schedule for Sprint P-13+. Requires adapter development from scratch. Start with site structure analysis and test fetching.

### Letgo (letgo)
- **Current state:** `bot_listing_status = pending`, `integration_type` not set
- **Adapter:** ❌ **NONE**
- **SCRAPE_FETCHER:** ❌ NOT registered
- **Circuit breaker:** NOT configured
- **Reliability score:** 60
- **Anti-bot difficulty:** **VERY HIGH** — P2P marketplace with dynamic content loading, aggressive anti-scraping
- **Estimated daily:** ~100+ listings (if scraping were possible)
- **Business value:** HIGH — large P2P inventory, unique pricing
- **Effort to build:** VERY HIGH — likely requires headless browser (Puppeteer/Playwright) for dynamic content + proxy rotation + session management
- **Recommendation:** De-prioritize. Would require infrastructure beyond the current Cheerio-based scraping approach. Evaluate headless browser integration as a separate project (Sprint P-15+).

### Facebook Marketplace (facebook-marketplace)
- **Current state:** `bot_listing_status = pending`, `integration_type` not set
- **Adapter:** ❌ **NONE**
- **SCRAPE_FETCHER:** ❌ NOT registered
- **Circuit breaker:** NOT configured
- **Reliability score:** 58
- **Anti-bot difficulty:** **EXTREME** — Meta's anti-scraping is industry-leading, requires authenticated session, constantly evolving detection
- **Estimated daily:** ~200+ listings (if possible)
- **Business value:** VERY HIGH — massive inventory
- **Effort to build:** EXTREME — would require authenticated GraphQL API access, OAuth token management, or commercial anti-detect browser solution
- **Recommendation:** **Deprecated for scraping.** Facebook Marketplace should not be pursued via scraping. If integration is desired, explore official Meta API/partnership route (separate initiative, not a sprint task).

---

## 7. Cross-Cutting Technical Observations

### 7.1 Adapter System Fragmentation
The codebase has **3 parallel adapter systems**:

| System | Location | Sources Covered |
|--------|----------|-----------------|
| Unified Source Engine | `lib/unified-source-engine/adapters/` | easycep, getmobil (2/10) |
| SCRAPE_FETCHERS | `lib/bots/connectors.ts` | 7/10 (all except letgo, facebook, satariz) |
| Legacy StandardSourceAdapter | `lib/bots/adapters/types.ts` | Deprecated |

**Impact:** Sahibinden and the 4 commerce sources fall through to the generic connector wrapper path, bypassing the newer unified adapter infrastructure. Each new source requires adding 2-3 integration points.

### 7.2 Commerce Adapter Shared Dependency
All 4 commerce sources share `commerce.ts` (467 lines). This is efficient for maintenance but creates a **single point of failure** — a structural change at any one retailer could break all 4. The JSON-LD + DOM fallback chain mitigates this but doesn't eliminate it.

### 7.3 Reliability Score Gaps
3 sources (Satarız, Letgo, Facebook) have reliability scores of 58-65 — the default value. Zero actual data exists to validate these scores. They should be treated as "unknown" rather than "low confidence."

### 7.4 Circuit Breaker Coverage Gap
3 sources (Satarız, Letgo, Facebook) have no circuit breaker configuration. If they're activated in the future, circuit breakers must be added first.

### 7.5 Admin UI Type Mismatch
The admin UI dropdown offers 4 source types (`marketplace`, `refurbished`, `retailer`, `other`) but the DB CHECK constraint only allows 2 (`marketplace`, `refurbished`). This doesn't block current activation but should be fixed before adding new source types.

---

## 8. Parsing Quality Comparison

| Source | Method | External ID | Specs Extraction | Image Validation | Category Detection |
|--------|--------|-------------|------------------|------------------|-------------------|
| EasyCep | JSON-LD + DOM | SHA1(url) | From title + specs | ✅ HEAD check | Via normalization engine |
| Getmobil | JSON-LD @graph | From URL | From title + specs | ✅ HEAD check | Via normalization engine |
| Sahibinden | DOM only | From URL regex | 18 brand patterns | ✅ HEAD check | Via normalization engine |
| Commerce sources | JSON-LD + DOM | SHA1(url) or SKU | `inferSpecs()` in commerce.ts | ✅ HEAD check + 80ms delay | Via commerce.ts `inferCategory()` |

**Key gap:** Commerce sources use a different category detection (`inferCategory()` in commerce.ts, line 342) than the normalization engine's `detectCategory()`. This means the same product may get different category labels depending on the parsing path.

---

## 9. Ranked Activation Roadmap

### Phase 0 — Immediate Activation (This Week)
| Source | Effort | Est. Additional Listings/Day | Risk | Cumulative Total |
|--------|--------|---------------------------:|------|-----------------:|
| Getmobil | 5 min (DB update) | +30 | Low | 80/day |

**Actions:**
1. Set `bot_listing_status = 'published'` for getmobil
2. Run 1 real test from admin UI
3. Verify listing quality in listings table
4. If clean: enable cron (`cron_enabled = true`)

### Phase 1 — Commerce Source Testing (Next Week)
| Source | Effort | Est. Additional Listings/Day | Risk | Cumulative Total |
|--------|--------|---------------------------:|------|-----------------:|
| Yenilenmiş Market | 30 min (test + activate) | +20 | Low | 100/day |
| Teknosa Yenilenmiş | 30 min | +40 | Medium | 140/day |
| MediaMarkt Yenilenmiş | 30 min | +30 | Low-Medium | 170/day |
| Hepsiburada Yenilenmiş | 1-2 hr | +60 | Medium-High | 230/day |

**Actions per source:**
1. Run 1-2 real tests from admin UI (starting with fetch_limit=10)
2. Inspect parsed listings in `bot_runs` → verify title, price, image quality
3. If ≥80% listings have clean data: activate
4. If anti-bot blocks: add ScrapingFish proxy support to commerce.ts
5. Ramp `fetch_limit` from 20 → 40 over 1 week
6. Enable cron after 3 successful scheduled runs

**Fallback for Hepsiburada:** If server-side HTML doesn't contain enough listings, consider using `safeFetchHtml` with additional headers or evaluating whether a ScrapingFish proxy pass helps.

### Phase 2 — Sahibinden Activation (Sprint P-13)
| Source | Effort | Est. Additional Listings/Day | Risk | Cumulative Total |
|--------|--------|---------------------------:|------|-----------------:|
| Sahibinden | 1-2 sprints | +200 | High | 430/day |

**Dependencies:**
1. ✅ Existing adapter (sahibinden.ts, 318 lines)
2. ✅ ScrapingFish proxy (anti-bot-proxy.ts exists)
3. ❌ `integration_type` not set to `'scrape'`
4. ❌ Unified adapter missing
5. ❌ Admin UI blocks real test button
6. ❌ ScrapingFish API key needs production validation

**Work breakdown:**
1. DB: `UPDATE sources SET integration_type = 'scrape'` (5 min)
2. Infra: Create `sahibinden-unified.ts` (2-3 hr, follows easycep/getmobil pattern)
3. Infra: Add to `ADAPTER_FACTORIES` in unified-source-engine adapters index
4. Config: Verify `SCRAPINGFISH_API_KEY` in production
5. Admin UI: Add `'sahibinden'` to `realScrapeSourceSlugs`
6. Test: Run real test with fetch_limit=5, inspect results
7. Scale: Ramp to fetch_limit=30 over 2 weeks

### Phase 3 — New Source Development (Sprint P-14+)
| Source | Effort | Est. Additional Listings/Day | Risk | Cumulative Total |
|--------|--------|---------------------------:|------|-----------------:|
| Satarız | 1 sprint | +10-20 | Medium | 440-450/day |

**Requirements for new source:**
1. Site structure analysis (fetch homepage, category pages, product pages)
2. Adapter development (standalone or commerce-based)
3. SCRAPE_FETCHER registration in connectors.ts
4. Circuit breaker configuration in recovery
5. Unified adapter if following current architecture
6. Admin UI realScrapeSourceSlugs update
7. reliability_score data collection (start at 65, adjust after 10 runs)

### Phase 4 — Strategic Evaluation (Future)
| Source | Effort | Est. Additional Listings/Day | Recommendation |
|--------|--------|---------------------------:|----------------|
| Letgo | 2-3 sprints | +100 | Evaluate headless browser infra first |
| Facebook Marketplace | 5+ sprints | +200 | Deprecated for scraping. Consider API partnership. |

---

## 10. Risk Register

| Risk | Source(s) | Likelihood | Impact | Mitigation |
|------|-----------|------------|--------|------------|
| Commerce adapter breaks for all 4 sources | hepsiburada, teknosa, mediamarkt, yenilenmis-market | Medium | High (all 4 sources down) | JSON-LD + DOM fallback already built in; monitor first 5 runs per source |
| Anti-bot blocks Hepsiburada | hepsiburada-yenilenmis | Medium-High | Medium (1 source) | Add ScrapingFish proxy as per-source option in commerce.ts |
| ScrapingFish API cost | sahibinden | Medium | Medium | Monitor cost per listing; set fetch_limit cap; consider cache layer |
| Duplicate listing flood | All new sources | Low | Medium | (source, external_id) unique index already in place; duplicate engine handles cross-source dedup |
| Category mismatch between parser paths | Commerce sources | Medium | Low | Category is informational, not structural; normalization engine will correct on product match |
| CF challenge pattern changes | sahibinden | High | High | Requires active maintenance; assign monitoring rotation |

---

## 11. Effort Summary

| Phase | Sources | Estimated Effort | New Listings/Day | Risk Profile |
|-------|---------|-----------------|-----------------:|--------------|
| P0 (this week) | Getmobil | 5 min | +30 | Minimal |
| P1 (next week) | 4 commerce sources | 4-5 hr total | +150 | Low-Medium |
| P2 (Sprint P-13) | Sahibinden | 1-2 sprints | +200 | High |
| P3 (Sprint P-14+) | Satarız | 1 sprint | +10-20 | Medium |
| P4 (Future) | Letgo, Facebook | 7+ sprints total | +300 | Very High |

**Total potential:** ~430-450 listings/day if all Phase 0-3 sources activate.  
**Current baseline:** ~50 listings/day (EasyCep only) — **~8-9x increase** possible.

---

## 12. Recommendations

1. **Activate Getmobil today** — zero-code change, 5-minute DB update, +60% listing volume
2. **Test commerce sources immediately after** — Yenilenmiş Market first (lowest risk), then Teknosa, MediaMarkt, Hepsiburada last
3. **Assign Sahibinden to Sprint P-13** — highest single-source value (+200/day) but requires careful anti-bot validation
4. **Defer Satarız to Sprint P-14** — moderate value, full adapter build needed
5. **Deprecate Facebook Marketplace scraping** — not feasible with current infrastructure. Remove from active consideration unless official API access is obtained
6. **De-prioritize Letgo** — P2P scraping is high-effort, high-maintenance. Re-evaluate if headless browser infrastructure is built for other reasons

---

## Appendix A: Adapter Inventory

| File | Type | Lines | Source |
|------|------|-------|--------|
| `lib/bots/adapters/easycep.ts` | Standalone parser | 228 | EasyCep |
| `lib/bots/adapters/getmobil.ts` | Standalone parser | 307 | Getmobil |
| `lib/bots/adapters/sahibinden.ts` | Standalone + anti-bot | 318 | Sahibinden |
| `lib/bots/adapters/commerce.ts` | Shared commerce adapter | 467 | 4 commerce sources |
| `lib/bots/adapters/hepsiburada-yenilenmis.ts` | Commerce config | 19 | Hepsiburada |
| `lib/bots/adapters/teknosa-yenilenmis.ts` | Commerce config | 19 | Teknosa |
| `lib/bots/adapters/mediamarkt-yenilenmis.ts` | Commerce config | 19 | MediaMarkt |
| `lib/bots/adapters/yenilenmis-market.ts` | Commerce config | 19 | Yenilenmiş Market |
| `lib/unified-source-engine/adapters/easycep-unified.ts` | Unified adapter | — | EasyCep |
| `lib/unified-source-engine/adapters/getmobil-unified.ts` | Unified adapter | — | Getmobil |
| `lib/bots/anti-bot-proxy.ts` | ScrapingFish proxy | — | Sahibinden (and future) |

## Appendix B: DB Source Configuration

```sql
-- Current source states (from sources table)
SELECT slug, bot_listing_status, integration_type, cron_enabled, 
       fetch_limit, is_active, total_imported, last_success
FROM sources
ORDER BY 
  CASE bot_listing_status WHEN 'published' THEN 0 ELSE 1 END,
  slug;
```

| slug | bot_listing_status | integration_type | cron_enabled | fetch_limit | is_active | total_imported |
|------|-------------------|-----------------|:------------:|:-----------:|:---------:|:--------------:|
| easycep | published | scrape | true | 60 | true | ~500+ |
| getmobil | pending | scrape | false | 30 | true | 0 |
| yenilenmis-market | pending | scrape | false | 20 | true | 0 |
| teknosa-yenilenmis | pending | scrape | false | 20 | true | 0 |
| hepsiburada-yenilenmis | pending | scrape | false | 20 | true | 0 |
| mediamarkt-yenilenmis | pending | scrape | false | 20 | true | 0 |
| sahibinden | pending | manual | false | 10 | true | 0 |
| satariz | pending | manual | false | 10 | true | 0 |
| letgo | pending | manual | false | 10 | true | 0 |
| facebook-marketplace | pending | manual | false | 10 | true | 0 |

## Appendix C: Previous Production Metrics (from Sprint P-11 Audit)

| Metric | Value |
|--------|-------|
| Total products | 39 |
| Total listings | ~150 |
| Active sources | EasyCep (published) |
| Pending sources | 9 |
| Listings without product match | ~0 (post-matcher) |
| Product categories covered | Telefon, Oyun Konsolu, Ekran Kartı, Laptop, Tablet, Aksesuar |

---

*End of Sprint P-12 Source Expansion Audit. No code changes were made — this is a planning document only.*
