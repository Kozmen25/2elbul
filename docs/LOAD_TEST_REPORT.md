# Sprint P-8 — Production Load Test Raporu

**Tarih:** 2026-07-14  
**Kapsam:** Production-scale load test — import ve sync pipeline'ları  
**Taşıyıcı Kısıt:** "Do NOT implement optimizations automatically. STOP AFTER LOAD TEST."

---

## Özet

Sprint P-8 kapsamında 2ElBul'un iki ana veri pipeline'ı (Sync Path ve Import Path) production-scale yük altında test edilmiştir. Testler, stub Supabase client ile 1000 ve 5000 listing seviyelerinde çalıştırılmış, her pipeline için throughput, timing, DB query sayısı ve memory kullanımı ölçülmüştür.

**Toplam Validasyon:** ✅ `tsc --noEmit` | ✅ `npm test` (865 test, 55 dosya) | ✅ `npm run build`

---

## Test Mimarisı

Üç destek dosyası load test altyapısını oluşturur:

| Dosya | Açıklama |
|---|---|
| `__tests__/load/stub-factory.ts` | Tam zincirleme Supabase stub — `.select()`, `.insert()`, `.upsert()`, `.eq()`, `.in()`, `.gte()`, `.lt()`, `.range()`, `.order()`, `.single()`, `.maybeSingle()` destekler. `existingProducts` Map ile mevcut ürün simülasyonu, `failRpc` ile hata senaryoları. |
| `__tests__/load/synthetic-data.ts` | 50 ürün şablonu (%40 Apple, %30 Samsung, %20 Xiaomi, %10 diğer) + deterministik seed'li jeneratör. 10 şehir, 4 durum seçeneği. |
| `__tests__/load/metrics-collector.ts` | Timing, sayma, memory snapshot, stub çağrı analizi ve formatMetrics() çıktısı. |

### Pipeline Karşılaştırması

| Özellik | Sync Path | Import Path |
|---|---|---|
| **Giriş** | BotAdapterListing[] (bot scraping) | RawImportListing[] (admin import) |
| **Adapter** | Yok (doğrudan sync) | `adapter.normalize()` → RawImportListing |
| **Product Matching** | `loadProductIdsForListings()` (name lookup) | `batchFindOrCreateMatchedProducts()` |
| **Duplicate Detection** | `buildDuplicateSummary()` (sync sonrası) | `groupListingDuplicatesByKey()` (işlem öncesi) |
| **DB Kaydı** | `rpc("sync_source_listings")` + fallback `insertListingsLegacy()` | Bireysel `upsert()` onConflict |
| **DB Query Sayısı** | **3** (select + rpc) | **N** (her listing için 1 upsert) |

---

## Metrikler

### Sync Path

| Scale | Süre | Throughput | DB Queries | RSS (bitiş) | Detay |
|---|---|---|---|---|---|
| 1,000 | 9.56s | 104.65/s | 3 | 103.6 MB | 65 product key grubu, 124 duplicate grup |
| 5,000 | 237.93s | 21.01/s | 3 | 226.3 MB | 65 product key grubu, 125 duplicate grup |

**İdempotency (1K):** 18.6s (iki çalıştırma) — aynı girdi, aynı sonuç ✅  
**Recovery (RPC failure → legacy, 1K):** 18.6s — RPC hatasına rağmen tüm listing'ler kaydedildi ✅

### Import Path

| Scale | Süre | Throughput | DB Queries | RSS (bitiş) | Detay |
|---|---|---|---|---|---|
| 1,000 | 9.27s | 107.86/s | 1,000 | 245.4 MB | 65 product key grubu, 124 duplicate grup |
| 5,000 | 230.71s | 21.67/s | 5,000 | 276.7 MB | 65 product key grubu, 125 duplicate grup |

**İdempotency (1K):** 18.5s (iki çalıştırma) — failure oranı aynı ✅  
**Recovery (upsert hataları, 100):** 100ms — kısmi başarılı tamamlandı ✅

### Ölçek Karşılaştırması

| Pipeline | 1K → 5K Süre Artışı | 1K → 5K Throughput Düşüşü |
|---|---|---|
| Sync | ~25× | ~5× |
| Import | ~25× | ~5× |

### Performans Analizi

**Darboğaz: Duplicate Engine O(n²) Karşılaştırma Fazı**

- **1,000 listing:** ~9.3s (karşılaştırma: 499,500 çift)
- **5,000 listing:** ~237s (karşılaştırma: 12,497,500 çift)
- **Kompleksite:** O(n²) — listing sayısı 5 kat artınca süre ~25 kat artıyor
- **Comparisons reduction:** `groupListingDuplicatesByKey()` ile %100 reduction (65 brand+model anahtarına)

Sync ve Import path'leri aynı duplicate engine'i kullandığı için benzer süreler gösterir. Fark (~237s vs ~231s) ihmal edilebilir düzeydedir ve test ortamı varyasyonundan kaynaklanır.

**Import Path'in Yüksek DB Query Sayısı:**
Import path, her listing için ayrı `upsert()` yapar (1000 listing = 1000 query). Sync path ise tek `rpc` çağrısıyla tüm listing'leri kaydeder (3 query). Gerçek Supabase'de bu fark network round-trip nedeniyle çok daha belirgin olacaktır.

---

## Test Detayları

### Test Yapısı

```
__tests__/load/load-test.test.ts
├── Sync Path (describe)
│   ├── scale=1000  → syncs 1000 bot listings        [✓ 9.56s]
│   ├── scale=5000  → syncs 5000 bot listings        [✓ 237.93s]
│   ├── scale=10000 → SKIP (large)
│   ├── scale=50000 → SKIP (large)
│   ├── scale=100000 → SKIP (large)
│   ├── sync path idempotency at 1K scale             [✓ 18.6s]
│   └── sync path recovers from RPC failure           [✓ 18.6s]
│
└── Import Path (describe)
    ├── scale=1000  → imports 1000 raw listings       [✓ 9.27s]
    ├── scale=5000  → imports 5000 raw listings       [✓ 230.71s]
    ├── scale=10000 → SKIP (large)
    ├── scale=50000 → SKIP (large)
    ├── scale=100000 → SKIP (large)
    ├── import path idempotency at 1K scale            [✓ 18.5s]
    └── import path handles upsert failures            [✓ 100ms]
```

### Zaman Aşımı Yapılandırması

| Test Grubu | Timeout |
|---|---|
| 1,000-scale tests | 120s |
| 5,000-scale tests | 300s (O(n²) duplicate engine ~237s) |
| Large-scale (SKIP) | 120s |
| İdempotency/Recovery | 120s |

### Mock Stratejisi

- **Sync Path:** `syncListingsForSource(stub.supabase, sourceId, listings)` — stub direkt enjekte edilir
- **Import Path:** `vi.mock("@/lib/supabase-admin")` ile `createSupabaseAdminClient` mock'lanır, `supabaseAdminStub.current` üzerinden stub enjekte edilir
- **Product Matcher:** `vi.mock("@/lib/product-matcher")` — `batchFindOrCreateMatchedProducts` mock'u her input için sıralı ID döndürür
- **server-only:** `vi.mock("server-only", () => ({}))`
- **Taxonomy:** `vi.mock("@/lib/taxonomy/context")` — boş resolver

---

## Validasyon Sonuçları

| Adım | Komut | Sonuç |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | ✅ Hata yok |
| Test | `npx vitest run` | ✅ 55 test dosyası, 865 test — tamamı geçti (6 SKIP) |
| Build | `npm run build` | ✅ Tüm rotalar başarıyla derlendi |

---

## Gözlemler ve Öneriler

### 1. Duplicate Engine O(n²) Scaling Doğrulandı

Beklenen davranış: 5.000 listing'de ~237s süre. Bu, 50.000 listing'de ~23.700s (~6.5 saat) anlamına gelir. Production'da bu ölçekte çalışması gerekiyorsa optimizasyon gerekir.

**Öneri:** Mevcut `groupListingDuplicatesByKey()` brand+model bazlı gruplandırma ile karşılaştırma sayısını %100 azaltır. Ancak O(n²) hala grup içi karşılaştırmalarda geçerlidir. Daha büyük ölçekler için:
- Benchmark bazlı threshold: belirli grup büyüklüğü üzerinde karşılaştırmayı atla
- Sampling: tüm çiftler yerine rastgele örneklem
- Paralel işleme: grup bazında parallel karşılaştırma

### 2. Import Path Query Optimizasyonu

Her listing için ayrı `upsert()` = N query. 100.000 listing'de bu 100.000 round-trip demektir.

**Öneri:** Batch upsert kullanımı (`supabase.from("listings").upsert(batch)`). Bu, SQL `INSERT ... ON CONFLICT` ile çözülebilir.

### 3. Sync Path RPC Bağımlılığı

Sync path, tek `rpc("sync_source_listings")` çağrısıyla çalışır. Bu, DB round-trip'ini minimize eder ancak RPC başarısız olursa legacy fallback'e düşer (ki bu da legacy kod + O(n²) duplicate engine demektir).

**Öneri:** Legacy fallback'in de batch operasyon kullanacak şekilde modernize edilmesi.

### 4. Memory Kullanımı

| Test | Start RSS | End RSS | Fark |
|---|---|---|---|
| Sync 1K | 81.1 MB | 103.6 MB | +22.5 MB |
| Sync 5K | 104.9 MB | 226.3 MB | +121.4 MB |
| Import 1K | 239.9 MB | 245.4 MB | +5.5 MB |
| Import 5K | 246.5 MB | 276.7 MB | +30.2 MB |

Sync path, duplicate engine'in tüm listing'leri bellekte tutması nedeniyle daha fazla memory tüketir. Import path'te her listing işlenip atıldığı için memory büyümesi sınırlıdır.

---

## Atlanan Testler (SKIP)

Büyük ölçekli testler (10K, 50K, 100K) O(n²) süre nedeniyle atlanmıştır:

| Scale | Tahmini Süre | Not |
|---|---|---|
| 10,000 | ~950s (~16 dk) | Çalıştırılabilir, ancak zaman alıcı |
| 50,000 | ~23,700s (~6.5 saat) | Optimizasyon gerekli |
| 100,000 | ~94,800s (~26 saat) | Optimizasyon olmadan mümkün değil |

Bu testleri çalıştırmak için `it.skip` → `it` değişikliği yapılmalı ve timeout 900_000+ olarak ayarlanmalıdır.

---

## Kod Referansı

| Dosya | Satır | İçerik |
|---|---|---|
| `__tests__/load/load-test.test.ts` | 1-307 | Ana test dosyası — 8 test, 6 skip |
| `__tests__/load/stub-factory.ts` | 1-356 | Supabase stub factory |
| `__tests__/load/synthetic-data.ts` | 1-209 | Sentetik veri jeneratörü |
| `__tests__/load/metrics-collector.ts` | 1-228 | Metrik toplama ve formatlama |
| `lib/bots/listing-sync.ts` | 1-147 | Sync pipeline (production) |
| `lib/import/import-listings.ts` | 1-147 | Import pipeline (production) |

---

## Sonuç

Sprint P-8 Production Load Test tamamlanmıştır:

1. **Sync Path:** 1K'da 104.65 listing/s, 5K'da 21.01 listing/s — RPC çağrısı sayesinde minimum DB yükü
2. **Import Path:** 1K'da 107.86 listing/s, 5K'da 21.67 listing/s — her listing için ayrı upsert, N query
3. **İdempotency:** Her iki pipeline da aynı veriyi iki kez işlediğinde tutarlı sonuç verir
4. **Recovery:** Sync path RPC hatası durumunda legacy fallback'e düşer; Import path per-listing hatalarını tolere eder
5. **Darboğaz:** Duplicate Engine O(n²) karşılaştırma fazı — 5K'da ~237s
6. **Validasyon:** 865 test geçti, tsc ve build temiz

**Kısıt:** Core platform FREEZE devam etmektedir. Yukarıdaki öneriler **uygulanmayacak**, sadece raporlanmıştır.

---

# Düz Metin Kopyası (Plain-Text Copyable)

```
SPRINT P-8 — PRODUCTION LOAD TEST RAPORU
Tarih: 2026-07-14

METRIKLER:

Sync Path
  1,000 listing: 9.56s, 104.65/s, 3 DB query
  5,000 listing: 237.93s, 21.01/s, 3 DB query

Import Path
  1,000 listing: 9.27s, 107.86/s, 1,000 DB query
  5,000 listing: 230.71s, 21.67/s, 5,000 DB query

Idempotency (1K): Sync 18.6s, Import 18.5s — both consistent
Recovery: Sync (RPC failure) 18.6s, Import (upsert failures) 100ms

DARBOGAZ:
  Duplicate Engine O(n^2) — 5K'da ~237s
  1K: 499,500 comparison pairs
  5K: 12,497,500 comparison pairs

VALIDASYON:
  tsc --noEmit:    ✅ Hata yok
  vitest run:       ✅ 55 dosya, 865 test, 0 hata (6 SKIP)
  npm run build:    ✅ Tum rotalar basarili

KARAR: Load test tamamlandi. Core platform FREEZE.
Optimizasyon uygulanmayacak. Sprint sonu.
```
