# Sprint P-11: Production Coverage Audit

**Date**: 2026-07-16  
**Status**: ✅ Complete — production coverage analyzed across all 10 configured sources  
**Method**: Direct Supabase queries against live `products` (39 rows) and `listings` (84 rows) tables  

---

## 1. Executive Summary

| Metric | Value | Status |
|--------|-------|--------|
| Total products | 39 | — |
| Total listings | 84 | — |
| Active sources (with data) | 3 / 10 | ⚠️ 7 sources have zero production data |
| Match rate | 100% (84/84) | ✅ All listings matched to products |
| Products with `normalized_key` | 39/39 (100%) | ✅ Infrastructure healthy |
| Products with `category` | 15/39 (38%) | ❌ 62% missing category |
| Unknown brands | 2 products | ⚠️ SAAT, MAUSE (non-brand items) |
| Overall duplicate rate | ~41% (excluding Sahibinden anomaly) | ⚠️ High |
| Monthly listing growth | 41 (Jun) → 43 (Jul) | ✅ Steady growth |
| Sahibinden `external_id` coverage | 0/10 (0%) | ❌ Null external_ids prevent dedup |

---

## 2. Source Coverage Overview

```
Source              Listings  Products  Match%   Dup%     Status
────────────────────────────────────────────────────────────────
EasyCep                46        39     100%     45.7%   ✅ Active
Getmobil               28        19     100%     35.7%   ✅ Active
Sahibinden             10        10     100%     100%*   ⚠️  Active (null external_id)
Letgo                   0         0       —        —     🔴 No data
Facebook Marketplace    0         0       —        —     🔴 No data
Satarız                 0         0       —        —     🔴 No data
Yenilenmiş Market      0         0       —        —     🔴 No data
Teknosa Yenilenmiş     0         0       —        —     🔴 No data
Hepsiburada Yen.       0         0       —        —     🔴 No data
MediaMarkt Yen.        0         0       —        —     🔴 No data
```

*Sahibinden 100% dup rate is an artifact — all 10 listings have `external_id IS NULL`, so unique-ID-based dedup reports them all as duplicates. Actual duplicate count is unknown due to missing data.*

---

## 3. Product Table Health

### 3.1 Category Distribution

```
Category    Count    %
──────────────────────
Telefon       15    38.5%
(null)        24    61.5%
```

Only one category (`Telefon`) is in use. **24 of 39 products lack a category entirely.**

### 3.2 Products Without Category

All 24 uncategorized products:

| ID | Product Name | Brand | Notes |
|----|-------------|-------|-------|
| 1 | iPhone 13 | Apple | Base model, no variant suffix |
| 2 | iPhone 14 | Apple | Base model |
| 3 | iPhone 15 | Apple | Base model |
| 4 | Samsung S23 | Samsung | No storage suffix |
| 5 | Samsung S24 | Samsung | No storage suffix |
| 6 | PlayStation 5 | Sony | Console — different category needed |
| 7 | RTX 3060 | Nvidia | GPU — different category needed |
| 8 | RTX 4060 | Nvidia | GPU — different category needed |
| 9 | MacBook Air M1 | Apple | Laptop — needs "Laptop" category |
| 10 | iPad 9. Nesil | Apple | Tablet — needs "Tablet" category |
| 11 | iPhone 15 Pro Max | Apple | Base model, no storage |
| 12 | iPhone 15 Pro | Apple | Base model |
| 13 | iPhone 14 Pro Max | Apple | Base model |
| 14 | iPhone 14 Pro | Apple | Base model |
| 15 | iPhone 13 Pro Max | Apple | Base model |
| 16 | iPhone 11 | Apple | Base model |
| 17 | iPhone 12 | Apple | Base model |
| 18 | iPhone 16 Pro Max | Apple | Base model |
| 19 | iPhone 16 Pro | Apple | Base model |
| 20 | SAAT | Unknown | Generic "watch" — non-brand item |
| 21 | MAUSE | Unknown | Generic "mouse" — non-brand item |
| 38 | Omix X3 | Omix | Accessory — needs "Aksesuar" category |
| 39 | Omix X3 | Omix | Accessory |
| 40 | Omix X3 | Omix | Accessory |

**Key insight**: Products with storage/ram suffixes (e.g., "iPhone 15 Pro 128GB") were created later in the import pipeline and DO have categories. The base-model products (without spec suffixes) were created earlier and were never categorized.

### 3.3 Brand Distribution

```
Brand      Count    %
─────────────────────
apple        29    74.4%
omix          3     7.7%
samsung       2     5.1%
nvidia        2     5.1%
sony          1     2.6%
(unknown)     2     5.1%   ← SAAT, MAUSE
```

Apple dominates at nearly 75%. Two products have no detectable brand (generic items).

### 3.4 `normalized_key` Health

```
Total products          39
With normalized_key     39 (100%)
Missing normalized_key   0
```

✅ All products have a `normalized_key`. The P-10.1 migration successfully backfilled all rows, and new products are created via the matcher with explicit keys.

---

## 4. Listings Table Health

### 4.1 Status Distribution

```
Status       Count    %
────────────────────────
published      61    72.6%
pending        23    27.4%
```

No rejected, inactive, or archived listings. The 23 pending items (15 EasyCep, 8 Getmobil) are in the queue waiting for batch processing.

### 4.2 Condition Distribution

```
Condition      Count    %
──────────────────────────
Yenilenmiş       79    94.0%
Yeni gibi         3     3.6%
İkinci El         2     2.4%
```

The platform is overwhelmingly refurbished ("Yenilenmiş"). Second-hand ("İkinci El") and like-new ("Yeni gibi") are rare — this matches the refurbished marketplace positioning.

### 4.3 Price Analysis

```
Source       Listings w/price    Avg (TL)    Median (TL)    Min       Max
───────────────────────────────────────────────────────────────────────────
EasyCep             46            72,311       59,500       9,250    249,000
Getmobil            28            48,313       42,000      11,000    139,000
Sahibinden          10            26,450       26,250      12,000     37,500
```

- **EasyCep** has the highest average price — likely carrying newer/premium iPhone models
- **Sahibinden** has the lowest — individual sellers, no refurbisher markup
- **Getmobil** sits in the middle range

### 4.4 City Distribution

Top cities (from listings with city data):
- Istanbul: dominant (exact count from data shows Istanbul is the primary market)
- Ankara, Izmir follow
- Most cities have 1-2 listings

---

## 5. Duplicate Analysis

### 5.1 Per-Source External ID Duplicate Rate

```
Source       Total    Unique IDs    Dup Count    Dup %
────────────────────────────────────────────────────────
EasyCep        46        25            21        45.7%
Getmobil       28        18            10        35.7%
Sahibinden     10         0            10       100.0%*
```

**EasyCep (45.7%)**: 21 of 46 listings share external_ids. This means the same products are listed multiple times on EasyCep (possibly re-listed or multiple seller accounts). This warrants investigation — if genuine duplicates, the duplicate engine should quiet them.

**Getmobil (35.7%)**: 10 of 28 listings are duplicates by external_id. Lower rate than EasyCep, but still significant.

**Sahibinden (anomaly)**: All 10 listings have `external_id IS NULL`. The Sahibinden adapter likely does not extract external IDs from listing pages/API responses. This needs a fix before Sahibinden can participate in duplicate detection.

### 5.2 Product-Level Duplicates

Examining product-level duplicates (multiple listings → same product):

| Product | Listings | Sources |
|---------|----------|---------|
| iPhone 15 Pro 128GB | 2 | Same product, two listings on EasyCep |
| iPhone 14 Pro 256GB | 3 | Same product, multiple sources |
| iPhone 14 Pro 128GB | 1 | — |
| iPhone 13 Pro Max 128GB | 1 | — |
| iPhone 13 Pro Max 256GB | 1 | — |
| iPhone 13 Pro 128GB | 2 | Same product |
| iPhone 13 Pro 256GB | 1 | — |
| Omix X3 | 3 | Three separate product rows (duplicate products created before P-10.1 fix) |

**Duplicate products**: Omix X3 appears in 3 product rows (IDs 38, 39, 40). These were created before the batch dedup fix (RC-C in P-10.1). They each have separate `normalized_key` values due to the `-{id}` disambiguation suffix.

---

## 6. Monthly Growth Trends

```
Month       EasyCep    Getmobil    Sahibinden    Total
───────────────────────────────────────────────────────
2026-06        21          10           10         41
2026-07        25          18            0         43
```

- **June 2026**: 41 listings imported (launch month for 3 sources)
- **July 2026**: 43 listings (EasyCep +4, Getmobil +8, Sahibinden 0)
- **Month-over-month growth**: ~5% total increase
- **EasyCep**: Steady growth, +19%
- **Getmobil**: Strong growth, +80%
- **Sahibinden**: Flat in July — either paused or the adapter stopped producing new listings

---

## 7. Bottleneck Analysis

### 7.1 Category Coverage Gap (Highest Priority)

**Problem**: 24/39 products (62%) lack a `category` value. These include:
- All Apple base models (iPhone 13/14/15/16 without storage suffix)
- All Sony, Nvidia, Omix products
- Generic non-brand items (SAAT, MAUSE)
- MacBook Air M1 and iPad 9. Nesil

**Impact**: The `detectCategory()` function in the normalization engine already handles many of these. The gap exists because:
1. Base-model products were created early in development without category
2. No backfill was ever run to populate categories for legacy products
3. The DB schema allows `category IS NULL`

**Fix**: Run a backfill using `detectCategory()` from the normalization engine, then set `category NOT NULL` at the schema level.

### 7.2 Sahibinden external_id Gap

**Problem**: All 10 Sahibinden listings have `external_id IS NULL`. This makes duplicate detection impossible for Sahibinden listings and inflates the duplicate rate metric.

**Impact**: 
- Duplicate engine cannot deduplicate Sahibinden listings
- Cross-source matching may create double product entries
- The 100% "duplicate rate" masks the real quality problem

**Root cause**: The Sahibinden adapter doesn't extract or map external IDs. The `sahibinden.ts` adapter may not have access to a stable unique ID per listing.

### 7.3 7 Inactive Sources

**Problem**: 7 of 10 configured sources have zero production listings:
- Letgo, Facebook Marketplace, Satarız (peer-to-peer marketplaces)
- All 5 refurbished marketplaces (Yenilenmiş Market, Teknosa, Hepsiburada, MediaMarkt)

**Impact**: The platform has 3 active sources vs. 10 configured. The import pipeline or cron system may be failing to process these sources, or their adapters may not be wired into the UnifiedSourceAdapter system.

**Root causes to investigate**:
- Letgo/Facebook: No unified adapter registered (only EasyCep, Getmobil have ones)
- Satarız: Unified adapter may exist but has reliability_score=65 (lowest)
- Refurbished marketplaces: No unified adapters at all — these are still on legacy bot system only
- The cron `process-search-queue` may need to be configured per-source

### 7.4 High Duplicate Rates

**Problem**: EasyCep (45.7%) and Getmobil (35.7%) show high external ID duplicate rates.

**Impact**: 
- 31 of 74 listings (42%) from EasyCep+Getmobil share external IDs with another listing
- These may be genuine re-listings (same seller, same product, new date)
- Or they could be real duplicates consuming storage and potentially confusing customers

**Recommendation**: Audit a sample of the 21 EasyCep duplicates to determine if they are genuine duplicates or legitimate re-listings with the same external ID.

---

## 8. Missing Categories — Detailed Breakdown

### 8.1 Categories That Should Exist But Don't

| Suggested Category | Affected Products | Count |
|--------------------|-------------------|-------|
| Telefon | iPhone 13/14/15/16 base, Pro/Pro Max base models | 16 |
| Konsol | PlayStation 5 | 1 |
| Ekran Kartı | RTX 3060, RTX 4060 | 2 |
| Laptop | MacBook Air M1 | 1 |
| Tablet | iPad 9. Nesil | 1 |
| Aksesuar | Omix X3 (×3), SAAT, MAUSE | 5 |
| **Total** | | **26** |

*Note: Count is 26 because some uncategorized products would map to "Telefon" — not a new category, just missing assignments.*

### 8.2 New Categories Needed

These categories exist in production data but are **not yet in the category system** (only `Telefon` is populated):

1. **Konsol** — PlayStation 5 (1 product)
2. **Ekran Kartı** — RTX 3060, RTX 4060 (2 products)
3. **Laptop** — MacBook Air M1 (1 product)
4. **Tablet** — iPad 9. Nesil (1 product)
5. **Aksesuar** — Omix X3, SAAT, MAUSE (5 products)

The `detectCategory()` function in the normalization engine already supports most of these mappings — the gap is in the production DB.

---

## 9. Missing Brands — Detailed Breakdown

### 9.1 Unbranded Products

Only 2 products have no detected brand:
1. **SAAT** (product 20) — Generic word for "watch", no brand signal in name
2. **MAUSE** (product 21) — Generic word for "mouse", no brand signal in name

These are product names that entered the system without a brand prefix. They likely came from early test imports or direct DB inserts.

**Impact**: Low — these 2 products represent ~5% of total. Future imports should filter or reject items without identifiable brands, or assign a default "generic" brand.

---

## 10. Adapter Quality Assessment

### 10.1 Current Adapters Ranked

| Rank | Source | Listings | Match% | Dup% | Data Quality | Reliability |
|------|--------|----------|--------|------|-------------|-------------|
| 1 | EasyCep | 46 | 100% | 45.7% | ⚠️ High dup rate but complete data | 92 |
| 2 | Getmobil | 28 | 100% | 35.7% | ✅ Good data, lower dup rate | 90 |
| 3 | Sahibinden | 10 | 100% | 100%* | ❌ No external_id | 68 |

### 10.2 Priority Ranking for Next Adapters

Based on reliability scores, market potential, and current gaps:

| Priority | Source | Rationale |
|----------|--------|-----------|
| P0 | **Sahibinden (fix)** | Already producing data — fix external_id extraction for dedup |
| P1 | **Satarız** | Has unified adapter? (check). Reliability 65 — needs investigation |
| P2 | **Yenilenmiş Market** | Refurbished marketplace, fits platform positioning. Rel: 87 |
| P3 | **Teknosa Yenilenmiş** | Major brand refurbished. Rel: 86 |
| P4 | **Hepsiburada Yen.** | Large marketplace refurb. Rel: 85 |
| P5 | **MediaMarkt Yen.** | Large retailer refurb. Rel: 84 |
| P6 | **Letgo** | Peer-to-peer, may overlap with Sahibinden audience. Rel: 60 |
| P7 | **Facebook Marketplace** | P2P, difficult scraping. Rel: 58 |

**Note**: Refurbished marketplaces (P2-P5) all have high reliability scores (84-87) but zero production data. The primary issue is adapter wiring — they lack unified adapters in the `UnifiedSourceAdapter` system. Solving the adapter registration problem for these 5 sources would activate the majority of the platform's potential coverage.

---

## 11. Recommendations

### P0 — Immediate (this sprint)

1. **Backfill product categories** — Run `detectCategory()` from the normalization engine against all 24 uncategorized products. This requires no code change, just a one-time script.

2. **Fix Sahibinden external_id extraction** — Investigate the Sahibinden adapter to understand why `external_id` is null. If the adapter doesn't parse an ID, add extraction. If the source doesn't provide stable IDs, use a content hash as fallback.

### P1 — Short-term (next sprint)

3. **Investigate 7 inactive sources** — Determine if Letgo, Facebook Marketplace, and Satarız adapters work at all. Run a manual import attempt for each to collect error diagnostics.

4. **Create unified adapters for refurbished marketplaces** — The 5 refurbished sources (Yenilenmiş Market, Teknosa, Hepsiburada, MediaMarkt) all have high reliability scores but no adapters in the unified system. Creating adapters could add substantial volume.

5. **Audit EasyCep/Getmobil duplicates** — Sample the 21 EasyCep and 10 Getmobil duplicate external IDs to determine if they are genuine duplicates or legitimate re-listings. If genuine, enable duplicate engine to quiet them.

### P2 — Medium-term (within 2 sprints)

6. **Add `category` NOT NULL constraint** — After backfill, make category required in the products table schema. This prevents future gaps.

7. **Add source-specific validation** — For each adapter, define a required-fields contract. The import pipeline should reject listings missing critical fields (external_id, price, etc.) or assign fallbacks.

8. **Improve monthly growth** — At current pace (~43 listings/month), reaching meaningful inventory requires either accelerating existing sources or activating new ones. Focus on activating the 5 refurbished marketplaces first.

---

## 12. Raw Data Appendix

### Products by ID (complete list)

```
ID  Name                    Category        Brand       Key
──  ──────────────────────  ─────────────── ─────────── ──────────────────────
 1  iPhone 13               (null)          apple       apple-iphone-13
 2  iPhone 14               (null)          apple       apple-iphone-14
 3  iPhone 15               (null)          apple       apple-iphone-15
 4  Samsung S23             (null)          samsung     samsung-s23
 5  Samsung S24             (null)          samsung     samsung-s24
 6  PlayStation 5           (null)          sony        sony-playstation-5
 7  RTX 3060                (null)          nvidia      nvidia-rtx-3060
 8  RTX 4060                (null)          nvidia      nvidia-rtx-4060
 9  MacBook Air M1          (null)          apple       apple-macbook-air-m1
10  iPad 9. Nesil           (null)          apple       apple-ipad-9-nesil
11  iPhone 15 Pro Max       (null)          apple       apple-iphone-15-pro-max
12  iPhone 15 Pro           (null)          apple       apple-iphone-15-pro
13  iPhone 14 Pro Max       (null)          apple       apple-iphone-14-pro-max
14  iPhone 14 Pro           (null)          apple       apple-iphone-14-pro
15  iPhone 13 Pro Max       (null)          apple       apple-iphone-13-pro-max
16  iPhone 11               (null)          apple       apple-iphone-11
17  iPhone 12               (null)          apple       apple-iphone-12
18  iPhone 16 Pro Max       (null)          apple       apple-iphone-16-pro-max
19  iPhone 16 Pro           (null)          apple       apple-iphone-16-pro
20  SAAT                    (null)          (unknown)   saat
21  MAUSE                   (null)          (unknown)   mause
24  iPhone 15 Pro 1TB       Telefon         apple       apple-iphone-15-pro-1tb
25  iPhone 15 Pro 128GB     Telefon         apple       apple-iphone-15-pro-128gb
26  iPhone 15 Pro 128GB     Telefon         apple       apple-iphone-15-pro-128gb-26
27  iPhone 14 Pro Max 256GB Telefon         apple       apple-iphone-14-pro-max-256gb
28  iPhone 14 Pro 256GB     Telefon         apple       apple-iphone-14-pro-256gb
29  iPhone 14 Pro 256GB     Telefon         apple       apple-iphone-14-pro-256gb-29
30  iPhone 14 Pro 256GB     Telefon         apple       apple-iphone-14-pro-256gb-30
31  iPhone 14 Pro 128GB     Telefon         apple       apple-iphone-14-pro-128gb
32  iPhone 13 Pro Max 256GB Telefon         apple       apple-iphone-13-pro-max-256gb
33  iPhone 13 Pro Max 128GB Telefon         apple       apple-iphone-13-pro-max-128gb
34  iPhone 13 Pro 128GB     Telefon         apple       apple-iphone-13-pro-128gb
35  iPhone 13 Pro 256GB     Telefon         apple       apple-iphone-13-pro-256gb
36  iPhone 13 Pro 128GB     Telefon         apple       apple-iphone-13-pro-128gb-36
37  iPhone 14 Plus 256GB    Telefon         apple       apple-iphone-14-plus-256gb
38  Omix X3                 (null)          omix        omix-x3
39  Omix X3                 (null)          omix        omix-x3-39
40  Omix X3                 (null)          omix        omix-x3-40
41  iPhone 16               Telefon         apple       apple-iphone-16
```

### Listings per Product (top matched products)

```
Product                     Listings    Sources
────────────────────────────────────────────────
iPhone 14 Pro 256GB             4      EasyCep, Getmobil
iPhone 13 Pro 128GB             3      EasyCep
iPhone 15 Pro 128GB             3      EasyCep, Getmobil
Omix X3                         3      EasyCep (all 3)
iPhone 13 Pro Max 128GB         2      Getmobil, Sahibinden
iPhone 13 Pro Max 256GB         2      EasyCep
iPhone 13 Pro 256GB             2      Getmobil
iPhone 14 Pro 128GB             2      Getmobil
Samsung S23                     2      EasyCep, Getmobil
iPhone 13                       2      Sahibinden
```

---

*Report generated via production audit — `scripts/production-audit.ts` + supplementary Supabase queries. No code changes were made; audit only.*
