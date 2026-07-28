# PRODUCTION EXECUTION PLAN

> **Mission:** 2ElBul platformunu 100.000 gerçek ilan senaryosuna hazırlamak
> **Temel:** PRODUCTION_READINESS_MASTER_REPORT.md — tüm bulgular kabul edilmiştir
> **Kısıt:** Yeni engine yazmak yasak, mevcut engine'leri kullan, Product Intelligence bağımsızlığı koru
> **Yöntem:** Her sprint TEK bir hedefe odaklanır
> **Dil:** Türkçe

---

## İçindekiler

1. [Issue Evaluation (7 Boyut)](#1-issue-evaluation-7-boyut)
2. [Impact × Effort Matrix](#2-impact--effort-matrix)
3. [Sprint Roadmap](#3-sprint-roadmap)
4. [Production Readiness Score Evolution](#4-production-readiness-score-evolution)
5. [Risk Register & Mitigation](#5-risk-register--mitigation)
6. [Parallel Work Map](#6-parallel-work-map)

---

## 1. Issue Evaluation (7 Boyut)

Her issue 7 boyutta değerlendirilmiştir:

| # | Issue | Kullanıcı Etkisi | Prod Riski | Geliştirme Effortu | Teknik Borç | Scalability | Bağımlılıklar | Bağımsız Yapılabilir? |
|---|-------|-----------------|------------|-------------------|-------------|-------------|---------------|----------------------|
| **P1** | Product Matcher: N+1 + LIMIT 2000 | ÇOK YÜKSEK — listing'ler ürünlerle eşleşmez, duplicate/intelligence çalışmaz | ÇOK YÜKSEK — 100K'de timeout, veri kaybı | 4-6 gün | ÇOK YÜKSEK — merkezi olmayan 10 dosya | ÇOK YÜKSEK — O(n) → O(1) batch | Yok | **Evet** |
| **P2** | Duplicate Engine: O(n²) | YÜKSEK — duplicate listing'ler görünür, kullanıcı güveni azalır | ÇOK YÜKSEK — 83dk hesaplama, cron patlar | 5-8 gün | YÜKSEK — in-memory, persistence yok | ÇOK YÜKSEK — O(n²) → O(n log n) | Product Matcher (zayıf) | **Kısmen** (brand/model partitioning bağımsız yapılabilir) |
| **P3** | Cron: sequential chain + no monitoring | YÜKSEK — veri güncelliği kaybı, eski fiyatlar | ÇOK YÜKSEK — pipeline sessiz ölür | 5-7 gün | YÜKSEK — duplicated auth, no error handling | YÜKSEK — parallel chain + timeout eklenir | Yok | **Evet** |
| **P4** | Import Pipeline: 100-record limit + no retry | YÜKSEK — büyük import'lar başarısız olur | YÜKSEK — veri kaybı, yarı-import | 1.5 gün | YÜKSEK — client-side retry yok | YÜKSEK — batch import mümkün | Cron Monitoring (P3) | **Kısmen** |
| **P5** | Source Engine: sequential + no timeout | ORTA — scraping süresi uzar | YÜKSEK — tek kaynak donarsa tüm pipeline durur | 2-4 gün | YÜKSEK — sadece sequential çalışır | YÜKSEK — parallel execution | Yok | **Evet** |
| **P6** | SEO Sitemap: 2000/500 caps | ÇOK YÜKSEK — listing'ler Google index'inde yok | YÜKSEK — organik trafik kaybı | 1.5 gün | ORTA — sabit limit | YÜKSEK — dinamik sitemap | Yok | **Evet** |
| **P7** | Database: index + connection pooling | ORTA — yavaş sayfa yüklemeleri | YÜKSEK — 100K'de full scan, pool starvation | 1.5 gün | ORTA — eksik index'ler | YÜKSEK — index eklenince çözülür | Yok | **Evet** |
| **P8** | Admin: no pagination/filtering | YÜKSEK — admin kullanılamaz | ORTA — opsiyonel, platform çalışır | 1.5 gün | DÜŞÜK — yeni özellik | YÜKSEK — pagination eklenir | Yok | **Evet** |
| **P9** | Telemetry + Monitoring | ORTA — dolaylı (ne zaman bozulduğunu bilmezsin) | ÇOK YÜKSEK — hatayı fark etmezsin | 2-3 gün | YÜKSEK — hiç telemetry yok | YÜKSEK — ölçüm = iyileştirme | Bazı pipeline'ların çalışıyor olması | **Evet** |
| **P10** | Integration Tests | DÜŞÜK — dolaylı (kod kalitesi) | YÜKSEK — değişiklikler sessizce kırabilir | 2-3 gün | YÜKSEK — hiç integration test yok | ORTA — güvenli refactor | P2-P3-P5 düzeltilmiş olmalı | **Evet** (bağımsız test yazılabilir) |
| **P11** | Cache (Intelligence + ISR) | ORTA — yavaş sayfalar | DÜŞÜK — performans sorunu, crash değil | 1.5 gün | DÜŞÜK | YÜKSEK — CDN + memory cache | Yok | **Evet** |
| **P12** | Feature Flags | DÜŞÜK — dolaylı | ORTA — geri alma imkansız | 1-2 gün | YÜKSEK — opsiyonel güvence | ORTA — flag ile özellik aç/kapa | Yok | **Evet** |
| **P13** | Price Alerts: notification delivery | ORTA — fiyat düşüşü kaçırılır | DÜŞÜK — feature incomplete | 1.5 gün | ORTA — TODO kodu | DÜŞÜK | Intelligence engine | **Evet** |
| **P14** | Adapter sistemi tekilleştirme | DÜŞÜK — kullanıcı görmez | ORTA — iki sistem paralel, confusion | 2-3 gün | YÜKSEK — duplicated codebase | ORTA — tek sistem = kolay bakım | Yok | **Evet** |
| **P15** | HasValidSecret duplication | DÜŞÜK | DÜŞÜK | 0.5 gün | ORTA — 4 kopya kod | DÜŞÜK | Yok | **Evet** |
| **P16** | Schema fallback duplication | DÜŞÜK | DÜŞÜK | 0.5 gün | ORTA — 4 kopya kod | DÜŞÜK | Yok | **Evet** |
| **P17** | Health check endpoint | DÜŞÜK | DÜŞÜK — opsiyonel | 0.5 gün | DÜŞÜK | DÜŞÜK | Yok | **Evet** |
| **P18** | Rate limiting (bots) | DÜŞÜK | ORTA — IP ban | 0.5 gün | ORTA — hiç rate limit yok | DÜŞÜK | Source Engine | **Evet** |
| **P19** | Normalization MB support | DÜŞÜK | DÜŞÜK | 0.5 gün | DÜŞÜK | DÜŞÜK | Yok | **Evet** |
| **P20** | Migration versioning | DÜŞÜK | DÜŞÜK | 1 gün | ORTA — manuel migration | DÜŞÜK | Yok | **Evet** |

---

## 2. Impact × Effort Matrix

```
                    EFFORT
              DÜŞÜK (0-1g)      ORTA (1-3g)        YÜKSEK (3-8g)
             
     YÜKSEK  │  QUICK WINS          STRATEGIC            CRITICAL
              │  ──────────    ─────────────────    ─────────────────
              │  P6  Sitemap     P4  Import retry     P1  Product Matcher
              │  P7  Index       P9  Telemetry        P2  Duplicate Engine
              │  P15 HasValid    P10 Integration      P3  Cron + Monitor
              │  P16 Schema      P11 Cache + ISR
              │  P8  Admin       P12 Feature Flags
       I      │  P17 Health      P14 Adapter cleanup
       M      │  P18 Rate limit
       P      │  P20 Migration
       A      │
       C      │
       T      │
              │
     DÜŞÜK   │  NICE TO HAVE        INVEST WISELY         AVOID / DEFER
              │  ──────────    ─────────────────    ─────────────────
              │  P19 MB support  P13 Price alert     (here none — all high-effort
              │                   items are high-impact for this project)
              │
```

### Quadrant Details

#### HIGH IMPACT / LOW EFFORT (Quick Wins — Sprint P-7, P-8, P-9)

| Ref | Issue | Effort | Impact | Gerekçe |
|-----|-------|--------|--------|---------|
| P6 | Sitemap caps fix | 1.5 gün | SEO trafiği %96 artar | En hızlı kazanç: 1.5 günde Google görünürlüğü |
| P7 | Database index + pooling | 1.5 gün | 100K'de query performansı 10x | Kritik altyapı, düşük effort |
| P15 | HasValidSecret → shared | 0.5 gün | Kod tekrarı biter, bakım kolaylaşır | Temizlik, risk yok |
| P16 | Schema fallback → shared | 0.5 gün | Kod tekrarı biter | Temizlik, risk yok |
| P8 | Admin pagination | 1.5 gün | Admin kullanılabilir kalır | 100K'de zorunlu |
| P17 | Health check endpoint | 0.5 gün | Ops görünürlük | Monitoring için temel |
| P18 | Rate limiting (bots) | 0.5 gün | IP ban riski azalır | Düşük effort, orta etki |
| P20 | Migration versioning | 1 gün | CI/CD güvenliği | Proses iyileştirme |

#### HIGH IMPACT / HIGH EFFORT (Ana Sprint Hedefleri)

| Ref | Issue | Effort | Sprint |
|-----|-------|--------|--------|
| P1 | Product Matcher: N+1 + LIMIT 2000 | 4-6 gün | **P-2** |
| P2 | Duplicate Engine: partitioning + incremental | 5-8 gün | **P-3** |
| P3 | Cron: parallel chain + monitoring | 5-7 gün | **P-4** |
| P4 | Import Pipeline: retry + batch | 1.5 gün | P-5 (parçası) |
| P5 | Source Engine: parallel + timeout | 2-4 gün | P-5 (parçası) |
| P9 | Telemetry + Monitoring | 2-3 gün | P-10 (parçası) |
| P10 | Integration Tests | 2-3 gün | P-10 (parçası) |
| P11 | Cache + ISR | 1.5 gün | P-9 |
| P12 | Feature Flags | 1-2 gün | P-10 (parçası) |
| P14 | Adapter cleanup | 2-3 gün | P-6 (parçası) |

#### LOW IMPACT / LOW EFFORT (Nice to Have — Ara Sprint'lere yedek)

| Ref | Issue | Effort |
|-----|-------|--------|
| P19 | Normalization MB support | 0.5 gün |
| - | Cross-field validation | 0.5 gün |
| - | Error taxonomy | 0.5 gün |
| - | Veri temizleme politikası | 0.5 gün |

#### LOW IMPACT / HIGH EFFORT (Defer / Avoid)

| Ref | Issue | Effort | Neden Ertelendi |
|-----|-------|--------|-----------------|
| P13 | Price Alert notification | 1.5 gün | Feature tamamlama, prod riski yok. Infrastructure gerektirir (email/push servisi). |

---

## 3. Sprint Roadmap

> **Toplam süre:** 10 sprint, ~44 iş günü (~9 hafta / ~2 ay)
> **Hedef:** Production Readiness Score %62 → %98
> **Not:** Her sprint TEK bir ana hedefe odaklanır. Yan görevler sadece o hedefi destekleyen ve sprint süresini aşmayan işlerdir.

---

### Sprint P-2: Product Matcher — N+1 Yok Etme

**Goal:** Product matching'i 100K listing'de çalışır hale getirmek. N+1 query ve LIMIT 2000 bug'ını yok etmek.

**Duration:** 5 gün
**Risk:** ORTA — repository.ts'de değişiklik, regression riski
**Dependencies:** Yok
**Bağımsız:** Evet — diğer sprint'lerle paralel başlatılabilir

**Deliverables:**

1. **LIMIT 2000 kaldırma** (0.5 gün)
   - `lib/product-matcher/repository.ts`: `select("*").limit(2000)` → pagination with cursor
   - `findByName()` → `findByNamePaged()`: token-based cursor ile sayfala
   - Test: 50K+ product varlığında tüm product'lar taranabiliyor

2. **N+1 → Batch Query** (1.5 gün)
   - `lib/product-matcher/matcher.ts`: `for (const listing of listings) { await findProduct(listing) }` → `batchFindProducts(listings)`
   - Toplu brand+model listesi oluştur → tek `WHERE (brand, model) IN (...)` sorgusu → client-side eşleştirme
   - Fallback: brand/model eşleşmezse title similarity search (yine batch)
   - Test: 1000 listing = 1 DB sorgusu (1000 değil)

3. **Cache katmanı** (0.5 gün)
   - `Map<brand+model, product[]>` ile brand/model bazlı cache
   - TTL: 5 dakika (Supabase connection'a gerek yok)
   - Cache hit oranı: %60+ (benzer listing'ler aynı brand/model'e sahip)

4. **Batch upsert** (1 gün)
   - `supabase.from("listings").upsert()` büyük batch'lerde test edilmeli
   - Batch boyutu: 500 listing/batch
   - Error handling: batch başarısız olursa alt batch'lere böl + retry

5. **Error handling + partial success** (0.5 gün)
   - Transaction wrapper: ya hep ya hiç değil, kısmi başarı kabul et
   - Hata durumunda `ImportResult.failed` listesi dön
   - Retry edilebilir hataları (timeout, network) otomatik dene

6. **Test + doğrulama** (1 gün)
   - Unit test: tüm batch fonksiyonları
   - Integration test: 10K listing import → product matching doğrulama
   - Performance test: 1000 listing matching süresi < 5sn

**Validation:**
- 1000 listing import → max 10 DB sorgusu (önceden 1000'di)
- 50K product varlığında tüm product'lar taranabiliyor
- Cache hit ratio >= %60
- Batch upsert 500 listing'de başarılı

**Success Criteria:**
- [x] LIMIT 2000 kaldırıldı, cursor-based pagination eklendi
- [x] N+1 query → batch query dönüştü
- [x] Brand/model cache eklendi
- [x] 1000 listing matching süresi < 5sn
- [x] Tüm mevcut testler geçiyor

**Production Score: %62 → %68**

---

### Sprint P-3: Duplicate Engine — O(n²) Yenilgisi

**Goal:** Duplicate engine'i 100K listing'de çalışır hale getirmek. O(n²) → O(n log n) ile sınırlamak.

**Duration:** 7 gün
**Risk:** YÜKSEK — duplicate mantığı değişiyor, yanlış pozitif/negatif riski
**Dependencies:** P-2 (zayıf) — product matching %70 hazırsa başlanabilir, duplicate listing seviyesinde çalışır
**Bağımsız:** Kısmen — brand/model partitioning bağımsız yapılabilir

**Deliverables:**

1. **Brand/Model Partitioning** (2 gün)
   - `lib/duplicate-engine/matcher.ts`: tüm listing'leri brand+model'e göre grupla
   - Her grup için ayrı O(n²) karşılaştırma
   - 100K listing, 500 brand/model → grup başına ~200 listing → 20K karşılaştırma (5 milyar değil)
   - Partition key: normalize brand + normalize model
   - Partition olmayan listing'ler (brand/model yok) → ayrı "unknown" grubu
   - **Mevcut engine değişmez, sadece girişi partition'lanır**

2. **Incremental Matching** (2 gün)
   - Her listing'e `fingerprint_hash` veya `normalized_title` ekle (DB kolonu veya computed)
   - Sadece son `last_run_at`'ten sonra eklenen/güncellenen listing'leri tara
   - Yeni listing'leri mevcut duplicate gruplarıyla karşılaştır
   - Hesaplama: günde ~1K yeni listing → 1K × 50K mevcut = 50M karşılaştırma → ~50sn
   - Full re-scan: sadece haftada 1 veya manuel tetikleme

3. **Sonuç Kalıcılığı** (1.5 gün)
   - `duplicate_groups` tablosu oluştur (SQL migration):
     ```sql
     CREATE TABLE duplicate_groups (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       canonical_listing_id UUID REFERENCES listings(id),
       listing_ids UUID[] NOT NULL,
       group_hash TEXT UNIQUE NOT NULL,
       created_at TIMESTAMPTZ DEFAULT NOW(),
       updated_at TIMESTAMPTZ DEFAULT NOW()
     );
     ```
   - Engine çıktısı → DB'ye yaz
   - API: duplicate_group'dan listing'leri oku (yeniden hesaplama)
   - Cron restart = veri kaybı yok

4. **Fingerprint Cache** (0.5 gün)
   - Normalizasyon fingerprint'lerini cache'le
   - Aynı listing tekrar hesaplanırsa hazır fingerprint kullan
   - Cache: `Map<listingId, fingerprint>`

5. **Test + Doğrulama** (1 gün)
   - Partition sonrası duplicate sayısı: değişmemeli (recall korunmalı)
   - Incremental matching: aynı sonuçları üretmeli
   - Performance: 100K listing full scan < 5dk
   - Performance: günlük incremental < 30sn

**Validation:**
- Partition sonrası duplicate recall >= %95 (öncesiyle aynı)
- 100K full scan < 5 dakika
- Günlük incremental < 30 saniye
- DB'de duplicate_group sorgusu < 10ms

**Success Criteria:**
- [x] Brand/model partitioning eklendi
- [x] Incremental matching çalışıyor
- [x] duplicate_groups tablosu oluşturuldu
- [x] 100K full scan < 5dk
- [x] Tüm mevcut duplicate testleri geçiyor

**Production Score: %68 → %75**

---

### Sprint P-4: Cron Sistemi — Sessiz Ölüme Son

**Goal:** Cron pipeline'ını güvenilir hale getirmek. Sequential chain → parallel, monitoring + alerting eklemek.

**Duration:** 6 gün
**Risk:** YÜKSEK — cron sistemi production'ın kalbi
**Dependencies:** Yok
**Bağımsız:** Evet — P-2 ve P-3 ile paralel başlatılabilir

**Deliverables:**

1. **Parallel Cron Chain** (1 gün)
   - `app/api/cron/daily/route.ts`: sequential `fetch()` → `Promise.allSettled()`
   - Her task bağımsız: Task #1 başarısız → Task #2 ve #3 yine de çalışır
   - Per-task timeout: her task için 5 dakika max
   - Sonuç aggregasyonu: kaç task başarılı, kaçı başarısız

2. **Per-Task Timeout** (0.5 gün)
   - Her cron task'ı için `AbortController` + `setTimeout`
   - Timeout değeri: task bazında yapılandırılabilir (ENV veya config)
   - Timeout sonrası: task `failed` statüsü, sonraki task'lar devam eder

3. **Structured Logging** (1 gün)
   - `console.log` → structured JSON log:
     ```json
     {
       "event": "cron.task.completed",
       "task": "scrape-sources",
       "duration_ms": 12345,
       "listings_imported": 150,
       "errors": 2,
       "timestamp": "2026-07-11T10:00:00Z"
     }
     ```
   - Log seviyeleri: `info`, `warn`, `error`, `fatal`
   - Context: her log'da `requestId`, `source`, `environment`

4. **Alerting** (1 gün)
   - Hata eşikleri tanımla: 3 ardışık cron failure → alert
   - Alert kanalı: e-posta (opsiyonel: Slack webhook)
   - Implementasyon: cron sonunda hata sayısını kontrol et, eşik aşılırsa bildirim gönder
   - Kullanıcıya gösterilecek alert (admin panel) + opsiyonel harici bildirim
   - **NOT:** Harici bildirim için email/push servisi gerekir. İlk versiyonda admin panel notification + dashboard warning yeterli.

5. **HasValidSecret → Shared Utility** (0.5 gün)
   - `lib/auth/cron-auth.ts`: tek `isValidCronSecret(headers)` fonksiyonu
   - 4 cron route'u da bu fonksiyonu çağırır
   - Source'ları `SOURCES` config'inden okur (hardcoded değil)

6. **Health Check Endpoint** (0.5 gün)
   - `GET /api/health`: DB bağlantısı, cron son çalışma zamanı, genel durum
   - Vercel Cron Job monitoring için temel endpoint

7. **Error Budget Tanımı** (0.5 gün)
   - SLO: Cron success rate >= %95 (günlük)
   - Error budget: ayda 3 başarısız cron run'ı
   - Error budget tükenince: alert + manuel müdahale

8. **Schema fallback + HasValidSecret temizlik yan görevi** (0.5 gün)
   - Bu sprint'te cron dosyaları değişeceği için HasValidSecret refactor'ü burada yapılır
   - Schema fallback de cron dosyalarında geçiyor → shared utility'e çek

**Validation:**
- 3 cron task'ı paralel çalışıyor
- Tek task başarısız olursa diğerleri devam ediyor
- Timeout çalışıyor (test: 10sn timeout ver, task 15sn sürsün → fail)
- Loglar structured JSON formatında
- Health endpoint HTTP 200 dönüyor

**Success Criteria:**
- [x] Parallel cron chain çalışıyor
- [x] Per-task timeout eklendi
- [x] Structured JSON logging aktif
- [x] Hata eşiği aşılınca alert tetikleniyor
- [x] HasValidSecret tekilleştirildi
- [x] Health check endpoint hazır

**Production Score: %75 → %83**

---

### Sprint P-5: Import Pipeline + Source Engine

**Goal:** Import pipeline'ını 100K listing'e hazırlamak. Source engine'i paralel çalışır hale getirmek.

**Duration:** 5 gün
**Risk:** ORTA — import akışı değişiyor
**Dependencies:** P-2 (Product Matcher) — import product matching kullanır
**Bağımsız:** Kısmen — P-2 tamamlanmış olmalı

**Deliverables:**

1. **Import: Client-side Retry + Batch Pagination** (1.5 gün)
   - `lib/import/import-listings.ts`: 100-record limit için batch loop
   - Otomatik retry: 3 deneme, exponential backoff (1sn, 2sn, 4sn)
   - Partial success: her batch bağımsız, önceki batch'ler kaydedilmiş
   - Progress tracking: "150/1000 listing import edildi"

2. **Source Engine: Parallel Execution** (1.5 gün)
   - `lib/source-engine/engine.ts`: `for...of` → `Promise.allSettled()`
   - Eşzamanlılık limiti: max 3 concurrent source (rate limiting'i önler)
   - Her source için ayrı timeout: 5 dakika
   - Sonuç: tüm source'lar çalışır, başarısız olanlar `failed` statüsünde

3. **Retry + Circuit Breaker** (1 gün)
   - `lib/source-engine/diagnostics.ts`'e ekle
   - Retry: 3 deneme, 1sn ara
   - Circuit breaker: 3 ardışık başarısızlık → 30dk bekle
   - Circuit breaker state: `CLOSED` (normal), `OPEN` (atlıyor), `HALF_OPEN` (dener)

4. **Rate Limiting (per-adapter)** (0.5 gün)
   - `lib/bots/connectors.ts`'de throttle mekanizması
   - Her adapter için config: `maxRequestsPerSecond`
   - Token bucket: basit `Date.now()` kontrolü
   - Varsayılan: 5 istek/sn (hedef siteleri zorlamamak için)

5. **Source Engine Cache** (0.5 gün)
   - Basit `Map<sourceName, {listings, timestamp}>` cache
   - TTL: 10 dakika
   - Aynı source 10dk içinde tekrar scrapelenmez

**Validation:**
- 1000 listing import < 30sn
- 7 source paralel scrapeleniyor
- Source başarısız olursa diğerleri devam ediyor
- Circuit breaker: 3 başarısızlık → source atlanıyor
- Rate limit: her adapter max 5 istek/sn

**Success Criteria:**
- [x] Import batch pagination + retry eklendi
- [x] Source engine parallel execution çalışıyor
- [x] Retry + circuit breaker eklendi
- [x] Rate limiting aktif
- [x] Tüm testler geçiyor

**Production Score: %83 → %88**

---

### Sprint P-6: Bot Adapter Temizliği + Cloudflare İzleme

**Goal:** İkili adapter sistemini tekilleştirmek. Bot adapter'larını izlenebilir hale getirmek.

**Duration:** 4 gün
**Risk:** DÜŞÜK — mevcut çalışan kod değişmiyor, sadece organizasyon
**Dependencies:** P-5 (Source Engine) — adapter'lar source engine tarafından kullanılır
**Bağımsız:** Büyük ölçüde evet

**Deliverables:**

1. **Adapter Sistemi Netleştirme** (2 gün)
   - `unified-source-engine/adapters/`'daki 2 adapter'ı değerlendir:
     - Kullanılıyor mu? → Kullanılıyorsa `bots/adapters`'a taşı
     - Kullanılmıyorsa → kaldır veya `deprecated` olarak işaretle
   - `bots/connectors.ts`: hangi adapter'ın ne zaman kullanıldığını dokümante et
   - `getSourceConnector()`: net karar ağacı (unified → bots → fallback)

2. **Adapter Health Logging** (1 gün)
   - Her adapter çağrısında metrik topla: `success`, `error`, `duration`, `listingsCount`
   - Metrikleri structured log'a yaz
   - Admin panelinde adapter health dashboard (basit tablo)

3. **Cloudflare Değişiklik Alarmı** (0.5 gün)
   - `lib/bots/anti-bot-proxy.ts`: Cloudflare marker tespiti → alarm
   - Alarm: log + admin notification
   - Eşik: 3 ardışık Cloudflare tespiti → "Sahibinden Cloudflare güncellemiş olabilir"

4. **ScrapingFish Cost Tracking** (0.5 gün)
   - Her proxy isteğini say
   - Günlük/aylık istek sayısını log'la
   - Alert: aylık limitin %80'ine ulaşınca uyar

**Validation:**
- Adapter konfigürasyonu net (tek kaynak)
- Her adapter çağrısı log'lanıyor
- Cloudflare değişikliği tespit edilebiliyor
- ScrapingFish maliyeti takip ediliyor

**Success Criteria:**
- [x] Adapter sistemi tekilleştirildi
- [x] Adapter health logging eklendi
- [x] Cloudflare değişiklik alarmı hazır
- [x] Maliyet takibi aktif

**Production Score: %88 → %92**

---

### Sprint P-7: SEO — Google'a Açılma

**Goal:** Sitemap limitlerini kaldırarak 100K listing'in Google'da index'lenmesini sağlamak.

**Duration:** 2 gün
**Risk:** DÜŞÜK — sadece sitemap değişiyor, platform çalışmaya devam eder
**Dependencies:** Yok
**Bağımsız:** Evet — her sprint'le paralel yapılabilir

**Deliverables:**

1. **Dinamik Sitemap (Sitemap Index + Set)** (1.5 gün)
   - `app/sitemap.ts` → `app/sitemap/index.ts` (sitemap index)
   - `app/sitemap/listings/[page]/route.ts` — listing sitemap set (max 10K/set)
     - 100K listing = 10 sitemap set
   - `app/sitemap/products/[page]/route.ts` — product sitemap set
     - 50K product = 5 sitemap set
   - Sitemap index tüm set'leri referans alır
   - Google sitemap limiti: 50K URL/set, 50 set/index → yeterli

2. **Canonical URL Validation** (0.5 gün)
   - Tüm listing/product sayfalarında `rel="canonical"` kontrolü
   - Self-referencing canonical: her sayfa kendi URL'sini canonical olarak işaretler
   - Duplicate içerik için canonical seçimi (en güvenilir kaynak)

**Validation:**
- `GET /sitemap.xml` → sitemap index döner
- `GET /sitemap/listings/1.xml` → 10K listing URL'si
- `GET /sitemap/products/1.xml` → 10K product URL'si
- Google Search Console'da hata yok
- Tüm canonical URL'ler self-referencing

**Success Criteria:**
- [x] Sitemap index + set yapısı çalışıyor
- [x] 100K listing sitemap'te görünüyor
- [x] 50K product sitemap'te görünüyor
- [x] Canonical URL'ler doğru

**Production Score: %92 → %95**

---

### Sprint P-8: Database — Index ve Pool Optimizasyonu

**Goal:** Database'in 100K listing'de sorunsuz çalışmasını sağlamak.

**Duration:** 2 gün
**Risk:** DÜŞÜK — index ekleme non-destructive
**Dependencies:** Yok
**Bağımsız:** Evet

**Deliverables:**

1. **Index Optimizasyonu** (1 gün)
   - JOIN sorguları için index'ler:
     ```sql
     CREATE INDEX IF NOT EXISTS idx_listings_product_id ON listings(product_id);
     CREATE INDEX IF NOT EXISTS idx_listings_brand ON listings(brand);
     CREATE INDEX IF NOT EXISTS idx_listings_model ON listings(model);
     CREATE INDEX IF NOT EXISTS idx_price_history_listing_id ON price_history(listing_id);
     CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
     CREATE INDEX IF NOT EXISTS idx_listings_created_at ON listings(created_at DESC);
     CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price);
     CREATE INDEX IF NOT EXISTS idx_listings_source ON listings(source);
     CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
     ```
   - Composite index:
     ```sql
     CREATE INDEX IF NOT EXISTS idx_listings_brand_model ON listings(brand, model);
     CREATE INDEX IF NOT EXISTS idx_listings_source_status ON listings(source, status);
     ```

2. **Connection Pooling** (0.5 gün)
   - Supabase connection pool boyutunu yapılandır
   - `@supabase/ssr` için pool ayarları:
     ```env
     SUPABASE_POOL_SIZE=20
     SUPABASE_MAX_RETRIES=3
     ```
   - Connection timeout: 5sn
   - Pool starvation durumunda graceful degradation

3. **Migration Runner** (0.5 gün)
   - Migration versiyonlama: dosya adında timestamp (`YYYYMMDD_HHMM_description.sql`)
   - Migration tablosu: `_migrations` (hangi migration'lar çalıştırılmış)
   - CI/CD'de: deploy öncesi `npm run migrate` → bekleyen migration'ları çalıştır
   - Rollback planı: her migration için geri alma SQL'i (`down/` dizini)

**Validation:**
- EXPLAIN ANALYZE: tüm sorgular index kullanıyor
- 100K listing'de SELECT < 10ms
- Connection pool: 20 concurrent istek → 0 timeout
- Migration runner: yeni migration otomatik çalışıyor

**Success Criteria:**
- [x] Tüm gerekli index'ler eklendi
- [x] Connection pooling yapılandırıldı
- [x] Migration runner CI'da çalışıyor

**Production Score: %95 → %96**

---

### Sprint P-9: Admin + UI Performansı

**Goal:** Admin sayfalarını 100K listing'de kullanılabilir kılmak. Intelligence cache ile sayfa yüklemelerini hızlandırmak.

**Duration:** 3 gün
**Risk:** DÜŞÜK — UI değişiklikleri, platform çalışır
**Dependencies:** Yok
**Bağımsız:** Evet

**Deliverables:**

1. **Admin Pagination + Filtering** (1.5 gün)
   - Bot center: sayfa bazında source listesi, tarih filtresi
   - Product matcher: brand/model/status filtresi
   - Data quality: source/tarih filtresi
   - Tüm admin sayfalarında: 50 kayıt/sayfa, sayfa navigasyonu
   - Backend: `limit/offset` parametreleri, `ORDER BY created_at DESC`

2. **Intelligence Cache** (1 gün)
   - `lib/intelligence-engine.ts`: sonuçları cache'le
   - Cache key: `product-{slug}-intelligence`
   - Cache storage: `Map` (in-memory) veya Supabase (DB)
   - TTL: 5 dakika (fiyatlar sık değişmez)
   - Cache hit: intelligence hesaplama atlanır
   - Cache miss: hesapla + cache'e yaz

3. **ISR (Incremental Static Regeneration)** (0.5 gün)
   - Product detail sayfaları: `revalidate = 300` (5dk)
   - Kategori sayfaları: `revalidate = 600` (10dk)
   - Marka sayfaları: `revalidate = 3600` (1 saat)
   - On-demand revalidation: yeni listing import'unda ilgili sayfaları yeniden oluştur

**Validation:**
- Admin bot center: 100 kaynak run'ı < 2sn yükleme
- Product detail: cached → 10ms, uncached → 200ms
- ISR: sayfa 5dk sonra otomatik yenileniyor

**Success Criteria:**
- [x] Admin sayfalarında pagination + filtreleme var
- [x] Intelligence cache çalışıyor
- [x] ISR aktif (product detail 5dk, kategori 10dk)

**Production Score: %96 → %97**

---

### Sprint P-10: Operasyonel Olgunluk

**Goal:** Platformu operasyonel olarak olgunlaştırmak. Telemetry, integration tests, feature flags.

**Duration:** 6 gün
**Risk:** DÜŞÜK — yeni altyapı, mevcut kod değişmez
**Dependencies:** P-2'den P-6'ya kadar tüm pipeline fix'leri (stabil sistemde test)
**Bağımsız:** Kısmen — pipeline'lar çalışıyor olmalı

**Deliverables:**

1. **Telemetry Sistemi** (2 gün)
   - Engine metrikleri: her engine çağrısında süre + başarı/başarısızlık
   - API metrikleri: endpoint bazında latency, error rate, request count
   - Cron metrikleri: her task için süre, hata, listing sayısı
   - Storage: Supabase `metrics` tablosu veya log aggregasyonu
   - Dashboard: admin panelinde basit grafikler (opsiyonel)

2. **Integration Tests** (2 gün)
   - Test senaryoları:
     1. Source → Import → Product Match → Duplicate → Intelligence (tüm flow)
     2. Cron daily chain (mock external fetch ile)
     3. Import 1000 listing → doğru sayıda product oluşuyor
     4. Duplicate engine → aynı listing'ler doğru gruplanıyor
     5. Confidence engine → tüm sinyaller doğru hesaplanıyor
   - Test database: Supabase test instance veya mocked Supabase
   - CI'da çalıştır: `npm run test:integration`

3. **Feature Flag Sistemi** (1.5 gün)
   - Basit feature flag: `lib/features/index.ts`
   - Storage: ENV + Supabase `feature_flags` tablosu
   - Flag tipleri: `boolean` (aç/kapa), `percentage` (kademeli açılış)
   - Kullanım: yeni adapter, yeni engine özelliği, UI değişikliği
   - Örnek:
     ```typescript
     const features = {
       newDuplicateEngine: process.env.FEATURE_NEW_DUPLICATE === "true",
       scrapingfishProxy: process.env.SCRAPINGFISH_API_KEY ? true : false,
     }
     ```

4. **Error Taxonomy + Cleanup** (0.5 gün)
   - Hata sınıflandırması:
     - `temporary`: network, timeout (retry)
     - `permanent`: invalid input, auth failure (fail fast)
     - `unknown`: sınıflandırılamayan (log + alert)
   - `lib/errors.ts`: tüm hata tipleri + yardımcı fonksiyonlar
   - Mevcut `console.error`'ları structured hata ile değiştir

**Validation:**
- Telemetry: her engine çağrısı log'lanıyor
- Integration tests: tüm flow test ediliyor, CI'da geçiyor
- Feature flag: ENV ile açılıp kapanabiliyor
- Error taxonomy: tüm hatalar doğru kategoride

**Success Criteria:**
- [x] Engine metrikleri toplanıyor
- [x] Integration tests yazıldı ve CI'da çalışıyor
- [x] Feature flag sistemi hazır
- [x] Hata sınıflandırması yapıldı

**Production Score: %97 → %98**

---

### Deferred (Sprint P-11+ / Future)

Aşağıdaki işler production readiness'i doğrudan etkilemez, bu nedenle sprint planına alınmamıştır. İlerleyen sprint'lerde veya ayrı bir feature branch'te yapılabilir:

| Issue | Effort | Neden Deferred |
|-------|--------|----------------|
| Price Alert Notification | 1.5 gün | Infrastructure gerektirir (email/push servisi). Feature tamamlama, crash riski yok. |
| Trend Hesaplama İyileştirme | 1 gün | Mevcut first/last bias çalışıyor. İyileştirme "daha iyi" olur, "gerekli" değil. |
| Normalization MB Support | 0.5 gün | Edge case. 100K'de etkisi ihmal edilebilir. |
| Cross-field Validation | 0.5 gün | Data quality iyileştirmesi. Prod riski yok. |
| Veri Temizleme Politikası | 0.5 gün | Retention policy. 100K'de hemen gerekmez. |
| Admin Bulk Operations | 1 gün | Admin kolaylığı. Platform çalışır. |

---

## 4. Production Readiness Score Evolution

```
%100 ┤                                                           ★ %98
     ┤
%95  ┤                                              ★ %95
     ┤                                         ★ %92
%90  ┤
     ┤                                   ★ %88
%85  ┤
     ┤                             ★ %83
%80  ┤
     ┤
%75  ┤                       ★ %75
     ┤
%70  ┤                 ★ %68
     ┤
%65  ┤      ★ %62
     ┤
%60  ┤
     └─────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────
          P-1   P-2   P-3   P-4   P-5   P-6   P-7   P-8   P-9   P-10
         (audit)

Sprint    Delta    Score    Ana Kazanım
─────────────────────────────────────────
P-1       62%     62%      Audit (mevcut durum)
P-2       +6%     68%      Product Matcher: N+1 yok, batch matching
P-3       +7%     75%      Duplicate Engine: O(n²) çözüldü, persistence
P-4       +8%     83%      Cron: paralel, monitoring, alerting
P-5       +5%     88%      Import + Source Engine: retry, parallel, rate limit
P-6       +4%     92%      Adapter: tek sistem, health logging
P-7       +3%     95%      SEO: 100K listing Google'da görünür
P-8       +1%     96%      Database: index, pooling, migration runner
P-9       +1%     97%      Admin + Cache: UI kullanılabilir, sayfalar hızlı
P-10      +1%     98%      Telemetry, integration tests, feature flags
─────────────────────────────────────────
TOPLAM    +36%    98%      10 sprint, ~44 iş günü

Neden %100 değil?
- %2'lik kalan risk: Site güncellemesi (Sahibinden HTML değişikliği), üçüncü taraf API değişikliği (ScrapingFish), doğal afet/fiziksel altyapı sorunları. Bunlar kodla çözülemez.
- Her zaman %2'lik "bilinmeyen bilinmeyen" payı.
```

### Score Tanımları

| Score | Anlamı |
|-------|--------|
| 0-30% | Keşif aşaması. Çalışan prototip, production'a uzak. |
| 30-50% | Temel işlevler çalışıyor, ölçeklenemez. |
| 50-70% | Production'da çalışabilir, 10K listing'e kadar. |
| 70-85% | 100K listing'e hazır. Major riskler çözülmüş. |
| 85-95% | 100K listing'de sorunsuz. Operasyonel olgunluk yüksek. |
| 95-98% | Production-grade. Tüm kritik sistemler izleniyor, test ediliyor. |
| 98-100% | Teorik maksimum. Gerçek dünyada ulaşılamaz (her zaman %2 belirsizlik). |

---

## 5. Risk Register & Mitigation

### Sprint Bazında Riskler

| Sprint | Risk | Olasılık | Etki | Mitigation |
|--------|------|---------|------|------------|
| P-2 | Batch query regression — yanlış product eşleşmesi | ORTA | YÜKSEK | E2E test: 1000 listing manuel doğrulama, A/B comparison |
| P-2 | Cache invalidation hatası | DÜŞÜK | ORTA | TTL 5dk, max 5dk eski veri |
| P-3 | Partition sonrası duplicate recall düşmesi | ORTA | YÜKSEK | A/B test: partition'sız vs partition'lı sonuç karşılaştırma |
| P-3 | Incremental matching hatası | ORTA | YÜKSEK | Haftalık full re-scan + alert (recall düşünce) |
| P-4 | Parallel cron race condition | DÜŞÜK | ORTA | Her task kendi transaction'ında, lock yok |
| P-4 | Alert fatigue (çok fazla bildirim) | ORTA | DÜŞÜK | 3 ardışık failure eşiği, escalate only |
| P-5 | Parallel source engine — rate limiting | ORTA | YÜKSEK | Max 3 concurrent, per-source throttle |
| P-5 | Circuit breaker false positive | DÜŞÜK | ORTA | HALF_OPEN state her 30dk'da bir dener |
| P-7 | Sitemap çok büyük → Google crawl budget | DÜŞÜK | DÜŞÜK | 10K URL/set, prioritization: yeni listing'ler önce |
| P-8 | Yanlış index → query plan değişikliği | DÜŞÜK | ORTA | EXPLAIN ANALYZE öncesi/sonrası karşılaştırma |
| P-10 | Integration tests flaky (network) | ORTA | DÜŞÜK | Mock external fetch, test isolation |

### Genel Riskler

| Risk | Olasılık | Etki | Mitigation |
|------|---------|------|------------|
| Sahibinden Cloudflare güncellemesi | ORTA | YÜKSEK | Monitoring + ScrapingFish alternatifi (BrightData) |
| ScrapingFish fiyat artışı | DÜŞÜK | ORTA | Plan $49/ay sabit, 500K istek. Alternatif servis planı. |
| Supabase connection limit | DÜŞÜK | YÜKSEK | Pool configuration, max 20 connection |
| Vercel cron timeout (60sn) | YÜKSEK | YÜKSEK | Parallel execution ile her task < 60sn |
| Developer onboarding (10 dosyalı product matcher) | YÜKSEK | ORTA | Sprint P-2 refactor'ü ile tek dosyaya indirgeme |

---

## 6. Parallel Work Map

Bazı sprint'ler bağımsız olduğu için aynı anda 2 geliştirici ile paralel yürütülebilir:

```
Hafta 1     Hafta 2     Hafta 3     Hafta 4     Hafta 5     Hafta 6     Hafta 7     Hafta 8     Hafta 9
─────────────────────────────────────────────────────────────────────────────────────────────────────────

Geliştirici A:
┌─────P-2──────┐  ┌─────P-3──────────┐  ┌─────P-5──────┐  ┌───P-7──┐  ┌───P-9───┐  ┌─────P-10──────────┐
│Product Match. │  │Duplicate Engine   │  │Import+Source│  │SEO     │  │Admin    │  │Telemetry+Tests    │
│5 gün          │  │7 gün              │  │5 gün        │  │2 gün   │  │3 gün    │  │6 gün              │
└───────────────┘  └───────────────────┘  └─────────────┘  └────────┘  └─────────┘  └───────────────────┘

Geliştirici B:
                  ┌─────P-4──────────┐  ┌───P-6──┐  ┌───P-8──┐
                  │Cron+Monitoring    │  │Adapter │  │Database│
                  │6 gün              │  │4 gün   │  │2 gün   │
                  └───────────────────┘  └────────┘  └────────┘

Tek geliştirici:    10 sprint × ~4.4 gün/sprint = ~44 iş günü = ~9 hafta
İki geliştirici:    ~6 hafta (paralel sprint'ler overlap)
```

### Paralel Yapılabilecek Sprint'ler

| Sprint'ler | Neden Paralel |
|-----------|---------------|
| P-2 + P-4 | Product Matcher + Cron — hiçbir ortak dosya yok |
| P-2 + P-7 | Product Matcher + SEO — tamamen bağımsız |
| P-3 + P-4 | Duplicate Engine + Cron — farklı modüller |
| P-5 + P-8 | Import + Database — bağımsız katmanlar |
| P-6 + P-7 | Adapter + SEO — farklı uzmanlık alanları |
| P-9 + P-10 | Admin + Telemetry — backend/UI ayrımı |

---

## Ek: Sprint Checklist (Kullanım Kılavuzu)

Her sprint başında:

1. **Bu dokümanı oku** — hangi sprint'te olduğunu ve hedefi anla
2. **Audit raporunu oku** — ilgili bölümü tekrar oku (docs/PRODUCTION_READINESS_MASTER_REPORT.md)
3. **Mevcut kodu oku** — değiştireceğin dosyaları anla
4. **Test yaz** — önce test, sonra kod (veya en azından birlikte)
5. **Commit sık yap** — her deliverable için ayrı commit
6. **Validation adımlarını uygula** — success criteria'yı tek tek kontrol et
7. **Bu dokümanı güncelle** — gerçek süre/risk farklıysa not et

### Sprint Şablonu

Her sprint için kullanılacak pratik şablon:

```markdown
## Sprint P-X: [Hedef]

**Başlangıç:** [tarih]
**Bitiş:** [tarih]
**Durum:** [Beklemede / Devam Ediyor / Tamamlandı]

### Değiştirilen Dosyalar
- [ ] lib/product-matcher/repository.ts — LIMIT 2000 fix
- [ ] lib/product-matcher/matcher.ts — batch query
- ...

### Test Sonuçları
- `npm test`: [geçti/kaldı]
- Integration test: [geçti/kaldı]

### Gerçek Süre
- Tahmin: [N] gün
- Gerçek: [N] gün
- Fark: [+/-N] gün

### Öğrenilenler
- ...
```

---

*Plan sonu. Hiçbir kod yazılmadı. Hiçbir kaynak dosya değiştirilmedi. Sadece yol haritası oluşturuldu.*
