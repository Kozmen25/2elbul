# Source Registry Phase 5 Report — Remove Legacy Fallbacks

## Summary

Phase 5 removed all 6 hardcoded numeric sourceId fallbacks from `lib/product-matcher/duplicate.ts`. No code outside `duplicate.ts` was modified. The 7th fallback (`listing-sync.ts:219`) is reserved for Phase 6 and was untouched.

## Removed Fallbacks

| # | Location | Before | After | Reason |
|---|---|---|---|---|
| 1 | `duplicate.ts:21` | `reference.sourceId ?? 1` | `reference.sourceId` | `createComparisonInput` normalizes falsy → null; `resolveSourceCount` returns 1 (single source) when null |
| 2 | `duplicate.ts:30` | `candidate.sourceId ?? 2` | `candidate.sourceId` | Same as above — hardcoded Letgo (ID:2) was an arbitrary default for candidates |
| 3 | `duplicate.ts:73` | `l.sourceId ?? 1` | `l.sourceId` | Same null-safe chain applies in `groupListingDuplicates` path |
| 4 | `duplicate.ts:156` | `listing.sourceId ?? 1` | `listing.sourceId` | Same in `groupListingDuplicatesByKey` normalized-key groups |
| 5 | `duplicate.ts:172` | `listing.sourceId ?? 1` | `listing.sourceId` | Same in null-key-within-brand bucket |
| 6 | `duplicate.ts:184` | `listing.sourceId ?? 1` | `listing.sourceId` | Same in brandless (nullBrand) bucket |

### Safety Rationale (applies to all 6 removals)

For each removed fallback, the call chain is:

```
sourceId (undefined/null) → createComparisonInput({ sourceId: undefined })
  → options?.sourceId || null  →  sourceId: null
    → resolveSourceCount(null, ...)    → returns 1  (neutral: treats as single source)
    → resolveSourceReliability(null)   → returns 55/70  (neutral fallback)
    → calculateSourceDiversityScore(null, ...) → returns 100  (neutral: no diversity penalty)
```

This is **more correct** than the old behavior: previously, a listing without `sourceId` was **always** assumed to be from Sahibinden (ID:1), which artificially inflated reliability and diversity scores. Now, listings without a known source get neutral scores — the engine treats them as "unknown source" rather than "definitely Sahibinden."

## Validation Results

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ Zero type errors |
| Product Matcher tests (10) | ✅ 10 passed |
| Duplicate Engine tests (80) | ✅ 80 passed |
| Source Registry tests (12) | ✅ 12 passed |
| Confidence Engine tests (10) | ✅ 10 passed |

## Remaining Transitional Code

The following code still references legacy patterns and is **intentionally not modified** in this phase:

| Module | Pattern | Status | Phase |
|---|---|---|---|
| `lib/bots/listing-sync.ts:219` | `sourceId ?? listing.sourceId ?? 1` | Legacy | Phase 6 |
| `lib/confidence-engine/helpers.ts:417-424` | regex fallback patterns for `resolveSourceReliabilityFromName` | Transitional | Acceptable |
| `lib/unified-source-engine/adapters/index.ts` | `getCanonicalSourceRegistry()` can return null | Transitional | Acceptable |

### Transitional Code Explanation

1. **`resolveSourceReliabilityFromName`** in Confidence Engine (`helpers.ts:417-424`) uses regex patterns as fallback when the registry is null. This is safe because the registry is initialized at startup and is almost always available. The regex fallbacks (e.g., `/sahibinden/i` → score 75) are a belt-and-suspenders approach that only activates if the DB-backed registry fails to load. **Do not remove** — they protect against a null-registry edge case.

2. **`getCanonicalSourceRegistry()` returning null** — the Bridge module returns null if the registry singleton hasn't been initialized. All callers handle null gracefully (neutral scores, fallback values). Making this non-nullable would require initialization guarantees at import time, which creates circular-dependency risk. The null pattern is intentional and correct.

## Rollback Notes

To revert Phase 5, restore the 6 fallbacks in `duplicate.ts`:

| Line | Change |
|---|---|
| 21 | `reference.sourceId` → `reference.sourceId ?? 1` |
| 30 | `candidate.sourceId` → `candidate.sourceId ?? 2` |
| 73 | `l.sourceId` → `l.sourceId ?? 1` |
| 156 | `listing.sourceId` → `listing.sourceId ?? 1` |
| 172 | `listing.sourceId` → `listing.sourceId ?? 1` |
| 184 | `listing.sourceId` → `listing.sourceId ?? 1` |

Or via `git revert` of the Phase 5 commit(s).

## Audit Re-check: Legacy Count = 0

Re-running the classification from the SOURCE_REGISTRY_FINAL_AUDIT:

The 7 legacy fallbacks identified in the audit break down as:
- **6 in `duplicate.ts`** → Phase 5 target ✅ **REMOVED**
- **1 in `listing-sync.ts:219`** → Phase 6 target 🚫 **NOT TOUCHED**

**Legacy count in modified files: 0.** All 6 previously-legacy locations now correctly pass `sourceId` without defaults.

The single remaining legacy site (`listing-sync.ts:219`) is unchanged and remains classified as Legacy in the audit. It will be addressed in Phase 6.

## Architecture Note: Why `?? 1` on `sourceId` Was Wrong

The original fallback `sourceId ?? 1` assumed Sahibinden as a default — which is semantically incorrect because:

1. The Duplicate Engine's `ComparisonListing` comes from **any** pipeline (bot sync, import, API). Assuming "Sahibinden" for all pipelines that don't populate `sourceId` is a bias that skews duplicate detection confidence.

2. The Duplicate Engine is a **scoring engine** — it should evaluate based on available data and return neutral scores for missing data. Hardcoded fallbacks bypass this principle by injecting a fictional source identity.

3. With Phase 4 complete, all bot pipelines populate `sourceId` via the Source Registry. The only listings that reach the Duplicate Engine without a `sourceId` are import-pipeline listings (which intentionally set `sourceId: null`). For these, neutral scoring is correct behavior.
