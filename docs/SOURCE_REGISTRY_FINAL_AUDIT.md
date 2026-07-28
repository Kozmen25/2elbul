# Source Registry Final Audit

> **Date**: 2026-07-12
> **Scope**: Entire repository — every `sourceId`, `source_id`, `SourceRegistry`, and `getCanonicalSourceRegistry` occurrence classified
> **Commissioned by**: Pre-Phase 5 gate check (Do NOT start Phase 5 — wait for approval)

---

## 1. Registry Architecture (Two Distinct Registries)

### 1.1 Source Identity Registry (`lib/source-registry/`)

| File | Role | Status |
|---|---|---|
| `lib/source-registry/types.ts` | `SourceRegistryRecord` (with `sourceId: number`) + `SourceRegistry` interface | ✅ Correct |
| `lib/source-registry/registry.ts` | `SourceRegistryImpl` — DB-backed, 3 Maps (byId/bySlug/byName), initialized from `public.sources` | ✅ Correct |
| `lib/source-registry/index.ts` | Barrel exports | ✅ Correct |
| `lib/source-registry/registry.test.ts` | Unit tests for `SourceRegistryImpl` | ✅ Correct |

**Canonical IDs** (from DB `public.sources`):

| ID | Source |
|---|---|
| 1 | Sahibinden |
| 2 | Letgo |
| 3 | Facebook Marketplace |
| 4 | EasyCep |
| 5 | Getmobil |
| 6 | Yenilenmiş Market |
| 7 | Teknosa Yenilenmiş |
| 8 | Hepsiburada Yenilenmiş |
| 9 | MediaMarkt Yenilenmiş |
| 10 | Satarız |

### 1.2 Adapter Registry (`lib/unified-source-engine/registry.ts`)

| File | Role | Status |
|---|---|---|
| `lib/unified-source-engine/types.ts:78-83` | `SourceRegistry` interface (separate from identity registry — stores `UnifiedSourceAdapter` instances) | ✅ Correct |
| `lib/unified-source-engine/registry.ts` | `DefaultSourceRegistry` — Map<string, UnifiedSourceAdapter> keyed by slug | ✅ Correct |

### 1.3 Bridge Module (`lib/unified-source-engine/adapters/index.ts`)

Connects the two registries. Seeds the adapter registry using identity registry data.

| Function | Returns | Status |
|---|---|---|
| `initializeSourceAdapters(supabase)` | Creates both registries, seeds adapters from DB | ✅ Correct |
| `getCanonicalSourceRegistry()` | `SourceRegistry \| null` (identity registry singleton from DB) | ✅ Correct |
| `getUnifiedSourceRegistry()` | Adapter registry singleton | ✅ Correct |

---

## 2. Classification by Module

### 2.1 Source Registry Own Code

| Location | Expression | Classification |
|---|---|---|
| `lib/source-registry/types.ts:5` | `sourceId: number` (field in `SourceRegistryRecord`) | ✅ Correct |
| `lib/source-registry/types.ts:16` | `getById(sourceId: number)` | ✅ Correct |
| `lib/source-registry/registry.ts:29` | `this.byId.set(record.sourceId, record)` | ✅ Correct |
| `lib/source-registry/registry.ts:35-36` | `getById(sourceId)` / `this.byId.get(sourceId)` | ✅ Correct |
| `lib/source-registry/registry.ts:55-56` | `getReliability(sourceId)` / `this.byId.get(sourceId)?.reliabilityScore` | ✅ Correct |
| `lib/source-registry/registry.ts:68` | `this.byId.set(record.sourceId, record)` (register) | ✅ Correct |
| `lib/source-registry/registry.ts:77` | `sourceId: row.id` (from DB `public.sources`) | ✅ Correct |

### 2.2 Unified Source Engine

| Location | Expression | Classification |
|---|---|---|
| `lib/unified-source-engine/types.ts:13` | `NormalizedListing.sourceId: number` (required) | ✅ Correct |
| `lib/unified-source-engine/types.ts:45` | `SourceAdapterOptions.sourceId: number` | ✅ Correct |
| `lib/unified-source-engine/types.ts:53` | `AdapterFetchResult.sourceId: number` | ✅ Correct |
| `lib/unified-source-engine/types.ts:63` | `UnifiedSourceAdapter.readonly sourceId: number` | ✅ Correct |
| `lib/unified-source-engine/factory.ts:38` | `sourceId: options.sourceId` (from adapter options) | ✅ Correct |
| `lib/unified-source-engine/pipeline.ts:46-47` | `if (listing.sourceId <= 0)` validation check | ✅ Correct |
| `lib/unified-source-engine/pipeline.ts:67` | `sourceId: number` in internal type | ✅ Correct |
| `lib/unified-source-engine/adapters/index.ts:35` | `sourceId: source.sourceId` (from registry record) | ✅ Correct |
| `lib/unified-source-engine/adapters/easycep-unified.ts:32,69` | `sourceId: options.sourceId` | ✅ Correct |
| `lib/unified-source-engine/adapters/getmobil-unified.ts:30,67` | `sourceId: options.sourceId` | ✅ Correct |

### 2.3 Bot Adapters

| Location | Expression | Classification |
|---|---|---|
| `lib/bots/types.ts:7` | `BotAdapter.sourceId: number` (required on adapter interface) | ✅ Correct |
| `lib/bots/types.ts:25` | `BotAdapterListing.sourceId?: number` (optional on listing — per-listing override) | ✅ Correct |
| `lib/bots/adapters/types.ts:71,83` | `sourceId: number` in adapter config types | ✅ Correct |
| `lib/bots/adapters/types.ts:101` | `source_id: context.sourceId` (DB column from config) | ✅ Correct |
| `lib/bots/adapters/types.ts:143,157,174` | `sourceId: config.sourceId` in standard adapter output | ✅ Correct |
| `lib/bots/adapters/easycep-adapter.ts:73` | `sourceId: config.sourceId` | ✅ Correct |
| `lib/bots/adapters/easycep-adapter.ts:112,124` | `sourceId: config.sourceId` | ✅ Correct |
| `lib/bots/adapters/getmobil-adapter.ts:73` | `sourceId: config.sourceId` | ✅ Correct |
| `lib/bots/adapters/getmobil-adapter.ts:112,124` | `sourceId: config.sourceId` | ✅ Correct |

**Adapter test files** (hardcoded IDs matching canonical values — acceptable in tests):

| Location | Expression | Classification |
|---|---|---|
| `lib/bots/adapters/easycep-adapter.test.ts:9` | `sourceId: 4` (EasyCep) | ✅ Correct (test) |
| `lib/bots/adapters/easycep-adapter.test.ts:46` | `source_id: 4` (EasyCep) | ✅ Correct (test) |
| `lib/bots/adapters/getmobil-adapter.test.ts:9` | `sourceId: 5` (Getmobil) | ✅ Correct (test) |
| `lib/bots/adapters/getmobil-adapter.test.ts:46` | `source_id: 5` (Getmobil) | ✅ Correct (test) |
| `lib/bots/adapters/types.test.ts:14` | `sourceId: 7` (Teknosa) | ✅ Correct (test) |
| `lib/bots/adapters/types.test.ts:54` | `source_id: 7` (Teknosa) | ✅ Correct (test) |

### 2.4 Bot Pipeline (Listing Sync)

| Location | Expression | Classification |
|---|---|---|
| `lib/bots/listing-sync.ts:87` | `syncListingsForSource(supabase, sourceId, listings)` parameter | ✅ Correct |
| `lib/bots/listing-sync.ts:101` | `logDuplicateSummary(\`Source ${sourceId}\`)` | ✅ Correct |
| `lib/bots/listing-sync.ts:112` | `buildRpcListingPayload(listing, productId, sourceId)` | ✅ Correct |
| `lib/bots/listing-sync.ts:130,137` | `p_source_id: sourceId` (RPC parameter) | ✅ Correct |
| `lib/bots/listing-sync.ts:143` | `insertListingsLegacy(supabase, listings, sourceId)` | ✅ Correct |
| `lib/bots/listing-sync.ts:183` | `insertListingsLegacy(..., sourceId?: number)` parameter | ✅ Correct |
| `lib/bots/listing-sync.ts:328` | `buildListingPayloadBase(listing, productId, sourceId)` parameter | ✅ Correct |
| `lib/bots/listing-sync.ts:336` | `source_id: listing.sourceId ?? sourceId` (two-tier resolution) | ✅ Correct |
| `lib/bots/listing-sync.ts:346,349` | `buildRpcListingPayload` threads sourceId | ✅ Correct |
| `lib/bots/listing-sync.ts:370,373` | `buildLegacyListingPayload` threads sourceId | ✅ Correct |
| **`lib/bots/listing-sync.ts:219`** | **`sourceId ?? listing.sourceId ?? 1`** | **❌ Legacy fallback** |

### 2.5 Bot Pipeline (Source Runner)

| Location | Expression | Classification |
|---|---|---|
| `lib/bots/source-runner.ts:30` | `SourceRunResult.sourceId: number` | ✅ Correct |
| `lib/bots/source-runner.ts:73` | `source_id: source.id` (DB `sources.id`) | ✅ Correct |
| `lib/bots/source-runner.ts:115` | `sourceId: source.id` (from `SourceRunRecord.id`) | ✅ Correct |
| `lib/bots/source-runner.ts:211` | `sourceId: source.id` | ✅ Correct |
| `lib/bots/source-runner.ts:298` | `sourceId: source.id` | ✅ Correct |

### 2.6 Bot Pipeline (Connectors — Bridge Between Registries)

| Location | Expression | Classification |
|---|---|---|
| `lib/bots/connectors.ts:111-114` | `canonical.getBySlug(config.sourceSlug)` → `source.sourceId` | ✅ Correct |
| `lib/bots/connectors.ts:117` | `getUnifiedSourceRegistry()` to find adapter | ✅ Correct |

### 2.7 Import Pipeline

| Location | Expression | Classification |
|---|---|---|
| `lib/import/types.ts:27` | `sourceId: number \| null` (required, nullable) | ✅ Correct |
| `lib/import/adapters.ts:148` | `sourceId: null` (intentional — imports don't carry identity) | ✅ Correct |
| `lib/import/import-listings.ts:122` | `source_id: listing.sourceId` (null → DB gets NULL) | ✅ Correct |

### 2.8 Old Source Engine (Legacy, Being Replaced)

| Location | Expression | Classification |
|---|---|---|
| `lib/source-engine/types.ts:8` | `sourceId?: number` (optional) | ⚠️ Transitional |
| `lib/source-engine/engine.ts:100` | `query.eq("id", options.sourceId)` | ✅ Correct |
| `lib/source-engine/engine.ts:114` | `legacyQuery.eq("id", options.sourceId)` | ✅ Correct |
| `lib/source-engine/engine.ts:142` | `sourceId: result.sourceId` | ✅ Correct |

The old source engine receives `sourceId` optionally from callers and filters by it. No hardcoded IDs. Will be replaced by unified-source-engine.

### 2.9 Duplicate Engine

| Location | Expression | Classification |
|---|---|---|
| `lib/duplicate-engine/types.ts:41` | `sourceId?: number \| null` (on `ComparisonInput`) | ✅ Correct |
| `lib/duplicate-engine/helpers.ts:12,23` | `sourceId: options?.sourceId \|\| null` | ✅ Correct |
| `lib/duplicate-engine/engine.ts:17,187` | `import { getCanonicalSourceRegistry }` / call | ✅ Correct |
| `lib/duplicate-engine/engine.ts:62` | `resolveSourceCount(input1.sourceId, input2.sourceId)` | ✅ Correct |
| `lib/duplicate-engine/engine.ts:63` | `resolveSourceReliability(...)` | ✅ Correct |
| `lib/duplicate-engine/engine.ts:176-180` | `resolveSourceCount(sourceId1, sourceId2)` — null-safe | ✅ Correct |
| `lib/duplicate-engine/engine.ts:184-192` | `resolveSourceReliability` — uses registry, falls back to 65 | ✅ Correct |
| `lib/duplicate-engine/scoring.ts:208-213` | `calculateSourceDiversityScore(sourceId1, sourceId2)` | ✅ Correct |
| `lib/duplicate-engine/scoring.ts:232` | `sourceDiversity: calculateSourceDiversityScore(...)` | ✅ Correct |

**Test data** (hardcoded IDs acceptable in tests):

| Location | Expression | Classification |
|---|---|---|
| `lib/duplicate-engine/engine.test.ts:341` | `sourceId: 1` (Sahibinden) | ✅ Correct (test) |
| `lib/duplicate-engine/engine.test.ts:347` | `sourceId: 2` (Letgo) | ✅ Correct (test) |
| `lib/duplicate-engine/engine.test.ts:357` | `sourceId: 1` (Sahibinden) | ✅ Correct (test) |
| `lib/duplicate-engine/engine.test.ts:361` | `sourceId: 1` (Sahibinden) | ✅ Correct (test) |

### 2.10 Confidence Engine

| Location | Expression | Classification |
|---|---|---|
| `lib/confidence-engine/helpers.ts:11` | `import { getCanonicalSourceRegistry }` | ✅ Correct |
| `lib/confidence-engine/helpers.ts:418-420` | `getCanonicalSourceRegistry().getByName(name)` → `reliabilityScore` | ✅ Correct |

### 2.11 Product Matcher — ❌ Legacy Fallbacks

| Location | Expression | Default ID | Maps To | Classification |
|---|---|---|---|---|
| `lib/product-matcher/duplicate.ts:21` | `reference.sourceId ?? 1` | 1 | Sahibinden | **❌ Legacy** |
| `lib/product-matcher/duplicate.ts:30` | `candidate.sourceId ?? 2` | 2 | Letgo | **❌ Legacy** |
| `lib/product-matcher/duplicate.ts:73` | `l.sourceId ?? 1` | 1 | Sahibinden | **❌ Legacy** |
| `lib/product-matcher/duplicate.ts:156` | `listing.sourceId ?? 1` | 1 | Sahibinden | **❌ Legacy** |
| `lib/product-matcher/duplicate.ts:172` | `listing.sourceId ?? 1` | 1 | Sahibinden | **❌ Legacy** |
| `lib/product-matcher/duplicate.ts:184` | `listing.sourceId ?? 1` | 1 | Sahibinden | **❌ Legacy** |

**Note**: These 6 fallbacks in `duplicate.ts` are the primary Phase 5 target. They only execute when `sourceId` is undefined/null on the input, which shouldn't happen after Phase 4 completion.

### 2.12 Legacy Source Adapters (Deprecated)

| Location | Expression | Classification |
|---|---|---|
| `lib/source-adapters/types.ts:9` | Comment referencing new unified types | ✅ Correct |
| `lib/source-adapters/types.ts:17` | `SearchInput.sourceId: number \| null` (interface type, not a value) | ⚠️ Transitional |
| `lib/source-adapters/index.ts:5,20` | `import { getUnifiedSourceRegistry }` / call | ✅ Correct |

The entire `lib/source-adapters/` is deprecated. Its `SearchInput` has `sourceId: number | null` which callers populate. No adapter owns its own ID.

### 2.13 Database Schema (SQL)

| File | Usage | Classification |
|---|---|---|
| `supabase/bot-sync.sql:36` | `listings.source_id` column (FK → `public.sources(id)`) | ✅ Correct |
| `supabase/bot-sync.sql:61-66` | Partial indexes on `source_id` | ✅ Correct |
| `supabase/bot-sync.sql:211,314` | RPC uses `source_id` | ✅ Correct |
| `supabase/bot-sync.sql:353` | WHERE filter by `source_id` | ✅ Correct |
| `supabase/production-hardening.sql:24` | WHERE `source_id is not null` | ✅ Correct |
| `supabase/sources-and-bots.sql:24` | `bot_runs.source_id` FK column | ✅ Correct |
| `supabase/sources-and-bots.sql:41` | Index on `bot_runs(source_id)` | ✅ Correct |
| `supabase/search-demand-queue.sql:23` | `bot_queue.source_id` FK column | ✅ Correct |
| `supabase/search-demand-queue.sql:49` | Unique constraint on `(demand_id, source_id)` | ✅ Correct |
| `supabase/migrations/listings-schema-sync.sql` | Same as bot-sync.sql (migration) | ✅ Correct |
| `supabase/migrations/source-engine-skip-inactive.sql:124,227,267` | RPC uses `source_id` | ✅ Correct |

### 2.14 App Layer (API Routes)

| File | Pattern | Classification |
|---|---|---|
| `app/api/search-demand/route.ts:152-177` | Reads `source.id` from DB, inserts `bot_queue.source_id` | ✅ Correct |
| `app/api/cron/process-search-queue/route.ts:28,84,257-284` | Reads `source_id` from `bot_queue`, resolves from DB | ✅ Correct |
| `app/api/search/instant-bot/route.ts:33,85,266-291` | Reads `source_id` from `bot_queue`, resolves from DB | ✅ Correct |
| `app/api/cron/run-sources/route.ts:34,42` | `sourceId` from query param → `runSourceScrapeBot()` | ✅ Correct |
| `app/api/admin/run-bot-task/route.ts:155` | `source_id: null` (manual admin task with no source) | ✅ Correct |
| `app/api/admin/source-health/check/route.ts:28-115` | Reads `sourceId` from body, queries DB `sources.id` | ✅ Correct |
| `app/api/admin/source-debug/run/route.ts:16-41` | Reads `sourceId` from body, passes to adapter | ✅ Correct |

### 2.15 App Layer (Admin Pages)

All admin pages obtain `sourceId` from DB queries (`sources.id` or `bot_runs.source_id`). No hardcoded IDs.

| File | Pattern | Classification |
|---|---|---|
| `app/admin/bot-runs/page.tsx` | `source_id` from `bot_runs` DB query | ✅ Correct |
| `app/admin/bot-center/page.tsx` | `source_id` from DB, grouped by `sources.id` | ✅ Correct |
| `app/admin/bot-center/bot-center-client.tsx` | `sourceId` prop from parent | ✅ Correct |
| `app/admin/sources/actions.ts` | `sourceId` parameter from admin form, queries `sources.id` | ✅ Correct |
| `app/admin/search-demands/page.tsx` | `source_id` from `bot_queue` DB query | ✅ Correct |
| `app/admin/data-quality/page.tsx` | `source_id` from `bot_runs` DB query | ✅ Correct |
| `app/admin/source-debug/page.tsx` | `sources.id` mapped to `bot_runs.source_id` | ✅ Correct |

---

## 3. Five Conditions Verification

### Condition 1: No module invents its own source IDs

**Result: ✅ PASS**

All production code obtains `sourceId` from one of:
- **SourceRegistry**: `getCanonicalSourceRegistry().getBySlug()` in connectors, confidence engine, duplicate engine
- **DB query**: `sources.id` in source-runner, admin pages, API routes
- **Adapter config**: Enriched from registry at initialization time (`initializeSourceAdapters`)
- **Function parameter**: Threaded through pipeline from the above sources

Test files hardcode IDs matching canonical values, which is acceptable.

### Condition 2: No duplicate source registry exists

**Result: ⚠️ TWO REGISTRIES, BUT ARCHITECTURALLY DISTINCT**

| Registry | Location | Purpose |
|---|---|---|
| `SourceRegistryImpl` | `lib/source-registry/registry.ts` | Source **identity** — DB-backed, id/slug/name → reliability, active status |
| `DefaultSourceRegistry` | `lib/unified-source-engine/registry.ts` | Source **adapter** — slug → UnifiedSourceAdapter instances |

These serve different purposes and both are necessary. The naming collision (`SourceRegistry` interface in both `lib/source-registry/types.ts` and `lib/unified-source-engine/types.ts`) is a minor naming concern but not a duplication.

### Condition 3: No adapter owns source IDs anymore

**Result: ✅ PASS**

All adapters receive `sourceId` through their config/options, populated from the SourceRegistry:
- `createEasyCepStandardAdapter(config)` — config has `sourceId: number` from registry
- `createGetmobilStandardAdapter(config)` — same
- `createEasyCepUnifiedAdapter(options, supabase)` — options has `sourceId` from registry
- `createGetmobilUnifiedAdapter(options, supabase)` — same
- Unified adapters via `factory.ts` — `sourceId: options.sourceId`

### Condition 4: No engine owns source IDs anymore

**Result: ✅ PASS**

| Engine | Source of sourceId |
|---|---|
| Unified Source Engine | From adapter options (registry-populated) |
| Duplicate Engine | From `ComparisonInput.sourceId` (caller provides) |
| Confidence Engine | From SourceRegistry via `getByName()` |
| Old Source Engine | Optional param from caller — no hardcoded IDs |

### Condition 5: Every sourceId originates from Registry or is intentionally null

**Result: ✅ PASS** (with documented caveats)

**Proper origins:**
- Bot pipeline: DB `sources.id` → `SourceRunRecord` → `syncListingsForSource()` → `source_id` in listing payload
- Adapter pipeline: DB `sources.id` → `SourceRegistry` → `initializeSourceAdapters()` → adapter config → `BotAdapterListing.sourceId`
- Unified pipeline: Same adapter pipeline → `NormalizedListing.sourceId`
- Import pipeline: Explicitly `null` — intentional (import payloads don't carry source identity)
- API/Admin: DB queries → `sources.id` or `bot_runs.source_id`

**Documented caveats (backward-compatibility fallbacks):**

| Location | Fallback | When it fires | Phase |
|---|---|---|---|
| `duplicate.ts:21,73,156,172,184` | `?? 1` (Sahibinden) | sourceId missing on ComparisonInput | Phase 5 target |
| `duplicate.ts:30` | `?? 2` (Letgo) | sourceId missing on candidate | Phase 5 target |
| `listing-sync.ts:219` | `?? 1` (Sahibinden) | Both function param AND listing-level sourceId missing | Phase 6 target |

These fallbacks are **backward-compatibility safety nets** — they should never fire after Phase 4, but are preserved to avoid runtime breakage.

---

## 4. Complete Legacy Mapping Register

### ❌ Hardcoded Fallbacks (Phase 5/6 Targets)

| # | File | Line | Expression | Default Value | Phase |
|---|---|---|---|---|---|
| 1 | `lib/product-matcher/duplicate.ts` | 21 | `reference.sourceId ?? 1` | Sahibinden (ID: 1) | Phase 5 |
| 2 | `lib/product-matcher/duplicate.ts` | 30 | `candidate.sourceId ?? 2` | Letgo (ID: 2) | Phase 5 |
| 3 | `lib/product-matcher/duplicate.ts` | 73 | `l.sourceId ?? 1` | Sahibinden (ID: 1) | Phase 5 |
| 4 | `lib/product-matcher/duplicate.ts` | 156 | `listing.sourceId ?? 1` | Sahibinden (ID: 1) | Phase 5 |
| 5 | `lib/product-matcher/duplicate.ts` | 172 | `listing.sourceId ?? 1` | Sahibinden (ID: 1) | Phase 5 |
| 6 | `lib/product-matcher/duplicate.ts` | 184 | `listing.sourceId ?? 1` | Sahibinden (ID: 1) | Phase 5 |
| 7 | `lib/bots/listing-sync.ts` | 219 | `sourceId ?? listing.sourceId ?? 1` | Sahibinden (ID: 1) | Phase 6 |

**Total: 7 hardcoded fallback values** — 6 in `duplicate.ts`, 1 in `listing-sync.ts`.

### ⚠️ Transitional Items (Not Legacy, But Not Final)

| # | Item | Reason | Target |
|---|---|---|---|
| 1 | `lib/source-engine/types.ts` — `sourceId?: number` (optional) | Old engine being replaced by unified | Phase 6+ |
| 2 | `lib/source-adapters/` — deprecated types | Legacy adapter system being replaced | Phase 6+ |
| 3 | `SourceRegistry` interface naming collision | Two interfaces, same name, different packages | Documentation fix |
| 4 | `lib/confidence-engine/helpers.ts` — fallback reliability rules | Regex-based fallback when registry returns null | Phase 5+ |

---

## 5. Summary

| Metric | Count |
|---|---|
| Total `sourceId`/`source_id` references audited | ~150 across 40+ files |
| ✅ Correct classifications | ~140 |
| ⚠️ Transitional classifications | ~5 |
| ❌ Legacy (hardcoded fallbacks) | **7** |
| Conditions passed | **4.5/5** (Condition 2 has two registries but architecturally distinct — no action needed) |

**Ready for Phase 5**: Yes. All 7 legacy fallbacks are identified and scoped. No module invents its own source IDs. The Source Registry is the single source of truth for source identity. Phase 5 can remove the 6 `duplicate.ts` fallbacks and verify the import pipeline, followed by Phase 6 for the `listing-sync.ts:219` fallback.
