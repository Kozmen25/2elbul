# Sprint P-15 — Production Readiness Audit

**Date:** 2026-07-19  
**Scope:** Full production system audit — database, cron, queues, APIs, adapters, imports, source architecture, monitoring, recovery, matcher, duplicate engine, normalization, admin panel, environment variables  
**Rules:** Audit only — NO code changes, NO SQL, NO new features  
**Validation:** ✅ tsc 0 errors ✅ 865/871 tests pass ✅ Build passes

---

## Executive Summary

This audit examined the entire 2ElBul platform across 5 parallel assessment streams. **4 Critical, 8 High, 12 Medium, and 8 Low** findings were identified. The most urgent issues are public API endpoints lacking authentication (search/instant-bot, search-demand), volatile in-memory state for both alerting and circuit breakers, and CRON_SECRET leakage through query parameters. Three of the seven configured scrape sources (Sahibinden + 4 commerce brand sites) cannot produce listings in production without anti-bot infrastructure. **Recommendation: NO-GO for full production launch** until the 4 Critical items and 5 High items are resolved.

**Validation Baseline:**
| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npm test` (vitest) | ✅ 55/55 files, 865 passed, 6 skipped |
| `npm run build` | ✅ Pass (Turbopack, all routes compiled) |

---

## 1. Launch Checklist (Blocking Issues)

These items **must** be resolved before production launch. Classified by severity.

### 🔴 Critical (4 — Production Launch Blockers)

| # | Finding | Area | Impact | Resolution |
|---|---------|------|--------|------------|
| C1 | **Public API auth bypass** — `search/instant-bot` and `search-demand` POST endpoints have NO authentication. They accept requests with `service_role` key from anyone. | API Security | Anyone can trigger search bots with full database write access via service_role | Add admin auth or API key validation |
| C2 | **In-memory alert store** — `AlertEngine` uses `InMemoryAlertStore`. Every server restart erases active alerts, acknowledgements, resolutions, and history. No persistence path is wired. | Monitoring | Alert history is ephemeral; no forensic ability after restart | Wire DB-backed AlertStore |
| C3 | **In-memory circuit breaker state** — `CircuitBreakerRegistry` stores all states in a `Map<string, CircuitBreakerState>`. Restart resets all breakers to CLOSED with zero failure counts. | Recovery | Source outage protections are reset on every Vercel redeploy | Persist breaker state to Supabase or RecoveryMetrics |
| C4 | **CRON_SECRET transmitted via query parameters** — The daily cron route accepts the secret via `?secret=...` query parameter. This leaks the secret through Vercel access logs, CDN logs, browser history, and referrer headers. | Security | Cron secret exposed in plaintext through multiple channels | Accept via header only; remove query param fallback |

### 🟠 High (8 — Must Fix Before Full Production)

| # | Finding | Area | Impact | Resolution |
|---|---------|------|--------|------------|
| H1 | **Commerce adapters have NO anti-bot protection** — `hepsiburada-yenilenmis`, `teknosa-yenilenmis`, `mediamarkt-yenilenmis`, `yenilenmis-market` all call `safeFetchHtml` with a single static User-Agent and no ScrapingFish/proxy fallback. | Adapters | 4 of 7 scrape sources virtually guaranteed to be blocked in production, silently producing empty results | Add ScrapingFish/proxy fallback (same pattern as Sahibinden adapter) |
| H2 | **No alert notifiers connected** — `AlertNotifier` interface exists but `AlertEngine` defaults to empty notifiers array. Critical alerts (CAPTCHA, source unavailable, 3+ consecutive failures) fire only in-memory. | Monitoring | Production outages generate no Slack/email/SMS notifications | Wire at least one notifier (email, Slack webhook) |
| H3 | **Monitoring UI renders fake alert data** — `monitoring-client.tsx` creates placeholder rows `[...Array(Math.min(...))]` instead of rendering actual alert objects. Active alerts are counted but their type, source, title, message, and timestamp are never displayed. | Admin UI | Alert list is non-functional in production; shows "Kritik Alarm" / "Kaynak #N" regardless of real data | Fix client to render actual alert data from MonitoringSummary |
| H4 | **No rate-limit / polite-crawl pacing** — `SCRAPE_FETCHERS` fires all source fetchers in parallel with no inter-request delay or per-source rate limiting. | Adapters | Violates polite-crawl norms on all sources; increases detection/block risk | Add staggered scheduling with configurable delay between source fetches |
| H5 | **Null-brand bypass in duplicate engine** — `groupListingDuplicatesByKey` pushes listings with no detected brand into `allInputs` without a group boundary. These participate in O(n²) cross-group comparisons. | Duplicate Engine | Performance degradation on batches with null-brand items; logged "X% reduction" is misleading | Add a separate bucket for null-brand items |
| H6 | **Double signal extraction per listing** — `extractProductSignals` called twice for each listing (once in brand partition, once in normalized_key partition). Second extraction may produce different signals. | Duplicate Engine | 2x computation on batches of 50+; potential bucket inconsistency between brand and key partitions | Cache extractProductSignals result per listing |
| H7 | **No ScalpingFish API key configured** — Sahibinden adapter blocks on Cloudflare when `SCRAPINGFISH_API_KEY` is not set. 4 commerce adapters also lack proxy fallback (see H1). | Infrastructure | 5 of 7 configured scrape sources cannot function in production | Obtain ScrapingFish key and configure in Vercel env vars |
| H8 | **No escalation policy** — Alert rules are flat. No logic to escalate warning→critical if unresolved for a duration. No timeout-based escalation, pager routing, or alert fatigue mitigation. | Monitoring | Critical conditions may go unnoticed if initial alert is missed | Implement escalation rules with timed thresholds |

### 🟡 Medium (12 — Address Within First Month)

| # | Finding | Area | Impact |
|---|---------|------|--------|
| M1 | `price_history` schema inconsistency — table defined in 3 places with different columns. `price_history.price` is `bigint` but `listings.price` is `numeric(12,2)`, truncating decimal cents. | Database | Price storage truncation; schema drift risk |
| M2 | **Connector wrapper does not populate DLQ** — `withRecoveryPolicy()` records failure on circuit breaker and re-throws. Never calls `DeadLetterQueue.insert()`. | Recovery | DLQ remains empty despite failures; admin DLQ UI shows nothing actionable |
| M3 | **No automatic DLQ retry cron** — `retryAllPending()` exists but only via admin UI button click. No scheduled retry of expired/pending entries. | Recovery | DLQ entries stuck in "retrying" or "pending" indefinitely unless manually actioned |
| M4 | **Queue metrics sample limited to 1000 rows** — `collectQueueMetrics()` fetches only last 1000 `job_queue` rows. For production queues of tens/hundreds of thousands, this understates depth and inflates failure rate. | Monitoring | Queue health metrics inaccurate at scale |
| M5 | **Serial cron chain risks Vercel 60s timeout** — `GET /api/cron/daily` fetches `[run-sources, process-search-queue, check-price-alerts]` serially with no timeout on internal fetch(). Vercel Hobby plan has 60s hard limit. | Cron | Cron likely times out on Hobby plan when all sources are active |
| M6 | **No timeout on internal cron fetch()** — Cron aggregator uses bare `fetch()` with no `AbortController` or timeout. A hung source run blocks the entire daily cron chain. | Cron | Hung fetch stalls all subsequent cron tasks |
| M7 | `deduplicateByUrl` copy-pasted in 4 files — identical `[...new Map(...)].values()` implementations in `sahibinden.ts`, `easycep.ts`, `getmobil.ts`, `commerce.ts`. | Code Quality | Maintenance burden; fix must be applied in 4 places |
| M8 | **ScrapingFish key check is truthy-based** — `!!process.env.SCRAPINGFISH_API_KEY` check passes on empty string `""`, silently bypassing the proxy. | Adapters | Misconfiguration risk: empty env var silently disables proxy |
| M9 | **Canonical name formatting Apple/Samsung-only** — Only `apple/iphone-*` and `samsung/galaxy-*` get structured canonical names. Other brands (Xiaomi, Google, OnePlus) fall through to inconsistent quality. | Normalization | Inconsistent canonical name quality; impacts dedup across brands |
| M10 | **`products-backfill-category.sql` hardcodes IDs 1-21, 38-40 but schema.sql seeds only 5 products** — Backfill SQL references product IDs that may not exist in production. | Database | Category backfill likely fails or produces partial results |
| M11 | `verifyAdmin()` duplicated in ~10 API route files — identical auth check logic pasted across endpoint files. | Code Quality | Maintenance burden; security fix must propagate to all copies |
| M12 | `calculateStorageScore` bare number "1" collision — `storageValues` array includes `"1"`, mapped to `1TB`. Product model "Xiaomi Mi 1" or "OnePlus 1" would be falsely tagged 1TB. | Normalization | Retro/rare listings get incorrect storage detection |

### 🟢 Low (8 — Track for Future Sprints)

| # | Finding | Area |
|---|---------|------|
| L1 | Hardcoded User-Agent `2ElBulBot/1.0` — no rotation pool, trivially identifiable | Adapters |
| L2 | `Content-Type` strict check may reject valid pages — `safeFetchHtml` rejects non-`text/html` responses | Adapters |
| L3 | `extractProductSignals` category `"tab"` substring match could match non-tablet words | Normalization |
| L4 | Duplicate index definitions in migration files | Database |
| L5 | `CRON_SECRET` is a dev placeholder in `.env.example` | Configuration |
| L6 | Dead code imports in admin recovery route files | Code Quality |
| L7 | Bot-to-source mapping by heuristics (`extractSourceIdFromBotId` substring matching) | Monitoring |
| L8 | `ADMIN_EMAILS` in `.env.example` — no production admin contact configured | Configuration |

---

## 2. Blocking Issues by Domain

### API Security (3 Blockers)
| ID | Severity | Summary | Status |
|----|----------|---------|--------|
| C1 | 🔴 Critical | search/instant-bot, search-demand public POST with service_role | **Unresolved** |
| C4 | 🔴 Critical | CRON_SECRET leaked via query params | **Unresolved** |
| H3 | 🟠 High | Monitoring UI shows fake alert data | **Unresolved** |

### Infrastructure (3 Blockers)
| ID | Severity | Summary | Status |
|----|----------|---------|--------|
| H1 | 🟠 High | 4 commerce adapters lack anti-bot protection | **Unresolved** |
| H7 | 🟠 High | SCRAPINGFISH_API_KEY not configured | **Unresolved** (carried from P-14) |
| M5 | 🟡 Medium | Serial cron chain + Vercel 60s timeout | **Unresolved** |

### Recovery/Monitoring (4 Blockers)
| ID | Severity | Summary | Status |
|----|----------|---------|--------|
| C2 | 🔴 Critical | In-memory alert store — volatile | **Unresolved** |
| C3 | 🔴 Critical | In-memory circuit breaker — volatile | **Unresolved** |
| H2 | 🟠 High | No alert notifiers wired | **Unresolved** |
| H8 | 🟠 High | No escalation policy | **Unresolved** |

### Duplicate Engine (2 Blockers)
| ID | Severity | Summary | Status |
|----|----------|---------|--------|
| H5 | 🟠 High | Null-brand bypass — misleading O(n²) savings | **Unresolved** |
| H6 | 🟠 High | Double signal extraction per listing | **Unresolved** |

### Database (2 Blockers)
| ID | Severity | Summary | Status |
|----|----------|---------|--------|
| M1 | 🟡 Medium | price_history schema inconsistency + bigint truncation | **Unresolved** |
| M10 | 🟡 Medium | products-backfill-category hardcoded IDs | **Unresolved** |

---

## 3. Optional Improvements

Items unlikely to block launch but worth scheduling:

| Improvement | Benefit | Effort |
|-------------|---------|--------|
| Add DB-backed npm scripts for migration management | Safer deployments | Low |
| Structured logging (replace console.error with logger) | Production observability | Medium |
| Rate-limit middleware for admin API routes | Defense in depth | Low |
| Turkish label mapping in monitoring UI | Consistent UX | Low |
| Shared `verifyAdmin()` helper (eliminate 10 copies) | Security consistency | Low |
| Dedup by URL shared utility (eliminate 4 copies) | Maintenance | Low |
| Created listing / import adapter normalization | Consistency | Medium |
| Pre-commit hook for migration validation | Safety | Low |

---

## 4. Risk Matrix

| Risk | Probability | Impact | Score | Mitigation |
|------|-------------|--------|-------|------------|
| Public API abuse via unauthenticated search endpoints | **Certain** | **Critical** (DB write access with service_role) | **25** | Add auth immediately — highest priority |
| Vercel cron timeout (60s Hobby limit) with 7+ sources | **Likely** | **High** (daily processing fails silently) | **16** | Upgrade to Pro (300s/600s), or split cron chain |
| Circuit breaker states lost on redeploy | **Certain** | **Medium** (source hammered on restart after outage) | **15** | Persist to Supabase |
| Alert history lost on server restart | **Certain** | **Medium** (outage forensics impossible) | **15** | Wire DB-backed AlertStore |
| Commerce source adapters silently return empty results | **Likely** | **Medium** (20% of expected daily listings lost) | **12** | Add proxy fallback per-source |
| Price truncation (bigint vs numeric) causes incorrect pricing | **Possible** | **Medium** (off-by-cents on all price_history records) | **9** | Change column type to numeric(12,2) |
| DLQ entries stuck forever without manual intervention | **Likely** | **Low** (no auto-retry mechanism) | **8** | Add cron-based retry worker |
| Queue health metrics wrong at scale (1000-row sample) | **Possible** | **Low** (misleading dashboard) | **6** | Use COUNT query instead of LIMIT |

**Risk scoring:** Probability × Impact (1–5 each). Threshold: ≥10 requires mitigation before production.

---

## 5. Capacity Estimate

### Daily Listing Throughput (Current Configuration)

| Source | fetch_limit | Est. Listings/Day | Adapter Type | Anti-Bot Status |
|--------|:-----------:|:-----------------:|--------------|:---------------:|
| EasyCep | 30 | ~50 | Dedicated (full) | Native API — no proxy needed |
| Getmobil | 40 | ~30 | Dedicated (full) | Direct JSON API — no proxy needed |
| Yenilenmiş Market | 20 | ~20 | Commerce wrapper | ❌ No proxy — likely blocked |
| Teknosa Yenilenmiş | 20 | ~40 | Commerce wrapper | ❌ No proxy — likely blocked |
| MediaMarkt Yenilenmiş | 20 | ~30 | Commerce wrapper | ❌ No proxy — likely blocked |
| Hepsiburada Yenilenmiş | 20 | ~60 | Commerce wrapper | ❌ No proxy — likely blocked |
| Sahibinden | 30 | ~40 | Dedicated (full) | ❌ ScrapingFish not configured |
| **Total (all sources)** | **180** | **~270** | | |
| **Total (with anti-bot)** | **70** | **~80** | | **Only EasyCep + Getmobil guaranteed** |

### Without anti-bot remediation:
Only **EasyCep (~50/day)** and **Getmobil (~30/day)** are guaranteed functional. Total: **~80 listings/day** — far below the P-13 estimate of 230/day.

### With full remediation (ScrapingFish for all):
Expected **~270 listings/day** with ±20% seasonal variance.

### Queue Processing
- Search demand queue: 20 jobs per batch, 8-attempt schema fallback
- Vercel Hobby cron timeout (60s) is the binding constraint
- At 270 listings/day: estimated 2-3 cron cycles needed for full processing
- **Upgrade to Pro recommended** (300s or 600s function timeout)

### Database Growth Estimate
| Table | Est. Row Growth/Month | Notes |
|-------|:---------------------:|-------|
| products | ~3,000 | ~100/day × 30 days |
| matched_listings | ~7,500 | ~250/day × 30 |
| price_history | ~15,000 | ~500/day × 30 (multiple price checks per product) |
| listings | ~8,100 | ~270/day × 30 |
| source_run_logs | ~600 | ~20 source runs/day × 30 |
| recovery_metrics | ~600 | ~20 recovery events/day × 30 |
| **Total** | **~35,000 rows/month** | Supabase free tier handles millions |

**Supabase Free Tier Capacity:** At this growth rate, database capacity is sufficient for 12+ months. The free tier's 500MB database limit would be reached in approximately 2-3 years at current growth.

---

## 6. Maintenance Recommendations

### Pre-Launch (Must Do)
1. **Add auth to search/instant-bot and search-demand POST endpoints** — public service_role access is a critical vulnerability
2. **Remove CRON_SECRET query param fallback** — accept secret via header only
3. **Wire DB-backed AlertStore** — alert state must survive restarts
4. **Persist circuit breaker state** — at minimum to RecoveryMetrics table

### First Month (Should Do)
5. **Obtain and configure ScrapingFish API key** in Vercel environment
6. **Add ScrapingFish/proxy fallback** to commerce adapters (hepsiburada, teknosa, mediamarkt, yenilenmis-market)
7. **Wire alert notifier** (Slack webhook or email) for critical alerts
8. **Fix monitoring UI alert list** to render real alert data
9. **Add staggered cron scheduling** — avoid parallel source fetches
10. **Upgrade Vercel plan from Hobby to Pro** for adequate function timeout (300s+)

### Ongoing (Establish as Practice)
11. **Set up migration CI check** — verify SQL against staging before production apply
12. **Add structured logging** — replace `console.error` with a logging framework
13. **Schedule monthly health check** — review circuit breaker stats, DLQ entries, alert history
14. **Monitor price_history type** — plan migration from `bigint` to `numeric(12,2)`
15. **Establish runbook** — document restart procedure, known error messages, escalation contacts

---

## 7. Final Go / No-Go Recommendation

| Criterion | Status | Weight |
|-----------|--------|:------:|
| Database schema stability | ⚠️ **Medium issues** (price_history 3x definition, bigint truncation) | 15% |
| API security | ❌ **FAIL** (2 public endpoints with service_role access) | 20% |
| Cron/queue reliability | ⚠️ **Medium issues** (timeout risk, serial chain, no DLQ auto-retry) | 15% |
| Source adapter completeness | ❌ **FAIL** (5 of 7 sources blocked by anti-bot) | 20% |
| Monitoring usability | ❌ **FAIL** (alerts ephemeral, UI shows fake data, no notifiers) | 15% |
| Recovery infrastructure | ⚠️ **Medium issues** (breakers volatile, connectors don't populate DLQ) | 10% |
| Code quality | 🟢 **Low issues** (duplication, dead code, untested branches) | 5% |

### Verdict: ❌ **NO-GO**

**The platform is not ready for full production launch.** Four blocking conditions exist:

1. **Critical security vulnerability (C1):** Public API endpoints with service_role access must be resolved before any production traffic.
2. **Source adapter coverage (H1, H7):** 5 of 7 configured sources (71%) cannot produce listings — the platform would launch at 30% of expected capacity.
3. **Ephemeral operational state (C2, C3):** Both alerting and circuit breaker state disappear on every redeploy, making production operations blind and exposing sources to rapid retry storms.
4. **No outbound alerting (H2):** Critical conditions generate no notifications — production outages would go undetected until manually observed.

### Path to GO

| Step | Blocking Items | Estimated Effort |
|------|---------------|:----------------:|
| 1. Secure public API endpoints | C1, C4 | 1-2 days |
| 2. Configure ScrapingFish + proxy for commerce adapters | H1, H7 | 1-2 days |
| 3. Persist alert and circuit breaker state | C2, C3 | 2-3 days |
| 4. Wire alert notifier (Slack/email) | H2 | 1 day |
| 5. Fix monitoring UI alert rendering | H3 | 0.5 day |
| 6. Add polite-crawl pacing | H4 | 0.5 day |
| 7. Fix duplicate engine findings | H5, H6 | 1 day |
| 8. Add escalation policy | H8 | 0.5 day |

**Estimated total: 8-10 days of engineering effort** across infrastructure, security, and backend work. Items 1-4 (estimated 5-7 days) are the critical path. Items 5-8 can run in parallel.

### Conditional GO (Partial Launch)

A **conditional GO** is possible if the launch scope is reduced to **only EasyCep and Getmobil** (the 2 sources with confirmed anti-bot bypass), with the following conditions:
- Public API endpoints secured (C1)
- CRON_SECRET query param removed (C4)
- At least one alert notifier wired (H2)
- Circuit breaker state made durable (C3)

This represents ~80 listings/day (30% of full capacity) but with acceptable risk posture. Full GO requires all 4 Critical and 5 High items resolved.

---

## 8. Prior Sprint Context

### Sprint P-14 — Sahibinden Activation (Completed)
- 2/3 blockers resolved: `integration_type→scrape`, `realScrapeSourceSlugs` updated
- 1 stopper documented: Cloudflare requires SCRAPINGFISH_API_KEY (carried to P-15 as H7)
- Score: 67% activation readiness

### Sprint P-13 — Source Activation (Completed)
- 5 sources activated: Getmobil, Yenilenmiş Market, Teknosa Yenilenmiş, MediaMarkt Yenilenmiş, Hepsiburada Yenilenmiş
- Infrastructure pre-wired for all 5 (circuit breakers, recovery, monitoring, admin UI)
- Commerce adapters assumed functional — P-15 audit reveals they lack anti-bot protection (H1)
- **P-13 estimate of 230 listings/day is invalid** without resolving H1 and H7

### Sprint P-12 — Source Expansion Plan (Reference)
- Full architectural blueprint for 6-source expansion
- Normalized_key infrastructure (Phase 2 plan) built in P-12/P-13 — now operational
- Product matcher batch operations implemented per plan

---

## Appendix A: Audit Coverage Map

| Audit Domain | Agent | Files Examined | Findings |
|-------------|-------|:--------------:|:--------:|
| Database & Migrations | Agent #1 | 14 migration files, 6 schema files | 4 (C:0, H:1, M:2, L:1) |
| Cron, Queues, APIs | Agent #2 | 26 API route files, 4 cron files | 6 (C:2, H:1, M:1, L:2) |
| Adapters, Imports, Source | Agent #3 | 10+ adapter/import files | 10 (C:0, H:2, M:4, L:4) |
| Monitoring & Recovery | Agent #4 | 8 monitoring/recovery files | 11 (C:2, H:3, M:3, L:3) |
| Matcher, Duplicate, Normalization | Agent #5 | 12+ matcher/engine files | 10 (C:2, H:1, M:4, L:3) |
| **Total** | | **~85+ files** | **41 (4C, 8H, 12M, 8L)** |

## Appendix B: Environment Variable Audit

| Variable | Set in Production? | Risk |
|----------|:------------------:|------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Presumed set | None |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Presumed set | None |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Presumed set | 🔴 Critical — must never be client-accessible |
| `CRON_SECRET` | ⚠️ Dev placeholder | 🟠 High — dev value in production |
| `SCRAPINGFISH_API_KEY` | ❌ **Not set** | 🔴 High — 5 sources blocked |
| `IMPORT_API_KEY` | ❌ **Unknown** | 🟡 Medium — if import API endpoints need auth |
| `ADMIN_EMAILS` | ❌ **Not set** | 🟢 Low — admin access uses Supabase auth |

## Appendix C: Validation Results

```
TypeScript:  0 errors
Tests:       55/55 files pass, 865 passed, 6 skipped
Build:       Pass (Turbopack, all routes compiled)
```

The validation suite confirms the codebase is in good technical shape. All findings in this report are architectural, security, and operational concerns — not compilation or correctness bugs.
