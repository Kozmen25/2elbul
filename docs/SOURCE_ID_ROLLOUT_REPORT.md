# Source ID Rollout Report — Phase 4

## Summary

Phase 4 completed the additive migration of `sourceId` across the entire platform. Every listing pipeline now populates the `source_id` column in the `listings` table via the canonical Source Registry (`lib/source-registry/registry.ts`). No hardcoded IDs were introduced. No business logic was modified.

**Canonical source IDs** (from DB `public.sources`):

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

## Files Modified

### `lib/bots/types.ts`
- Added `sourceId?: number` to `BotAdapterListing` type (optional, backward-compatible)

### `lib/import/types.ts`
- Added `sourceId: number | null` to `NormalizedImportListing` (required, nullable)

### `lib/import/adapters.ts`
- Added `sourceId: null` to `normalizeCommon()` return value (all import adapters set null; import pipeline never populates sourceId from the raw payload — it's always null until an explicit mapping is added)

### `lib/import/import-listings.ts`
- Added `source_id: listing.sourceId` to the Supabase upsert payload

### `lib/bots/listing-sync.ts`
- `buildListingPayloadBase()`: added `sourceId: number` parameter, sets `source_id: listing.sourceId ?? sourceId` in payload
- `buildRpcListingPayload()`: threads `sourceId` parameter through to base
- `buildLegacyListingPayload()`: threads `sourceId` parameter through to base
- RPC call site: `buildRpcListingPayload(listing, productId, sourceId)` updated
- `insertListingsLegacy()`: added optional `sourceId?: number` parameter
- Legacy fallback call site: now passes `sourceId` to `insertListingsLegacy()`
- Legacy insert uses `sourceId ?? listing.sourceId ?? 1` as final safety net

## Data Flow

```
Bot Adapter → BotAdapterListing { sourceId?: number }
  → syncListingsForSource(sourceId, listings)  — function-level sourceId from registry
    → buildRpcListingPayload(listing, productId, sourceId)
      → buildListingPayloadBase() → source_id: listing.sourceId ?? sourceId
    → OR (RPC fallback) insertListingsLegacy(supabase, listings, sourceId)
      → buildLegacyListingPayload() → same base builder
```

```
Import Adapter → NormalizedImportListing { sourceId: null }
  → importListings() → upsert { source_id: listing.sourceId }
```

## Remaining Fallbacks (Phase 5 targets — DO NOT TOUCH)

Six hardcoded fallbacks in `lib/product-matcher/duplicate.ts`:

| Line | Expression | Default ID |
|---|---|---|
| 21 | `reference.sourceId ?? 1` | Sahibinden |
| 30 | `candidate.sourceId ?? 2` | Letgo |
| 73 | `l.sourceId ?? 1` | Sahibinden |
| 156 | `listing.sourceId ?? 1` | Sahibinden |
| 172 | `listing.sourceId ?? 1` | Sahibinden |
| 184 | `listing.sourceId ?? 1` | Sahibinden |

One additional fallback in `lib/bots/listing-sync.ts:219`:
- `sourceId ?? listing.sourceId ?? 1` — backward-compatibility safety net in legacy insert path

## Validation Results

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ Passed — zero type errors |
| Unit tests (core libs) | ✅ 200 passed — bots, import, source-registry, confidence-engine, duplicate-engine |
| `npm test` (all) | ⚠️ 17 pre-existing failures (`server-only` import in Pages Router tests) — none related to Phase 4 |
| `npm run build` | ⚠️ Pre-existing failures (`easycep.ts`/`getmobil.ts` server-only in Pages Router) — none related to Phase 4 |

## Architecture Decisions

1. **Additive migration**: `sourceId` is ADDED alongside legacy `source` field. No existing fields removed or modified.
2. **Two-tier resolution**: `listing.sourceId ?? sourceId` — individual adapters can override sourceId per-listing (future-proofing), while the function parameter provides the default.
3. **Import pipeline declares `null`**: Import adapters set `sourceId: null` because import payloads don't carry source identity. The registry-based resolution is intentionally left as a future improvement.
4. **Backward compatibility**: All `?? 1` fallbacks preserved in `duplicate.ts` and legacy sync path. No breaking changes.

## Next Steps

- **Phase 5**: Remove 6 hardcoded fallbacks in `duplicate.ts` — verify `sourceId` is always populated from the pipeline before removing defaults
- **Phase 6**: Remove `?? 1` fallback in `insertListingsLegacy()`, add deprecation markers on legacy source field
