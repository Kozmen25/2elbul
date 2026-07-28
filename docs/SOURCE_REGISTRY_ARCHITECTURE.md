# Source Registry Architecture

> **Status**: Architecture proposal — not implemented  
> **Purpose**: Single authoritative mapping of source identifiers across all subsystems  
> **Principle**: One canonical mapping, stable IDs, backward compatible, extensible

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Inconsistency Catalog](#2-inconsistency-catalog)
3. [Canonical Source Selection](#3-canonical-source-selection)
4. [Source Registry Architecture](#4-source-registry-architecture)
5. [Stable ID Strategy](#5-stable-id-strategy)
6. [Backward Compatibility](#6-backward-compatibility)
7. [Migration Phases](#7-migration-phases)
8. [Extensibility Model](#8-extensibility-model)
9. [Dependency Map](#9-dependency-map)
10. [Risk Register](#10-risk-register)

---

## 1. Current State Analysis

Source identifiers exist in **9 distinct subsystems**, each with its own representation. No single source of truth exists today.

### 1.1 Subsystem Inventory

| # | Subsystem | File(s) | ID Type | Values | Notes |
|---|-----------|---------|---------|--------|-------|
| 1 | **`public.sources` DB table** | `supabase/sources-and-bots.sql` | `bigint` PK (auto-generated) | 1–10 (sequential) | Canonical storage — but never referenced by application code as sourceId |
| 2 | **Source Engine** | `lib/source-engine/` | `sourceId?: number` (optional) | Queries `sources.id` from DB | Only DB-aware subsystem; uses `sources.id` directly |
| 3 | **Bot adapters (config)** | `lib/bots/types.ts` | `sourceId: number` (required) | 1 (EasyCep), 2 (Getmobil) | Hardcoded per-adapter; Getmobil=2 conflicts with Unified Engine's Getmobil=3 |
| 4 | **Unified Source Engine** | `lib/unified-source-engine/adapters/index.ts` | `sourceId: number` (required) | 1 (EasyCep), 3 (Getmobil) | Only 2 of 10 sources registered; Getmobil=3 appears invented |
| 5 | **Commerce adapters** | `lib/bots/adapters/commerce.ts` | `CommerceAdapterConfig.sourceName` (no sourceId field) | 4 sources | Has `sourceName: string` only — no numeric sourceId anywhere |
| 6 | **Sahibinden raw scraper** | `lib/bots/adapters/sahibinden.ts` | None — hardcoded `source: "Sahibinden"` string | 1 source | Not wrapped in StandardSourceAdapter; no sourceId, no config |
| 7 | **Import pipeline** | `lib/import/types.ts` | `ImportSource` string union | 9 values | String-only; excludes Satarız; no numeric sourceId field |
| 8 | **Confidence Engine** | `lib/confidence-engine/helpers.ts` | Regex-based name matching | 9 rules → scores | `SOURCE_RELIABILITY_RULES` array — pattern → score; no numeric IDs |
| 9 | **Duplicate Engine** | `lib/duplicate-engine/engine.ts`, `scoring.ts` | `sourceId: number \| null` | Runtime values | Uses flat 70/55 reliability; null = perfect diversity (bug) |

### 1.2 Identifier Forms Per Subsystem

```
                    ┌─────────────────────────────────┐
                    │     public.sources (DB)          │
                    │  id=1  name="EasyCep"            │
                    │  id=2  name="Letgo"              │
                    │  id=4  name="EasyCep"            │
                    │  id=5  name="Getmobil"           │
                    │  id=10 name="Satarız"            │
                    └──────────┬──────────────────────┘
                               │ DB query (.eq("id", N))
                               ▼
                    ┌─────────────────────────────────┐
                    │     Source Engine (engine.ts)    │
                    │  options.sourceId → WHERE id=N   │
                    │  Result: sourceId: result.sourceId│
                    └─────────────────────────────────┘

     ┌──────────────┬──────────────────┬──────────────────┬──────────────────┐
     ▼              ▼                  ▼                  ▼                  ▼
┌────────────┐ ┌────────────┐ ┌───────────────┐ ┌──────────────┐ ┌────────────────┐
│Bot Adapter │ │Unified     │ │Commerce       │ │Import        │ │Confidence/     │
│Config      │ │Source      │ │Adapter Config │ │Pipeline      │ │Duplicate Engine│
│sourceId: 1 │ │Engine      │ │sourceName     │ │ImportSource  │ │regex → score   │
│sourceId: 2 │ │sourceId: 1 │ │(no sourceId)  │ │(string only) │ │sourceId: N     │
│(per-adapter)│ │sourceId: 3 │ │               │ │              │ │(null=100 bug)  │
│            │ │(invented)  │ │               │ │              │ │                │
│sourceName  │ │sourceName  │ │sourceName     │ │source string │ │sourceName      │
│sourceSlug  │ │sourceSlug  │ │               │ │              │ │(regex match)   │
└────────────┘ └────────────┘ └───────────────┘ └──────────────┘ └────────────────┘
```

### 1.3 String Type Hierarchy

```
ListingSource (10 values) — lib/listings.ts
  ├── "Sahibinden"
  ├── "Letgo"
  ├── "Facebook Marketplace"
  ├── "EasyCep"
  ├── "Getmobil"
  ├── "Yenilenmiş Market"
  ├── "Teknosa Yenilenmiş"
  ├── "Hepsiburada Yenilenmiş"
  ├── "MediaMarkt Yenilenmiş"
  └── "Satarız"

ImportSource (9 values) — lib/import/types.ts
  └── Excludes Satarız from ListingSource
      (Extract<ListingSource, ...>)

BotAdapterListing.source (free string) — lib/bots/types.ts
  └── "source: string" — no type constraint, assigned at adapter runtime
```

### 1.4 Adapter Registration Map

```
Source                    Slug                    Bot adapter    Unified Engine    Commerce    Import
──────                    ────                    ───────────    ──────────────    ────────    ──────
Sahibinden               sahibinden              Raw scraper    ❌                ❌         ✅
Letgo                    letgo                   ❌             ❌                ❌         ✅
Facebook Marketplace     facebook-marketplace    ❌             ❌                ❌         ✅
EasyCep                  easycep                 sourceId=1     sourceId=1        ❌         ✅
Getmobil                 getmobil                sourceId=2     sourceId=3        ❌         ✅
Yenilenmiş Market        yenilenmis-market       ❌             ❌                ✅         ✅
Teknosa Yenilenmiş       teknosa-yenilenmis      ❌             ❌                ✅         ✅
Hepsiburada Yenilenmiş   hepsiburada-yenilenmis  ❌             ❌                ✅         ✅
MediaMarkt Yenilenmiş    mediamarkt-yenilenmis   ❌             ❌                ✅         ✅
Satarız                  satariz                 ❌             ❌                ❌         ❌
```

---

## 2. Inconsistency Catalog

### INC-01: Getmobil ID Mismatch (Critical)

| Location | sourceId | File |
|----------|----------|------|
| Bot adapter test config | **2** | `lib/bots/adapters/getmobil-adapter.test.ts:9` |
| Unified Source Engine | **3** | `lib/unified-source-engine/adapters/index.ts:11` |
| public.sources DB row | **5** (auto-generated, never referenced) | `supabase/sources-and-bots.sql:85` |

**Impact**: If both bot adapter and unified engine run for Getmobil on the same product, Duplicate Engine sees two different sources as "same" (both would be Getmobil listings) rather than correctly identifying diversity. If either `sourceId` collides with another source, it creates false cross-source identity.

**Root cause**: No single source of truth. Each adapter system assigned its own IDs independently.

### INC-02: No sourceId=2 Mapping Anywhere

The value `sourceId: 2` is used by the Getmobil bot adapter, but no subsystem registers `sourceId=2` as a known source. The DB row for Getmobil has `id=5`. The Unified Engine has `sourceId=3` for Getmobil.

**Impact**: If any system resolves `sourceId=2` for reliability or diversity, the lookup produces undefined behavior — the ID maps to nothing.

### INC-03: Hardcoded Fallback ID Collisions (Critical)

In `lib/product-matcher/duplicate.ts`, `sourceId` defaults are hardcoded:

```typescript
sourceId: reference.sourceId ?? 1   // line 21
sourceId: candidate.sourceId ?? 2   // line 30
sourceId: l.sourceId ?? 1           // lines 73, 156, 172, 184
```

These fallbacks (`1` and `2`) **collide with real DB source IDs** (1=Sahibinden, 2=Letgo). When `sourceId` is missing from a `ComparisonListing`, the system silently treats it as "Sahibinden" or "Letgo" — creating false cross-source identity.

**Impact**: Listings missing sourceId are incorrectly attributed to Sahibinden or Letgo, which:
- Inflates price history for those sources
- Produces wrong sourceDiversity scores (same ID = 0 diversity = deduplicated)
- Generates incorrect Duplicate Engine reliability scores

### INC-04: sourceDiversity Null Bug

In `lib/duplicate-engine/scoring.ts:211`:
```typescript
if (!sourceId1 || !sourceId2) return 100;  // null → "perfect diversity"
```

Null/undefined sourceId is treated as **perfect diversity** (score=100), which inflates aggregate duplicate scores. A listing missing sourceId metadata should produce a **neutral** score, not the maximum.

**Impact**: When ComparisonListing.sourceId is absent (which happens for import pipeline and commerce adapter listings), the aggregate duplicate score is artificially inflated by 100 × weight(0.01) = 1 point. Small but systematic across all comparisons involving sourceId-less sources.

### INC-05: Duplicate Engine Reliability Disconnected

`lib/duplicate-engine/engine.ts:182-188`:
```typescript
function resolveSourceReliability(sourceId1, sourceId2) {
  const count = resolveSourceCount(sourceId1, sourceId2);
  return count >= 2 ? 70 : 55;
}
```

This returns **flat 70/55** based solely on whether source IDs differ. It **never consults** the Confidence Engine's `SOURCE_RELIABILITY_RULES` array (`/easycep/i→92, /getmobil/i→90, /sahibinden/i→68, ...`). This means:

- EasyCep × Getmobil comparison → reliability 70 (should be ~91 avg)
- Sahibinden × EasyCep comparison → reliability 70 (should be ~80 avg)
- Same-source comparison (two Getmobil listings) → reliability 55 (should be 90)

**Impact**: Source reliability is disconnected from actual source trustworthiness. The Duplicate Engine cannot distinguish between "two unreliable sources" vs "two reliable sources."

### INC-06: Six Adapters with No sourceId

| Adapter | Type | sourceId | File |
|---------|------|----------|------|
| Sahibinden | Raw scraper | None | `sahibinden.ts` |
| Yenilenmiş Market | Commerce adapter | None | `commerce.ts` (config has no sourceId field) |
| Teknosa Yenilenmiş | Commerce adapter | None | same |
| Hepsiburada Yenilenmiş | Commerce adapter | None | same |
| MediaMarkt Yenilenmiş | Commerce adapter | None | same |
| Satarız | Import-only | None | `import/adapters.ts` |

These 6 sources flow through the system with `sourceName` string only. When they reach the Duplicate Engine, their `sourceId` is undefined → triggers hardcoded fallback (`?? 1` or `?? 2`) → wrong source identity.

### INC-07: DB `public.sources` Never Used as sourceId Canon

The `public.sources` table has 10 rows with auto-generated sequential PKs (1–10). However:

- No application code references these IDs as sourceId values
- No adapter config reads from this table to get its sourceId
- No startup/bootstrap process seeds application registries from the DB
- The Source Engine (only DB-aware subsystem) queries the table for available sources but does not propagate `sources.id` to the adapter layer

**Impact**: The DB table is the most natural canonical source but is completely disconnected from application-layer source identity.

---

## 3. Canonical Source Selection

### 3.1 Decision: `public.sources` DB Table as Single Source of Truth

**Rationale**:

1. **Already exists** — The table has 10 seed rows covering all sources. Adding a `reliability_score` column is additive.
2. **Auto-generated stable PKs** — `bigint` identity columns can never collide. They persist across resets (`generated by default as identity`).
3. **Single write point** — Adding a new source = one INSERT. All application layers derive their IDs from this INSERT.
4. **TypeScript mirror** — A `SourceRegistry` class loads from this table at startup and serves as the in-memory runtime mirror.
5. **Existing FK relationship** — `bot_runs.source_id` already references `public.sources(id)`. Listing sync RPC already accepts `p_source_id: number`. The DB is already the integration point for FK relationships — extending it to drive application config is natural.

### 3.2 Rejected Alternatives

| Alternative | Reason for Rejection |
|-------------|---------------------|
| TypeScript enum/constant file | Another hardcoded list; diverges from DB; requires code deploy to add a source |
| Existing `ListingSource` string union | String-only, no numeric ID; union type requires code change per source |
| Existing `UnifiedSourceEngine` registry | Only 2 of 10 sources registered; in-memory only; no persistence |
| Bot adapter `SourceIntegrationConfig` | Configs are per-adapter, not shared; no central registry |

### 3.3 Architectural Principle: DB as Root, TypeScript as Mirror

```
┌──────────────────────┐
│  public.sources (DB) │  ←── SINGLE SOURCE OF TRUTH
│  ┌──────────────────┐│
│  │ id: bigint (PK)  ││  ←── sourceId comes from here
│  │ name: text       ││  ←── sourceName comes from here
│  │ slug: text (UQ)  ││  ←── sourceSlug comes from here
│  │ reliability: int ││  ←── NEW: replaces SOURCE_RELIABILITY_RULES
│  │ type: text       ││  ←── marketplace / refurbished
│  │ is_active: bool  ││
│  └──────────────────┘│
└──────────┬───────────┘
           │ load at startup
           ▼
┌──────────────────────┐
│  TypeScript          │  ←── APPLICATION MIRROR
│  SourceRegistry      │
│  ┌────────────────┐  │
│  │ get(slug)      │  │
│  │ getById(id)    │  │
│  │ getAll()       │  │
│  │ getReliability()│  │
│  └────────────────┘  │
└──────────────────────┘
```

---

## 4. Source Registry Architecture

### 4.1 Core Type: `SourceRegistryRecord`

```typescript
// Proposed — lib/source-registry/types.ts
export type SourceRegistryRecord = {
  sourceId: number;          // public.sources.id (stable PK)
  sourceName: string;        // public.sources.name ("EasyCep", "Getmobil", ...)
  sourceSlug: string;        // public.sources.slug ("easycep", "getmobil", ...)
  type: string;              // "marketplace" | "refurbished"
  isActive: boolean;         // public.sources.is_active
  reliabilityScore: number;  // Computed or stored — replaces in-memory regex rules
  listingSource: ListingSource;  // Maps to the string union
};
```

### 4.2 SourceRegistry Interface

```typescript
// Proposed — lib/source-registry/types.ts
export interface SourceRegistry {
  /** Initialize by loading all rows from public.sources */
  initialize(supabase: SupabaseClient): Promise<void>;

  /** Lookup by numeric sourceId (used by Duplicate Engine, listing sync) */
  getById(sourceId: number): SourceRegistryRecord | null;

  /** Lookup by slug string (used by adapters, connectors) */
  getBySlug(slug: string): SourceRegistryRecord | null;

  /** Lookup by source name string (used by Confidence Engine name matching) */
  getByName(name: string): SourceRegistryRecord | null;

  /** Get all active sources */
  getAllActive(): SourceRegistryRecord[];

  /** Get all sources (including inactive/deprecated) */
  getAll(): SourceRegistryRecord[];

  /** Resolve reliability score for a sourceId */
  getReliability(sourceId: number): number;

  /** Resolve source count for diversity calculation */
  resolveSourceCount(id1: number | null, id2: number | null): number;

  /** Register a new source at runtime (for testing or hot-add) */
  register(record: SourceRegistryRecord): void;
}
```

### 4.3 Implementation Skeleton

```typescript
// Proposed — lib/source-registry/registry.ts
export class SourceRegistryImpl implements SourceRegistry {
  private byId = new Map<number, SourceRegistryRecord>();
  private bySlug = new Map<string, SourceRegistryRecord>();
  private byName = new Map<string, SourceRegistryRecord>();

  async initialize(supabase: SupabaseClient): Promise<void> {
    const { data, error } = await supabase
      .from("sources")
      .select("id, name, slug, type, is_active, reliability_score")
      .order("id");

    if (error) throw error;

    for (const row of data ?? []) {
      const record = this.rowToRecord(row);
      this.byId.set(record.sourceId, record);
      this.bySlug.set(record.sourceSlug, record);
      this.byName.set(record.sourceName.toLowerCase(), record);
    }
  }

  getReliability(sourceId: number): number {
    return this.byId.get(sourceId)?.reliabilityScore ?? 65;
  }

  resolveSourceCount(
    id1: number | null | undefined,
    id2: number | null | undefined,
  ): number {
    if (id1 == null || id2 == null) return 1; // neutral when unknown
    return id1 === id2 ? 1 : 2;
  }
}
```

### 4.4 Integration Points

```
┌─────────────────────────────────────────────────────────────┐
│                    Startup Bootstrap                         │
│                                                             │
│  app starts → SourceRegistry.initialize(supabase)           │
│                ↓                                            │
│           Loads 10 rows from public.sources                 │
│                ↓                                            │
│           Populates byId, bySlug, byName maps               │
│                ↓                                            │
│           Seeds Unified Source Engine registry              │
│           Seeds SOURCE_RELIABILITY_RULES from DB             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Runtime Resolution                        │
│                                                             │
│  Duplicate Engine   ──→  SourceRegistry.getReliability(id)  │
│  Confidence Engine  ──→  SourceRegistry.getByName(name)     │
│  Adapter System     ──→  SourceRegistry.getBySlug(slug)      │
│  Listing Sync       ──→  SourceRegistry.getById(id)          │
│  Source Engine      ──→  (already queries DB directly)       │
└─────────────────────────────────────────────────────────────┘
```

### 4.5 DB Schema Changes

Add `reliability_score` column to `public.sources`:

```sql
alter table public.sources
  add column if not exists reliability_score int
    not null default 65
    check (reliability_score between 0 and 100);

-- Populate from existing Confidence Engine values
update public.sources set reliability_score = 68 where slug = 'sahibinden';
update public.sources set reliability_score = 60 where slug = 'letgo';
update public.sources set reliability_score = 58 where slug = 'facebook-marketplace';
update public.sources set reliability_score = 92 where slug = 'easycep';
update public.sources set reliability_score = 90 where slug = 'getmobil';
update public.sources set reliability_score = 87 where slug = 'yenilenmis-market';
update public.sources set reliability_score = 86 where slug = 'teknosa-yenilenmis';
update public.sources set reliability_score = 85 where slug = 'hepsiburada-yenilenmis';
update public.sources set reliability_score = 84 where slug = 'mediamarkt-yenilenmis';
update public.sources set reliability_score = 65 where slug = 'satariz';  -- default
```

---

## 5. Stable ID Strategy

### 5.1 ID Allocation Rules

1. **`public.sources.id` is the sourceId** — Never reassign. These are `generated by default as identity` and persist forever.
2. **Deprecated sources** are marked `is_active = false` — never deleted, never re-ID'd.
3. **New sources** get the next auto-generated PK value — no gaps problem, no coordination needed.
4. **Application code never generates sourceId values** — all sourceId assignment flows through the Registry.

### 5.2 Current ID Map (Canonical)

| sourceId | slug | name | Current Bot ID | Current Unified ID | Conflict? |
|----------|------|------|---------------|-------------------|-----------|
| **1** | sahibinden | Sahibinden | — | — | — |
| **2** | letgo | Letgo | — | — | — |
| **3** | facebook-marketplace | Facebook Marketplace | — | — | — |
| **4** | easycep | EasyCep | 1 | 1 | None (consistent) |
| **5** | getmobil | Getmobil | 2 | 3 | **Yes — must fix** |
| **6** | yenilenmis-market | Yenilenmiş Market | — | — | — |
| **7** | teknosa-yenilenmis | Teknosa Yenilenmiş | — | — | — |
| **8** | hepsiburada-yenilenmis | Hepsiburada Yenilenmiş | — | — | — |
| **9** | mediamarkt-yenilenmis | MediaMarkt Yenilenmiş | — | — | — |
| **10** | satariz | Satarız | — | — | — |

**Resolution for INC-01**: Getmobil must use `sourceId: 5` everywhere (the DB PK). The bot adapter's `sourceId: 2` and the Unified Engine's `sourceId: 3` are both wrong. The value `sourceId=2` does not exist as a DB row — this confirms it was invented without reference to the DB.

### 5.3 What Gets Inventoried

Each adapter registration needs to be updated from its current hardcoded sourceId to a Registry-derived one:

| Adapter | Current ID | Canonical ID | Action |
|---------|-----------|-------------|--------|
| EasyCep (bot) | 1 | 4 | Update |
| EasyCep (unified) | 1 | 4 | Update |
| Getmobil (bot) | 2 | 5 | **Fix + update** |
| Getmobil (unified) | 3 | 5 | **Fix + update** |
| Commerce adapters | none | 6,7,8,9 | Add via config |
| Sahibinden | none | 1 | Add via config |
| Satarız (import) | none | 10 | Add via config |
| Letgo (import) | none | 2 | Add via config |
| Facebook (import) | none | 3 | Add via config |

---

## 6. Backward Compatibility

### 6.1 No Breaking Changes to DB Schema

The existing `public.sources` table is unchanged except for the additive `reliability_score` column. All existing queries, FKs, and RPCs continue to work.

### 6.2 String-Based Types Remain

`ListingSource`, `ImportSource`, and `BotAdapterListing.source` remain string-based. Numeric `sourceId` is **added** alongside, never replaces, the string name. This allows gradual migration:

```typescript
// Before (unchanged)
export type BotAdapterListing = {
  source: string;         // remains — backward compatible
  // ...
};

// After — additive
export type BotAdapterListing = {
  source: string;         // unchanged
  sourceId?: number;      // NEW: optional, populated by adapter
  // ...
};
```

### 6.3 CommerceAdapterConfig Gets Optional sourceId

```typescript
// Before
export type CommerceAdapterConfig = {
  sourceName: string;
  sourceType: string;
  // ...
};

// After — additive
export type CommerceAdapterConfig = {
  sourceName: string;
  sourceType: string;
  sourceId?: number;       // NEW: optional, populated at adapter creation
  // ...
};
```

### 6.4 ImportSource Gets Numeric Bridge

```typescript
// Proposed — lib/source-registry/source-map.ts
// Reverse map: ImportSource -> sourceId
// Used by import pipeline to attach sourceId to NormalizedImportListing

export const IMPORT_SOURCE_TO_ID: Record<ImportSource, number> = {
  "Sahibinden": 1,
  "Letgo": 2,
  "Facebook Marketplace": 3,
  "EasyCep": 4,
  "Getmobil": 5,
  "Yenilenmiş Market": 6,
  "Teknosa Yenilenmiş": 7,
  "Hepsiburada Yenilenmiş": 8,
  "MediaMarkt Yenilenmiş": 9,
};
```

This map is **generated from the SourceRegistry at build time**, not hardcoded. The import pipeline adds `sourceId` to listings at normalization time.

### 6.5 ComparisonListing.sourceId Becomes Required (Eventually)

```typescript
// Phase 4 end state
export type ComparisonListing = {
  // ... existing fields
  sourceId: number;  // required — no more ?? 1 fallback
};
```

In the interim (Phases 1–3), `sourceId` remains optional with the fallback removed or replaced with a warning log.

### 6.6 Deprecated Types Schema

| Deprecated Type | File | Replacement | Compat Strategy |
|----------------|------|-------------|-----------------|
| `source-adapters/NormalizedListing` (no sourceId) | `lib/source-adapters/types.ts` | Unified `NormalizedListing` (has sourceId) | String sourceName preserved until removal |
| `ListingSource` string-only | `lib/listings.ts` | Augmented with sourceId via Registry | String enum unchanged |
| `ImportSource` string-only | `lib/import/types.ts` | Augmented with sourceId via Registry | String enum unchanged |

---

## 7. Migration Phases

### Phase 0: Architecture Approval

**No code changes**. This document.

**Deliverable**: Signed-off architecture document.

---

### Phase 1: Create SourceRegistry (Read-Only)

**Goal**: Build the SourceRegistry class that reads from `public.sources`. Zero behavior changes to consumers.

**Files to create**:
- `lib/source-registry/types.ts` — `SourceRegistryRecord`, `SourceRegistry` interface
- `lib/source-registry/registry.ts` — `SourceRegistryImpl` implementation
- `lib/source-registry/index.ts` — barrel exports
- `lib/source-registry/__tests__/registry.test.ts` — tests with mocked Supabase

**Files to modify**:
- `supabase/sources-and-bots.sql` — add `reliability_score` column + seed values

**Additive changes only**:
- No consumer code changes
- `getReliabilityScore()` returns values matching current `SOURCE_RELIABILITY_RULES` array
- All existing in-memory rules remain untouched

**Validation**: Registry loads 10 rows from mock DB; all lookups return correct records.

---

### Phase 2: Adapter Registration via Registry

**Goal**: SourceRegistry seeds all adapter registrations. Fix Getmobil ID mismatch.

**Files to modify**:
- `lib/unified-source-engine/adapters/index.ts`
  - Read sourceId from Registry instead of hardcoding
  - Register all 10 sources, not just 2
  - Fix Getmobil: `sourceId: 3` → `sourceId: 5`
- `lib/bots/adapters/getmobil-adapter.test.ts`
  - `sourceId: 2` → `sourceId: 5`
- `lib/bots/connectors.ts`
  - `getStandardSourceAdapter` uses Registry for config defaults

**Additive changes only**:
- Existing adapter code unchanged — only the config values change
- `SourceIntegrationConfig.sourceId` now comes from Registry

**Getmobil Fix Details**:
```
Before:  Bot adapter sourceId=2, Unified Engine sourceId=3
After:   Both use sourceId=5 (public.sources PK for Getmobil)

Impact on Duplicate Engine:
- Old: two Getmobil listings had different sourceIds (2 ≠ 3) → sourceDiversity=50, reliability=70
       → treated as DIFFERENT sources (false cross-source diversity)
- New: two Getmobil listings both have sourceId=5 → sourceDiversity=0, reliability=90
       → treated as SAME source (correct)
```

**Migration safety**:
- No consumer reads sourceId=2 or sourceId=3 and depends on their values
- The only subsystem consuming numeric sourceId is the Duplicate Engine (scoring.ts, engine.ts)
- Fixing Getmobil to 5 **decreases false diversity** and **increases reliability accuracy** — both are strictly correct

**Files to also update for consistency**:
- `lib/bots/adapters/easycep-adapter.test.ts` — `sourceId: 1` → `sourceId: 4` (cosmetic, no functional impact since 1≠4 but both are unique; prevents future confusion when EasyCep DB ID=4)

---

### Phase 3: Confidence + Duplicate Engine Integration

**Goal**: Connect Duplicate Engine reliability to the Registry instead of flat 70/55. Connect Confidence Engine reliability to Registry instead of regex array.

**Files to modify**:
- `lib/confidence-engine/helpers.ts`
  - `SOURCE_RELIABILITY_RULES` becomes a generated array from `SourceRegistry`
  - `resolveSourceReliabilityFromName()` queries Registry by name instead of iterating regex rules
- `lib/duplicate-engine/engine.ts`
  - `resolveSourceReliability()` queries `Registry.getReliability(id)` instead of flat 70/55
  - Reliability = average of both sources' reliability scores

**Reliability recalculation** (before vs after):

| Source Pair | Before (flat) | After (registry) | Delta |
|------------|---------------|-------------------|-------|
| EasyCep × Getmobil | 70 | 91 (avg 92+90) | **+21** |
| EasyCep × Sahibinden | 70 | 80 (avg 92+68) | **+10** |
| Getmobil × Getmobil | 55 | 90 (same source) | **+35** |
| Sahibinden × Sahibinden | 55 | 68 (same source) | **+13** |
| Facebook × Facebook | 55 | 58 | **+3** |
| Letgo × Sahibinden | 70 | 64 (avg 60+68) | **-6** |

**Duplicate Engine sourceReliability becomes source-aware**: same-source comparisons get the source's own reliability score (was flat 55). Cross-source comparisons get the average (was flat 70).

**No behavioral change for consumer API**: `resolveSourceReliability()` returns a number; callers don't change.

---

### Phase 4: Populate sourceId Across All Sources

**Goal**: Every listing flowing through the system carries a valid numeric sourceId.

**Files to modify**:

| Change | File | What |
|--------|------|------|
| Add sourceId to CommerceAdapterConfig | `lib/bots/adapters/commerce.ts` | `sourceId?: number` field |
| Commerce adapters pass sourceId | `lib/bots/adapters/commerce.ts` (createListing) | Attach `sourceId` to BotAdapterListing output |
| Sahibinden raw scraper wraps in StandardSourceAdapter | `lib/bots/adapters/sahibinden.ts` + `connectors.ts` | Create StandardSourceAdapter wrapper; sourceId from Registry |
| Import pipeline attaches sourceId | `lib/import/types.ts` + `lib/import/adapters.ts` | `NormalizedImportListing` gets `sourceId: number` |
| Import adapters fill sourceId | `lib/import/adapters.ts` | `normalizeCommon()` sets `sourceId` via `IMPORT_SOURCE_TO_ID` or Registry |
| BotAdapterListing gets optional sourceId | `lib/bots/types.ts` | `sourceId?: number` additive field |

**Commerce adapter wiring** (example for Yenilenmiş Market):
```typescript
// Before
const config: CommerceAdapterConfig = {
  sourceName: "Yenilenmiş Market",
  sourceType: "refurbished",
  // no sourceId
};

// After
const config: CommerceAdapterConfig = {
  sourceName: "Yenilenmiş Market",
  sourceType: "refurbished",
  sourceId: registry.getBySlug("yenilenmis-market")?.sourceId, // = 6
};
```

**Sahibinden wrapper**: The raw scraper is the only source not using `StandardSourceAdapter`. Wrapping it in Phase 4 means:
- Sahibinden uses the same `createStandardSourceAdapter` helper
- Sahibinden listings carry `sourceId: 1` in their normalized form
- No change to the actual scraping logic (fetchSahibindenListings lives on)

**Satarız**: `ListingSource` already includes "Satarız" but it's excluded from `ImportSource`. If Satarız gets an adapter later, it uses `sourceId: 10` from the Registry.

---

### Phase 5: Duplicate Engine sourceDiversity Fix + Remove Fallbacks

**Goal**: Fix the null→100 bug and remove hardcoded fallback IDs.

**Files to modify**:
- `lib/duplicate-engine/scoring.ts`
  - `calculateSourceDiversityScore()`: null → **return neutral weight** (not 100)

```typescript
// Before (bug)
export function calculateSourceDiversityScore(
  sourceId1: number | null | undefined,
  sourceId2: number | null | undefined
): number {
  if (!sourceId1 || !sourceId2) return 100;  // null = perfect diversity
  return sourceId1 === sourceId2 ? 0 : 50;
}

// After (fix)
export function calculateSourceDiversityScore(
  sourceId1: number | null | undefined,
  sourceId2: number | null | undefined
): number {
  if (sourceId1 == null || sourceId2 == null) return 50;  // neutral when unknown
  return sourceId1 === sourceId2 ? 0 : 50;
}
```

- `lib/product-matcher/duplicate.ts`
  - Remove all `?? 1` and `?? 2` fallbacks
  - sourceId is now guaranteed present (Phase 4 ensures this)

```typescript
// After — sourceId is required
sourceId: reference.sourceId,  // no fallback
```

- If a listing reaches the matcher without sourceId, log a warning and use `sourceId: 0` (sentinel for "unknown") rather than colliding with real source IDs.

**Duplicate Engine sourceCount fix** (`engine.ts`):
```typescript
// Before
function resolveSourceCount(sourceId1, sourceId2) {
  if (sourceId1 == null || sourceId2 == null) return 1;
  return sourceId1 === sourceId2 ? 1 : 2;
}

// After — delegates to Registry
function resolveSourceCount(sourceId1, sourceId2) {
  return registry.resolveSourceCount(sourceId1, sourceId2);
}
```

---

### Phase 6: Retire Legacy Systems

**Goal**: Remove deprecated source-adapters. Clean up hardcoded registration files.

**Files to delete**:
- `lib/source-adapters/types.ts`
- `lib/source-adapters/index.ts`
- `lib/source-adapters/` (entire directory, with confirmation that no imports remain)

**Files to archive**:
- `lib/bots/adapters/easycep-adapter.ts` — deprecated in favor of unified engine
- `lib/bots/adapters/getmobil-adapter.ts` — deprecated in favor of unified engine

**Files to clean up**:
- `lib/unified-source-engine/adapters/index.ts` — reads from Registry only, no hardcoded IDs
- `lib/bots/connectors.ts` — legacy fallback chain removed; only Registry path remains

---

## 8. Extensibility Model

### 8.1 Adding a New Source

**Before Source Registry** (current state): Add to 5+ locations, worry about ID collisions, update 2+ enums, update 2 regex arrays, hope nothing breaks.

**After Source Registry**:

```
Step 1: INSERT INTO public.sources (name, slug, base_url, type, reliability_score)
         VALUES ('Yeni Kaynak', 'yeni-kaynak', 'https://...', 'marketplace', 70);
         -- DB auto-generates sourceId = 11

Step 2: Create adapter file (e.g., lib/bots/adapters/yeni-kaynak.ts)
         -- Adapter reads config from SourceRegistry by slug

Step 3: Register in connectors.ts SCRAPE_FETCHERS map
         -- Same pattern as existing sources

Step 4: (If needed) Add to ListingSource union in lib/listings.ts
         -- Only needed if the new source has a new name not covered by existing string types
```

**No changes required**:
- SourceRegistry loads new row at next startup → all `getById`, `getBySlug`, `getByName` routes work
- Duplicate Engine reliability → `getReliability(sourceId=11)` returns the configured value
- Confidence Engine → `getByName("Yeni Kaynak")` returns the record
- No hardcoded arrays to update
- No ID collision risk

### 8.2 Deprecating a Source

```
Step 1: UPDATE public.sources SET is_active = false WHERE slug = 'old-source';
         -- Registry still returns it via getAll(), filtered out of getAllActive()
         -- Existing FK references (bot_runs.source_id) remain valid
         -- No data loss, no migration needed

Step 2: (Eventually) Remove adapter code
```

### 8.3 TypeScript Type Generation

For build-time type safety, generate `ListingSource` and `ImportSource` from the DB:

```typescript
// Proposed — auto-generated from DB rows at build time
// lib/source-registry/generated.ts

export type ListingSource = 
  | "Sahibinden" 
  | "Letgo" 
  | "Facebook Marketplace" 
  | "EasyCep" 
  | "Getmobil" 
  | "Yenilenmiş Market" 
  | "Teknosa Yenilenmiş" 
  | "Hepsiburada Yenilenmiş" 
  | "MediaMarkt Yenilenmiş" 
  | "Satarız";
```

This can be automated (generate from `SELECT name FROM public.sources WHERE is_active = true`) or kept as a manually-synced type with a CI check that validates it matches the DB.

---

## 9. Dependency Map

### 9.1 What Depends on sourceId Today

```
sourceId (numeric)
  ├── Duplicate Engine scoring.ts → calculateSourceDiversityScore()
  ├── Duplicate Engine engine.ts → resolveSourceCount(), resolveSourceReliability()
  ├── product-matcher duplicate.ts → detectListingDuplicates(), groupListingDuplicates()
  ├── product-matcher types.ts → ComparisonListing.sourceId
  ├── Source Engine engine.ts → options.sourceId filter
  ├── Bot adapters → StandardSourceAdapter.sourceId
  ├── Unified Source Engine → UnifiedSourceAdapter.sourceId
  ├── listing-sync.ts → syncListingsForSource(sourceId)
  └── bot_runs table → source_id FK → public.sources(id)

sourceName (string)
  ├── Confidence Engine helpers.ts → SOURCE_RELIABILITY_RULES (regex match)
  ├── BotAdapterListing.source → stored in DB listings.source column
  ├── Listing type → ListingSource string union
  ├── Import type → ImportSource string union
  └── All UI rendering → display name

sourceSlug (string)
  ├── SourceConnector → keyed lookup in SCRAPE_FETCHERS
  ├── SourceRegistry → get(slug) lookup
  └── Default scrape URL resolution
```

### 9.2 Migration Ordering Dependency Graph

```
Phase 1: SourceRegistry
  ↓ (creates the lookup mechanism)
Phase 2: Adapter Registration
  ↓ (fixes IDs, seeds all adapters)
Phase 3: Engine Integration
  ↓ (connects reliability)
Phase 4: Populate sourceId
  ↓ (ensures all listings carry IDs)
Phase 5: Diversity Fix + Remove Fallbacks
  ↓ (consumes the populated IDs)
Phase 6: Retire Legacy
```

Phases 2 and 3 can be partially parallelized (reliability integration doesn't strictly depend on all adapters being registered), but Phases 4 and 5 must remain sequential: you must populate sourceId before you can remove the fallbacks that compensated for missing sourceId.

### 9.3 Blocking Dependencies

| Change | Blocked By | Why |
|--------|-----------|-----|
| Remove `?? 1` fallback | Phase 4 (all listings have sourceId) | Otherwise listings without sourceId crash |
| Fix null→100 diversity bug | Phase 4 (at least) | Without sourceId populated, null is common — fixing the bug before populating sourceId would change scores for legitimately missing data |
| Remove easycep-adapter.ts | Phase 6 (unified engine covers all sources) | Currently only 2 of 10 sources in unified engine |
| Remove source-adapters directory | Phase 6 | Must verify zero imports remain |

### 9.4 External Dependencies

| Dependency | What It Depends On | Risk |
|-----------|-------------------|------|
| `bot_runs.source_id` FK | `public.sources.id` stability | Low — PKs never change |
| `sync_source_listings(p_source_id)` RPC | `public.sources.id` stability | Low — parameter is already correct |
| `process-search-queue` route | DB `sources.id` for bot runs | Low — already uses DB query |
| Price history by source name | `BotAdapterListing.source` string | Low — string unchanged by migration |

---

## 10. Risk Register

### R-01: Hot Reload / Serverless Startup

In serverless environments, the SourceRegistry must be initialized on every cold start. Loading 10 rows from `public.sources` is fast (~5ms), but the `initialize()` call must happen before any adapter runs.

**Mitigation**: Lazy initialization pattern — first `getById()` call triggers `initialize()` if not yet loaded. Also add explicit `initializeSourceRegistry()` call in the app bootstrap (e.g., `layout.tsx` or middleware).

### R-02: SourceRegistry Drift from DB

If a row is added/changed in `public.sources` while the app is running, the in-memory SourceRegistry would be stale.

**Mitigation** (Phase 1 only, no production concern):
- Acceptable: Registry is stale until next cold start (10 sources, rarely changes)
- Future: Add a `last_updated` column and periodic refresh, or a `reload()` method callable via API
- Accept for now: manual app restart after DB change

### R-03: sourceId Uniqueness During Migration

During Phases 2–4, different adapters will have different sourceId values for the same source until all are migrated. This creates temporary inconsistency.

**Mitigation**: Start Phase 2 with the Unified Source Engine (2 adapters), then bot adapters, then commerce — in that order. The overlap period is minimized to hours, not days. Test against a staging environment.

### R-04: Sahibinden Wrapper Breaking

The Sahibinden raw scraper has Cloudflare bypass logic (`anti-bot-proxy.ts`, Cloudflare detection). Wrapping it in `StandardSourceAdapter` must not change the fetching behavior.

**Mitigation**: `fetchSahibindenListings()` remains unchanged. The wrapper only adds `sourceId: 1` to the normalized output. Test the wrapper on a known URL list before deploying.

### R-05: Fallback Removal Breaks Unknown Listings

If a listing reaches the matcher without sourceId after Phase 5 (when `?? 1` is removed), it will evaluate as `undefined` → Duplicate Engine treats it differently.

**Mitigation**: After Phase 4, all adapters produce sourceId. Any listing that reaches the matcher without sourceId is a bug. Use `sourceId: 0` as a sentinel for "unknown" (never assigned by DB), and log a warning. The sentinel 0 is safe because `public.sources` PK starts at 1.

---

## Appendix A: Source of Truth Decision Record

| Decision | Rationale | Alternative Considered | Verdict |
|----------|-----------|----------------------|---------|
| `public.sources` as canonical | DB is persistent, has FK relationships, auto-generates IDs | TypeScript enum file → rejected (diverges, requires deploy) | **Accept** |
| SourceRegistry mirrors DB at startup | No DB dependency per-lookup, fast, cache-friendly | Direct DB query per lookup → rejected (N+1, latency per adapter call) | **Accept** |
| Reliability scores stored in DB | Single source of truth, changeable without code deploy | In-memory regex array → rejected (hardcoded, requires deploy per change) | **Accept** |
| Additive migration (no breaking changes) | Zero risk to current production behavior | Big-bang rewrite → rejected (unnecessary risk) | **Accept** |
| String types remain (sourceId added alongside) | Minimal diff, no UI changes, no DB migration for listings.source | Replace string with numeric → rejected (massive migration cost) | **Accept** |
| Bot stops using sourceId=2 and sourceId=3 for Getmobil | These are invented values that don't exist in DB | Keep both + add mapping layer → rejected (more complexity, no benefit) | **Accept** |

## Appendix B: Getmobil ID Fix Impact Analysis

| Metric | Before (ID=2/3) | After (ID=5) | Delta |
|--------|-----------------|--------------|-------|
| sourceDiversity: two Getmobil listings | 50 (different sourceIds 2≠3) → treated as different sources | 0 (same sourceId 5=5) → treated as same source | **Correct** |
| sourceReliability: two Getmobil listings | 70 (count≥2, flat) | 90 (same source → source's reliability) | **+20, correct** |
| sourceReliability: Getmobil × EasyCep | 70 (count≥2, flat) | 91 (avg 90+92) | **+21, correct** |
| sourceCount: two Getmobil listings | 2 (different IDs → 2 sources) | 1 (same ID → 1 source) | **Correct** |

The fix **decreases false diversity** and **increases accuracy** in all paths.

## Appendix C: Commerce Adapter sourceId Wiring

Current commerce adapters (`lib/bots/adapters/commerce.ts`) are created by `createCommerceAdapter()` or similar factory calls. They receive `CommerceAdapterConfig` which has `sourceName: string` only.

**Phase 4 wiring**:
```typescript
// Each commerce adapter creation call:
const sourceRecord = registry.getBySlug("yenilenmis-market"); // sourceId=6

const config: CommerceAdapterConfig = {
  sourceName: sourceRecord.sourceName,
  sourceType: "refurbished",
  category: "cep-telefonu",
  sourceId: sourceRecord.sourceId, // ← ADDED
};
```

The `createListing()` function then attaches `sourceId` to the `BotAdapterListing` output:
```typescript
// In createListing():
return {
  ...listing,
  source: config.sourceName,
  seller_name: sellerName || config.sourceName,
  sourceId: config.sourceId,  // ← ADDED
  // ...
};
```

The 4 commerce adapters to wire:
| Adapter | Config File | sourceName | sourceId |
|---------|------------|------------|----------|
| Yenilenmiş Market | `lib/bots/adapters/yenilenmis-market.ts` or similar | "Yenilenmiş Market" | 6 |
| Teknosa Yenilenmiş | `lib/bots/adapters/teknosa.ts` or similar | "Teknosa Yenilenmiş" | 7 |
| Hepsiburada Yenilenmiş | `lib/bots/adapters/hepsiburada.ts` or similar | "Hepsiburada Yenilenmiş" | 8 |
| MediaMarkt Yenilenmiş | `lib/bots/adapters/mediamarkt.ts` or similar | "MediaMarkt Yenilenmiş" | 9 |

## Appendix D: Source Registry File Map

```
lib/
├── source-registry/                    # NEW directory
│   ├── types.ts                       # SourceRegistryRecord, SourceRegistry interface
│   ├── registry.ts                    # SourceRegistryImpl
│   ├── index.ts                       # Barrel exports
│   └── __tests__/
│       └── registry.test.ts           # Tests
│
├── confidence-engine/
│   └── helpers.ts                     # SOURCE_RELIABILITY_RULES → generate from registry (P3)
│
├── duplicate-engine/
│   ├── engine.ts                      # resolveSourceReliability → query registry (P3)
│   └── scoring.ts                     # calculateSourceDiversityScore null fix (P5)
│
├── product-matcher/
│   └── duplicate.ts                   # Remove ?? 1/?? 2 fallbacks (P5)
│
├── unified-source-engine/
│   └── adapters/index.ts              # Read from registry, not hardcoded (P2)
│
├── bots/
│   ├── types.ts                       # BotAdapterListing.sourceId? (P4)
│   ├── connectors.ts                  # Registry-backed config (P2)
│   └── adapters/
│       ├── commerce.ts                # CommerceAdapterConfig.sourceId? (P4)
│       └── sahibinden.ts              # StandardSourceAdapter wrapper (P4)
│
└── import/
    ├── types.ts                       # NormalizedImportListing.sourceId (P4)
    └── adapters.ts                    # Attach sourceId at normalization (P4)

supabase/
└── sources-and-bots.sql               # Add reliability_score column (P1)
```

---

*End of architecture document. This document describes the target state only — no implementation changes have been made.*
