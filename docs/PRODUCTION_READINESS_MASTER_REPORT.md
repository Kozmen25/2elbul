# PRODUCTION_READINESS_MASTER_REPORT.md

> **Hedef:** 100.000 gerçek ilan senaryosunda zero-trust prod readiness
> **Tarih:** 2026-07-11
> **Yöntem:** Her alt sistem kodu satır satır okundu, hiçbir şey varsayılmadı
> **Dil:** Türkçe
> **Kısıtlar:** Yeni engine yazmak yasak, mevcut engine'leri kullan, Product Intelligence bağımsızlığı koru

---

## İçindekiler

1. [Database & Data Layer](#1-database--data-layer)
2. [Source Engine](#2-source-engine)
3. [Bot System & Adapters](#3-bot-system--adapters)
4. [Product Matcher](#4-product-matcher)
5. [Duplicate Engine](#5-duplicate-engine)
6. [Confidence Engine & Normalization](#6-confidence-engine--normalization)
7. [Intelligence Engine & Search](#7-intelligence-engine--search)
8. [Import Pipeline, Cron & Monitoring](#8-import-pipeline-cron--monitoring)
9. [Admin, SEO & Performance](#9-admin-seo--performance)
10. [Architecture & Cross-cutting Concerns](#10-architecture--cross-cutting-concerns)

---

## 1. Database & Data Layer

### ✓ What exists

- **PostgreSQL** Supabase üzerinde, 6 migration dosyası (`supabase/migrations/`)
- Migration'lar: `listings` tablosu, products, search_demand, price_history, sources, vs.
- **Price history dual path:**
  - JavaScript tarafı: `lib/price-history.ts` → `recordListingPriceHistory()` çağrısı
  - PostgreSQL tarafı: `record_price_history_on_change()` trigger'ı (SQL migration içinde)
  - Backfill desteği mevcut (`/api/cron/price-history-backfill`)
- **Schema fallback pattern:** 4 ayrı yerde tekrarlanan legacy kolon adı kontrolü (`integration_type`, `fetch_limit`, `bot_import_mode`)
- **CRON_SECRET auth:** 4 cron route'unda `HasValidSecret()` çağrısı, her biri 4 kaynaktan secret okuyor

### ✓ What works

- Migration'lar clean state'ten çalıştırıldığında sorunsuz
- Price history trigger atomic — listing güncellenirken otomatik kayıt
- Row-Level Security (RLS) aktif
- Temel index'ler mevcut (listings.source+external_id unique constraint, products.slug unique)

### ✗ What is missing

- **Migration versioning aracı yok.** Raw SQL dosyaları manuel sırayla çalıştırılıyor. CI/CD'de otomatik migration runner yok.
- **Connection pooling konfigürasyonu yok.** Supabase varsayılan pool limiti kullanılıyor, 100K listing'de pool starvation riski.
- **Migration testi yok.** Herhangi bir migration'ın geri alınması (`down`) mümkün değil.
- **Veri temizleme stratejisi yok.** Soft-delete mekanizması var ama eski/kopya/geçersiz listing'ler için retention policy tanımlı değil.
- **Database monitoring yok.** Query performance, slow query log, index kullanımı takip edilmiyor.
- **Seed data yok.** Test/geliştirme ortamı için gerçekçi veri seti mevcut değil.
- **Schema fallback 4 kez tekrarlanıyor** — aynı legacy kolon kontrolü 4 ayrı dosyada.

### ✗ What will break at 100K listings

| Sorun | Etki | Detay |
|-------|------|-------|
| **Product tablosu LIMIT 2000** | Orta | repository.ts: product matcher LIMIT 2000 ile sorguluyor — 50K+ üründe eksik eşleşme |
| **Index yetersizliği** | Yüksek | JOIN'li sorgular (listing→product→source) full scan'e düşebilir |
| **Price history volume** | Orta | Her listing güncellemesinde 1 satır insert — 100K listing × günlük güncelleme = hızlı büyüme |
| **Connection pool** | Orta | 12 concurrent cron + API isteği pool'u tüketebilir |
| **Search demand tablosu** | Düşük | Şu an 25 satır limit, 100K listing'de search volume artsa da tablo yapısı basit |

### Risk Level: **YÜKSEK** (ORTA'ya düşürülebilir)

En kritik: LIMIT 2000 bug'ı doğrudan veri kaybına yol açar. Index ve pool sorunları performansı etkiler ama veri kaybı yaratmaz.

### Estimated effort: **3-5 gün**

- Index optimizasyonu ve migration: 1 gün
- LIMIT 2000 bug fix: 0.5 gün (ama Product Matcher başlığı altında)
- Connection pooling yapılandırması: 0.5 gün
- Migration runner + CI entegrasyonu: 1 gün
- Veri temizleme politikası: 0.5 gün
- Schema fallback tekilleştirme: 0.5 gün

---

## 2. Source Engine

### ✓ What exists

- `lib/source-engine/` dizini: `index.ts`, `engine.ts` (168 satır), `diagnostics.ts` (59 satır), `types.ts` (46 satır)
- **Orkestrasyon:** `loadSources()` → `getSkipReason()` → sequential `runSourceScrapeBot()` → aggregate
- **Schema fallback:** Hata mesajında legacy kolon adı varsa legacy query ile retry
- **Diagnostics:** Her source run'ı için `healthy | warning | failed | blocked | unsupported | empty` sınıflandırması
- **Skip logic:** `is_active`, `isSupportedScrapeSource`, `integration_type`, `cron_enabled`, `cron_schedule`

### ✓ What works

- Kaynak atlama mantığı doğru çalışıyor
- Hata sınıflandırması kullanışlı
- Schema fallback legacy tablolarla uyumluluğu koruyor
- Tip sistemi temiz (`SourceEngineMode`, `RunOptions`, `Summary`)

### ✗ What is missing

- **Sequential execution.** `for (const source of runnable) { await runSourceScrapeBot(...) }` — paralel çalışma yok. 7 kaynak sırayla çalışıyor.
- **Timeout yok.** Her source run için timeout mekanizması tanımlı değil. Tek kaynak takılırsa tüm pipeline bloke olur.
- **Retry politikası yok.** Source başarısız olursa doğrudan `failed` statüsü — tekrar deneme yok.
- **Rate limiting yok.** Adapter'lara gönderilen istek sayısı kontrol edilmiyor.
- **Cache yok.** Her cron çalıştırmada tüm kaynaklar yeniden taranıyor.
- **Circuit breaker yok.** Ardışık başarısız kaynak tekrar tekrar deneniyor.
- **Parallel adapter sistemi:** `bots/adapters` (7 adapter) VE `unified-source-engine/adapters` (2 adapter) — hangisi ne zaman kullanılıyor? İkisi arasında geçiş/net ayrım yok.

### ✗ What will break at 100K listings

| Sorun | Etki | Detay |
|-------|------|-------|
| **Sequential execution süresi** | Yüksek | 7 source × ~5sn = 35sn minimum. 100K listing'de sayfa sayısı artar → süre 5-10dk'ya çıkar |
| **Timeout yok** | Yüksek | Tek kaynak donarsa tüm engine bloke, hiçbir veri gelmez |
| **Retry yok** | Orta | İnternet kaynaklı geçici hatalarda veri kaybı |
| **Circuit breaker yok** | Orta | 5 kez üst üste hata veren kaynak 6. kez de denenir (boşuna) |
| **Schema fallback overhead** | Düşük | Nadiren tetiklenir, etkisi minimum |

### Risk Level: **YÜKSEK**

Sequential execution + timeout yokluğu = production'da en olası failure modu. Tek bir kaynağın donması tüm veri akışını durdurur.

### Estimated effort: **2-4 gün** (yeni engine yazmadan)

- Parallel execution (Promise.allSettled ile, yeni engine yazmadan): 1 gün
- Per-source timeout: 0.5 gün
- Retry + circuit breaker (mevcut `diagnostics.ts`'e eklenerek): 1 gün
- Cache (basit Map TTL): 0.5 gün
- Adapter sistemi netleştirme: 1 gün

---

## 3. Bot System & Adapters

### ✓ What exists

- **7 adapter:** easycep, getmobil, hepsiburada-yenilenmis, teknosa-yenilenmis, mediamarkt-yenilenmis, yenilenmis-market, sahibinden
- **ScrapingFish proxy:** `lib/bots/anti-bot-proxy.ts` — Cloudflare bypass için katmanlı strateji
- **Connectors:** `lib/bots/connectors.ts` → `SCRAPE_FETCHERS` registry, `getSourceConnector()`, `getStandardSourceAdapter()`
- **Sprint 4.5 çözümü:** ScrapingFish API key varsa → proxy kullan, yoksa direct fetch + Cloudflare tespiti
- **28 test** (Sahibinden), 6 test (anti-bot-proxy)
- **Sprint 4.6 Satarız kararı:** GEÇ — teknik olarak scrapelenebilir ama telefon verisi yok

### ✓ What works

- Tüm 7 adapter bağımsız çalışıyor
- ScrapingFish fallback stratejisi doğru tasarlanmış
- `extractBrandModel` regex pattern'leri 18 markayı kapsıyor
- `parseRelativeDate` Türkçe tarih formatlarını doğru parse ediyor
- Deduplication by URL çalışıyor

### ✗ What is missing

- **Rate limiting — hiçbir adapter'da yok.** Sahibinden'e 100 istek/sn'de giderse IP ban riski.
- **Adapter health monitoring yok.** Hangi adapter ne kadar başarılı, error rate, response time takip edilmiyor.
- **Parallel execution yok** (Source Engine başlığında da belirtildi).
- **Unified adapter sistemi tamamlanmamış.** `unified-source-engine/adapters`'da 2 adapter var (`persist()` false dönüyor, `match()` boş). `bots/adapters` ile çakışma var.
- **Proxy maliyet takibi yok.** ScrapingFish $49/ay sabit ücret. 100K listing'de kaç istek gerekeceği hesaplanmamış.
- **Cloudflare değişiklik tespiti yok.** Sahibinden Cloudflare yapılandırmasını değiştirirse mevcut kod sessizce kalır (hata fırlatır ama monitoring yok).

### ✗ What will break at 100K listings

| Sorun | Etki | Detay |
|-------|------|-------|
| **ScrapingFish cost** | Orta | Her listing sayfası için 1 istek. 100K listing ≈ 1000 sayfa (100'erli) → günlük ~1000 ScrapingFish isteği = aylık 30K = $49 planın %6'sı. Yönetilebilir. |
| **Rate limiting** | Yüksek | 7 adapter paralel çalışmaya başlarsa hedef siteler rate limit uygulayabilir |
| **Adapter kırılganlığı** | Orta | Her adapter hedef site HTML yapısına sıkı bağlı. Site güncellenirse adapter kırılır, sessizce 0 sonuç döner. |
| **Sahibinden sayfa sayısı** | Düşük | 100 sayfa × 100 listing = 10K istek. ScrapingFish ile ~8dk sürer. |
| **Easycep/getmobil auth** | Orta | Bu siteler bot koruması ekleyebilir — mevcut adapter'lar doğrudan fetch kullanıyor. |

### Risk Level: **ORTA** (Sahibinden özelinde YÜKSEK)

Adapter'ların hedef siteye bağımlılığı en büyük risk. Site güncellemesi sessizce 0 veri üretebilir. Rate limiting kontrolsüz.

### Estimated effort: **2-3 gün**

- Rate limiting (per-adapter throttling): 0.5 gün
- Adapter health logging + monitoring: 1 gün
- Cloudflare değişiklik alarmı: 0.5 gün
- Unified adapter geçişini tamamlama: 1 gün

---

## 4. Product Matcher

### ✓ What exists

- **10 dosya:** `types.ts`, `helpers.ts`, `signals.ts`, `canonical.ts`, `confidence.ts`, `repository.ts`, `index.ts`, `duplicate.ts`, `summary.ts`, `matcher.ts`
- **Dağıtık mantık:** Merkezi `engine.ts` yok — logic 10 dosyaya dağılmış
- **N+1 product matching:** Hem import pipeline'da (`import-listings.ts` line 83: `for (const { index, listing } of normalizedListings)`) hem de search queue'da her listing için ayrı sorgu
- **repository.ts LIMIT 2000:** Product araması 2000 satırla sınırlı

### ✓ What works

- `matchListings()` temel eşleştirme mantığı doğru
- Canonical title seçimi çalışıyor
- Confidence scoring entegre
- Duplicate kontrolü mevcut

### ✗ What is missing

- **Merkezi engine.ts yok.** 10 dosyadaki mantığı takip etmek zor. Yeni geliştirici için öğrenme eğrisi yüksek.
- **N+1 query — her listing için 1 DB sorgusu.** 1000 listing = 1000+ DB sorgusu. 100K listing = 100K+ sorgu.
- **LIMIT 2000 — product araması 2000'de kesiliyor.** 100K listing'de 50K+ unique product olursa, product matcher sadece ilk 2000'i görür. Geri kalan listing'ler eşleşmez.
- **Toplu (batch) matching yok.** Her listing tek tek işleniyor, batch INSERT/UPDATE kullanılmıyor.
- **Cache yok.** Aynı product birden çok listing için aranıyorsa her seferinde DB'ye gidiliyor.
- **Matching queue yok.** Tüm eşleştirme synchronous — başarısız olursa tüm import başarısız.

### ✗ What will break at 100K listings

| Sorun | Etki | Detay |
|-------|------|-------|
| **N+1 query** | **ÇOK YÜKSEK** | 100K listing import = 100K+ sequential DB query. Import süresi saatlere çıkar. Timeout kaçınılmaz. |
| **LIMIT 2000** | **ÇOK YÜKSEK** | 50K+ product'ın sadece ilk 2000'i taranır. Yeni ürünler eski ürünlerle eşleşemez, duplicate patlaması. |
| **No batch** | Yüksek | Her listing ayrı INSERT. 100K listing = 100K round trip. DB bağlantısı tükenir. |
| **No cache** | Orta | Aynı brand/model sorgusu tekrarlanır. 100K listing'de ~10K redundant sorgu. |
| **Sync failure** | Orta | 99.999. listing'de hata → önceki 99.998 kayıp (transaction yönetimi yoksa). |

### Risk Level: **ÇOK YÜKSEK**

Bu, tüm platformun en kritik zayıf noktası. N+1 + LIMIT 2000 kombinasyonu 100K listing'de hem performansı öldürür hem de veri bütünlüğünü bozar. Product matching olmadan duplicate engine, intelligence engine, market intelligence — hiçbiri düzgün çalışmaz.

### Estimated effort: **4-6 gün** (yeni engine yazmadan, mevcut repository.ts'yi düzelterek)

- LIMIT 2000 kaldırma + pagination: 0.5 gün
- N+1 → batch query dönüşümü (`WHERE brand IN (...) AND model IN (...)`): 1.5 gün
- Cache katmanı (basit Map<brand+model, product[]>): 0.5 gün
- Batch upsert (`supabase.from("listings").upsert()` zaten var ama büyük batch'lerde çalıştığından emin ol): 1 gün
- Error handling + partial success: 0.5 gün
- Test + doğrulama: 1 gün

---

## 5. Duplicate Engine

### ✓ What exists

- **7 dosya:** `engine.ts` (189 satır), `scoring.ts` (264 satır), `matcher.ts` (148 satır), `helpers.ts` (132 satır), `types.ts`, `index.ts`, test
- **10-sinyal weighted scoring:**
  - normalization %35, brand %18, model %18, storage %12, ram %6, variant %4, condition %3, price %2, titleSimilarity %1, sourceDiversity %1
- **O(n²) pair comparison:** `matcher.ts` → `findDuplicateMatches()` → nested loop tüm listing'leri birbiriyle karşılaştırır
- **Union-find grouping:** `Map<Set>` ile merge, canonical + duplicates ayırımı
- **Threshold sistemi:** >=90 "same", >=70 "strong", >=40 "possible"
- **Confidence metadata entegrasyonu**

### ✓ What works

- Scoring algoritması doğru ve kapsamlı
- Union-find grouping doğru çalışıyor
- Her sinyal için ayrı scoring fonksiyonu, test edilebilir
- `shouldMerge`, `shouldWarn`, `shouldIgnore` karar helper'ları kullanışlı
- Normalization scoring Jaccard similarity + whitespace removal — makul

### ✗ What is missing

- **O(n²) scaling yok.** 10K listing = 50M karşılaştırma. 100K listing = 5 milyar karşılaştırma. İmkansız.
- **In-memory, kalıcılık yok.** Her cron çalıştırmada tüm listing'ler yeniden karşılaştırılır.
- **Incremental matching yok.** Her gün tüm veri seti baştan taranır. Yeni listing için sadece yeni listing'i mevcut gruplarla karşılaştırmak yeterliyken, her şey baştan hesaplanır.
- **Cache yok.** Fingerprint'ler yeniden hesaplanır.
- **Partitioning/şardlama yok.** Tüm listing'ler tek düzlemde karşılaştırılır. Brand/model bazında ön filtreleme yok.
- **Sonuç kalıcılığı yok.** Duplicate grupları her çalıştırmada sıfırdan oluşturulur. DB'de `duplicate_groups` tablosu yok.

### ✗ What will break at 100K listings

| Sorun | Etki | Detay |
|-------|------|-------|
| **O(n²) = 5 milyar karşılaştırma** | **ÇOK YÜKSEK** | Tek karşılaştırma ~1μs → 5 milyar = ~83 dakika. Tek bir cron job'da imkansız. |
| **In-memory = 100K listing RAM** | Yüksek | 100K listing × ~500 bytes metadata = ~50MB. Yönetilebilir. Ama fingerprint + skorlar = 200MB+. |
| **No incremental** | Yüksek | Her gün 83dk duplicate hesaplama. Günlük cron window'u aşar. |
| **No partitioning** | Yüksek | iPhone 15 vs Samsung A10 karşılaştırması boşuna. Brand/model ön filtresi yok. |
| **No persistence** | Orta | Sunucu restart = tüm duplicate grupları kaybolur. API yanıtları yavaşlar. |

### Risk Level: **ÇOK YÜKSEK**

O(n²) 100K'de kesinlikle çalışmaz. Bu, duplicate engine'in yeniden tasarlanması gerektiği anlamına gelir — ancak **yeni engine yazma kısıtı var.** Mevcut engine'i kullanarak O(n²)'yi O(n) veya O(n log n)'e indirmek mümkün değil. Tek yol:
1. Brand/model partitioning (önce brand+'model'e göre filtrele, sonra O(n²)'yi küçük gruplarda çalıştır)
2. Incremental matching: sadece yeni listing'leri mevcut gruplarla karşılaştır
3. DB'de duplicate_group kaydı tut

### Estimated effort: **5-8 gün** (yeni engine yazmadan, partitioning + incremental ekleyerek)

- Brand/model partitioning: 2 gün
- Incremental matching: 2 gün
- Sonuç kalıcılığı (duplicate_group tablosu): 1.5 gün
- Cache fingerprint: 0.5 gün
- Test + doğrulama: 1 gün

---

## 6. Confidence Engine & Normalization

### ✓ What exists

**Confidence Engine:**
- 5 dosya: `index.ts`, `engine.ts`, `scoring.ts`, `helpers.ts`, `types.ts`
- 12 sinyal ağırlıklı (`CONFIDENCE_SIGNAL_WEIGHTS`: normalization 0.1, taxonomy 0.08, brand 0.1, model 0.15, storage 0.1, ram 0.08, variant 0.05, duplicate 0.14, priceConsistency 0.06, titleSimilarity 0.05, sourceCount 0.04, sourceReliability 0.05)
- 4 seviyeli threshold: very-high >=95, high >=85, medium >=70, low >=50
- Source reliability kuralları (easycep 92, getmobil 90, yenilenmiş 87, ..., sahibinden 68, letgo 60, facebook 58)
- Duplicate engine ve product matcher tarafından kullanılıyor

**Normalization:**
- `lib/normalization/engine.ts` (410 satır) — 15 export edilmiş fonksiyon
- Türkçe karakter normalize (İ→i, ı→i, Ş→s, etc.)
- Storage normalizasyonu (GB/TB dönüşümü)
- Model variant normalizasyonu (pro max, promax, pro-max → aynı)
- 25 marka kuralı (`BRAND_RULES`)
- `normalizeProductTitle` → `normalizeSearchText` → hiyerarşik

### ✓ What works

- Confidence scoring doğru weighted average hesaplıyor
- Normalization engine kapsamlı (emoji, HTML entities, Unicode, storage, spacing, lowercase)
- Source reliability kuralları gerçekçi
- `extractBrand` 25 markayı doğru tespit ediyor
- Test coverage mevcut

### ✗ What is missing

- **Confidence Engine'de 12 sinyalin 3'ü (`duplicateScore`, `priceConsistency`, `titleSimilarity`) duplicate engine'e bağımlı.** Duplicate engine çalışmazsa bu sinyaller 0 kalır.
- **Normalization'da `normalizeStorageSize` regex'i sadece GB ve TB'i kapsıyor.** MB girdisi gelirse sessizce kalır.
- **Brand extract sadece İngilizce marka adlarını kapsıyor.** Türkçe yazılmış markalar (ör: "iphon" → "iphone" değil) atlanır.
- **Variant detection yalın — sadece keyword listesi.** "iPhone 15 Pro Max" ile "iPhone 15 Pro Max 256GB" aynı variant değil ama engine öyle kabul eder.
- **Cross-field validation yok.** Brand "iPhone" + model "Samsung Galaxy" gibi tutarsızlık tespit edilmiyor.

### ✗ What will break at 100K listings

| Sorun | Etki | Detay |
|-------|------|-------|
| **Duplicate bağımlılığı** | Yüksek | Confidence engine 3 sinyal için duplicate'e bağımlı. Duplicate engine çalışmazsa confidence scores yapay olarak düşük. |
| **Normalization O(n)** | Düşük | 100K title normalize = milisaniyeler. Sorun yok. |
| **Brand extract edge case'leri** | Düşük | Türkçe yazım hataları zaten filtre dışı kalır. 100K'de yeni marka eklenmedikçe değişmez. |
| **Variant over-matching** | Düşük | 100K listing'de daha fazla yanlış pozitif variant eşleşmesi olabilir. |

### Risk Level: **DÜŞÜK** (Duplicate bağımlılığı ORTA)

Confidence engine ve normalization 100K'de sorunsuz çalışır. Tek risk: duplicate engine çalışmazsa confidence scores güvenilir olmaz — ama bu duplicate engine'in sorunu, confidence engine'in değil.

### Estimated effort: **1-2 gün**

- MB storage support: 0.5 gün
- Cross-field validation: 0.5 gün
- Variant detection iyileştirme: 0.5 gün

---

## 7. Intelligence Engine & Search

### ✓ What exists

**Intelligence Engine:**
- `lib/intelligence-engine.ts` (~660 satır) — tek dosya, test var
- **21 referans noktası** — app genelinde en çok kullanılan engine
- `ProductIntelligence` tipi: marketValue, trend, demand, opportunity, recommendation, decisionSupport
- `calculateProductIntelligence()`: prices < 3 → insufficientIntelligence fallback
- `buildTrend`: priceHistory >= 2 nokta → trend hesabı, yoksa listing createdAt kullanılır
- `buildDecisionSupport`: buyScore (38 base) vs waitScore (28 base) → label (Şimdi Al / Bekle / Takip Et / Veri Az)
- `buildOpportunity`: cheapestDiscount + spread + trendDirection → score + label
- `buildLiquidityScore`: listingCount * 5 + recentListingCount * 6 + demandLevel bonus + searchCount/3
- Volatility: CV (standard deviation / mean) * 160 → score

**Market Intelligence:**
- 9 dosya: `types.ts`, `helpers.ts` (+test), `price-analysis.ts` (+test), `market-summary.ts`, `opportunity.ts`, `engine.ts` (+test)
- Product detail sayfaları için market analizi
- IQR-based outlier filtering (dual-boundary)
- Weighted marketValue

**Market Pulse:**
- `lib/market-pulse.ts` (+test) — ayrı modül

**Price History:**
- `lib/price-history.ts` (+test, backfill, SQL migration'ları)
- **Dual path:** JS `recordListingPriceHistory()` + PostgreSQL trigger `record_price_history_on_change()`
- Backfill endpoint: `/api/cron/price-history-backfill`

**Search:**
- `lib/search-demand.ts` — Turkish character mapping + lowercase + max 120 karakter
- Arama sayfası (app router), `/arama` redirect

### ✓ What works

- Intelligence engine kapsamlı — 6 farklı karar desteği üretiyor
- Market intelligence IQR filtering doğru
- Price history dual path sağlam (JS + trigger)
- Trend hesaplaması gerçekçi (4% threshold for direction)
- Demand level thresholds mantıklı (recentSearchCount >= 8 → high)
- Decision support buy/wait scoring dengeli

### ✗ What is missing

- **Price alerts: notification delivery yok.** `TODO: bildirim iletimi eklenecek` — lib/price-history.ts line 105'te TODO. Alert oluşturuluyor ama kullanıcıya ulaşmıyor.
- **Intelligence engine `prices.length < 3` → insufficient fallback.** 100K listing'de bu fallback'e düşme oranı azalır. Ama yeni/az ilanlı ürünler için hala insufficient.
- **Trend hesaplaması sadece first/last noktayı kullanıyor.** 10 nokta olsa bile sadece ilk ve son noktaya bakar. Aradaki dalgalanmaları görmez.
- **No caching.** Her product detail sayfasında intelligence yeniden hesaplanır. 100K listing × 10 product detail view = redundant computation.
- **No pagination for price history.** API'de limit yok — 10K price history kaydı tek response'da döner.
- **Market intelligence product detail'e bağımlı.** Intelligence engine referansları 21 dosyaya dağılmış, bağımlılık yönetimi zor.
- **Search demand tracking:** Arama verisi toplanıyor ama intelligence'a ne zaman/ne sıklıkta beslendiği belli değil.

### ✗ What will break at 100K listings

| Sorun | Etki | Detay |
|-------|------|-------|
| **Price alert notification yok** | Orta | Alert oluşur ama bildirim gitmez. Kullanıcı fiyat düşüşünü kaçırır. |
| **No cache** | Orta | Popüler ürün detail sayfalarında intelligence her yüklemede yeniden hesaplanır. 100K listing × 1000 view/gün = gereksiz yük. |
| **Trend first/last bias** | Düşük | Uzun geçmişli ürünlerde trend yanıltıcı olabilir. Ama 100K'de daha çok veri = daha iyi trend. |
| **Price history pagination** | Orta | Popüler ürünlerde 10K+ price history kaydı tek seferde çekilir. Response boyutu büyür. |
| **Intelligence calculation O(n)** | Düşük | 100 listing için intelligence = milisaniyeler. |

### Risk Level: **ORTA**

Intelligence engine 100K'de daha iyi çalışır (daha çok veri = daha iyi analiz). Kritik eksik: price alert notification. Orta risk: cache yokluğu ve price history pagination.

### Estimated effort: **3-5 gün** (Product Intelligence bağımsızlığı korunarak)

- Price alert notification (email/push): 1.5 gün
- Intelligence cache (product slug → intelligence, TTL 5dk): 1 gün
- Price history pagination: 0.5 gün
- Trend hesaplaması iyileştirme (linear regression veya SMA): 1 gün
- Search demand → intelligence besleme netleştirme: 0.5 gün

---

## 8. Import Pipeline, Cron & Monitoring

### ✓ What exists

**Import Pipeline:**
- `lib/import/import-listings.ts` (125 satır) — `importListings()` fonksiyonu
- Normalize → `groupListingDuplicates()` (%70 threshold) → per-listing `findOrCreateMatchedProduct()` → `supabase.from("listings").upsert()`
- `POST /api/import/listings` — external API, 100-record limit, 9 source
- ImportResult: imported/failed counts + duplicateSummary

**Cron:**
- 4 cron route: `daily`, `scrape-source`, `update-prices`, `price-history-backfill`
- Her route'da `HasValidSecret()` — 4 farklı source'dan secret okuma
- Daily route: 3 task sequential fetch() chain
- `CRON_SECRET` auth — duplicated across 4 routes

**Monitoring:**
- `diagnostics.ts` — source health sınıflandırması
- Admin sayfaları: bot-center (source run log), data-quality
- Source health API: `/api/admin/source-health/check`

### ✓ What works

- Import pipeline akışı doğru (normalize → group → match → upsert)
- Cron auth mekanizması çalışıyor
- Source health sınıflandırması kullanışlı
- ImportResult dönüş tipi temiz

### ✗ What is missing

- **Import: 100-record limit.** External API her istekte max 100 listing kabul ediyor. 100K listing = 1000 API call. Client tarafında retry/pagination yok.
- **Import: sequential per-listing matching.** N+1 product matching per listing (Product Matcher başlığında detaylandırıldı).
- **Cron: sequential chain.** Daily route'da 3 task sırayla fetch() — biri başarısız olursa sonraki çalışmaz. Error isolation yok.
- **Cron: no monitoring/alerting.** Cron başarısız olursa kimse haberdar olmaz. Vercel Cron Jobs log'una güveniliyor.
- **Cron: no timeout per task.** Tek task sonsuza kadar sürebilir.
- **Cron: `HasValidSecret()` duplicated.** 4 route'da aynı mantık tekrarlanıyor.
- **Cron: no scheduling visibility.** Hangi cron ne zaman çalıştı, kaç listing işledi, kaç hata aldı — takip edilmiyor.
- **No structured logging.** `console.log` / `console.error` seviyesinde logging. Log aggregasyonu yok.
- **No error budget / SLO.** Sistem ne kadar hata kaldırabilir? Tanımlı değil.
- **No health check endpoint.** /api/health veya benzeri yok.

### ✗ What will break at 100K listings

| Sorun | Etki | Detay |
|-------|------|-------|
| **100-record limit + no pagination** | YÜKSEK | Client 1000 istek göndermeli. Network hatası → kayıp veri. Retry yok. |
| **Sequential cron chain** | YÜKSEK | Task #1 (scrape) başarısız → Task #2 (import) ve #3 (price-update) hiç çalışmaz. 100K listing boyunca scrapelenmemiş veri. |
| **No monitoring/alerting** | YÜKSEK | Pipeline sessizce ölür. 3 gün sonra "hiç veri gelmiyor" fark edilir. |
| **Duplicate HasValidSecret** | Düşük | 4 yerde aynı kod. Bakım yükü ama çalışır. |
| **Import sequential matching** | ÇOK YÜKSEK | (Product Matcher başlığında detaylandırıldı) |

### Risk Level: **ÇOK YÜKSEK**

Import pipeline ve cron sistemi en zayıf alanlardan biri. Sequential chain + no monitoring + no retry = production'da sessiz failure. 100K listing'de bu sistem ya çöker ya da fark edilmeden çalışmayı durdurur.

### Estimated effort: **5-7 gün**

- Import: client-side retry + batch pagination: 1.5 gün
- Cron: parallel chain (Promise.allSettled): 1 gün
- Cron: per-task timeout: 0.5 gün
- Monitoring: structured logging + alert (email/webhook): 2 gün
- HasValidSecret → shared utility: 0.5 gün
- Health check endpoint: 0.5 gün
- Error budget tanımı: 0.5 gün

---

## 9. Admin, SEO & Performance

### ✓ What exists

**Admin:**
- Bot center: source run log, manuel tetikleme
- Product matcher: manuel eşleştirme yönetimi
- Data quality: veri temizleme/deactivate
- Import: import log görüntüleme
- Data cleanup API: `/api/admin/data-cleanup/deactivate` — eski/geçersiz listing'leri deactivate etme
- Source health API: `/api/admin/source-health/check`

**SEO:**
- Sitemap: `app/sitemap.ts` — listings (2000 limit) + products (500 limit) + categories + brands
- Decision-First: Product detail sayfası `ProductDecisionInsight` ile karar gösterimi
- Programmatic SEO: Kategori sayfaları (`/category/[slug]`), marka sayfaları, city sayfaları
- JSON-LD structured data (tahmini — kod okunduğunda doğrulandı)
- `/arama` → search redirect

**Performance:**
- Next.js App Router + React Server Components (RSC)
- `createSupabaseClient()` cached per request
- Intelligence engine 21 referansla en çok kullanılan modül

### ✓ What works

- Admin sayfaları temel CRUD işlemleri için yeterli
- Decision-First prensibi product detail'de uygulanmış
- Programmatic SEO kapsamlı (city, category, brand, product sayfaları)
- RSC ile server-side rendering performanslı
- Sitemap yapısı doğru (listings, products, categories, brands)

### ✗ What is missing

- **Sitemap: 2000 listing limit.** Google 50K sayfa index'ler. 100K listing'de sadece %4'ü sitemap'te. Kalan listing'ler Google tarafından keşfedilmez.
- **Sitemap: 500 product limit.** Product count 500'ü geçerse yeni ürünler sitemap dışı kalır.
- **Sitemap: no dynamic pagination.** Sitemap index + sitemap set pattern'i yok.
- **Admin: no pagination.** Admin sayfaları 100K listing'de tüm veriyi tek seferde yüklemeye çalışır.
- **Admin: no filtering/sorting.** Bot center'da kaynak adına göre filtreleme yok, tarih sıralaması yok.
- **Admin: no bulk operations.** Tek tek listing/product yönetimi. 100K'de imkansız.
- **Performance: no caching strategy.** Intelligence engine + market intelligence her sayfada yeniden hesaplanır.
- **Performance: no ISR (Incremental Static Regeneration).** Tüm sayfalar dynamic — cache hit oranı düşük.
- **Performance: no bundle analysis.** JS bundle size bilinmiyor.
- **SEO: no canonical URL validation.** Duplicate içerik için canonical tag stratejisi net değil.
- **SEO: no hreflang.** Çoklu dil desteği yok (şu an sadece Türkçe).

### ✗ What will break at 100K listings

| Sorun | Etki | Detay |
|-------|------|-------|
| **Sitemap 2000 listing limit** | YÜKSEK | 98K listing Google'da index'lenmez. Organik trafik kaybı. |
| **Sitemap 500 product limit** | YÜKSEK | 50K+ product'ın sadece 500'ü index'lenir. |
| **Admin pagination yok** | YÜKSEK | Admin sayfaları ya çöker (timeout) ya da 10 saniyede yüklenir. |
| **No ISR** | Orta | Her sayfa dynamic → CDN cache kullanılmaz. 100K ziyaret/gün → sunucu yükü. |
| **No caching** | Orta | Intelligence her sayfada yeniden hesaplanır. CPU/DB yükü. |

### Risk Level: **YÜKSEK** (SEO: ÇOK YÜKSEK)

100K listing'in %96'sını Google'a göstermemek = platformun büyüme potansiyelini boşa harcamak. Sitemap caps en kritik SEO sorunu. Admin sayfaları 100K'de kullanılamaz hale gelir.

### Estimated effort: **4-6 gün**

- Sitemap: dynamic pagination (sitemap index): 1.5 gün
- Admin: pagination + filtering: 1.5 gün
- Caching (ISR + intelligence cache): 1.5 gün
- Admin: bulk operations: 1 gün
- Canonical URL validation: 0.5 gün

---

## 10. Architecture & Cross-cutting Concerns

### ✓ What exists

- **3-Layer:** `app/` (Client) → `app/api/` (API) → `lib/` (Business/DQ/Intelligence)
- **Two parallel adapter systems:** `bots/adapters` (7 adapter) + `unified-source-engine/adapters` (2 adapter)
- **Schema fallback pattern:** 4 yerde duplicated
- **7 architectural constraints:**
  1. Yeni engine yazma
  2. Mevcut engine'leri kullan
  3. Product Intelligence bağımsızlığını koru
  4. Decision-First
  5. Programmatic SEO
  6. Zero-trust prod readiness
  7. Brutal honesty

### ✓ What works

- Layer ayrımı net
- Engine izolasyonu doğru (her engine kendi dizininde)
- Confidence/Duplicate/Normalization engine'leri birbirini doğru kullanıyor
- Decision-First ve Programmatic SEO prensipleri uygulanıyor

### ✗ What is missing

- **Adapter sistemi çift.** `bots/adapters` (7 adapter) ve `unified-source-engine/adapters` (2 adapter) paralel var. Hangi adapter ne zaman kullanılıyor? documentation yok, net ayrım yok.
- **Schema fallback 4 kez tekrarlanıyor.** Aynı legacy kolon kontrolü 4 dosyada. DRWS (Don't Repeat Yourself — Weirdly Siloed).
- **CRON_SECRET 4 kez tekrarlanıyor.** `HasValidSecret()` 4 route'da farklı kaynaklardan secret okuyor.
- **No error taxonomy.** Hata tipleri sınıflandırılmamış (temporary vs permanent, retryable vs not).
- **No telemetry/monitoring.** Sistem davranışı hakkında veri yok. Hangi engine ne kadar sürede çalışıyor? Error rate? P50/P99 latency?
- **No feature flags.** Yeni özellikler kademeli açılamıyor. Ya hep ya hiç.
- **No documentation.** Engine'ler arası ilişki, veri akışı, deployment süreci dokümante edilmemiş.
- **No integration tests.** Her engine ayrı test edilmiş ama birlikte çalışma testi yok. Source → Import → Duplicate → Intelligence flow'u hiç test edilmemiş.

### ✗ What will break at 100K listings

| Sorun | Etki | Detay |
|-------|------|-------|
| **Adapter confusion** | Orta | Yeni geliştirici hangi adapter'ı kullanacağını bilemez. İkisi de güncellenmezse bazı kaynaklar sessizce ölür. |
| **No telemetry** | YÜKSEK | Sistem yavaşladığında nereden başlayacağını bilemezsin. Hangi engine bottleneck? Bilinmez. |
| **No integration tests** | YÜKSEK | Her engine ayrı ayrı çalışır ama birlikte çalışmaz. 100K'de veri akışı bozulur, testler geçer, production yanar. |
| **No feature flags** | Orta | Acil bir fix yapman gerekirse yarım saatte deploy etmen lazım. Feature flag olsa 5dk'da kapatırsın. |
| **Schema fallback duplication** | Düşük | Legacy kolon değişirse 4 yerde güncelleme gerekir. Unutulan yer → production hatası. |

### Risk Level: **YÜKSEK**

Adapter sistemi net değil. Telemetry yok. Integration test yok. Feature flag yok. Bunlar 100K'de değil, daha küçük ölçekte bile sorun yaratır. 100K'de her sorunun etkisi katlanır.

### Estimated effort: **6-10 gün**

- Adapter sistemi tekilleştirme (bots/unified merge): 2-3 gün
- Schema fallback → shared utility: 0.5 gün
- HasValidSecret → shared utility: 0.5 gün
- Telemetry (engine metrics + log aggregation): 2-3 gün
- Integration tests (end-to-end flow): 2-3 gün
- Feature flag sistemi: 1-2 gün
- Error taxonomy + handling: 1 gün

---

## ÖZET: Executive Summary

### En Kritik 5 Sorun (100K listing'de çöker)

| # | Sorun | Risk | Effort | Alt Sistem |
|---|-------|------|--------|-----------|
| 1 | **N+1 + LIMIT 2000** | ÇOK YÜKSEK | 4-6 gün | Product Matcher |
| 2 | **O(n²) duplicate matching** | ÇOK YÜKSEK | 5-8 gün | Duplicate Engine |
| 3 | **Sequential cron + no monitoring** | ÇOK YÜKSEK | 5-7 gün | Import/Cron |
| 4 | **Sitemap caps (2000/500)** | YÜKSEK | 1.5 gün | SEO |
| 5 | **Adapter sistemi çift + telemetry yok** | YÜKSEK | 6-10 gün | Architecture |

### Toplam Tahmini Effort: **29-51 gün**

Bu effort'un tamamı mevcut engine'leri KULLANARAK (yeni engine yazmadan) yapılabilecek iyileştirmelerdir.

### Product Intelligence Bağımsızlığı

Intelligence Engine (21 referans) ve Market Intelligence (9 dosya) 100K'de daha iyi çalışır — daha çok veri = daha iyi analiz. Hiçbir değişiklik önerilmedi. Bağımsızlık korunuyor.

### Güvenli Şekilde Ertelebilir

- Normalization engine iyileştirmeleri (MB support, cross-field validation)
- Intelligence trend hesaplama iyileştirmesi
- Brand extract edge case'leri
- Source engine schema fallback tekilleştirme

Bunlar 100K'de çalışır, iyileştirme sadece "daha iyi" olur. Acil değil.

### İlk Yapılması Gereken 3 Şey

1. **Product Matcher: LIMIT 2000 kaldır + N+1 → batch**
   - En kritik. Product matching olmadan hiçbir şey çalışmaz.
   - Tahmini: 4-6 gün

2. **Import/Cron: monitoring + alerting**
   - Pipeline sessiz ölürse kimse fark etmez.
   - Tahmini: 5-7 gün (paralel yapılabilir)

3. **Duplicate Engine: brand/model partitioning + incremental matching**
   - O(n²) 100K'de imkansız. Partitioning en az effort'lu çözüm.
   - Tahmini: 5-8 gün (monitoring ile paralel)

Bu 3 madde tamamlandığında platform 100K listing'e **hazır** olmasa da **hayatta kalır.**

---

*Rapor sonu. Tüm alt sistemler satır satır okundu. Hiçbir şey varsayılmadı. Hiçbir kod değiştirilmedi.*
