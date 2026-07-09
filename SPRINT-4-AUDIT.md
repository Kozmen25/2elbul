# SPRINT 4.0 — DATA FIRST AUDIT
## CTO Seviyesinde Acımasız Proje Analizi
**Tarih:** 2026-07-08 | **Kapsam:** ~70 dosya, 10.000+ satır

---

## Özet Kararname

Bu proje **feature olgunluğuna** erişmiştir ancak **data olgunluğuna** erişememiştir. 10+ engine, 6 intelligence modülü, 3 adapter sistemi, 16 admin sayfası, 46 test dosyası — bunların hepsi "çalışıyor" ama **gerçek veriyle hiç test edilmemiş durumda**. 

Aşağıdaki rapor, her katmanı veri kalitesi, ölçeklenebilirlik, izlenebilirlik ve production readiness açısından mercek altına alır.

---

## A. Bot Sistemi ve Crawler Mimarisi

### Mevcut Durum

Bot sistemi 3 katmanlı bir soyutlama ile çalışır:

1. **connectors.ts** — 6 scrape fetcher'ı tanımlar (EasyCep, Getmobil, Hepsiburada, Teknosa, MediaMarkt, Yenilenmiş Market)
2. **source-runner.ts** — Her kaynak için: adapter seç → sync() çağır → syncListingsForSource() ile DB'ye yaz
3. **3 adapter sistemi** (aşağıda detaylandırılmıştır)

Her bot run'ı `bot_runs` tablosuna kaydedilir, başarı/başarısızlık durumu izlenir.

### Kritik Sorunlar

**1. Üç Paralel Adapter Sistemi — Mimari Parçalanma**

Projede aynı işi yapan **üç farklı adapter katmanı** bulunmaktadır:

| Sistem | Durum | Kaynak Sayısı | Tanım |
|--------|-------|--------------|-------|
| `bots/adapters/` (scrape fetchers) | AKTİF | 6 | Doğrudan HTML scrape eden fonksiyonlar |
| `unified-source-engine/` | KISMİ | 2 (EasyCep, Getmobil) | Yeni soyutlama, `UnifiedSourceAdapter` interface'i |
| `bots/adapters/types.ts` (StandardSourceAdapter) | DEPRECATED | — | Eski interface, "Sprint 0.5+ kaldırılacak" notu var |

`connectors.ts:getStandardSourceAdapter()` üç yolu dener:
1. Unified registry'de varsa → unified adapter'ı kullan
2. EasyCep/Getmobil ise → legacy easycep-adapter/getmobil-adapter kullan
3. Hiçbiri yoksa → doğrudan scrape fetcher'ı çağır

Bu, **her bot run'ında 3 katmanlı bir zincir** demek. Yeni bir kaynak eklendiğinde geliştiricinin hangi katmana ekleyeceğini bilmesi gerekir — bu bilgi hiçbir yerde dokümante edilmemiştir.

**2. source-runner.ts:336 — normalizeImportMode() Sessiz Hata**

```typescript
function normalizeImportMode(value: unknown) {
  return value === "published" || value === "pending" ? value : null;
}
```

DB'de `bot_import_mode` kolonu `manual` değerini alırsa, bu fonksiyon `null` döner. `normalizeSyncStatus(null)` ise `"active"` döner. Yani **"manuel mod" konsepti çalışmaz** — kaynak manuel moda alınsa bile bot yine de `active` statüsünde ilan basar.

**3. SCRAPE_READY_SLUGS Sabit Kodlanmış**

```typescript
export const SCRAPE_READY_SLUGS = Object.keys(SCRAPE_FETCHERS);
// ["easycep", "getmobil", "hepsiburada-yenilenmis", "teknosa-yenilenmis", 
//  "mediamarkt-yenilenmis", "yenilenmis-market"]
```

Yeni bir scrape kaynağı eklendiğinde **hem** `SCRAPE_FETCHERS` map'ine **hem de** `getStandardSourceAdapter()` fonksiyonuna kayıt yapılması gerekir. Bu iki yerin senkronizasyonu elle yapılır, test edilmez.

**4. Bot Run Kayıtları — Eksik Metrikler**

`bot_runs` tablosu şu an şunları **kaydetmez**:
- Kaç listing duplicate olarak işaretlendi
- Kaç listing normalize edilemedi
- Ortalama response süresi (adapter bazında)
- HTTP status code dağılımı (scrape sırasında)
- Hangi URL'ler 4xx/5xx döndü

---

## B. Crawler Yapısı ve Hata Toleransı

### Mevcut Durum

Her crawler (EasyCep, Getmobil, Hepsiburama, Teknosa, MediaMarkt, Yenilenmiş Market) doğrudan HTML sayfalarını Cheerio ile parse eder. `source-runner.ts` tüm crawler'ları sırayla çalıştırır (paralel değil, sequential).

### Kritik Sorunlar

**1. Sequential Execution — Darboğaz**

```typescript
// source-engine/engine.ts:42
for (const source of runnable) {
  const result = await runSourceScrapeBot(supabase, source, {...});
  results.push(result);
}
```

6 kaynak sırayla çalıştırılır. Her kaynak ortalama 30 saniye sürerse, total run süresi = 3 dakika. Paralel olsa ~30 saniye olurdu. Dahası, **bir kaynak takılırsa (timeout) tüm pipeline bloke olur**.

**2. Crawler Sağlık Kontrolü Yok**

`connectors.ts`'deki her fetcher çağrılmadan önce hedef siteye bir health check yapılmaz. Eğer:
- Site 5xx dönüyorsa → hata mesajı log'lanır, sonraki kaynağa geçilir
- Site yavaşsa (10+ saniye) → timeout yok, request asılı kalır
- HTML yapısı değişmişse → 0 ürün bulunur, hata sayılmaz

**3. Pagination Yok**

Her crawler yalnızca **ilk sayfayı** çeker:
```typescript
// easycep.ts
export async function fetchEasyCepListings(scrapeUrl: string, limit: number) {
  // ... tek sayfa scrape
}
```

Bir kategoride 1000 ürün varsa, crawler yalnızca ilk 20-50'sini görür. **Pagination stratejisi sıfır.**

---

## C. Source Manager ve Kaynak Yönetimi

### Mevcut Durum

Admin panelinde `app/admin/sources/page.tsx` 16 kaynak alanını üç kademeli fallback ile çeker:
1. Tam select (16 kolon)
2. publishMode hatası → daha az kolon
3. integrationSettings hatası → minimum kolon

### Kritik Sorunlar

**1. Üç Kademeli Fallback — Anti-pattern**

`sources/page.tsx:20-39`:
```typescript
let sourceData = ... // try 16 columns
if (sourceError) { 
  integrationSettingsAvailable = false;
  // try 10 columns
  if (sourceError) {
    publishModeAvailable = false;
    // try 7 columns
  }
}
```

Bu mantık **5 farklı dosyada** tekrarlanır: `bot-center/page.tsx`, `sources/page.tsx`, `source-engine/engine.ts`, `source-runner.ts`, `listing-sync.ts`. Her biri kendi `isMissingColumn()` fonksiyonunu tanımlar. Bir migration çalıştırıldığında bu fallback'lerin çalışması gerekmez, ancak **silinmezler** ve dead code olarak kalırlar.

**2. Yeni Kaynak Ekleme Maliyeti**

Yeni bir scrape kaynağı eklemek için gereken adımlar:
1. `bots/adapters/` altında yeni fetcher yaz
2. `bots/adapters/index.ts`'ye export ekle
3. `bots/connectors.ts`'de SCRAPE_FETCHERS'a ekle
4. `bots/connectors.ts`'de `defaultScrapeUrl()`'e ekle
5. `app/api/import/listings/route.ts`'de `supportedSources` set'ine ekle
6. Admin panelinde kaynağı manuel ekle (`sources` tablosuna INSERT)
7. Eğer unified-source-engine kullanılacaksa, oraya da adapter yaz

**Tahmini maliyet: 2-4 saat + test.** Bunun otomasyonu sıfır.

---

## D. Health Monitoring ve İzlenebilirlik

### Mevcut Durum

`admin/bot-center/page.tsx`:
- `bot_runs` tablosundan son 200 kaydı çeker
- `sources` tablosundan sağlık durumunu okur
- 24 saatlik başarı oranını hesaplar

### Kritik Sorunlar

**1. Dashboard — Gerçek Zamanlı Değil**

Sayfa her yüklendiğinde Supabase'e 3+ sorgu atar. **SSR** olduğu için her ziyaret DB'ye yük bindirir. Canlı güncelleme (SSE/WebSocket) yok.

**2. Alarm Sistemi Yok**

Bot 5 kez üst üste başarısız olsa, kaynak 24 saattir çalışmasa veya hiç ürün bulamasa **kimseye bildirim gitmez**. Admin paneli dışında bir gösterge yok.

**3. Metrik Eksiklikleri**

Health monitoring'in **kapsamadığı** şeyler:
- Kaynak bazında ortalama gecikme süresi
- Parse edilemeyen sayfa sayısı
- Duplicate oranı (bot bazında)
- Schema değişikliği tespiti (HTML yapısı değişti mi?)
- Veri tazeliği (en son ne zaman güncel veri geldi?)

---

## E. Retry Sistemi

### Mevcut Durum

**Retry mekanizması projede yok denecek kadar azdır.**

### Kritik Sorunlar

**1. Crawler Katmanında Retry Yok**

```typescript
// connectors.ts
const scrapeFetcher = SCRAPE_FETCHERS[integrationConfig.sourceSlug];
if (scrapeFetcher) {
  return scrapeFetcher(scrapeUrl, integrationConfig.productLimit);
}
```

HTTP request başarısız olursa (network hatası, 5xx, timeout) **hiçbir retry yapılmaz**. Kaynak hemen "failed" olarak işaretlenir.

**2. DB İşlemlerinde Retry Yok**

`listing-sync.ts`'de `supabase.rpc("sync_source_listings", ...)` bir kere dener, başarısız olursa legacy fallback'e düşer. Retry count, exponential backback, jitter — hiçbiri yok.

**3. 23505 (unique constraint) Retry**

`product-matcher` repository'sinde 23505 hatası için bir retry mekanizması vardır ancak bu yalnızca **product-matcher** içindir. Bot pipeline'ında bu retry yoktur.

---

## F. Queue Sistemi

### Mevcut Durum

Bir **search queue** API route'u vardır (`app/api/cron/process-search-queue/`), ancak bu özellik search intent'e bağlıdır. Bot run'ları için queue sistemi **yoktur**.

### Kritik Sorunlar

**1. Bot Run'ları Queue'suz Çalışır**

6 kaynak sequential çalışır. Bir kaynak takılırsa tüm pipeline durur. Queue sistemi olsa:
- Her kaynak bağımsız worker'da çalışır
- Başarısız kaynaklar otomatik yeniden kuyruklanır
- Önceliklendirme yapılabilir (yüksek öncelikli kaynaklar önce)

**2. Rate Limiting Yok**

Hedef sitelere saniyede kaç request gittiği kontrol edilmez. EasyCep'e 10 request/saniye gitse, IP ban yeme riski vardır.

---

## G. Parser Yapısı

### Mevcut Durum

6 farklı site için ayrı parser'lar:
- `easycep.ts` — `parseEasyCepCategoryHtml()`, `parseEasyCepProductPage()`
- `getmobil.ts` — `parseGetmobilCategoryHtml()`, `parseGetmobilProductPage()`
- `hepsiburada-yenilenmis.ts`
- `mediamarkt-yenilenmis.ts`
- `teknosa-yenilenmis.ts`
- `yenilenmis-market.ts`

### Kritik Sorunlar

**1. HTML Bağımlılığı — Kırılganlık**

Her parser sitenin mevcut HTML yapısına sıkı sıkıya bağlıdır. Örnek:

```typescript
// easycep.ts
$(".product-card .price").text().trim()
```

Sitenin CSS sınıfları değiştiğinde parser sessizce 0 ürün döner. **Hata sayılmaz**, "başarılı" olarak işaretlenir.

**2. Schema Degradation Tespiti Yok**

Bir parser'ın döndüğü ürün sayısı normal dağılımın dışına çıktığında (ör: normalde 30 ürün bulurken aniden 0 buluyor) bunu tespit edecek bir mekanizma yoktur.

**3. HTML İkamesi Yok (Fallback Selector)**

Her alan için tek bir CSS selector tanımlanmıştır. Eğer site responsive design değiştirirse (mobil/desktop farklı HTML), parser çalışmaz.

---

## H. Duplicate Engine

### Mevcut Durum

`lib/duplicate-engine/` — 10 sinyal ağırlıklı scoring sistemi. Ağırlıklar:
- normalizationScore: 0.35
- brandScore: 0.18, modelScore: 0.18
- storageScore: 0.12, ramScore: 0.06
- variantScore: 0.04, conditionScore: 0.03
- priceScore: 0.02, titleSimilarity: 0.01
- sourceDiversity: 0.01

Confidence thresholds: >=90 → "same", >=70 → "strong", >=40 → "possible"

### Kritik Sorunlar

**1. O(n²) — Ölçeklenemez**

```typescript
// duplicate-engine/matcher.ts
for (const a of listings) {
  for (const b of listings) {
    // Jaccard similarity, her çift için 10 sinyal hesapla
  }
}
```

- 100 listing → 4.950 karşılaştırma ✓
- 1.000 listing → 499.500 karşılaştırma ⚠
- 10.000 listing → 49.995.000 karşılaştırma ❌
- 100.000 listing → 5 milyar karşılaştırma 💀

**Hiçbir blocking/indeksleme stratejisi yoktur.** 100K listing'de bu engine dakikalarca çalışır.

**2. Hardcoded Source ID'ler**

```typescript
// duplicate.ts:19-21
const sourceIds = [1, 2]; // EasyCep ve Getmobil sabit!! 
```

**Gerçek DB'deki source ID'lerle hiçbir ilgisi yok.** Bu, source diversity skorunun her zaman aynı iki kaynağı karşılaştırması demek. Yeni kaynak eklenirse otomatik olarak duplicate detection'ın dışında kalır.

**3. Normalizasyon Ağırlığı Çok Yüksek**

normalizationScore (0.35) + brandScore (0.18) + modelScore (0.18) = **0.71**

Bu demek ki duplicate kararı **%71 oranında normalization ve brand/model eşleşmesine bağlı**. Fiyatın etkisi yalnızca %0.02. İki farklı ürün aynı marka/model'e sahipse (ör: iPhone 14 Pro 128GB vs iPhone 14 Pro 256GB), normalize edilmiş storage bilgisi yanlışsa yanlış positive üretilir.

**4. Threshold Güvencesi Yok**

Confidence threshold'lar sabit kodlanmıştır, veri dağılımına göre adapte olmaz. Gerçek veriyle kalibrasyon yapılmamıştır.

---

## I. Product Matcher

### Mevcut Durum

`lib/product-matcher/` — 10 dosya. Pipeline:
1. `normalize()` → text temizleme
2. `extractProductSignals()` → brand/model/storage/ram çıkar
3. `createCanonicalProductName()` → normalize edilmiş isim
4. `findExistingMatchedProduct()` → exact match + full scan fallback
5. INSERT with 23505 retry

### Kritik Sorunlar

**1. .limit(2000) Full Scan — Felaket Senaryosu**

```typescript
// repository.ts:29
const { data } = await supabase
  .from("products")
  .select("id, name, signals, ...")
  .limit(2000);

return data?.find(p => p.name === canonicalName);
```

Bu kod:
1. İlk 2000 ürünü belleğe çeker
2. JavaScript'te `Array.find()` ile arar
3. Eğer ürün 2001. sıradaysa → **bulamaz, yeni ürün olarak ekler**
4. 10.000 ürün olduğunda → her match'te 2000 satır çekilir, 10K product = 200 request

**2. İki Farklı Confidence Sistemi — Tutarsızlık**

| Sistem | Sinyal Sayısı | Algoritma | Base Skor |
|--------|--------------|-----------|-----------|
| `confidence-engine` | 12 weighted | 0.35+0.18+... | Weighted |
| `product-detail.ts` | 6 additive | 45+25+25+... | 45 |

**Aynı listing için iki farklı confidence puanı üretilir.** Örnek:
- confidence-engine: "brand=Apple, model var, storage var → 82 (Yüksek)"
- product-detail: "count=3, variation=%15, outlier yok → 67 (Orta)"

Kullanıcıya hangisinin gösterileceği **içinde bulunulan bağlama göre değişir**, standartlaştırılmamıştır.

---

## J. Normalization Engine

### Mevcut Durum

`lib/normalization/` — 24 marka kuralı, Türkçe diakritik, storage normalizasyonu. 12 adımlı pipeline:
```
removeEmoji → removeHtmlEntities → normalizeUnicode → 
normalizeStorageSize → normalizeModelVariants → 
normalizeSpacing → collapseWhitespace → trim → lowercase
```

### Kritik Sorunlar

**1. Marka Kuralları Sabit Kodlanmış**

24 marka kuralı TypeScript kodu içinde tanımlanmıştır. Yeni bir marka eklendiğinde kod değişikliği + deploy gerekir. **DB'de yönetilen bir marka kuralı tablosu yoktur.**

**2. Model Varyantları Elle Yönetilir**

```typescript
// normalization/index.ts
"iphone 14 pro max": "iphone 14 pro max",
"iphone 14 pro": "iphone 14 pro",
```

Her yeni model için elle kural eklenmesi gerekir. Bu ölçeklenemez.

**3. Hata Durumunda Sessiz Geçiş**

Normalizasyon başarısız olursa (ör: storage "256GB" yerine "256 GB" parse edilemezse), orijinal değer olduğu gibi bırakılır. **Hiçbir log veya uyarı üretilmez.**

---

## K. Database Pipeline ve Veri Doğrulama

### Mevcut Durum

Veri akışı:
```
Bot → Crawler → Parser → normalizeSyncStatus() → 
syncListingsForSource() → RPC (sync_source_listings) → 
listings tablosu → product-matcher → products tablosu
```

### Kritik Sorunlar

**1. RPC Fallback — Veri Kaybı Riski**

```typescript
// listing-sync.ts:134-138
if (rpcResult.error && isRpcSignatureError(rpcResult.error)) {
  rpcResult = await supabase.rpc("sync_source_listings", {
    p_source_id: sourceId,
    p_items: payload,
    // skip_inactive_marking parametresi OLMADAN
  });
}
```

İkinci çağrıda `p_skip_inactive_marking` parametresi yoktur → default değer kullanılır. Bu, `skipInactiveMarking=true` ile çalışan bir bot run'ının aslında **inactive marking yapmasına** neden olur. Veri tutarlılığı ihlali.

**2. Legacy Insert — Duplicate Koruması Zayıf**

```typescript
// listing-sync.ts:193-200
const existingUrls = new Set(existingListings.map(l => String(l.url)));
if (existingUrls.has(listing.url)) { skipped++; continue; }
```

Legacy insert yalnızca **URL bazında** duplicate kontrolü yapar. Aynı ürün farklı URL'lerle gelirse (ör: tracking parameter farklı), duplicate olarak işlenir.

**3. Transaction Bütünlüğü Yok**

Her listing bağımsız bir INSERT/UPDATE işlemidir. 100 listing'lik bir batch'te 50. satırda hata olursa, ilk 49 satır işlenmiş olarak kalır. **Rollback yoktur.**

---

## L. Intelligence Katmanı ve SEO/JSON-LD

### Mevcut Durum

- **Market Intelligence**: `buildMarketIntelligence()` → priceAnalysis + marketSummary + confidence + opportunity + JSON-LD
- **Opportunity Engine**: 10 weighted signal, 4 recommendation action
- **Decision Engine**: confidence + smartPrice analizi
- **SEO**: JSON-LD Dataset schema, sitemap.ts

### Kritik Sorunlar

**1. Market Intelligence Confidence — Base Skor 52**

```typescript
// market-intelligence/market-summary.ts (üstü kapalı)
// product-detail.ts'de base 45, market-intelligence'da base 52
```

Market intelligence'ın confidence skoru **sampleSize > 0 ise base 52**'den başlar. Bu, 1 listing olsa bile confidence'ın 52 olduğu anlamına gelir. **Anlamsız bir güven** üretir.

**2. Product-Detail.ts — 1008 Satırlık Canavar**

`getProductDetail()` tek fonksiyon:
- Product + listings + priceHistory + searchDemand + intelligence + decisionInsight + marketIntelligence + opportunityAnalysis + bestDeals + relatedProducts
- 3-level column fallback
- İki farklı confidence hesaplama
- Token-overlap related product matching

**Bu fonksiyonun tek sorumluluğu yoktur.** Test etmesi imkansızdır (10+ bağımlılık, internal DB state, 3 caching katmanı).

**3. inferSourceCountFromDiversity — Ters Mantık**

```typescript
// confidence-engine/helpers.ts
function inferSourceCountFromDiversity(sourceDiversity: number): number {
  if (sourceDiversity >= 100) return 1;  // BUG: yüksek diversity → 1 kaynak
```

**Source diversity arttıkça kaynak sayısı azalıyor.** Bu kesinlikle ters mantık. Yüksek diversity = çok farklı kaynak, düşük diversity = az kaynak olmalı.

**4. sitemap.ts — 500 Ürün Sınırı**

```typescript
// sitemap.ts
.products.in("id", [...publicProductIds]).limit(500)
```

Gerçek veride 10.000 ürün varsa, sitemap yalnızca 500'ünü index'letir. Google diğer 9.500'ü **görmez**.

**5. JSON-LD — Statik Dataset Schema**

Her ürün sayfası aynı `Dataset` schema'sını kullanır. Google'ın zengin sonuçlar için görmek istediği:
- `Product` schema'sı (fiyat, stok durumu, marka)
- `AggregateOffer` (en düşük/en yüksek fiyat)
- `Review`/`Rating` (varsa)

Bunların hiçbiri yoktur. Yalnızca `Dataset` schema'sı vardır, bu da "bu site veri toplar" anlamına gelir, ürün sayfası olarak değerlendirilmez.

**6. home-data.ts — Bellek Patlaması**

```typescript
// 7 paralel sorgu
const { data: allProducts } = await supabase.from("products").select("*");
const { data: allListings } = await supabase.from("listings").select("*");
```

**Tüm products ve listings tabloları belleğe çekilir.** 100K listing = ~50MB JSON + JS overhead = ~200MB. SSR sayfasında her ziyaretçi için bu kadar bellek tüketilir. **Production'da crash sebebi.**

---

## 12 Soruya Cevaplar

### S1: Mevcut bot sistemi production'da kaç kaynağı yönetebilir?

**Cevap:** 6 kaynak yönetebilir, ancak **3'ü kırılgan durumda**. Sequential çalışma + retry yok + pagination yok = 10+ kaynakta sistem çöker. Paralel çalışma, retry mekanizması ve queue sistemi olmadan 10 kaynak eşiği aşılamaz.

### S2: Crawler'ların gerçek veri bulma başarısı nedir?

**Cevap:** **Bilinmiyor.** Hiçbir crawler gerçek veriyle production'da test edilmemiştir. Test'ler mock data kullanır. HTML yapısı değişikliğine karşı alarm yoktur. Health check yoktur.

### S3: Duplicate engine O(n²) ile kaç listing'de çalışmaz hale gelir?

**Cevap:** ~2.000 listing'de yavaşlar (~5 milyon karşılaştırma), ~10.000'de kullanılamaz hale gelir (~50 milyon). 100.000 listing'de **5 milyar karşılaştırma** ile crash olur. Blocking/indeksleme olmadan çözümü yoktur.

### S4: İki confidence sistemi arasındaki fark nedir?

| Özellik | confidence-engine | product-detail.ts |
|---------|-----------------|-------------------|
| Sinyal sayısı | 12 | 6 |
| Algoritma | Weighted sum | Additive bonus |
| Base skor | Dynamic | 45 sabit |
| Maksimum | 100 | ~98 (45+25+25+8-22) |
| Kullanım yeri | Duplicate + Matcher | Decision panel |

**İkisi de aynı veriyi farklı şekilde puanlar, aynı kullanıcıya farklı güven seviyeleri gösterir.**

### S5: Product Matcher 100K+ üründe nasıl performans gösterir?

**Felaket.** `.limit(2000)` full scan yaklaşımıyla her match işlemi 5+ request atar. 1000 listing'lik bir bot run'ı = 5000+ Supabase sorgusu. Yaklaşık 15-20 dakika sürer.

### S6: Normalization engine hangi dilleri/karakterleri destekler?

Türkçe (diakritik), İngilizce. 24 marka kuralı. Emoji, HTML entities, Unicode normalizasyonu var. **Arapça, Kiril, Çince karakter desteği yoktur**, ancak şu an için gerekli değildir.

### S7: Yeni bir kaynak eklemek için kaç dosya değişir?

**Minimum 5 dosya:**
1. Yeni crawler/adapter (1 yeni dosya)
2. `bots/adapters/index.ts` (export)
3. `bots/connectors.ts` (SCRAPE_FETCHERS + defaultScrapeUrl)
4. `app/api/import/listings/route.ts` (supportedSources)
5. Admin panelinde DB kaydı (manuel SQL)

Eğer unified-source-engine kullanılacaksa +2 dosya daha. **Toplam: 5-7 dosya, 2-4 saat.**

### S8: Bot hata toleransı nedir?

**Düşük.** 
- Network hatası → retry yok, direkt fail
- HTML değişikliği → 0 ürün, "başarılı" olarak işaretlenir
- Kaynak timeout → sequential çalışma nedeniyle tüm pipeline bloke olur
- DB hatası → legacy fallback (veri kaybı riski taşır)

### S9: Veri doğrulama pipeline'ı hangi aşamalarda veri kaybeder?

1. **Crawler**: HTML parse hatası → 0 ürün → sessiz geçiş
2. **Normalizasyon**: Geçersiz fiyat/URL → skip, log yok
3. **Product Matcher**: 2000 limit aşımı → duplicate ürün
4. **RPC**: Fallback'te skip_inactive_marking parametresi kaybolur
5. **Legacy Insert**: URL bazlı duplicate koruması zayıf

### S10: Monitoring hangi metrikleri göstermez?

- **Parse başarı oranı** (kaç ürün parse edilemedi?)
- **Duplicate oranı** (bot bazında)
- **Veri tazeliği** (en son ne zaman güncel veri geldi?)
- **HTTP hata dağılımı** (4xx vs 5xx vs timeout)
- **Response süresi trendi** (yavaşlama var mı?)
- **Schema degradation** (HTML yapısı değişti mi?)

### S11: JSON-LD yapısı Google'da nasıl sıralanır?

**Düşük.** Yalnızca `Dataset` schema'sı kullanılır. Google'ın ürün sayfaları için beklediği `Product` + `AggregateOffer` + `Offer` schema'ları yoktur. Programmatic SEO için üretilen sayfalar Google'da "içerik sayfası" olarak index'lenir, "ürün sayfası" olarak değil.

### S12: Projeyi production'a hazır hale getirmek için gereken minimum işler nelerdir?

**A. Acil (1-2 hafta):**
1. `home-data.ts` sayfalama (pagination) — crash engelleme
2. Duplicate engine'de hardcoded source ID fix
3. `inferSourceCountFromDiversity()` mantık hatası düzeltme
4. Product-detail.ts parçalama (1008 satır → modüler)
5. `sitemap.ts` limit kaldırma

**B. Kritik (3-4 hafta):**
6. O(n²) duplicate detection → blocking + indexing
7. `.limit(2000)` product-matcher kaldırma
8. İki confidence sistemini birleştirme
9. Üç adapter sistemini tek bir katmana indirgeme
10. Bot pipeline'ına retry + timeout ekleme

**C. Production (2-3 ay):**
11. Gerçek veriyle tüm engine'leri kalibre etme
12. Monitoring + alarm sistemi
13. JSON-LD'yi Product schema ile zenginleştirme
14. Crawler'lar için health check + schema degradation detection
15. Queue sistemi + paralel bot çalıştırma

---

## Final Değerlendirme

**2ElBul, bir "feature playground" olarak başarılıdır.** 10+ engine, 6 intelligence modülü, 46 test dosyası — bu seviyede bir mimari düşünce az projede vardır. Takımın engine tasarımı, weighted scoring, pipeline mimarisi konusundaki yetkinliği nettir.

**Ancak, production'a hazır değildir.** Veri kalitesi, ölçeklenebilirlik ve izlenebilirlik konularında **sistematik eksiklikler** vardır. Bu raporun A-L bölümlerinde detaylandırılan sorunların her biri, gerçek veriyle karşılaşıldığında crash, veri kaybı veya tutarsız kullanıcı deneyimi üretecektir.

**En büyük risk:** Sistem **henüz hiç gerçek veri görmemiştir.** Tüm engine'ler, tüm threshold'lar, tüm confidence seviyeleri — bunlar gerçek dünya verisiyle kalibre edilmemiştir. Veri gelmeye başladığında, bu raporun öngördüğü sorunların çoğu kendini gösterecektir.

**Öncelik sırası:**
1. `home-data.ts` → crash engelle (hemen)
2. Hardcoded ID'ler → veri tutarlılığı (1 gün)
3. Product-detail.ts parçala → bakım (3 gün)
4. Product-matcher limit → ölçeklenebilirlik (1 hafta)
5. İki confidence sistemini birleştir → tutarlılık (1 hafta)
6. Sonra diğerleri...

**Unutma: Feature'ların hiçbiri "bitmiş" değildir. Sadece "yeterince olgunlaşmıştır." Data gelmeden hiçbir engine'in gerçek başarısı ölçülemez.**
