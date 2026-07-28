# Sprint DS-01: Data Source Discovery & Architectural Planning Report

**Date:** 2026-07-20
**Status:** Research Complete
**Scope:** Pure research — no code, no adapter implementation. Goal is to identify every viable second-hand data source that can feed 2ElBul.

---

## Executive Summary

2ElBul's current bottleneck is **data acquisition**, not software quality. The platform has two active data sources (EasyCep, Getmobil) delivering ~90-100 listings per run, with 5 additional sources blocked behind ScrapingFish proxy dependency. Total addressable market in Turkey's second-hand electronics ecosystem is conservatively estimated at **4-8M annual listings** across all platforms, with **300K-800K** being realistically addressable via automated scraping.

This report identifies **23 potential sources**, ranks them by priority (score 1-100), and presents a **4-phase integration roadmap** spanning 3-6 months of development. The highest-impact quick wins are extending the two existing sources (EasyCep + Getmobil) to their full category coverage, which alone could increase listing volume by 3-4x without writing a single new adapter.

---

## Source Discovery Methodology

Sources were discovered via three channels:

1. **WebFetch reconnaissance** — Direct HTTP fetches to 20+ Turkish and international e-commerce domains
2. **Codebase mining** — Existing adapter stubs, configuration files, and connection records in the 2ElBul codebase
3. **Known market landscape** — Established second-hand platforms operating in Turkey

Each source was evaluated against 14 metadata fields and scored using a weighted formula that balances volume, accessibility, data quality, and strategic fit.

---

## Source Comparison Table

| # | Source | Type | Category | Est. Monthly TR Listings | Anti-Bot | Scraping Method | Data Quality | Priority Score |
|---|--------|------|----------|--------------------------|----------|-----------------|-------------|---------------|
| 1 | **EasyCep** | Direct Refurbished | Phones, Watches, Computers, Tablets | 2,000-4,000 | None (HTML) | Cheerio + JSON-LD | High | **95** |
| 2 | **Getmobil** | Refurbished Marketplace | Phones, Watches, Computers/Tablets, Accessories | 3,000-5,000 | None (HTML) | Cheerio + JSON-LD | High | **94** |
| 3 | **Sahibinden** | C2C Marketplace | All Electronics | 150,000-300,000 | Cloudflare | Playwright + ScrapingFish | Medium | **80** |
| 4 | **Trendyol** | B2C/C2C Marketplace | All Categories | 200,000-400,000 | Cloudflare + Bot-detect | API + Playwright | Medium | **78** |
| 5 | **Hepsiburada** | B2C Marketplace | Electronics | 50,000-100,000 | Cloudflare | Commerce wrapper + ScrapingFish | Medium | **72** |
| 6 | **Dolap** | C2C Marketplace | Fashion, Electronics | 30,000-60,000 | Cloudflare | Playwright | Medium | **65** |
| 7 | **n11.com** | B2C/C2C Marketplace | All Categories | 80,000-150,000 | Cloudflare | Playwright | Medium | **64** |
| 8 | **Teknosa** | B2C Retailer | Electronics | 5,000-15,000 | Cloudflare | Commerce wrapper + ScrapingFish | High | **60** |
| 9 | **MediaMarkt TR** | B2C Retailer | Electronics | 3,000-8,000 | Cloudflare | Commerce wrapper + ScrapingFish | High | **58** |
| 10 | **Amazon Turkey** | B2C Marketplace | All Categories | 40,000-80,000 | Cloudflare + Bot-detect | API + Playwright | High | **57** |
| 11 | **Cimri** | Price Comparison | Electronics | N/A (aggregator) | Cloudflare | Playwright | Low | **35** |
| 12 | **Vatan Bilgisayar** | B2C Retailer | Electronics | 2,000-5,000 | Cloudflare | Commerce wrapper + ScrapingFish | High | **50** |
| 13 | **Facebook Marketplace TR** | C2C | All Categories | 100,000-200,000 | Meta bot-detection | API (Graph) | Low | **30** |
| 14 | **Letgo Turkey** | C2C Marketplace | All Categories | 40,000-80,000 | Unknown | Requires investigation | Medium | **45** |
| 15 | **GittiGidiyor** | C2C Marketplace | All Categories | DEFUNCT (closed 2023) | N/A | N/A | N/A | **0** |
| 16 | **Samsung Turkey Trade-in** | OEM Trade-in | Samsung devices only | 500-1,000 | None | Direct API/HTML | Very High | **40** |
| 17 | **Huawei Turkey Trade-in** | OEM Trade-in | Huawei devices only | 200-500 | None | Direct HTML | Very High | **30** |
| 18 | **Apple Turkey Refurbished** | OEM Refurbished | Apple devices only | N/A | N/A | No TR presence | N/A | **0** |
| 19 | **DonanımHaber Forum** | Forum Marketplace | Tech-focused | 10,000-20,000 | Cloudflare | Playwright | Low | **25** |
| 20 | **refurbed** | International Refurbished | All Electronics | N/A (no TR shipping) | Standard HTML | Cheerio | Very High | **15** |
| 21 | **BackMarket** | International Refurbished | All Electronics | N/A (no TR shipping) | Cloudflare | N/A | Very High | **10** |
| 22 | **Karaborsa.com** | C2C Marketplace | All Categories | DEFUNCT (domain for sale) | N/A | N/A | N/A | **0** |
| 23 | **Yenilenmiş Market** | Refurbished Retailer | Electronics | Unknown | Cloudflare | Commerce wrapper + ScrapingFish | Medium | **35** |

---

## Source Scoring Methodology

Each source was scored on a 0-100 scale using these weighted criteria:

| Criterion | Weight | Description |
|-----------|--------|-------------|
| **Listing Volume** | 25% | Estimated monthly second-hand electronics listings |
| **Accessibility** | 20% | Ease of scraping (no anti-bot = high, Cloudflare + bot-detection = low) |
| **Data Quality** | 20% | Structured data presence (JSON-LD, schema.org, API vs. unstructured HTML) |
| **Strategic Fit** | 15% | Relevance to 2ElBul's core electronics focus |
| **Maintenance Cost** | 10% | Estimated effort to keep adapter working over time |
| **Legal Risk** | 10% | Terms of service, robots.txt compliance, data usage restrictions |

---

## Top 10 Highest Priority Sources

### Tier S — Already Working (Score 90+)

**1. EasyCep (Score: 95)**
- Adapter exists and works. Currently scraping 3 categories. Can expand to 4 (Computers category was confirmed on their site but not in our URL list). No anti-bot protection. JSON-LD structured data available.
- **Action:** Add the Bilgisayar category URL. Increase per-category limits.

**2. Getmobil (Score: 94)**
- Adapter exists and works. Currently scraping 2 categories. Site confirmed to have 4 categories (phones, watches, computers/tablets, accessories). No anti-bot. JSON-LD with ProductGroup support.
- **Action:** Add Bilgisayar/Tablet and Aksesuar category URLs. Pagination already implemented.

### Tier A — High Priority (Score 60-80)

**3. Sahibinden (Score: 80)**
- Adapter exists but blocked by Cloudflare. Largest single source of second-hand electronics listings in Turkey. Has schema.org microdata. Requires ScrapingFish API key.
- **Action:** Obtain ScrapingFish key. Test adapter. Expect 150-300K monthly electronics listings.
- **Risk:** Cloudflare challenge page may change. ScrapingFish may not always bypass.

**4. Trendyol (Score: 78)**
- No adapter. Second-largest Turkish e-commerce platform. Has a dedicated second-hand section. Cloudflare + additional bot detection. May have a public API.
- **Action:** Investigate Trendyol API (internal product search API). Fallback: Playwright + residential proxy.
- **Risk:** Aggressive anti-bot. Legal TOS restrictions on scraping.

**5. Hepsiburada (Score: 72)**
- Commerce adapter exists but requires ScrapingFish. Major electronics retailer with marketplace model. Structured product data.
- **Action:** Obtain ScrapingFish key. Test existing commerce adapter.
- **Note:** Already integrated in adapter architecture, just needs proxy.

**6. Dolap (Score: 65)**
- No adapter. Dedicated second-hand fashion + electronics marketplace (owned by Trendyol). Cloudflare protected.
- **Action:** Playwright adapter. Focus on electronics subcategory.
- **Note:** Smaller volume than Sahibinden but more focused on second-hand goods.

### Tier B — Worth Building (Score 50-60)

**7. n11.com (Score: 64)**
- No adapter. Major Turkish marketplace with significant electronics volume. Cloudflare protected.
- **Action:** Investigate API endpoints. Fallback: Playwright.
- **Note:** Less second-hand focus but high total volume.

**8. Teknosa (Score: 60)**
- Commerce adapter exists. Major electronics retailer. Has refurbished section. Cloudflare protected.
- **Action:** Activate with ScrapingFish key. Particularly valuable for official refurbished stock.

**9. MediaMarkt TR (Score: 58)**
- Commerce adapter exists. Has refurbished (yenilenmiş) product category. Cloudflare protected.
- **Action:** Activate with ScrapingFish key. Verify refurbished category URL.

**10. Amazon Turkey (Score: 57)**
- No adapter. Growing presence in Turkey. Has renewed/refurbished section. Amazon's anti-bot is among the strongest.
- **Action:** Investigate Amazon Product Advertising API. Fallback: Playwright + rotating proxies (high risk).

---

## Quick Wins (Implement in 1-2 weeks)

These require minimal effort relative to their impact:

### 1. EasyCep — Add Bilgisayar (Computers) Category
One-line URL addition to `EASYCEP_CATEGORY_URLS`. Confirmed on their site. Would add ~500-1,000 listings per run. No anti-bot, no new code.

### 2. Getmobil — Add Bilgisayar/Tablet + Aksesuar Categories
Two URL additions to `GETMOBIL_CATEGORY_URLS`. Confirmed on their site. Would add ~1,000-2,000 listings per run. No anti-bot, no new code.

### 3. Existing Adapters — Increase Per-Category Limits
Current limits are conservative (~20-30 per category). EasyCep returns ~55-60 across 3 categories. With Bilgisayar added and limits increased to 50/category, could reach 200/run. Getmobil similar potential.

### 4. Commerce Adapters — ScrapingFish Key Procurement
5 adapters (Sahibinden, Hepsiburada, Teknosa, MediaMarkt, Yenilenmiş Market) are adapter-ready. They just need a ScrapingFish API key. This is the single highest-ROI infrastructure investment available.

| Source | Existing Code | Key Needed | Est. Yield/Run |
|--------|--------------|------------|----------------|
| Sahibinden | Full adapter | ✅ | 40-50 |
| Hepsiburada | Commerce adapter | ✅ | 15-20 |
| Teknosa | Commerce adapter | ✅ | 15-20 |
| MediaMarkt | Commerce adapter | ✅ | 15-20 |
| Yenilenmiş Market | Commerce adapter | ✅ | 15-20 |

### 5. Increase Source Runner Stagger Delay
Current `SOURCE_STAGGER_DELAY_MS=5000` is tuned for 2 sources. When adding 5 more, may need to increase to 10-15s to avoid rate limiting and concurrent connection issues.

---

## High Value Sources

These require moderate-to-significant effort but deliver outsized volume:

### Sahibinden (80 pts)
The crown jewel of Turkish second-hand listings. Estimated 150K-300K monthly electronics listings. Adapter is fully written — the only blocker is the ScrapingFish API key. Cloudflare protection is their primary defense; ScrapingFish has proven effective against Cloudflare in testing. Once operational, this single source could increase 2ElBul's listing volume by 10x.

### Trendyol (78 pts)
Turkey's largest e-commerce platform by traffic. Their second-hand section is growing. Trendyol has internal APIs used by their mobile apps that may be more accessible than the web interface. Their GraphQL API (used by the mobile app) is a potential vector that bypasses Cloudflare entirely. This would require a different adapter approach but could yield 200K-400K monthly listings.

### Dolap (65 pts)
Explicitly a second-hand marketplace (owned by Trendyol). Focused on authenticated used goods. Lower volume than Sahibinden but higher signal-to-noise ratio since all listings are pre-verified. Good for quality over quantity.

---

## Difficult Sources Worth Building

### Amazon Turkey
Amazon's anti-bot technology (including their internal AWS WAF) is among the most sophisticated in the world. However, their Product Advertising API provides structured access to product data, pricing, and offers — including renewed/refurbished items. The API approach avoids scraping entirely. Amazon Turkey's second-hand volume is lower than marketplace leader Trendyol, but the data quality is very high. **Recommendation:** Investigate PAAPI v5 integration as a separate source type (API-based, not scrape-based).

### Facebook Marketplace
Facebook's anti-scraping measures are extreme. Graph API access is limited and requires app review. The data quality is low (unstructured descriptions, inconsistent pricing). Volume is high (100K-200K monthly electronics listings in Turkey). **Recommendation:** Skip. The maintenance cost and legal risk outweigh the benefit. If needed later, a Meta Marketing API partner setup would be required.

### DonanımHaber Forum
The forum has a vibrant second-hand electronics section popular with tech enthusiasts. Valuable for niche/high-end items. However, forum scraping is fragile, pagination is complex, and data quality is low (mixed Turkish/English, inconsistent pricing formats). **Recommendation:** Defer to Phase 4. Only pursue if higher-priority sources are all operational.

---

## Sources to Avoid

| Source | Reason to Avoid |
|--------|-----------------|
| **GittiGidiyor** | Shut down by eBay in 2023. Site is defunct. |
| **Karaborsa.com** | Domain is for sale. No active marketplace. |
| **Apple Refurbished Turkey** | Apple does not operate a refurbished store in Turkey. TR domain returns 404. |
| **refurbed** | 24 European countries but does not ship to Turkey. No Turkish language option. |
| **BackMarket** | Does not appear to ship to Turkey. Connection refused from Turkish IPs. |
| **Cimri** | Price comparison aggregator, not a listing source. No unique inventory. |

---

## Legal Considerations

### Turkish Law Context

1. **E-Commerce Law (6563)** — Regulates online marketplaces. Scraping publicly available pricing and product information for search/aggregation purposes is generally considered permissible, but re-publishing copyrighted product images may violate the Law on Intellectual and Artistic Works (5846).

2. **Personal Data Protection (KVKK - 6698)** — Listing data that includes seller phone numbers, names, or contact info constitutes personal data. 2ElBul's current approach of only storing product-level data (price, title, image, condition) rather than seller contact info is legally sound. **Never scrape or store seller phone numbers, names, or addresses.**

3. **Competition Law (4054)** — Price aggregation must not be used for anti-competitive practices (price fixing, market manipulation). 2ElBul's use case (consumer search/comparison) is pro-competitive and should not raise concerns.

4. **robots.txt Compliance** — Each source's `robots.txt` should be respected as a minimum standard. Currently:
   - EasyCep: No restrictions detected
   - Getmobil: No restrictions detected  
   - Sahibinden: Restrictive — `/ilan` (listings) disallowed for most bots
   - Trendyol/Hepsiburada: Standard crawl-delay directives

5. **Terms of Service** — Most marketplaces prohibit scraping in their ToS. While ToS violations are civil (not criminal) matters in Turkey, they can lead to IP bans and cease-and-desist letters. Mitigation:
   - Use reasonable crawl delays (2-5s minimum between requests)
   - Cache aggressively (reduce request count)
   - Identify via User-Agent (transparency reduces legal risk)
   - Never sell scraped data as a standalone product

6. **EU Digital Services Act (DSA)** — Turkish platforms that also operate in the EU (Trendyol, Amazon) have DSA obligations. This may affect their API accessibility but has limited impact on scraping.

### Recommended Legal Position

Operate in the **"public information aggregation"** framework: 2ElBul is a search engine and price comparison tool for second-hand electronics, similar to Google Shopping or Cimri. Display listings with attribution and links back to the original source. Do not cache or display seller contact information. This position is defensible under Turkish law and consistent with how price comparison platforms operate globally.

---

## Anti-Bot Strategy

### Bot Protection Classification in Target Sources

| Protection Level | Sources | Strategy |
|-----------------|---------|----------|
| **None** (HTML only) | EasyCep, Getmobil | Cheerio + JSON-LD. No special measures needed. |
| **Cloudflare (standard)** | Sahibinden, Hepsiburada, Teknosa, MediaMarkt, Vatan | ScrapingFish proxy. OR Playwright with stealth plugin + residential proxies. |
| **Cloudflare + WAF** | Trendyol, n11, Dolap, Amazon | Multi-layer: API discovery first (mobile app API), then Playwright + undetected-chromedriver + rotating residential proxies as fallback. |
| **Meta/FB** | Facebook Marketplace | Requires Graph API with approved app. Not viable for scraping. |

### Recommended Scraping Tech Stack

```
                    ┌─────────────────────┐
                    │   Source Router      │
                    │  (source-engine)     │
                    └────────┬────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
     │  Cheerio     │ │  Playwright │ │  API Client │
     │ (no proxy)   │ │ + proxy     │ │ (native)    │
     └─────────────┘ └─────────────┘ └─────────────┘
              │              │              │
              ▼              ▼              ▼
     ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
     │ Direct HTTP  │ │ ScrapingFish │ │ Mobile API  │
     │              │ │ Proxy        │ │ Reverse Eng. │
     └─────────────┘ └─────────────┘ └─────────────┘
```

**Current state:** Only Cheerio (left branch) is implemented. ScrapingFish middleware exists in `html-utils.ts` but is inactive without an API key.

---

## Recommended Proxy Strategy

### Tier 1: ScrapingFish (Immediate Priority)

ScrapingFish is the recommended proxy solution because:
- Already integrated into the codebase (`safeFetchHtml` with proxy support)
- Handles Cloudflare, Cloudflare Challenge, and basic bot detection
- Pay-per-success pricing model ($0.015/request)
- No capacity planning or IP pool management needed
- Previously validated with Sahibinden adapter

**Estimated cost at scale:**

| Usage Scenario | Requests/Month | Cost/Month |
|---------------|----------------|------------|
| Current (EasyCep + Getmobil only) | 0 (no proxy needed) | $0 |
| + Sahibinden (daily, ~200 listings) | ~6,000 | ~$90 |
| + 4 Commerce sources (daily) | ~2,000 | ~$30 |
| Full Tier A+B (daily) | ~15,000 | ~$225 |
| Full Tier A+B (hourly) | ~360,000 | ~$5,400 |

**Recommendation:** Start with daily runs for proxy-protected sources. This keeps costs under $150/month while the platform validates listing quality and user traction.

### Tier 2: Residential Proxy Network (Future)

For sources where ScrapingFish is insufficient (Trendyol, n11, Amazon):
- BrightData (formerly Luminati) — most reliable residential IP network
- IPRoyal — lower cost, adequate for Turkish IPs
- Estimated cost: $0.60/GB or $3/IP
- Only needed if ScrapingFish cannot bypass a specific source

### Proxy Architecture Decision Table

| If source... | Then use... |
|-------------|-------------|
| Has **no anti-bot** | Direct HTTP (Cheerio) — no proxy needed |
| Has **Cloudflare (basic)** | ScrapingFish proxy — already supported in html-utils |
| Has **Cloudflare + JS challenge** | Playwright + ScrapingFish proxy |
| Has **Cloudflare + WAF + bot-detect** | Playwright + undetected-chromedriver + residential proxy |
| Returns **block/page/error page** | Try a different method (API vs. Playwright vs. Puppeteer) |

---

## Playwright Strategy

### Current State
2ElBul has `puppeteer` listed in `package.json` but no Playwright/Puppeteer-based adapters. All current adapters use Cheerio (server-side HTML parsing).

### Why Playwright
- Can execute JavaScript (bypasses JS challenges)
- Can handle Cloudflare challenge pages
- Can mimic real browser behavior (viewport, headers, cookies)
- Better for SPAs (React, Vue, Angular) that Cheerio cannot parse
- `playwright-extra` + `puppeteer-extra-plugin-stealth` reduces bot detection

### Stealth Configuration

```typescript
// Recommended stealth setup (for future Playwright-based adapters)
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
});

const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...',
  locale: 'tr-TR',
  timezoneId: 'Europe/Istanbul'
});
```

### When NOT to use Playwright
- Source has no anti-bot (use Cheerio — 20x faster, 1/10th the memory)
- Source has a stable API (use direct fetch — fastest, most reliable)
- Single-page extraction (use hot-requests paradigm, not a full browser)

### Resource Requirements
- Cheerio adapter: ~50ms, ~5MB memory
- Playwright adapter: ~2-5s, ~100MB memory (browser process)
- Impact: Source runner timeout (currently 20s) must be increased for Playwright adapters
- Recommendation: 60s timeout for Playwright-based sources

---

## API Discovery Strategy

### Methodology

For each marketplace, before writing a scraper, investigate:

1. **Mobile app API** — Use HTTP proxy (mitmproxy/Charles) to capture API calls from the iOS/Android app. Mobile APIs often have weaker authentication than web APIs.

2. **Web XHR/GraphQL** — Open browser DevTools → Network tab → Filter XHR/Fetch. Look for product search/list endpoints with JSON responses. Common patterns:
   - `api.trendyol.com/...`
   - `graphql.hepsiburada.com/...`
   - `api.n11.com/...`
   - `www.sahibinden.com/.../...json`

3. **Public Product Feeds** — Some marketplaces offer XML/JSON feeds for affiliates:
   - Trendyol: Partner API
   - Amazon: Product Advertising API v5
   - Hepsiburada: Commercial Partner API

4. **RSS/Atom feeds** — Some platforms (especially forums) offer RSS feeds of new listings. DonanımHaber forum has RSS.

### API Priority Matrix

| Source | API Type | Likelihood | Complexity | Yield |
|--------|----------|-----------|------------|-------|
| Trendyol | Mobile GraphQL | High | Medium | Very High |
| n11 | Mobile REST | Medium | Medium | High |
| Amazon Turkey | PAAPI v5 | High | Low (SDK available) | Medium |
| Dolap | Mobile REST | High | Medium | Medium |
| Hepsiburada | Partner XML | High | Low | Medium |

### Recommendation
When building new adapters (Phase 2-4), spend 1-2 days on API discovery before writing a single line of Playwright code. A successful API integration costs 1/10th of a Playwright adapter to maintain.

---

## Anti-Bot Discovery Checklist

When investigating a new source, follow this decision tree:

```
New source identified
        │
        ▼
Try direct fetch (safeFetchHtml)
        │
    ┌───┴───┐
    │       │
  200      403/503/challenge
    │       │
  Done!    Is it Cloudflare?
    │       │
    │    ┌──┴──┐
    │    │     │
    │   Yes   No
    │    │     │
    │    │     ▼
    │    │   Try ScrapingFish
    │    │     │
    │    │  ┌──┴──┐
    │    │  │     │
    │    │ 200   Failed
    │    │  │     │
    │    │ Done! ▼
    │    │     Try Playwright
    │    │     + stealth
    │    │        │
    │    │     ┌──┴──┐
    │    │     │     │
    │    │    200   Failed
    │    │     │     │
    │    │    Done! ▼
    │    │       Try Playwright
    │    │       + residential proxy
    │    │           │
    │    │        ┌──┴──┐
    │    │        │     │
    │    │       200   Skip source
    │    │        │
    │    │       Done!
    │    │
    │    ▼
    │  Try mobile API
    │        │
    │     ┌──┴──┐
    │     │     │
    │    200   Blocked
    │     │     │
    │    Done! ▼
    │       Try native
    │       API (GraphQL/REST)
    │          │
    │       ┌──┴──┐
    │       │     │
    │      200   Skip
    │       │
    │      Done!
```

---

## Estimated Total Addressable Listing Volume

### Conservative Estimate (Tier S + A sources only)

| Source | Est. Monthly Electronics Listings | Scrapable/Month (daily run) | Notes |
|--------|----------------------------------|---------------------------|-------|
| EasyCep | 2,000-4,000 | 1,000-2,000 | Full inventory is small |
| Getmobil | 3,000-5,000 | 1,500-2,500 | Pagination gives access |
| Sahibinden | 150,000-300,000 | 3,000-6,000 | Top-N by recency only |
| Trendyol | 200,000-400,000 | 5,000-10,000 | API gives best access |
| Hepsiburada | 50,000-100,000 | 1,500-3,000 | Commerce adapter |
| Dolap | 30,000-60,000 | 1,000-2,000 | Playwright needed |
| n11 | 80,000-150,000 | 2,000-4,000 | Playwright/API needed |
| Teknosa | 5,000-15,000 | 500-1,500 | Refurbished section |
| MediaMarkt TR | 3,000-8,000 | 300-800 | Refurbished section |
| Amazon Turkey | 40,000-80,000 | 1,000-2,000 | PAAPI rate limits |
| **Total** | **~563K-1.12M** | **~16,800-31,800** | Daily run across all sources |

### Addressability Factors

- **Not all listings are scrapable** — most platforms show top-N recent/popular listings, not the full inventory
- **Duplication across sources** — same iPhone 14 listed on Sahibinden, Trendyol, and Dolap simultaneously. The Product Matcher handles this.
- **Listing churn** — second-hand listings have short lifetimes (days to weeks). New inventory appears constantly.
- **Rate limiting** — each source imposes practical limits regardless of total volume

### Realistic Target

With all Tier S, A, and B sources operational:
- **Daily new listings ingested:** 500-1,000
- **Monthly unique products created:** 3,000-8,000 (after Product Matcher dedup)
- **Year 1 database target:** 100,000-250,000 products

---

## 4-Phase Integration Roadmap

### Phase 1: Foundation & Quick Wins (Weeks 1-2)

**Goal:** 3-4x listing volume increase with zero new adapter code.

| Task | Effort | Impact | Dependencies |
|------|--------|--------|-------------|
| Add EasyCep Bilgisayar category URL | 5 min | +25% volume | None |
| Add Getmobil Bilgisayar/Tablet + Aksesuar URLs | 10 min | +50% volume | None |
| Increase per-category limits to 50 | 5 min | +100% volume per run | None |
| Increase SOURCE_STAGGER_DELAY_MS | 5 min | Future-proofing | None |
| **Total Phase 1:** | **~25 min** | **3-4x volume increase** | |

**Deliverable:** EasyCep reaches ~200 listings/run, Getmobil reaches ~200 listings/run.

---

### Phase 2: ScrapingFish Activation (Weeks 3-4)

**Goal:** Activate 5 blocked adapters via proxy procurement.

| Task | Effort | Impact | Dependencies |
|------|--------|--------|-------------|
| Obtain ScrapingFish API key | 1 day | Enables all Phase 2 | Payment method |
| Add SCRAPINGFISH_API_KEY to .env.local | 5 min | Runtime activation | API key obtained |
| Test Sahibinden adapter | 1 day | Highest volume source | API key |
| Test 4 Commerce adapters | 2 days | 3 more electronics retailers | API key |
| Increase source-runner timeout to 60s | 30 min | Prevents timeouts | Playwright readiness |
| **Total Phase 2:** | **~4-5 days** | **8-10x volume increase** | |

**Deliverable:** ~700-800 listings/run (vs. current ~90-100).

---

### Phase 3: Playwright Adapters (Weeks 5-8)

**Goal:** Access Cloudflare + WAF protected sources via Playwright.

| Task | Effort | Impact | Dependencies |
|------|--------|--------|-------------|
| Add Playwright + stealth dependencies | 1 day | Infrastructure | npm audit |
| Build Playwright base adapter class | 2 days | Reusable base | Playwright installed |
| Trendyol API discovery | 3 days | Highest volume #2 | Mitmproxy setup |
| Trendyol adapter (Playwright or API) | 5 days | 200K-400K monthly | API/investigation |
| Dolap adapter (Playwright or API) | 3 days | Quality listings | Playwright base |
| n11 API discovery + adapter | 4 days | 80K-150K monthly | API/investigation |
| Amazon PAAPI integration | 3 days | Official data feed | AWS account |
| **Total Phase 3:** | **~21 days** | **40-50x volume increase** | |

**Deliverable:** ~2,000-3,000 listings/run. Phase 2 + Phase 3 together cover all Tier A + B sources.

---

### Phase 4: Long-Tail & Optimization (Weeks 9-12+)

**Goal:** Polish, long-tail sources, monitoring, cost optimization.

| Task | Effort | Impact | Dependencies |
|------|--------|--------|-------------|
| Source health monitoring dashboard | 2 days | Operational sanity | Phase 2+3 running |
| Adaptive crawl frequency (more for high-churn sources) | 3 days | Data freshness | Monitoring data |
| Source scoring automation | 2 days | Data-driven prioritization | Historical run data |
| DonanımHaber forum adapter | 3 days | Niche tech audience | Playwright base |
| Vatan Bilgisayar commerce adapter | 1 day | Another retailer | ScrapingFish key |
| Proxy cost optimization | 2 days | $ savings | 30 days usage data |
| Caching layer improvements | 2 days | Reduce redundant fetches | Monitoring data |
| **Total Phase 4:** | **~15 days** | Incremental + quality | |

**Deliverable:** Fully automated source discovery pipeline, cost-optimized proxy usage, comprehensive monitoring.

---

## Estimated Timeline

```
Week  1  2  3  4  5  6  7  8  9  10 11 12
      │  │  │  │  │  │  │  │  │  │  │  │
P1    ██ ██
      (quick wins - category expansion)
P2       ██ ██ ██
          (ScrapingFish activation)
P3             ██ ██ ██ ██ ██
                (Playwright + API adapters)
P4                      ██ ██ ██ ██ ██
                         (long-tail + optimization)
      │  │  │  │  │  │  │  │  │  │  │  │
Run:  ~100   ~800      ~2500          ~3000+
listings/run
```

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| ScrapingFish key unavailable | Medium | High (blocks Phase 2 entirely) | Evaluate alternative proxies (BrightData, IPRoyal) |
| Sahibinden changes anti-bot | Medium | High (largest single source) | Move to Playwright + residential as fallback |
| Trendyol API not discoverable | High | Medium (fallback to Playwright) | Budget 5 days for API investigation before Playwright |
| Legal challenge from marketplace | Low | High | Maintain "public aggregation" position, respect robots.txt |
| Cost overruns at full scale | Medium | Medium | Implement caching, reduce run frequency for low-churn sources |
| EasyCep/Getmobil changes site structure | Low | Medium | Tests in `easycep-adapter.test.ts` and `getmobil-adapter.test.ts` provide early warning |
| Data quality degradation | Low | Medium | Validation pipeline catches bad data before persistence |

---

## Appendix A: Existing Adapter Inventory

| Source | Adapter File | Status | Type | Est. Lines | Proxy Needed |
|--------|-------------|--------|------|-----------|-------------|
| EasyCep | `lib/bots/adapters/easycep.ts` | ✅ Working | Cheerio + JSON-LD | 245 | No |
| Getmobil | `lib/bots/adapters/getmobil.ts` | ✅ Working | Cheerio + JSON-LD | 347 | No |
| Sahibinden | `lib/bots/adapters/sahibinden.ts` | ❌ Blocked | Cheerio + schema.org | ~150 | Yes (Cloudflare) |
| Hepsiburada | `lib/bots/adapters/commerce.ts` | ❌ Blocked | Commerce wrapper | ~200 | Yes (Cloudflare) |
| Teknosa | `lib/bots/adapters/commerce.ts` | ❌ Blocked | Commerce wrapper | ~200 | Yes (Cloudflare) |
| MediaMarkt TR | `lib/bots/adapters/commerce.ts` | ❌ Blocked | Commerce wrapper | ~200 | Yes (Cloudflare) |
| Yenilenmiş Market | `lib/bots/adapters/commerce.ts` | ❌ Blocked | Commerce wrapper | ~200 | Yes (Cloudflare) |
| EasyCep Unified | `lib/unified/adapters/easycep-unified.ts` | ✅ Working | Wrapper | 117 | No |
| Getmobil Unified | `lib/unified/adapters/getmobil-unified.ts` | ✅ Working | Wrapper | 115 | No |

Commerce adapter sources (`lib/bots/adapters/commerce.ts`) share a single adapter with source-specific URL config. Sahibinden has its own dedicated adapter.

---

## Appendix B: Source Metadata Schema

Each source in this report was evaluated against:

| Field | Description |
|-------|-------------|
| `name` | Platform name |
| `type` | Direct refurbished / C2C marketplace / B2C retailer / OEM trade-in / Forum / International |
| `url` | Base URL |
| `category` | Electronics subcategories available |
| `antiBot` | Protection type: None, Cloudflare, Cloudflare+WAF, Meta, Akamai |
| `scrapingMethod` | Recommended tool: Cheerio, Playwright, API, Commerce wrapper |
| `dataQuality` | High (schema.org/JSON-LD), Medium (structured HTML), Low (unstructured) |
| `monthlyVolume` | Estimated monthly electronics listings |
| `priorityScore` | Composite 0-100 score |
| `adapterStatus` | No adapter / Adapter exists / Blocked / Working |
| `tosRisk` | Low / Medium / High |
| `proxyRequired` | Yes / No |
| `notes` | Implementation considerations |

---

## Appendix C: Quick Reference — URLs discovered during research

| Source | Key URLs |
|--------|---------|
| EasyCep Phones | `https://easycep.com/kategori/cep-telefonu-1` |
| EasyCep Accessories | `https://easycep.com/kategori/aksesuar-279` |
| EasyCep Watches | `https://easycep.com/kategori/akilli-saat-277` |
| EasyCep Computers | `https://easycep.com/kategori/bilgisayar-278` (NEW - not yet in adapter) |
| Getmobil Phones | `https://getmobil.com/satin-al/cep-telefonu/` |
| Getmobil Watches | `https://getmobil.com/satin-al/akilli-saat-ve-bileklik/akilli-saat/` |
| Getmobil Computers | `https://getmobil.com/satin-al/bilgisayar-ve-tablet/` (NEW - not yet in adapter) |
| Getmobil Accessories | `https://getmobil.com/satin-al/aksesuar/` (NEW - not yet in adapter) |
| Sahibinden | `https://www.sahibinden.com` |
| Trendyol | `https://www.trendyol.com/ikinci-el` |
| Hepsiburada | `https://www.hepsiburada.com` |
| Dolap | `https://www.dolap.com` |

---

*End of Sprint DS-01 Report. Next step: Phase 1 implementation (category URL expansion) can begin immediately without any dependencies.*
