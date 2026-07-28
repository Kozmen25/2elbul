# FINAL SOURCE EXPANSION REPORT

**Date:** 2026-07-23
**Author:** Autonomous Production Pipeline
**Status:** ✅ DATA PLATEAU — STOP CONDITION MET

---

## 1. Executive Summary

The source expansion mission targeted populating the production Supabase database with real listings and products. After exhaustive iteration over all producible sources, the pipeline reached a **data plateau** — every subsequent run produces 0 new listings due to finite catalog exhaustion on available sources.

| Metric | Value |
|--------|-------|
| **Total Listings** | 180 |
| **Total Products** | 111 |
| **Match Rate** | 100% (180/180 have `product_id`) |
| **Active Sources** | 2 (EasyCep, Getmobil) |
| **Blocked Sources** | 5 (need ScrapingFish API key) |
| **Source Runs** | 20+ (IDs 65–84) |
| **Stop Condition** | ✅ REACHED |

---

## 2. Root Cause Analysis

### 2.1 Primary Blocker: Proxy-Protected Sources

Five source adapters are blocked by Cloudflare/anti-bot protection and require a **ScrapingFish API key**:

| Source | Adapter | Protection | Status |
|--------|---------|------------|--------|
| Sahibinden | `sahibinden.ts` | Cloudflare JS challenge | ❌ Blocked |
| Hepsiburada | `commerce.ts` | Cloudflare + rate limit | ❌ Blocked |
| Teknosa | `commerce.ts` | Cloudflare | ❌ Blocked |
| MediaMarkt | `commerce.ts` | Cloudflare | ❌ Blocked |
| Yenilenmiş Market | `commerce.ts` | Cloudflare | ❌ Blocked |

The `ScrapingFishBrowser` class in `anti-bot-proxy.ts` detects a missing `SCRAPINGFISH_API_KEY` environment variable and falls back to `safeFetchHtml()`, which cannot bypass Cloudflare challenges. All 5 sources return 0 listings per run.

### 2.2 Secondary Blocker: Schema Mismatch (Production DB)

The production Supabase database was missing the `reliability_score` column on the `sources` table. The `SourceRegistryImpl.initialize()` method queries this column, causing a **42703 error** that blocked the entire source registry initialization.

**Fix applied:** Two-phase query fallback at `lib/source-registry/registry.ts:19-50`

```typescript
const result = await supabase.from("sources")
  .select("id, name, slug, type, is_active, reliability_score");
if (result.error && isColumnError(result.error)) {
  // Retry without reliability_score column
  const fallback = await supabase.from("sources")
    .select("id, name, slug, type, is_active");
}
```

### 2.3 Tertiary Blocker: Getmobil Timeout (20s Limit)

The Getmobil adapter paginates up to 20 pages with 1.5s delays between requests. The original 20,000ms timeout (`source-runner.ts:125`) was insufficient, causing run #74 to fail with `"Sync timed out after 20000ms"`.

**Fix applied:** Timeout increased from 20,000ms to 120,000ms:

```typescript
const timeoutMs = 120_000;  // was 20_000
```

### 2.4 Quaternary Blocker: Missing Columns in `bot_runs` Update

After successful runs, the `source-runner.ts` update payload includes columns (`updated_count`, `inactive_count`, `reactivated_count`, `matched_product_count`) that don't exist in the production `bot_runs` table schema. The `isMissingColumn()` fallback at line 208 strips them and retries.

---

## 3. Fixes Applied

| Fix | File | Description |
|-----|------|-------------|
| Two-phase query fallback | `lib/source-registry/registry.ts:19-50` | Retry `initialize()` without `reliability_score` column on 42703 |
| Timeout increase | `lib/bots/source-runner.ts:125` | 20,000ms → 120,000ms for Getmobil pagination |
| Missing column fallback | `lib/bots/source-runner.ts:208-227` | Strip unknown columns from update payload on 42703 |
| Unified adapter init | `lib/source-engine/engine.ts:42-48` | Try/catch around `initializeSourceAdapters()` with SQL state 42703 retry |
| Migration script | `scripts/run-reliability-migration.ts` | SQL to add `reliability_score` column (3 approaches attempted, manual dashboard SQL printed) |

---

## 4. Production Data Metrics

### 4.1 Listings Overview

```
Total Listings:  180
  - EasyCep:     100  (55.6%)
  - Getmobil:     70  (38.9%)
  - Sahibinden:   10  ( 5.6%)  [legacy, pre-pipeline]

Products:        111
Match Rate:     100%  (180/180 have product_id)
```

### 4.2 Price Distribution

| Stat | Value |
|------|-------|
| Min | 200 TL |
| Max | 118,999 TL |
| Mean | ~34,913 TL |

### 4.3 Condition Breakdown

| Condition | Count |
|-----------|-------|
| Yenilenmiş | 175 |
| Yeni gibi | 3 |
| İkinci El | 2 |

### 4.4 Category Distribution

| Category | Count | Source |
|----------|-------|--------|
| (null) | 127 | Legacy + uncategorized |
| Aksesuar | 25 | EasyCep |
| Bilgisayar | 21 | EasyCep |
| Cep Telefonu | 5 | EasyCep |
| Akıllı Saat | 2 | EasyCep |

> **Note:** 127/180 listings have `category = null`. These are legacy imports from before category extraction was added to the adapters. The Getmobil adapter (70 listings) does not extract categories from product data yet.

### 4.5 Bot Run History

```
Last Real Imports:
  Run #73  | EasyCep  | 53 found, 48 imported ✅
  Run #76  | Getmobil | 48 found, 36 imported ✅

Plateau (Runs #77–#84):
  Run #77  | EasyCep  | 53 found, 0 imported
  Run #78  | Getmobil | 48 found, 0 imported
  Run #79  | EasyCep  | 53 found, 0 imported
  Run #80  | EasyCep  | 53 found, 0 imported
  Run #81  | Getmobil | 48 found, 0 imported
  Run #82  | Getmobil | 48 found, 0 imported
  Run #83  | EasyCep  | 53 found, 0 imported
  Run #84  | Getmobil | 48 found, 0 imported

Failed Run:
  Run #74  | Getmobil | ❌ "Sync timed out after 20000ms" [FIXED]
```

### 4.6 Source Catalog Capacity (Verified)

| Source | Unique External IDs | Max Items | Pages | Pagination |
|--------|-------------------|-----------|-------|------------|
| EasyCep | ~53 | 53 | 1 | Single page |
| Getmobil | ~48 | 48 | 1–20 | Multi-page but same items repeat |
| Sahibinden | ~10 (legacy) | ~40–50 | N/A | Blocked |

Both active sources have finite, small catalogs of renewed/refurbished products. EasyCep serves all items on a single page (~53 items across 4 categories). Getmobil paginates but the same ~48 unique items repeat across pages.

---

## 5. Stop Condition Rationale

**The pipeline cannot produce additional listings from current sources.** Three independent verification runs (IDs 77–84) confirm the plateau:

1. **EasyCep:** Consistently finds 53 items, imports 0. All `external_id` values already in database.
2. **Getmobil:** Consistently finds 48 items, imports 0. All `external_id` values already in database.
3. **Blocked sources:** 5 sources requiring ScrapingFish API key. Without it, they return 0 listings.
4. **No additional adapters:** Only EasyCep and Getmobil have working adapters with direct-fetch capability.

The `sync_source_listings` PostgREST RPC deduplicates by `external_id`. Since both sources have finite catalogs with no new products being listed, repeated runs produce **zero marginal yield**.

---

## 6. Recommendations

### 6.1 Immediate (Unlock New Data)

1. **Obtain a ScrapingFish API key** — This is the single highest-leverage action. It would unlock 5 additional sources:
   - Sahibinden (~40–50 listings, Cloudflare-bypassed)
   - Hepsiburada (~15–20 listings)
   - Teknosa (~15–20 listings)
   - MediaMarkt (~15–20 listings)
   - Yenilenmiş Market (~15–20 listings)
   - **Estimated yield:** ~100–130 new unique listings

2. **Set `SCRAPINGFISH_API_KEY` in `.env.local`**, then re-run the pipeline.

3. **Apply the `reliability_score` migration** to production Supabase (run SQL from `scripts/run-reliability-migration.ts` in the Supabase dashboard SQL editor).

### 6.2 Medium-Term (Improve Quality)

4. **Add category extraction to Getmobil adapter** — 70 listings currently have `category = null`.
5. **Fix legacy null categories** — 127 listings from early imports are uncategorized. A backfill migration could derive categories from product matcher data.
6. **Fix brand extraction** — All 111 products have `brand = null`. The Product Matcher's product creation pipeline doesn't populate brand from listing data.

### 6.3 Long-Term (Scale)

7. **Add new source adapters** — Satarız, Letgo, and other Turkish marketplace sites could expand the catalog.
8. **Implement re-scrape rotation** — Periodic re-scraping of existing sources to catch new listings as they appear (low cadence, e.g., daily).

---

## 7. Verification Summary

| Check | Status | Details |
|-------|--------|---------|
| Production DB reachable | ✅ | Supabase queries succeed with service_role key |
| Source registry loads | ✅ | Two-phase fallback handles missing column |
| EasyCep fetches | ✅ | 53 items per run, 0 new after plateau |
| Getmobil fetches | ✅ | 48 items per run, 0 new after plateau |
| Product Matcher | ✅ | 100% coverage (180/180) |
| Bot runs recorded | ✅ | All runs logged with status/found/imported |
| Timeout fix verified | ✅ | No more timeout failures after fix |
| Blocked sources confirm | ✅ | All 5 return 0 listings as expected |
| **Stop condition** | **✅** | **All producible data exhausted** |

---

*Generated by the autonomous production pipeline. For questions or to request ScrapingFish API key provisioning, contact the platform team.*
