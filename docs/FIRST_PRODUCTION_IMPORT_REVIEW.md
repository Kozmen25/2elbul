# First Production Import Review — 10,000 Listing Simulation

**Date:** 2026-07-11
**Author:** Claude (automated pipeline audit)
**Scope:** Trace the full import pipeline for 10,000 real listings from currently supported sources, identify every bottleneck, assess severity, and determine which fixes are required before launch.

---

## Table of Contents

1. [Pipeline Overview](#1-pipeline-overview)
2. [Stage 1: Source Adapter (HTTP Scraping)](#2-stage-1-source-adapter)
3. [Stage 2: Normalization](#3-stage-2-normalization)
4. [Stage 3: Product Matcher — PRIMARY BOTTLENECK](#4-stage-3-product-matcher)
5. [Stage 4: Duplicate Engine](#5-stage-4-duplicate-engine)
6. [Stage 5: Database Writes](#6-stage-5-database-writes)
7. [Stage 6: Search Index](#7-stage-6-search-index)
8. [Stage 7: Market Intelligence](#8-stage-7-market-intelligence)
9. [Stage 8: Frontend](#9-stage-8-frontend)
10. [Batch Matcher Deployment Plan](#10-batch-matcher-deployment-plan)
11. [Bottleneck Summary Table](#11-bottleneck-summary-table)
12. [Risk Assessment: Launch Without Batch Matcher](#12-risk-assessment)

---

## 1. Pipeline Overview

```
Source Adapter → Normalization → Product Matcher → Duplicate Engine → Database → Search Index → Market Intelligence → Frontend
     │                 │                 │                    │              │             │                  │
     ▼                 ▼                 ▼                    ▼              ▼             ▼                  ▼
  HTTP scrape       CPU-only          N+1 DB ops          O(n²) cmp     Bulk upsert    No dedicated      On-request
  30s/proxy         ~500K regex       30K round-trips      1.2K-5K/pair   + per-row     index found       computation
  + cheerio         ~3s total         UNSUSTAINABLE                        price history
```

**Total estimated wall-clock for 10K listings WITHOUT Batch Matcher deployment:**

| Source | Estimated Time | Dominant Factor |
|--------|---------------|-----------------|
| Sahibinden (via proxy) | 60-90 minutes | HTTP scraping + per-row product matching |
| Sahibinden (direct) | 25-40 minutes | Per-row product matching dominates |
| Import admin (bulk CSV) | 15-30 minutes | Per-row product matching dominates |

**With Batch Matcher deployed, import admin time drops to ~3-8 minutes** (HTTP scraping remains the floor).

---

## 2. Stage 1: Source Adapter (HTTP Scraping)

### Current Implementation

**File:** `lib/bots/adapters/sahibinden.ts`

- Per-listing HTTP GET requests via cheerio HTML parsing
- Anti-bot proxy (`SCRAPINGFISH_API_KEY`) with 30s timeout
- Cloudflare detection (`isCloudflareBlocked`)
- Retry: 2 retries with 1s delay per request
- `safeFetchHtml` with configurable throttling
- Category-page scraping: `parseSahibindenCategoryHtml()` extracts listings from search results pages (up to 1000 per call)

### Bottleneck Analysis

| Metric | Value |
|--------|-------|
| Listings per category scrape | Up to 1,000 (1 page = 50-100 listings, multi-page) |
| Time per individual listing fetch | ~300-500ms direct, ~1-3s via proxy |
| Time for 10K category-scraped listings | ~10-20 pages = 10-20 requests (fast) |
| Time for 10K individual listing fetches | ~50-85 minutes via proxy, ~10-20 minutes direct |
| Retry overhead | +2s per failed request |

**Severity: MEDIUM.** The category-scraping path is reasonably efficient (10-20 HTTP requests for 10K listings). The individual listing-detail path is slower but acceptable for initial import. Not the dominant bottleneck.

**Priority: P3.** Optimize after Batch Matcher and Duplicate Engine.

**Batch Matcher required before launch?** No. This stage is independent.

---

## 3. Stage 2: Normalization

### Current Implementation

**File:** `lib/normalization/engine.ts`

- `normalizeProductTitle()` — 12-step text normalization pipeline
- `extractProductSignals()` — brand, model, storage, RAM, color, category, key assembly
- Called per listing: ~50 regex operations per call
- Pure CPU, zero I/O

### Bottleneck Analysis

| Metric | Value |
|--------|-------|
| Calls per 10K listings | ~10,000 (once in Product Matcher, optionally in Listing Sync) |
| Regex operations per call | ~50 |
| Total regex ops | ~500,000 |
| Estimated wall-clock | ~1-3 seconds |
| Memory pressure | Negligible (~100KB per call, GC-friendly) |

**Severity: NEGLIGIBLE.** Pure computation with tight inner loop. Not a bottleneck at 10K scale.

**Priority: P5 (no action needed).**

**Batch Matcher required before launch?** No.

**Note:** Normalization is called INSIDE `prepareMatcherState()` which is called per-row today. With Batch Matcher, it's still called per-row (one `extractProductSignals` per listing), but the batch savings come from DB round-trips, not CPU. The CPU cost is the same either way — and it doesn't matter at 10K.

---

## 4. Stage 3: Product Matcher — PRIMARY BOTTLENECK

### Current Implementation

**File:** `lib/product-matcher/matcher.ts`, `lib/product-matcher/repository.ts`

All **6 caller sites** use the single-row `findOrCreateMatchedProduct()`:

| Caller | File | Line |
|--------|------|------|
| `import-listings.ts` (admin import) | `lib/import/import-listings.ts` | ~88 |
| `listing-sync.ts` (bot sync) | `lib/bots/listing-sync.ts` | ~380 |
| `instant-bot/route.ts` (search cron) | `app/api/search/instant-bot/route.ts` | ~385 |
| `process-search-queue/route.ts` (search queue cron) | `app/api/cron/process-search-queue/route.ts` | ~387 |
| Plus 2 more in legacy/fallback paths | — | — |

**Per-call cost breakdown of `findOrCreateMatchedProduct()`:**

| Sub-step | Cost |
|----------|------|
| `prepareMatcherState()` | 2× normalization calls (instant) |
| `findExistingMatchedProduct()` Phase 1 | 1 DB query: `.in("name")` |
| `findExistingMatchedProduct()` Phase 2 | 1 DB query: `.in("normalized_key")` |
| `products.insert()` (if new product) | 1 DB query |
| **Total per listing (best case)** | **2 DB round-trips** |
| **Total per listing (new product)** | **3 DB round-trips** |

### The N+1 Problem in Detail

```typescript
// Current pattern — EVERY caller
for (const listing of listings) {
  const productId = await findOrCreateMatchedProduct({   // ← N+1!
    supabase,
    title: listing.title,
    productName: ...,
    category: ...,
  });
  // ...
}
```

**Scaled to 10,000 listings:**

| Scenario | DB Round-trips | Estimated Wall-clock |
|----------|---------------|---------------------|
| 10K listings, 0% new products | 20,000 | ~15-25 minutes |
| 10K listings, 30% new products | 23,000 | ~18-30 minutes |
| 10K listings, 70% new products | 26,000 | ~20-35 minutes |

**Why it's slow:** Each round-trip incurs:
- Network latency (5-50ms to Supabase)
- Connection pool overhead
- Query planning + execution
- Response serialization

At 10K listings × 2-3 queries = 20K-30K individual HTTP requests to Supabase.

### The Fix Already Exists

`batchFindOrCreateMatchedProducts()` in `lib/product-matcher/matcher.ts`:

| Sub-step | Cost (batch) |
|----------|-------------|
| `prepareMatcherState()` | N calls (same as single — not the bottleneck) |
| `batchFindExistingMatchedProducts()` | **2 DB queries total** (Phase 1 + Phase 2) |
| `products.insert()` | N inserts in **1 batch request** |
| **Total for 10K listings** | **3-4 DB round-trips** |

**Reduction: 20,000-30,000 round-trips → 3-4 round-trips.**

The repository infrastructure (`batchFindExistingMatchedProducts`) is **fully implemented** (Phase 2 complete — uses indexed `.in("normalized_key")` query, no pagination). The matcher function (`batchFindOrCreateMatchedProducts`) is **fully implemented** with duplicate retry logic.

**What's missing:** Updating the 6 caller sites to use the batch function instead of the single-row function.

**Severity: CRITICAL.** This is the single largest performance bottleneck in the entire pipeline. 20K-30K individual DB round-trips is not sustainable for any dataset >100 listings.

**Priority: P0 (must fix before launch).**

**Batch Matcher required before launch?** YES. Absolutely. Cannot launch without it.

---

## 5. Stage 4: Duplicate Engine

### Current Implementation

**File:** `lib/duplicate-engine/matcher.ts`, `lib/duplicate-engine/engine.ts`

- `findDuplicateMatches()` — O(n²) nested loop comparing all listing pairs
- Uses `normalizeSearchText` + `getTokens` from normalization (black-box compliant)
- `calculateDuplicateScoreForInputs()` — O(n) per pair, calls confidence-engine after aggregation
- `groupDuplicates()` — union-find to build groups from matches
- Called per sync batch in `listing-sync.ts` and per import batch in `import-listings.ts`

### Bottleneck Analysis

| Group Size | Pairwise Comparisons | Time per Comparison | Total Time |
|-----------|---------------------|-------------------|------------|
| 10 listings | 45 | ~1-2ms | ~0.1s |
| 50 listings | 1,225 | ~1-2ms | ~1.5s |
| 100 listings | 4,950 | ~1-2ms | ~6-10s |
| 500 listings | 124,750 | ~1-2ms | ~2-4 minutes |
| 1000 listings | 499,500 | ~1-2ms | ~8-16 minutes |

**Estimated distribution for 10K listings:**
- ~70% match rate → 7,000 listings in groups
- Average group size: ~20-50 listings (by brand + model)
- ~140-350 groups
- Total comparisons: ~50K-150K
- Estimated wall-clock: **~1-5 minutes** (acceptable)

**Critical factor:** The ONE group that's largest determines the ceiling. "iPhone 15 Pro Max 256GB" might have 300+ listings → 44,850 comparisons → ~45-90 seconds for that single group.

### Severity: MEDIUM-HIGH

O(n²) is mathematically concerning, but in practice the grouping by brand/category limits group sizes. The risk is a single popular product creating an outsized group. Mitigated by:
- Group sizes are naturally bounded by market supply (rare to have >200 of the exact same model in one batch)
- `filterByConfidence()` can reduce noise after scoring
- Duplicate detection runs per-batch, not per-row

**Priority: P2.** Monitor in production. Add group-size cap if needed (process groups >100 items separately with sampling).

**Batch Matcher required before launch?** No. Independent bottleneck.

---

## 6. Stage 5: Database Writes

### Current Implementation

**Main sync path (`listing-sync.ts`):**
- `sync_source_listings` RPC — bulk upsert for listings
- `loadProductIdsForListings()` — single query to `products` table
- `resolveMatchedProductIds()` — per-row product matching (N+1, covered above)

**Legacy path (`import-listings.ts`):**
- Per-row listing upsert with `saveListingWithSchemaFallback()`
- Per-row `recordListingPriceHistory()`

### Bottleneck Analysis

| Operation | Current | With Batch Matcher |
|-----------|---------|-------------------|
| Product matching | 20K-30K queries | 3-4 queries |
| Listing upsert (main path) | 1 RPC call | 1 RPC call (unchanged) |
| Listing upsert (legacy path) | 10K individual upserts | 10K upserts (bottleneck if used) |
| Price history (main path) | Not per-row | Not per-row (good) |
| Price history (legacy path) | 10K inserts | 10K inserts (bottleneck if used) |

**`loadProductIdsForListings` gap:** This function queries `products` only by **name** (not `normalized_key`). If a product exists with a different name but matching `normalized_key`, this query misses it. The product matching layer catches it later via the two-phase lookup, but `loadProductIdsForListings` pre-load gives incomplete results.

**Severity: LOW** (main path). The `sync_source_listings` RPC handles bulk listing upsert efficiently. The legacy path's per-row pattern is a secondary concern (only used as fallback).

**Priority: P3.** Address legacy path if it becomes a bottleneck. Fix `loadProductIdsForListings` to also query by `normalized_key`.

**Batch Matcher required before launch?** No, but the product matching N+1 that feeds into DB writes IS the Batch Matcher problem (covered in Stage 3).

---

## 7. Stage 6: Search Index

### Current Implementation

No dedicated search-index service found. No Meilisearch, Algolia, or Elasticsearch integration exists in the codebase. Search operates via:

- `app/api/search/instant-bot/route.ts` — real-time search via adapters
- `app/api/cron/process-search-queue/route.ts` — queued search processing
- `app/search/actions.ts` — search actions querying Supabase directly
- `app/api/search/suggestions/route.ts` — search suggestions

### Bottleneck Analysis

**During import:**
There is no search-index pipeline to block on. Listings are written to `listings` table and become searchable through direct Supabase queries immediately. No search-index rebuild bottleneck.

**During query:**
Supabase full-text search performance depends on row count and indexing. With 10K listings, direct queries are fast (<100ms). This becomes a concern at 100K+ listings.

**Severity: NONE** (for the import pipeline itself).

**Priority: P4.** Add dedicated search index (Meilisearch) when listing count exceeds 100K.

**Batch Matcher required before launch?** No.

---

## 8. Stage 7: Market Intelligence

### Current Implementation

**Files:** `lib/market-intelligence/price-analysis.ts`, `lib/market-intelligence/engine.ts`

- `buildMarketPriceAnalysis()` — validates prices, computes stats (avg, median, min, max, spread, marketValue)
- `buildMarketIntelligence()` — composes price analysis + market summary + opportunity + confidence + JSON-LD
- All computation is synchronous, called on page-view, not during import
- Confidence scoring: base 52 + bonuses/penalties

### Bottleneck Analysis

**During import:** No direct impact. Market Intelligence is computed on page render, not during data ingestion.

**Price history writes (legacy path only):**
- `recordListingPriceHistory()` called per-row in legacy sync
- 10K listings = 10K individual inserts to `listing_price_history`
- Each insert is a separate DB round-trip

**Severity: LOW.** Price history writes only affect the legacy fallback path. Primary path does not record per-row price history during initial import (only when price changes).

**Priority: P3.** Batch price-history inserts if legacy path becomes a bottleneck.

**Batch Matcher required before launch?** No.

---

## 9. Stage 8: Frontend

### Current Implementation

Next.js App Router with server-side rendering. Pages query Supabase directly.

### Bottleneck Analysis

**During import:** Not directly affected. The import runs server-side. However:
- **Data freshness:** If a long-running import (60+ minutes via proxy) is marked as "complete" before the Duplicate Engine and Market Intelligence have finished processing, users may see incomplete data.
- **Search results:** Listings are visible as soon as the DB write completes, but may not have market intelligence data yet.

**Severity: LOW.** Frontend is decoupled from the import pipeline. Stale data during import is a UX concern, not a correctness concern.

**Priority: P4.** Add a "last_import_completed_at" timestamp and show a "verifying data" banner during post-import processing.

**Batch Matcher required before launch?** No.

---

## 10. Batch Matcher Deployment Plan

### What Exists Today

| Component | Status | File |
|-----------|--------|------|
| `batchFindExistingMatchedProducts()` | ✅ Complete | `lib/product-matcher/repository.ts` |
| `batchFindOrCreateMatchedProducts()` | ✅ Complete | `lib/product-matcher/matcher.ts` |
| Phase 2 indexed queries | ✅ Complete | `lib/product-matcher/repository.ts` |
| Export from barrel | ✅ Complete | `lib/product-matcher/index.ts` |
| Tests | ✅ Complete | `lib/product-matcher/batch-matcher.test.ts` |
| **Caller sites use batch** | **❌ NOT DONE** | 6 files need updating |

### Caller Sites to Update

| # | File | Function | Change |
|---|------|----------|--------|
| 1 | `lib/import/import-listings.ts` | Main import loop (~L83-121) | Batch all listings before loop |
| 2 | `lib/bots/listing-sync.ts` | `resolveMatchedProductIds()` (~L372-398) | Batch all listings |
| 3 | `app/api/cron/process-search-queue/route.ts` | `importAdapterListings()` (~L353-438) | Batch per-batch |
| 4 | `app/api/cron/process-search-queue/route.ts` | `ensureProduct()` (~L440-456) | Remove (absorbed into batch) |
| 5 | `app/api/search/instant-bot/route.ts` | `importListings()` (~L352-413) | Batch per-batch |
| 6 | `app/api/search/instant-bot/route.ts` | `ensureProduct()` (~L415-433) | Remove (absorbed into batch) |

### Migration Pattern

**Before:**
```typescript
for (const listing of listings) {
  const product = await findOrCreateMatchedProduct({ supabase, title, productName, ... });
  // use product.id
}
```

**After:**
```typescript
const productMap = await batchFindOrCreateMatchedProducts(supabase,
  listings.map(l => ({
    title: l.title,
    productName: l.model ?? ...,
    category: l.category,
    source: l.sourceName,
  }))
);
for (const listing of listings) {
  const product = productMap.get(listing.title);
  // use product.id
}
```

### Estimated Effort
- ~2-3 hours of focused work
- No schema changes required
- No new dependencies
- Rollback: point callers back to `findOrCreateMatchedProduct`

---

## 11. Bottleneck Summary Table

| Stage | Bottleneck | Severity | Priority | Wall-clock (10K) | Batch Matcher Needed? |
|-------|-----------|----------|----------|-----------------|----------------------|
| **Source Adapter** | Per-listing HTTP scraping, anti-bot proxy (30s timeout) | Medium | P3 | 10-90 min | No |
| **Normalization** | Pure CPU, ~500K regex ops | Negligible | P5 | ~1-3s | No |
| **Product Matcher** | **N+1 pattern: 20K-30K DB round-trips** | **Critical** | **P0** | **15-35 min** | **YES** |
| **Duplicate Engine** | O(n²) pairwise comparison in groups | Medium-High | P2 | 1-5 min | No |
| **Database Writes** | Main path: bulk RPC (fast). Legacy: per-row | Low | P3 | <1 min (main) | No (but overlaps) |
| **Search Index** | No bottleneck (no dedicated index) | None | P4 | 0 | No |
| **Market Intelligence** | On-demand computation, not import-time | Low | P3 | 0 (not during import) | No |
| **Frontend** | Data freshness during long imports | Low | P4 | 0 (decoupled) | No |

### Ranked by Priority

| Priority | Issue | Action Required |
|----------|-------|----------------|
| **P0** | Product Matcher N+1 (20K-30K DB round-trips) | Deploy Batch Matcher to 6 caller sites |
| **P1** | Duplicate Engine O(n²) + no dedup pre-filter | Add normalized_key pre-filter, cap group size at 200 |
| **P2** | Import pipeline lacks transaction/rollback | Wrap per-source import in transaction |
| **P3** | Source Adapter rate limiting unpredictable | Add adaptive rate limiter, queue-based scraping |
| **P3** | `loadProductIdsForListings` misses normalized_key match | Add `.in("normalized_key")` to pre-load query |
| **P4** | No search index at scale | Defer to 100K+ listings |
| **P4** | Frontend stale data during long import | Add "import in progress" status indicator |
| **P5** | Normalization called twice per listing | Minor optimization, negligible impact |

---

## 12. Risk Assessment: Launch Without Batch Matcher

### Can we launch without deploying Batch Matcher?

**NO.** Here is the quantitative analysis:

**At 100 listings** (current dev-scale):
- Product matcher: 200-300 DB queries (~30s) — painful but tolerable
- Full import time: ~2-5 minutes

**At 10,000 listings** (launch-scale):
- Product matcher: 20,000-30,000 DB queries (~15-35 minutes) — UNACCEPTABLE
- Full import time: ~30-120 minutes
- Risk of DB connection pool exhaustion
- Risk of function timeout (serverless limits: 60s-300s)
- Risk of partial import — half the listings imported before timeout, no rollback

### Production Risk Scenarios

| Scenario | Likelihood | Impact | Mitigation |
|----------|-----------|--------|-----------|
| DB connection pool exhausted during import | High (20K+ concurrent queries on pool of 10-15) | Partial import failure | Batch Matcher reduces to 3-4 queries |
| Serverless function timeout (Vercel: 60s default) | Certain (import takes 15-35 min) | Import aborts mid-way | Batch Matcher brings to <60s |
| Supabase rate limiting (5K req/min on free/pro) | Very High (20K queries > 5K limit) | 429 errors, retries, slowdown | Batch Matcher eliminates excess requests |
| Memory pressure from 10K concurrent promises | Medium | OOM crash | Batch Matcher processes in batches |

### Minimum Viable Launch Checklist

1. ✅ Phase 2 `normalized_key` infrastructure — COMPLETE
2. ✅ `batchFindExistingMatchedProducts` — IMPLEMENTED
3. ✅ `batchFindOrCreateMatchedProducts` — IMPLEMENTED
4. ❌ **Caller sites updated to use batch** — 0/6 DONE
5. ❌ Import-wide monitoring (progress tracking, ETA) — NOT STARTED
6. ❌ Graceful failure handling for partial imports — NOT STARTED

---

## Appendix A: Detailed Caller Analysis

### Caller 1: `lib/import/import-listings.ts` (Admin Import)

```
for (listing of listings) {
  product = await findOrCreateMatchedProduct({supabase, title, productName, category, source})
  // single listing upsert
  // single price history insert
}
```

**Impact:** N+1 for product matching + N+1 for listing upsert + N+1 for price history = 3N round-trips.
**Fix:** Batch all three: `batchFindOrCreateMatchedProducts` → batch listing upsert → batch price history.

### Caller 2: `lib/bots/listing-sync.ts` (Bot Sync)

```
resolveMatchedProductIds(): iterates all listings, calls findOrCreateMatchedProduct per listing
```

**Impact:** N+1 for product matching only (listing upsert is via bulk RPC).
**Fix:** Replace per-row loop with single `batchFindOrCreateMatchedProducts()` call.

### Callers 3-6: `instant-bot/route.ts` + `process-search-queue/route.ts` (Search Cron)

Both have identical patterns:
```
for (listing of listings) {
  productId = await ensureProduct()  // calls findOrCreateMatchedProduct
  // per-row listing upsert
}
```

**Impact:** N+1 for product matching + N+1 for listing upsert.
**Fix:** Batch per job (typically 3-10 listings — less critical, but same pattern).

---

## Appendix B: Key Metrics for Production Monitoring

| Metric | Warning Threshold | Critical Threshold |
|--------|------------------|-------------------|
| Import time per 1K listings | >5 minutes | >15 minutes |
| Product matcher queries per 1K listings | >1,000 | >2,000 |
| DB connection utilization during import | >70% | >90% |
| Duplicate engine group size (max) | >100 | >300 |
| Source adapter failure rate | >10% | >30% |
| Import abort rate | >1% | >5% |

---

*Document generated from pipeline audit. All bottleneck measurements estimated from code analysis and Supabase latency baselines (~20ms average query time for indexed queries, ~50ms for non-indexed).*
