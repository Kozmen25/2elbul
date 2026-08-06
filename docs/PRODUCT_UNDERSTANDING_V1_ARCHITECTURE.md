# Product Understanding Engine V1 — Architecture Document

> **Status:** Architecture Review (Updated for Product-First Ordering)  
> **Author:** Architecture Research (P-17 Post-Rollout 4)  
> **Target:** Single source of truth for product type inference across all engines  
> **Constraint:** No implementation until approved. Read-only document.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State: 4 Independent Inference Points](#2-current-state-4-independent-inference-points)
3. [Duplicate Logic Inventory](#3-duplicate-logic-inventory)
4. [Consumer Map: 12 Consumers Across the Platform](#4-consumer-map-12-consumers-across-the-platform)
5. [Gap Analysis: What P-17 Rollout 4 Left Unfinished](#5-gap-analysis-what-p-17-rollout-4-left-unfinished)
6. [Proposed V1 Architecture](#6-proposed-v1-architecture)
7. [Migration Plan: How Each Consumer Migrates](#7-migration-plan-how-each-consumer-migrates)
8. [Risk Analysis](#8-risk-analysis)
9. [Rollout Phases](#9-rollout-phases)
10. [Appendix: Taxonomy Reference](#10-appendix-taxonomy-reference)

---

## 1. Executive Summary

2ElBul currently has **4 independent places** that infer what a product is (phone vs. accessory vs. spare part), and **12 consumers** that read or could read this signal. The P-17 effort built a Product Understanding Engine and deployed it across all 4 rollouts, but it left critical gaps:

- **No top-level `deviceFamily` / `deviceModel`** — these exist only as `compatibleDevice`/`compatibleFamily` fields (meant for accessories, not the product itself)
- **12 of 20 AccessoryType values are unreachable** — patterns exist for only 8
- **`detectCategory()` in normalization/engine.ts runs completely duplicate logic** — ~30 accessory keywords + 4 accessory brands, separate from the engine's 8 categorized patterns + 25 brands
- **`CategoryResolver` in taxonomy/resolver.ts has zero accessory awareness** — "iPhone 14 Pro Max Ekran Koruyucu" classifies as "Telefon > Akıllı Telefon"
- **Confidence Engine has a 0.05 `productUnderstandingScore` weight that is never populated** — always contributes zero
- **Duplicate Engine has a 0.10 `productTypeScore` weight that is always neutral** — never populated, always returns 50
- **Home page is the only runtime consumer** — product detail receives the data but the frontend discards it

**V1 solves this** by enforcing a **mandatory product-first ordering**: the engine must first determine WHAT is being sold, THEN determine device identity. This fixes the fundamental flaw where "iPhone 14 Pro Max Ekran Koruyucu" was treated as an iPhone 14 Pro Max (a phone) instead of a screen protector for iPhone 14 Pro Max.

**New mandatory ordering: Primary Product → Device Family → Variant → Confidence**

The engine's pipeline is restructured to:
1. Identify the actual product entity first (screen protector, case, phone, battery, repair service)
2. Determine device family based on what the product IS
3. Extract variants and compatibility information
4. Assign confidence scores

---

## 2. Current State: 4 Independent Inference Points

### 2.1 Product Understanding Engine (P-17, Current)

| Property | Value |
|---|---|
| **Location** | `lib/product-understanding/engine.ts:373` |
| **Method** | Multi-signal fusion (8 weighted signals) |
| **Output** | `products.attributes` JSONB column |
| **Coverage** | Accessory patterns (8/20 types), spare part patterns (6 types) |
| **Confidence** | Per-field `{ value, confidence }` |
| **Device family** | Only as `compatibleDevice`/`compatibleFamily` (for accessories) |

**Strengths:** Multi-signal fusion, confidence scoring, categorized patterns, strip-and-extract  
**Weaknesses:** No top-level device identity, incomplete accessory coverage, spare_part never gets accessory sub-type, **violates product-first ordering** — compatible device extraction runs before product entity identification

### 2.2 `detectCategory()` in Normalization Engine

| Property | Value |
|---|---|
| **Location** | `lib/normalization/engine.ts:584` |
| **Method** | Linear keyword match + brand list |
| **Accessory keywords** | `kilif`, `sarj`, `kablo`, `usb`, `hdmi`, `donusturucu`, `aksesuar` (~7) |
| **Accessory brands** | `omix`, `anker`, `logitech`, `jbl` (4) |
| **Output** | Turkish category string or null |
| **Used by** | `home-data.ts:204` (fallback), `extractProductSignals()` |

**Strengths:** Fast, simple, catches basic cases  
**Weaknesses:** No confidence, no sub-types, flat keyword list, **completely independent** from Product Understanding Engine

### 2.3 `CategoryResolver` in Taxonomy

| Property | Value |
|---|---|
| **Location** | `lib/taxonomy/resolver.ts` |
| **Method** | First-match-wins regex patterns |
| **Accessory awareness** | **Zero** — no rules for accessories at all |
| **Example failure** | "iPhone 14 Pro Max Ekran Koruyucu" → "Telefon > Akıllı Telefon" |
| **Fallback chain** | `integration.ts`: new-engine → legacy → `{ categoryId: "default" }` |

### 2.4 Import Pipeline (P-17 Rollout 2a)

| Property | Value |
|---|---|
| **Location** | `lib/import/import-listings.ts:139` |
| **Role** | Writes `analyzeProduct()` result to `products.attributes` |
| **Non-fatal** | Engine failure doesn't roll back listing import |

This is the **single write path** — all consumers read from `products.attributes`.

---

## 3. Duplicate Logic Inventory

| ID | Location | What it does | Lines | Status |
|---|---|---|---|---|
| D1 | `normalization/engine.ts:586-603` | Accessory keyword + brand check (7 keywords, 4 brands) | ~17 | **DUPLICATE** of engine.ts |
| D2 | `normalization/engine.ts:475` | `detectCategory()` called inside `extractProductSignals()` | 1 | **DUPLICATE** consumer path |
| D3 | `taxonomy/resolver.ts:entire` | CategoryResolver has zero accessory rules | ~200 | **GAP** — should delegate |
| D4 | `product-understanding/engine.ts:332-343` | Only classifies accessoryType for `accessory`/`primary_product` — never for `spare_part` | ~11 | **GAP** |
| D5 | `product-understanding/accessory-patterns.ts` | Only 8 of 20 AccessoryType values have patterns | ~203 | **GAP** — 12 unreachable |

### Impact of D1 (Most Critical)

`detectCategory()` runs on every homepage load when `product.category` is null (line 204 of home-data.ts). It has:
- Different keywords than the Product Understanding Engine (`kilif` vs `kılıf` matching depends on normalization)
- Different brand list (4 vs 25)
- No confidence scoring
- No sub-type classification

This means **the same product can be classified differently** depending on which code path evaluates it.

---

## 4. Consumer Map: 12 Consumers Across the Platform

| # | Consumer | File | Current State | Impact |
|---|---|---|---|---|
| **1** | **Home page — listing stats** | `home-data.ts:278` | Filters `category === "Aksesuar"` from popular listed products | ✅ Working (via override at line 213) |
| **2** | **Home page — price opps** | `home-data.ts:390` | Filters `category !== "Aksesuar"` | ✅ Working |
| **3** | **Home page — price drops** | `home-data.ts:393` | Filters `category !== "Aksesuar"` | ✅ Working |
| **4** | **Home page — market pulse** | `home-data.ts:466` | Filters `category !== "Aksesuar"` | ✅ Working |
| **5** | **Home page — category stats** | `home-data.ts:291-309` | Composite key `productName||category` for price stats | ✅ Working |
| **6** | **Product detail — data** | `product-detail.ts:276-278` | Reads `attributes as ProductUnderstandingResult` | ✅ Wired but **dead data** — page doesn't render it |
| **7** | **Product detail — frontend** | `product/[slug]/page.tsx` | Receives `productUnderstanding` but never uses it | ❌ **Dead data path** |
| **8** | **Confidence Engine** | `confidence-engine/helpers.ts` | `productUnderstandingScore` (0.05 weight) **never populated** | ❌ **MISSING** — highest-impact opportunity |
| **9** | **Duplicate Engine** | `duplicate-engine/helpers.ts:3-27` | `productType` on `ComparisonInput` **never populated** (0.10 weight always neutral) | ❌ **MISSING** — highest-impact opportunity |
| **10** | **Market Intelligence** | `market-intelligence/types.ts:17` | `MarketIntelligenceScope.productType` exists but never set | ❌ **DEAD FIELD** |
| **11** | **Opportunity Engine** | `opportunity-engine/types.ts` | No product type signal in `OpportunitySignalContext` | ❌ **MISSING** |
| **12** | **Intelligence Engine** | `intelligence-engine.ts` | No product type input — treats all products identically | ❌ **MISSING** |

### Consumers Not Yet Connected (lower priority)

| # | Consumer | File | Current State |
|---|---|---|---|
| 13 | Search page | `search/page.tsx` | Reads `products.category` DB column only |
| 14 | Category Intelligence | `category-intelligence.ts` | Uses own keyword routing |
| 15 | AI Decision Card | `product/[slug]/page.tsx:484` | Shows `product.category` DB column, not PU |
| 16 | Market Pulse | `market-pulse.ts` | Indirect — receives pre-filtered data |

---

## 5. Gap Analysis: What P-17 Rollout 4 Left Unfinished

### Gap 1: No Top-Level Device Identity

**Current state:** `ProductUnderstandingResult` has `compatibleDevice`, `compatibleFamily`, `compatibleBrand`, `compatibleModel` — all describing what the product IS FOR (accessory compatibility), not what the product IS.

**What's missing:** The product itself has no `deviceFamily` or `deviceModel`. A "Samsung Galaxy S24" listing has no top-level device identity — only a `compatibleDevice` field that stays null (since it's not an accessory, the extractor doesn't run).

**Impact:** Product detail can't show "Bu ürün: Samsung Galaxy S24" — it only shows category as "Telefon". Price history can't segment by device model.

### Gap 2: Incomplete Accessory Coverage

**Current state:** 12 of 20 `AccessoryType` union values have no pattern entries:

```
holder, lens, battery, keyboard, mouse, watch, airpods,
tripod, selfie_stick, stand, filter, cleaner
```

**Impact:** "iPhone 14 Pro Max Pil" → detected as `accessory` (battery is a spare_part pattern, not accessory) but the correct type would be `spare_part > battery`. Products that ARE batteries (power banks) ARE in the accessory patterns. So batteries sold AS accessories vs. AS spare parts get different treatment.

### Gap 3: `detectCategory()` Not Consolidated

**Current state:** `detectCategory()` at normalization/engine.ts:584 independently detects accessories with 7 keywords + 4 brands vs. the engine's 8+ patterns + 25 brands.

**Impact:** Two truth sources, different maintenance cycles, different results for the same input.

### Gap 4: Confidence Engine `productUnderstandingScore` Never Wired

**Current state:** Signal name defined (types.ts:23), weight assigned 0.05 (scoring.ts:22), but `buildDuplicateConfidenceInput()` and `buildProductMatcherConfidenceInput()` never populate it.

**Impact:** 5% of every confidence score is always zero. The `productUnderstandingScore` is effectively dead code.

### Gap 5: Duplicate Engine `productType` Never Wired

**Current state:** `ComparisonInput.productType` defined (types.ts:46), `productTypeScore` weighted at 0.10 (scoring.ts:269), but `createComparisonInput()` never accepts or passes it.

**Impact:** 10% of every duplicate score is always neutral (50). Two identical phone models where one is the phone and one is a case → should score ~90 (different product types), instead scores ~95 (no type discrimination).

### Gap 6: `spare_part` Never Gets Accessory Sub-Type

**Current state:** engine.ts:332-343 only sets `accessoryType` when productType is `accessory` or `primary_product`. A `spare_part` like "iPhone X Batarya" gets `productType: "spare_part"` but `accessoryType: null`.

**Impact:** Can't distinguish "iPhone X Batarya" (spare part battery) from "Samsung Şarj Aleti" (accessory charger) at the sub-type level.

### Gap 7: CategoryResolver Has Zero Accessory Awareness

**Current state:** taxonomy/resolver.ts has no accessory rules. The fallback chain (integration.ts) tries new engine → legacy → default, but the legacy resolver always falls through to default for accessories not caught by `detectCategory()`.

**Impact:** If `detectCategory()` misses an accessory (unlikely keywords), it gets categorized as a phone/tablet/etc. Home page is the only safeguard with the Product Understanding Engine override.

### Gap 8 (NEW — Critical): Missing Product-First Ordering

**Current state:** The `analyzeProduct()` pipeline (engine.ts:374-431) runs:
1. `detectProductType()` — determines accessory vs spare_part vs primary_product
2. `extractCompatibleDevice()` — strip-and-extract for accessories/spare_parts
3. Condition, seller type, warranty detection

The engine jumps from "it's an accessory" directly to "what device is it for?" without ever asking "what accessory IS this?" The strip-and-extract algorithm blindly removes known accessory keywords, then whatever remains is assumed to be the device name. This means:

- "iPhone 14 Pro Max Ekran Koruyucu" → extracts "iPhone 14 Pro Max" → assigns compatibleDevice = "iPhone 14 Pro Max"
- But never explicitly identifies: "This is a **screen protector**"
- The accessoryType is detected (line 332-342) but only as a side effect of pattern matching, NOT as the primary purpose of the step

**The deeper problem:** The engine's architecture treats "what is the product" and "what device is it for" as a single step (strip-and-extract). They must be two separate ordered steps:

1. **First:** Identify the product entity (screen protector, case, phone, battery, repair)
2. **Then:** Determine device identity and compatibility based on what the product IS

**Impact:** Without this ordering, "Samsung Galaxy S24 Ultra Kılıf" is treated as "a Samsung Galaxy S24 Ultra (phone) with case keywords present" instead of "a case for Samsung Galaxy S24 Ultra." The strip-and-extract removes "kılıf" and produces the right compatibleDevice, but the engine never **states** that the product is a case. This missing explicit identification cascades: the engine can't answer "what accessories are trending" because it never formally identifies what each accessory IS.

---

## 6. Proposed V1 Architecture

### 6.1 Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    LAYER 3: CONSUMERS                    │
│  Home │ Detail │ Search │ Duplicate │ Confidence │ MI   │
│  Opportunity │ Intelligence │ Market Pulse │ AI Cards   │
└──────────────────────┬──────────────────────────────────┘
                       │ READ via products.attributes
┌──────────────────────▼──────────────────────────────────┐
│               LAYER 2: PRODUCT UNDERSTANDING             │
│              (Single Source of Truth)                    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │            ProductUnderstandingResult              │   │
│  │                                                    │   │
│  │  productType:        "accessory" [conf: 92]        │   │
│  │  accessoryType:      "screen_protector" [conf: 90] │   │
│  │  deviceFamily:       "Spigen" [conf: 85]           │   │  ← Product's own identity
│  │  deviceModel:        "Spigen" [conf: 85]           │   │  ← (accessory brand for accessories)
│  │  compatibleDevice:   "iPhone 15 Pro Max" [conf: 88]│   │  ← What it's FOR (NOT self)
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Pipeline (mandatory order):                             │
│    1. Product Entity Identification                     │
│    2. Device Identity Determination                     │
│    3. Compatibility Extraction                           │
│    4. Confidence Scoring                                 │
│                                                          │
│  Sub-engines: Signal Fusion | Pattern Registry |         │
│  Strip-and-Extract | Price Signal | Seller Type          │
│  Warranty | Condition                                    │
└──────────────────────┬──────────────────────────────────┘
                       │ WRITE via import pipeline
┌──────────────────────▼──────────────────────────────────┐
│               LAYER 1: INFERENCE POINTS                  │
│                                                          │
│  Import Pipeline (single write path)                     │
│  └─ analyzeProduct() → products.attributes              │
│                                                          │
│  detectCategory() → DEPRECATED for accessory logic       │
│  CategoryResolver  → DEFERS to PU engine when available  │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Key Design Decisions

#### Decision 1 (Revised): Product Entity First — Mandatory Ordering

**Constraint:** The engine MUST follow this exact order:
```
Primary Product → Device Family → Variant → Confidence
```

**What this means in practice:**

The pipeline is restructured into explicit ordered steps:

**Step 1: Identify the Product Entity**
- Determine what is ACTUALLY being sold: `screen_protector`, `case`, `phone`, `battery`, `repair`, etc.
- This is NOT "extract device name from title" — it's "identify the product by its own descriptors"
- "iPhone 14 Pro Max Ekran Koruyucu" → Step 1 output: `accessory > screen_protector`
- "Samsung Galaxy S24 Ultra" → Step 1 output: `primary_product > phone`
- Use pattern matching against accessory/spare-part/service registries, PLUS multi-signal fusion
- Output: `{ productType, accessoryType/sparePartType/serviceType }` with confidence

**Step 2: Determine Device Identity (`deviceFamily`, `deviceModel`)**
- NOW that we know WHAT the product is, interpret device names correctly:
  - If `accessory > screen_protector`: the "iPhone 14 Pro Max" in the title means the product IS FOR that device → `deviceFamily` = accessory brand (Spigen), NOT iPhone 14
  - If `primary_product > phone`: the "iPhone 14 Pro Max" IS the product itself → `deviceFamily` = "iPhone 14 Pro Max"
  - If `spare_part > battery`: the "iPhone X" in the title means it's FOR iPhone X → `deviceFamily` = "Generic Battery" or battery brand, NOT iPhone X
- The key semantic split:
  - `deviceFamily` = "This listing IS about this product" (the product's own identity)
  - `compatibleDevice` = "This listing IS FOR this device" (compatibility target)
  - For accessories/spare_parts: `deviceFamily` = the brand/identity of the accessory itself, `compatibleDevice` = what it fits
  - For primary products: `deviceFamily` = "iPhone 15 Pro Max", `compatibleDevice` = null

**Step 3: Extract Compatibility (Variant)**
- For accessories/spare_parts only: determine specific compatible device model/variant
- Runs AFTER product entity identification so the extraction logic knows what to expect
- A screen protector's compatible device is "iPhone 15 Pro Max" — this is the variant
- A phone's variant might be "Pro Max" (sub-model within the family)

**Step 4: Confidence Scoring**
- Per-field confidence, plus overall product understanding confidence
- Completes the analysis

**How this differs from the current implementation:**

| Aspect | Current (P-17) | V1 (Product-First) |
|---|---|---|
| Pipeline order | productType → compatibleDevice → rest | Product Entity → Device Identity → Compatibility → Confidence |
| Product entity | Side effect of pattern matching | First-class output, explicitly identified |
| Device identity (primary products) | Extracted from title, no entity check | Extracted AFTER confirming product IS a primary device |
| Device identity (accessories) | Not set (compatibleDevice used instead) | Set to accessory brand (Spigen, Anker, etc.) |
| "iPhone 14 Pro Max Ekran Koruyucu" | compatibleDevice = "iPhone 14 Pro Max", never explicitly says "screen protector" | Step 1: screen_protector. Step 2: deviceFamily = brand. Step 3: compatibleDevice = "iPhone 14 Pro Max" |
| Risk of device-name-first misclassification | HIGH — title extraction runs before entity check | ZERO — entity check always runs first |

#### Decision 2: Price as Signal Only — Never Decision

**Current issues in codebase:**
- `CategoryResolver` uses no price signals at all
- `detectCategory()` uses no price signals
- Product Understanding Engine already does price correctly (line 155 — `getPriceSignal()`)

**V1 rule:** Price adjusts confidence, never makes binary decisions.
- 250 TL listing when market is 50,000 TL → increases accessory probability by +0.15 weight
- Should NEVER classify as "99% discount" or "error"
- Price thresholds are brand-specific (iPhone accessories have higher thresholds)
- Price signal weight remains at 0.15 (unchanged from P-17)

#### Decision 3: All 20 Accessory Types Reachable

Add patterns for the 12 missing types. Each needs:
- At least 2-3 Turkish keyword patterns
- Base confidence score
- False-positive protection keywords
- Expected `compatibleDevice` presence (e.g., `tripod` likely has no compatible device, `holder` usually does)

Priority for adding:
1. **High:** `holder` (tutacak, aparat, tutucu) — very common in phone accessories
2. **High:** `battery` (yedek batarya, pil) — overlaps with spare_part, needs clear boundary
3. **Medium:** `keyboard`, `mouse` — common computer accessories
4. **Medium:** `watch` (saat, kol saati, akıllı saat) — wearable category
5. **Low:** `lens`, `filter`, `cleaner` — camera accessories (lower volume)
6. **Low:** `airpods`, `selfie_stick`, `tripod`, `stand`, `charger-stand`

#### Decision 4: `detectCategory()` Deprecated for Accessory Logic

Replace the accessory keyword section of `detectCategory()` with a read of `products.attributes.productType`:

```
Old: keyword match → return "Aksesuar"
New: if product.attributes?.productType === "accessory" → return "Aksesuar"
     else → continue to phone/tablet/laptop patterns unchanged
```

**Why not remove entirely:** `detectCategory()` still handles phone/tablet/laptop/console classification with 0 dependencies. Only the accessory part is duplicated.

#### Decision 5: CategoryResolver Defers to PU Engine

Add a `canResolve()` check that short-circuits to the Product Understanding Engine result when confidence ≥ 70:

```
resolve(title) → 
  if PU engine result exists AND productType !== "primary_product" →
    return mapped category (Aksesuar/Yedek Parça/Hizmet)
  else →
    continue first-match-wins pattern matching (unchanged)
```

This prevents "iPhone 14 Pro Max Ekran Koruyucu" from ever reaching the phone patterns.

---

## 7. Migration Plan: How Each Consumer Migrates

### 7.1 Phase 1: Foundation — Restructure Pipeline + Complete Engine (No Consumer Changes)

| Task | File | Change |
|---|---|---|
| 1.1 | `types.ts` | Add `deviceFamily`, `deviceModel` to `ProductUnderstandingResult` |
| 1.2 | `engine.ts` | **Restructure `analyzeProduct()` pipeline** to follow mandatory ordering: Step 1 = Product Entity (explicit product/sub-type identification), Step 2 = Device Identity (deviceFamily for ALL types), Step 3 = Compatibility Extraction (compatibleDevice for accessories/spare_parts only), Step 4 = Confidence |
| 1.3 | `accessory-patterns.ts` | Add patterns for 12 missing accessory types |
| 1.4 | `engine.ts:332-343` | Also classify `accessoryType` when `productType === "spare_part"` |
| 1.5 | `compatible-device-extractor.ts` | Refactor to accept product entity context — extraction behavior differs by product type (screen protector extracts different terms than a case) |

**Pipeline restructure detail for Task 1.2:**

```
Current (P-17):
  1. detectProductType() → productType + sub-types (side effect)
  2. extractCompatibleDevice() → compatibleDevice (strip-and-extract)
  3. detectProductCondition()
  4. detectSellerType()
  5. detectWarranty()

V1 (Product-First):
  1. identifyProductEntity() → productType + accessoryType/sparePartType/serviceType (explicit, first-class)
     └─ Uses same patterns + signals, but output is "what IS this", not "what device is mentioned"
  2. determineDeviceIdentity(entity, title) → deviceFamily + deviceModel
     └─ For primary products: extract from title (it IS the device)
     └─ For accessories: accessory brand from brand field, or "Generic"
     └─ For spare parts: spare part brand from brand field, or "Generic"
     └─ For services: null
  3. extractCompatibility(entity, title) → compatibleDevice + compatibleBrand/Family/Model
     └─ Only for accessories/spare_parts: strip-and-extract
     └─ NOT for primary products or services
  4. detectProductCondition()
  5. detectSellerType()
  6. detectWarranty()
  7. Build full ProductUnderstandingResult with confidence
```

**The critical behavioral change:**
- In Step 1, `identifyProductEntity()` MUST run BEFORE any device name extraction
- Pattern matching identifies the product entity (screen protector, case, battery)
- The device name in the title is NOT used to determine the product entity
- Only after the entity is known does the engine interpret device names

**Validation:** 0 regressions in existing tests. New tests confirming that product entity is always identified before device extraction. New tests for "iPhone 14 Pro Max Ekran Koruyucu" → accessory > screen_protector (NOT primary_product).

### 7.2 Phase 2: Wire the 3 High-Impact Consumers

| Task | File | Current | Target |
|---|---|---|---|
| 2.1 | `duplicate-engine/helpers.ts` | `createComparisonInput()` has no `productType` param | Accept `productType`, pass to `ComparisonInput` |
| 2.2 | Callers of `createComparisonInput()` | 2-3 callers to update | Pass `productType` from `attributes` |
| 2.3 | `confidence-engine/helpers.ts` | `buildDuplicateConfidenceInput()` skips `productUnderstandingScore` | Read `attributes.productType`, populate the signal |
| 2.4 | Same file | `buildProductMatcherConfidenceInput()` skips it too | Same fix |

**Validation:** Duplicate score for phone vs. phone-case drops by ~5 points (from 95 to 90). Confidence score for accessory listings increases by ~3-5 points (from missing signal to populated). No other scores change.

### 7.3 Phase 3: Deprecate `detectCategory()` Accessory Logic

| Task | File | Change |
|---|---|---|
| 3.1 | `normalization/engine.ts:586-603` | Replace accessory keyword/brand match with check for pre-computed product type |
| 3.2 | `home-data.ts:200-215` | Simplify — remove the Product Understanding Engine override (now handled in `detectCategory`) |
| 3.3 | `taxonomy/integration.ts` | Add PU engine check before legacy fallback |

**Impact:** Single accessory detection path. Home page override becomes redundant (but keep as safety net for Phase 3, remove in Phase 4).

**Risk:** `detectCategory()` is called in paths that don't have database access (sync callers). Keep the keyword fallback for sync-only contexts, wire the PU engine read for contexts that have product data.

### 7.4 Phase 4: Product Detail + Frontend Wiring

| Task | File | Change |
|---|---|---|
| 4.1 | `product/[slug]/page.tsx` | Render `productUnderstanding` data — accessory badge, device family, confidence |
| 4.2 | `product-detail.ts` | Pass `productUnderstanding` to `MarketIntelligenceScope.productType` |
| 4.3 | `market-intelligence/engine.ts` | Actually READ `scope.productType` in analysis |
| 4.4 | `intelligence-engine.ts` | Accept product type parameter, adjust buy/wait scoring per type |

### 7.5 Phase 5: Intelligence Engine + Opportunity Engine

| Task | File | Change |
|---|---|---|
| 5.1 | `intelligence-engine.ts` | Add product type-aware scoring (accessories have different price/volatility profiles) |
| 5.2 | `opportunity-engine/types.ts` | Add `productType` to `OpportunitySignalContext` |
| 5.3 | `opportunity-engine/scoring.ts` | Adjust opportunity thresholds per product type |

---

## 8. Risk Analysis

### Risk 1: Schema Migration — Adding `deviceFamily` Column

| Aspect | Detail |
|---|---|
| **What** | Adding `deviceFamily` + `deviceModel` fields to `ProductUnderstandingResult` (inside existing `attributes` JSONB) |
| **Impact** | JSONB is schema-less — no migration needed for the column itself. But consumers querying specific fields need awareness. |
| **Mitigation** | The `attributes` JSONB already has `compatibleDevice`/`compatibleFamily`. Adding new fields is a backwards-compatible additive change. |
| **Fallback** | Missing fields → `null` → consumers skip (same pattern as missing `attributes` column). |

### Risk 2: Backfill Performance

| Aspect | Detail |
|---|---|
| **What** | Re-running `analyzeProduct()` for ALL existing products to populate new fields |
| **Scale** | Current products with attributes populated (P-17 backfill already ran once) |
| **Impact** | New fields only — existing fields stay the same. Selective update rather than full re-analysis. |
| **Mitigation** | Write a targeted backfill that only updates `deviceFamily`/`deviceModel`. |

### Risk 3: `detectCategory()` Behavior Change

| Aspect | Detail |
|---|---|
| **What** | Changing `detectCategory()` to read from PU engine instead of keyword match |
| **Impact** | Could affect homepage rendering, search, filtering if PU engine disagrees with keyword match |
| **Mitigation** | **Phased rollout:** Phase 3.1 adds PU engine check AS PRIMARY, keeps keyword match as fallback. Monitor for 1 week. Phase 3.2 removes fallback. Phase 3.3 removes override in home-data.ts. |

### Risk 4: `spare_part` + `accessoryType` Overlap

| Aspect | Detail |
|---|---|
| **What** | A battery can be both a `spare_part` (for replacement) and an `accessory` (power bank) |
| **Risk** | Current engine classifies power banks as `accessory > powerbank` and replacement batteries as `spare_part > battery`. Phase 1.4 adds accessoryType to spare_part — could double-classify. |
| **Mitigation** | `spare_part > battery` gets `accessoryType: null`. Only products detected as both `accessory` AND `spare_part` with non-battery types get accessoryType. The `detectProductType()` multi-signal fusion already handles this — a product can only have one `productType`. |

### Risk 5 (New): Product-First Ordering Regressions

| Aspect | Detail |
|---|---|
| **What** | Restructuring the pipeline from 2-step (productType → compatibleDevice) to 4-step (Product Entity → Device Identity → Compatibility → Confidence) |
| **Impact** | Existing accessories that were correctly identified could have different deviceFamily/compatibleDevice assignments |
| **Mitigation** | **Parallel output for validation:** In Phase 1, keep the existing compatibleDevice logic intact but run it as Step 3 instead of Step 2. Compare before/after outputs for a sample of 100+ products. Ensure confidence scores are not degraded. |
| **Fallback** | If Step 2 (Device Identity) returns low confidence, default to existing behavior of using compatibleDevice as the device identity. |

### Risk 6: Consumer Wiring Order

| Aspect | Detail |
|---|---|
| **What** | Duplicate Engine and Confidence Engine need productType BEFORE detectCategory() changes |
| **Risk** | Wiring PU data into consumers before testing could cause incorrect scores |
| **Mitigation** | Phase 2 (consumer wiring) comes BEFORE Phase 3 (detectCategory deprecation). Test each consumer change with before/after score comparison. |

---

## 9. Rollout Phases

```
Phase 1: Foundation + Pipeline Restructure ─────────────── (est. 3-4 days)
├── 1.1 Add deviceFamily/deviceModel to types.ts
├── 1.2 Restructure analyzeProduct() → Product-First pipeline
├── 1.3 Add 12 missing accessory patterns
├── 1.4 Classify accessoryType for spare_part
├── 1.5 Refactor compatible-device-extractor for entity-aware extraction
├── 1.6 New tests: product-first ordering, entity identification
└── ✅ Tests pass, build green, 100-product before/after validation

Phase 2: Wire High-Impact Consumers ───────────────────── (est. 1-2 days)
├── 2.1 Duplicate Engine: createComparisonInput() gets productType
├── 2.2 Update callers to pass productType from attributes
├── 2.3 Confidence Engine: populate productUnderstandingScore
├── 2.4 Same for buildProductMatcherConfidenceInput
└── ✅ Score verification: before/after comparison

Phase 3: Deprecate Duplicate Logic ────────────────────── (est. 2-3 days)
├── 3.1 detectCategory(): PU engine check first, keyword fallback
├── 3.2 home-data.ts: simplify override (optional safety net)
├── 3.3 taxonomy/integration.ts: PU check before legacy
└── ✅ Monitor 1 week: no category regression

Phase 4: Frontend + Market Intelligence ───────────────── (est. 2-3 days)
├── 4.1 Product detail page renders productUnderstanding
├── 4.2 MarketIntelligenceScope.productType populated
├── 4.3 Market Intelligence reads productType
├── 4.4 Intelligence Engine gets product type parameter
└── ✅ Product detail shows device family badge

Phase 5: Intelligence + Opportunity ───────────────────── (est. 1-2 days)
├── 5.1 Intelligence Engine per-type scoring
├── 5.2 OpportunitySignalContext gets productType
├── 5.3 Opportunity thresholds per type
└── ✅ Full test suite: 950+ passing

Total estimated: 9-14 days
```

### Phase Dependencies

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4 ──→ Phase 5
  (no deps)   (needs P1)   (needs P2)   (needs P3)   (needs P4)
```

Each phase is independently shippable. Phase 1 can deploy immediately. Phase 2 only after Phase 1 is in production.

---

## 10. Appendix: Taxonomy Reference

### Product Type Classification

```
ProductType:
  ├── primary_product   → "Telefon", "Tablet", "Laptop", "Konsol", etc.
  ├── accessory         → "Aksesuar" + AccessoryType
  ├── spare_part        → "Yedek Parça" + SparePartType
  └── service           → "Hizmet" + ServiceType
```

### Device Identity Fields (Revised for Product-First Ordering)

| Field | Primary Product | Accessory | Spare Part | Service |
|---|---|---|---|---|
| `deviceFamily` | The product itself (e.g., "iPhone 15 Pro Max") | The accessory brand (e.g., "Spigen") | The spare part brand or "Generic" | null |
| `deviceModel` | Full model (e.g., "iPhone 15 Pro Max") | Same as deviceFamily | Same as deviceFamily | null |
| `compatibleDevice` | null | What it fits (e.g., "iPhone 15 Pro Max") | What it fits (e.g., "iPhone X") | null |

### Pipeline Output Examples (Product-First Ordering)

| Input Title | Step 1: Entity | Step 2: Device Identity | Step 3: Compatibility |
|---|---|---|---|
| "iPhone 15 Pro Max Ekran Koruyucu" | accessory > screen_protector | deviceFamily="Spigen" (or generic) | compatibleDevice="iPhone 15 Pro Max" |
| "Samsung Galaxy S24 Ultra" | primary_product > phone | deviceFamily="Samsung Galaxy S24 Ultra" | compatibleDevice=null |
| "iPhone X Batarya Değişim" | spare_part > battery | deviceFamily="Generic Battery" | compatibleDevice="iPhone X" |
| "Samsung Şarj Aleti 25W" | accessory > charger | deviceFamily="Samsung" | compatibleDevice=null (no specific device) |
| "AirPods Pro 2 Kılıf Silikon" | accessory > case | deviceFamily=brand or "Generic" | compatibleDevice="AirPods Pro 2" |
| "iPhone 14 Kılıf Spigen" | accessory > case | deviceFamily="Spigen" | compatibleDevice="iPhone 14" |
| "Teknik Servis Telefon Tamiri" | service > repair | deviceFamily=null | compatibleDevice=null |

### AccessoryType — Full Coverage Target

| Type | Status | Example | Priority |
|---|---|---|---|
| `screen_protector` | ✅ Implemented | "iPhone 14 Ekran Koruyucu" | — |
| `case` | ✅ Implemented | "Samsung Galaxy Kılıf" | — |
| `charger` | ✅ Implemented | "iPhone Şarj Aleti" | — |
| `cable` | ✅ Implemented | "Type C Kablo" | — |
| `adapter` | ✅ Implemented | "USB-C Donüştürücü" | — |
| `powerbank` | ✅ Implemented | "Xiaomi Powerbank" | — |
| `headphone` | ✅ Implemented | "JBL Kulaklık" | — |
| `hub` | ✅ Implemented | "USB Hub" | — |
| `holder` | 🚧 Phase 1 | "Telefon Tutacağı" | High |
| `battery` | 🚧 Phase 1 | "iPhone Pil" | High |
| `keyboard` | 🚧 Phase 1 | "Bluetooth Klavye" | Medium |
| `mouse` | 🚧 Phase 1 | "Kablosuz Fare" | Medium |
| `watch` | 🚧 Phase 1 | "Akıllı Saat" | Medium |
| `lens` | 📋 Planned | "Kamera Lens" | Low |
| `filter` | 📋 Planned | "ND Filter" | Low |
| `cleaner` | 📋 Planned | "Ekran Temizleyici" | Low |
| `airpods` | 📋 Planned | "AirPods" | Low |
| `selfie_stick` | 📋 Planned | "Selfie Çubuğu" | Low |
| `tripod` | 📋 Planned | "Tripod" | Low |
| `stand` | 📋 Planned | "Telefon Standı" | Low |

---

> **Next Step:** This document is ready for architecture review with the new product-first ordering constraint. No implementation should begin until all sections are approved. The 5 phases above are designed to be independently reviewable — each has clear deliverables, risks, and validation criteria.
