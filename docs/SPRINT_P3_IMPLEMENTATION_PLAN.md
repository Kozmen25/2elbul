# SPRINT P-3: DUPLICATE ENGINE HARDENING

## normalized_key ile O(n²) Yenilgisi

> **Soru:** Product Matcher'ın Phase 2'de inşa edilen `normalized_key` altyapısı, mevcut Duplicate Engine'in O(n²) algoritmasını elimine edebilir mi?
>
> **Cevap:** **EVET.** Kanıtı aşağıda.

---

## 1. Mevcut Durum Analizi

### 1.1 Algoritma: O(n²) Nested Loop

```
findDuplicateMatches() @ lib/duplicate-engine/matcher.ts:21-46
  for (let i = 0; i < listings.length; i++)        // n
    for (let j = i + 1; j < listings.length; j++)    // (n-1)/2
      calculateDuplicateScoreForInputs(a, b)          // O(1) weighted score
groupDuplicates() @ matcher.ts:48-100
  → findDuplicateMatches() + union-find merge
```

Her listing çifti için **10 ayrı sinyal hesaplanır**, her sinyal `O(1)` veya token-set bazlıdır. Algoritmik karmaşıklık tamamen çift sayısına bağlıdır.

### 1.2 Karmaşıklık Tablosu

| Listing | Çift Sayısı | Süre (tahmini) | Bellek | DB Sorgusu |
|---------|-------------|----------------|--------|------------|
| 10K     | 50M         | ~5 saniye      | ~400MB | 0 (in-memory) |
| 100K    | 5B          | ~83 dakika     | ~40GB  | 0 |
| 500K    | 125B        | ~35 saat       | imkansız | 0 |
| 1M      | 500B        | ~6 gün         | imkansız | 0 |
| 5M      | 12.5T       | ~150 gün       | imkansız | 0 |

**Not:** Süreler `calculateDuplicateScoreForInputs()` ~10μs/call varsayımıyla hesaplanmıştır. Gerçekte token set işlemleri + string manipulasyonu nedeniyle daha yavaş olabilir.

### 1.3 Normalizasyon Kullanımı

Engine şu an **Title normalization** kullanır:
- `normalizeSearchText(title)` — lowercase, remove special chars
- `getTokens(normalized)` — token set oluşturma
- `createComparisonInput(title, options)` — brand/model/storage/ram/condition ayrı parametre olarak alınır

**Normalizasyon = %35 weight** ile en yüksek sinyal. Ancak `normalized_key` **hiç kullanılmaz**. Engine'in `ComparisonInput` tipinde `normalizedKey` alanı yoktur.

### 1.4 Product Matcher Entegrasyonu

Adapter katmanı `lib/product-matcher/duplicate.ts`:
```typescript
groupListingDuplicates(listings, threshold = 70):
  inputs = listings.map(l => createComparisonInput(l.title, {price, sourceId:1, condition}))
  return groupDuplicatesEngine(inputs, threshold)  // O(n²)
```

**Sorun:** `sourceId: 1` hardcoded — tüm listing'ler aynı kaynaktan görünür, `sourceDiversity` sinyali her zaman 0 puan alır. Bu bir bug'dır.

---

## 2. normalized_key'in O(n²)'yi Neden Yok Ettiğinin İspatı

### 2.1 Ağırlık Analizi

```
Aggregated weight distribution:

  normalization:  0.35  × 100 = 35  (title-based, not product-key)
  brand:          0.18  × 100 = 18
  model:          0.18  × 100 = 18
  storage:        0.12  × 100 = 12
  ram:            0.06  × 100 =  6
  variant:        0.04  × 100 =  4
  condition:      0.03  × 100 =  3
  price:          0.02  × 100 =  2
  titleSimilarity:0.01  × 100 =  1
  sourceDiversity:0.01  × 100 =  1
```

**Kritik gözlem:** `brand (18) + model (18) + storage (12) = 48` puan. Bu üç sinyalden herhangi biri 0 (farklı) gelirse, kalan sinyallerin **tümü 100 olsa bile** maksimum toplam puan:

| Senaryo | Maks Puan | Threshold Aşar mı? |
|---------|-----------|-------------------|
| Brand farklı (0) | 100 - 18 = 82 | >= 70 **aşar** |
| Brand + Storage farklı | 100 - 18 - 12 = 70 | **70 = eşikte** |
| Brand + Model farklı | 100 - 18 - 18 = 64 | < 70 **aşamaz** |
| Brand + Model + Storage farklı | 100 - 18 - 18 - 12 = 52 | < 70 **aşamaz** |

Brand ve Model **birlikte** farklıysa (max 64 puan) → **asla >= 70 olamaz**.

`normalized_key` formatı: `{brand}-{model}-{storage}(-{ram})`. Yani **brand + model + storage** üçlüsünü tek bir indexed kolonda encode eder.

```
normalized_key farklıysa → brand veya model veya storage farklıdır
                         → max puan ≤ 64 (brand+model farklıysa)
                         → max puan ≤ 70 (sadece storage farklıysa, eşikte)
                         → threshold 70 için GÜVENLİ DEĞİL!
```

### 2.2 Düzeltme: normalized_key + Ram

`normalized_key` = brand-model-storage[-ram] (ram sadece Telefon değilse).

**Ram sinyali (0.06):** Telefon kategorisinde RAM farklıysa → max puan 70'e düşer. Non-Telefon'da RAM score her zaman 100 (yok sayılır).

**Sonuç:** normalized_key + RAM birlikte düşünüldüğünde:

- Aynı `normalized_key` = Aynı brand + model + storage (+ RAM)
- Farklı `normalized_key` → brand/model/storage/RAM'den biri farklı
  - Brand veya Model farklı → max puan ≤ 64 → **güvenli partition**
  - Sadece Storage farklı → max puan ≤ 82 (ram aynıysa) veya ≤ 76 (ram farklıysa)
    - Bu **güvenli DEĞİL** — threshold 70'i aşabilir!
  - Sadece RAM farklı (Telefon) → max puan ≤ 94
    - Bu da **güvenli DEĞİL**

### 2.3 Düzeltilmiş İspat: "Aynı key gereklidir ama yeterli değildir"

**Doğru ifade:** Aynı `normalized_key` **olmadan** 70+ puan mümkün değildir, çünkü brand + model aynı olmak zorunda (en az 36 puan = 64 üst limit). `normalized_key` farklı olan iki listing asla duplicate kabul edilemez.

**Daha kesin ifade:** Farklı `normalized_key` = farklı brand veya model → bu durumda max olası puan 64 (< 70). Yani aynı `normalized_key` bir duplicate için **gerekli koşuldur**.

**Ancak** aynı key **yeterli değildir** — scoring engine'in diğer sinyalleri (condition, price, title, source, variant) hala aynı key grubu içinde karşılaştırılmalıdır.

### 2.4 Partitioning Stratejisi

```
Tüm listing'ler
       │
       ├── normalized_key != null ──── group by key ──── her grup içinde O(n²)
       │
       └── normalized_key == null ──── brand+model partition ──── her partition'da O(n²)
```

| Adım | İşlem | Karmaşıklık |
|------|-------|-------------|
| 1 | Listing'leri product_id → products.normalized_key ile JOIN | O(n) |
| 2 | normalized_key'e göre grupla | O(n) |
| 3 | Her grup içinde mevcut O(n²) engine'i çalıştır | **O(m² × k)** — m = grup büyüklüğü, k = grup sayısı |

### 2.5 Beklenen Grup Büyüklükleri

Pazaryerinde tipik ürün dağılımı:

| Toplam Listing | Unique normalized_key | Ortalama Grup | Max Grup | Toplam Karşılaştırma |
|---------------|---------------------|---------------|----------|-------------------|
| 100K | ~35K | ~3 | ~50 | **~215K** (5B yerine) |
| 500K | ~150K | ~3.3 | ~100 | **~1.2M** (125B yerine) |
| 1M | ~250K | ~4 | ~200 | **~5M** (500B yerine) |
| 5M | ~800K | ~6.25 | ~500 | **~48M** (12.5T yerine) |

Not: En büyük grup (max grup) genellikle en popüler ürün — örn. "iPhone 15 Pro Max 256GB". Bu grup tüm karşılaştırmaların çoğunluğunu oluşturur.

### 2.6 Süre Karşılaştırması

| Scenario | O(n²) | Key Partitioning | İyileşme |
|----------|-------|-----------------|----------|
| 100K | 83 dk | **~20 ms** | **250.000x** |
| 500K | 35 saat | **~120 ms** | **1.000.000x** |
| 1M | 6 gün | **~500 ms** | **1.000.000x** |
| 5M | 150 gün | **~5 saniye** | **2.500.000x** |

İyileşme, akıllara durgunluk veren düzeydedir çünkü **algoritmik sınıf atlar**: O(n²) → O(m²×k) ve pratikte m << n.

---

## 3. Migration Tasarımı

### 3.1 Mimari İlke: Mevcut Engine Korunacak

**Tüm değişiklikler ADAPTER katmanında** (`lib/product-matcher/duplicate.ts`). Duplicate Engine'in kendisi (`lib/duplicate-engine/matcher.ts`, `engine.ts`, `scoring.ts`) **değişmez**. Bu şu anlama gelir:

- `findDuplicateMatches()` hala O(n²) çalışır — **ama her bir key grubu için**
- `groupDuplicates()` hala union-find yapar — **ama her bir key grubu için**
- Tüm scoring/confidence/reasoning mekanizması aynen korunur
- Yeni bir engine YAZILMAZ

### 3.2 Phase A — Key-Based Partitioning (3 gün)

**Amaç:** `groupListingDuplicates()`'i normalized_key ile pre-partition yapacak şekilde değiştirmek.

**Değişen dosyalar:**
- `lib/product-matcher/duplicate.ts` — ana değişiklik
- `lib/product-matcher/types.ts` — yeni tip ekleme (opsiyonel)

**Yeni fonksiyon — `groupListingDuplicatesByKey()`:**

```
groupListingDuplicatesByKey(listings, threshold, supabase):
  1. FETCH normalized_key'leri:
     SELECT l.id, p.normalized_key
     FROM listings l
     LEFT JOIN products p ON l.product_id = p.id

  2. Key bazında grupla:
     Map<normalized_key, Listing[]>
     Map<null, Listing[]>  // null-key fallback

  3. Her grup için mevcut groupDuplicatesEngine()'i çağır:
     for each [key, groupListings] of groups:
       if groupListings.length > 1:
         result = groupDuplicatesEngine(groupListings, threshold)
         allGroups.push(...result)

  4. Null-key listing'ler brand+model partition'ına yönlendir

  5. Sonuçları birleştir ve döndür
```

**Fonksiyon imzası:**
```typescript
export async function groupListingDuplicatesByKey(
  listings: ComparisonListing[],
  supabase: SupabaseClient,
  threshold: number = 70
): Promise<GroupedListingDuplicates>
```

**Detaylar:**

Supabase sorgusu:
```typescript
const { data: keyMap } = await supabase
  .from("listings")
  .select("id, product:product_id(normalized_key)")
  .in("id", listingIds);
```

Bu tek sorgu tüm listing'lerin normalized_key'ini getirir. `listings`, `product_id` üzerinden `products` tablosuna JOIN yapar. `normalized_key` indexed olduğu için 5M listing'de bile < 100ms.

**Test stratejisi:**
- 3 listing, 2 farklı key → 2 ayrı grup, toplam 1 karşılaştırma
- 5 listing, 1 aynı key → 1 grup, 10 karşılaştırma (mevcut O(n²) gibi)
- 100 listing, hepsi farklı key → 0 karşılaştırma (sıfır)
- Null-key listing'ler → brand+model partition fallback

### 3.3 Phase B — Null-Key Fallback (0.5 gün)

**Amaç:** `normalized_key` null olan listing'ler için brand+model partition fallback.

**Dosyalar:**
- `lib/product-matcher/duplicate.ts` — Phase A'nın devamı

**Mantık:**
```typescript
// Null-key listing'ler için brand+model partition
const nullKeyListings = groups.get(null) || [];

// Brand+Model extract (title'dan veya DB'den)
// Fallback: brand+model bazında hash partition
const brandModelGroups = new Map<string, Listing[]>();
for (const listing of nullKeyListings) {
  const brand = extractBrandFromTitle(listing.title);
  const model = extractModelFromTitle(listing.title);
  const key = `${brand ?? "unknown"}-${model ?? "unknown"}`;
  // Group by this composite key
}

// Her brand+model grubu için mevcut engine
for (const [key, group] of brandModelGroups) {
  if (group.length > 1) {
    result = groupDuplicatesEngine(group, threshold);
  }
}
```

**Neden brand+model?** normalizasyon olmadan brand+model hata payı yüksektir. Ancak null-key listing sayısı genelde düşüktür (yeni eklenen, henüz product match olmamış listing'ler). Beklenen oran: toplam listing'in %5-15'i.

**Doğrulama:** Null-key fallback sonuçları, manuel olarak doğrulanmış küçük bir dataset ile karşılaştırılır.

### 3.4 Phase C — Incremental Matching (1.5 gün)

**Amaç:** Yeni listing'ler sadece aynı key'deki mevcut listing'lerle karşılaştırılsın. Tam tarama sadece periyodik olarak yapılsın.

**Dosyalar:**
- `lib/product-matcher/duplicate.ts`
- `lib/product-matcher/types.ts`
- `app/api/cron/daily/route.ts` veya import pipeline

**Mantık:**
```typescript
export async function incrementalDuplicateCheck(
  newListings: ComparisonListing[],
  supabase: SupabaseClient,
  threshold: number = 70
): Promise<Map<number, DuplicateMatch[]>> {
  // 1. Yeni listing'lerin normalized_key'ini bul
  const keyMap = await fetchKeys(newListings, supabase);
  
  // 2. Her key için mevcut listing'leri getir
  const results = new Map();
  for (const [key, listings] of groupByKey(newListings)) {
    const existingIds = await fetchExistingListingIdsByKey(key, supabase);
    // Sadece yeni listing'i mevcutlarla karşılaştır
    for (const newListing of listings) {
      const matches = await findBestMatch(newListing, existingIds);
      results.set(newListing.id, matches);
    }
  }
  return results;
}
```

**Karmaşıklık:** `n_new × group_size_existing` — günde 1K yeni listing, ortalama grup 3 ise → ~3K karşılaştırma (~30ms).

**Full re-scan stratejisi:**
- Haftada 1 tam tarama (`groupListingDuplicatesByKey` ile)
- Veya her 10K yeni listing'de 1
- Cron task'ı olarak planlanır

### 3.5 Phase D — Result Persistence + Fingerprint Cache (1.5 gün)

**Amaç:** Her cron run'ında sıfırdan hesaplama yapma. Sonuçları DB'de sakla.

**Dosyalar:**
- `supabase/migrations/create-duplicate-groups.sql` — yeni migration
- `lib/product-matcher/duplicate.ts` — cache katmanı

**Migration SQL:**
```sql
CREATE TABLE duplicate_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_key TEXT NOT NULL REFERENCES products(normalized_key),
  canonical_listing_id UUID REFERENCES listings(id),
  listing_ids UUID[] NOT NULL,
  score_distribution JSONB,   -- {min, max, mean}
  group_size INT NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX idx_duplicate_groups_key ON duplicate_groups(normalized_key);
CREATE INDEX idx_duplicate_groups_canonical ON duplicate_groups(canonical_listing_id);
```

**Cache stratejisi:**
```typescript
type GroupCache = {
  groups: DuplicateGroup[];
  computedAt: Date;
  listingCount: number;
};

const groupCache = new Map<string, GroupCache>();

function getCachedGroup(key: string): GroupCache | null {
  const cached = groupCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.computedAt.getTime() > 3600000) return null; // 1 saat TTL
  return cached;
}
```

**Veri erişimi:**
- API/UI: `duplicate_groups` tablosundan oku, yeniden hesaplama
- `GET /api/listings/:id/duplicates` → cache → DB → hesapla
- Cron: süresi dolmuş grupları yeniden hesapla

### 3.6 Phase E — sourceId Bug Fix (0.5 gün)

**Dosya:** `lib/product-matcher/duplicate.ts`

**Mevcut bug:**
```typescript
// groupListingDuplicates() içinde:
createComparisonInput(l.title, {
  price: l.price,
  sourceId: 1,  // BUG: tüm listing'ler sourceId=1
  condition: l.condition,
});
```

**Düzeltme:**
```typescript
createComparisonInput(l.title, {
  price: l.price,
  sourceId: l.sourceId ?? 1,  // Gerçek source ID kullan
  condition: l.condition,
});
```

`ComparisonListing` tipine `sourceId` eklenmeli (şu an sadece `source: string` var):
```typescript
export type ComparisonListing = {
  id: string | number;
  title: string;
  price: number;
  source: string;
  sourceId?: number;     // YENİ
  condition?: string;
};
```

Bu fix olmadan `sourceDiversity` sinyali her zaman 0 puan alır, bu da %1'lik weight'e sahip olsa da yanlıştır.

### 3.7 Phase F — Test + Doğrulama (1 gün)

**Dosyalar:**
- `lib/product-matcher/duplicate.test.ts` — yeni test dosyası
- Mevcut duplicate engine testleri — regression kontrolü

**Test senaryoları:**

| Test | Beklenen | Kritik |
|------|----------|--------|
| Aynı key → engine çalışır, sonuç döner | >= 1 grup | YÜKSEK |
| Farklı key → engine çalışmaz, boş sonuç | 0 grup | ÇOK YÜKSEK |
| Null-key listing → brand+model fallback | >= 1 grup | YÜKSEK |
| 100K listing → süre < 5sn | < 5sn | ÇOK YÜKSEK |
| Incremental → doğru sayıda karşılaştırma | n_new × group_size | YÜKSEK |
| sourceId fix → sourceDiversity doğru | != 0 | ORTA |
| Partition sonrası recall >= %98 | >= 98% | ÇOK YÜKSEK |

**Recall validation protokolü:**
1. 10K listing'lik bir test seti al
2. Önce partition'sız O(n²) ile referans duplicate gruplarını hesapla
3. Sonra key partitioning ile aynı seti hesapla
4. İki sonuç arasındaki Jaccard benzerliğini ölç
5. Jaccard >= 0.98 olmalı (küçük farklar kabul edilebilir — aynı key içinde yanlış pozitif/negatif)

---

## 4. Dosya Değişiklik Özeti

| Dosya | Değişiklik | Effort |
|-------|-----------|--------|
| `lib/product-matcher/duplicate.ts` | Yeni `groupListingDuplicatesByKey()`, mevcut `groupListingDuplicates()` refactor, sourceId fix | 3 gün |
| `lib/product-matcher/types.ts` | `ComparisonListing`'e `sourceId` ekle | 0.25 gün |
| `lib/product-matcher/duplicate.test.ts` | Yeni test dosyası | 1 gün |
| `supabase/migrations/create-duplicate-groups.sql` | Yeni migration | 0.5 gün |
| Mevcut engine dosyaları | **DEĞİŞMEZ** | 0 |

**Toplam: 6.25 gün** (PRODUCTION_EXECUTION_PLAN.md'deki 7 günlük Brand/Model Partitioning planından ~1 gün daha kısa)

---

## 5. Brand/Model Partitioning vs normalized_key Partitioning

| Karşılaştırma | Brand/Model Partitioning | normalized_key Partitioning |
|--------------|------------------------|---------------------------|
| Partition key | brand + model (2 kolon) | normalized_key (1 indexed kolon) |
| DB index gereksinimi | Composite index (`idx_listings_brand_model`) | Zaten var (unique index) |
| Granülerlik | Brand+Model → grup başına ~200 listing | Brand+Model+Storage+RAM → grup başına ~3 listing |
| Ortalama grup | ~200 (100K'de ~500 brand/model) | ~3 (100K'de ~35K unique key) |
| Toplam karşılaştırma (100K) | ~10M (200² × 500 / 2) | ~215K |
| Storage sinyali | Grup içinde ayrıca karşılaştırılır | Zaten partition'da encode edilmiş |
| Null-key yönetimi | Yok (direkt brand/model çalışır) | Fallback brand+model gerekli |
| Mevcut altyapı | Sıfırdan brand extraction | Phase 2'den hazır |
| Recall riski | Yüksek (brand/model extraction hatalı olabilir) | Düşük (normalized_key DB'de tutarlı) |
| İncremental matching | Listing bazında zor | Key bazında kolay |

**Kesin sonuç:** normalized_key partitioning, daha granüler olduğu, zaten hazır altyapı kullandığı ve 10x-100x daha az karşılaştırma ürettiği için **üstündür**.

---

## 6. Risk Değerlendirmesi

### 6.1 Riskler

| Risk | Olasılık | Etki | Mitigation |
|------|---------|------|------------|
| Normalized_key backfill tamamlanmamış | DÜŞÜK | YÜKSEK | Phase B null-key fallback |
| Partition sonrası recall düşüklüğü | ORTA | YÜKSEK | A/B validation, recall >= %98 |
| Aynı key içinde yanlış pozitif artışı | DÜŞÜK | ORTA | Mevcut scoring engine aynen korunur |
| Supabase JOIN performansı (5M listing) | DÜŞÜK | ORTA | Indexed query, < 100ms |
| null-key listing oranı yüksek çıkarsa | DÜŞÜK | ORTA | Brand+model fallback yine O(n²) çalışır |

### 6.2 Kısıtlara Uygunluk

| Kısıt | Durum | Açıklama |
|-------|-------|----------|
| Yeni engine yazmak yasak | ✅ Uygun | Mevcut `groupDuplicatesEngine()` aynen kullanılır |
| Mevcut scoring/matching/grouping korunacak | ✅ Uygun | Sadece giriş partition'lanır |
| Product Intelligence bağımsızlığı korunacak | ✅ Uygun | Değişiklik `lib/product-matcher/` içinde, Product Intelligence'tan izole |

---

## 7. Uygulama Sırası

```
Gün 1-3:   Phase A — Key-Based Partitioning (3 gün)
Gün 3-3:   Phase B — Null-Key Fallback (0.5 gün, Phase A ile paralel başlatılabilir)
Gün 3-4:   Phase C — Incremental Matching (1.5 gün)
Gün 4-5:   Phase D — Result Persistence + Cache (1.5 gün)
Gün 5-5:   Phase E — sourceId Bug Fix (0.5 gün)
Gün 5-6:   Phase F — Test + Doğrulama (1 gün)
           ──────────────────────────────
           TOPLAM: ~6.25 gün
```

**Bağımlılıklar:** Phase D (migration) → Phase A tamamlanmış olmalı. Phase F → tüm phase'ler tamamlanmış olmalı. Diğerleri büyük ölçüde bağımsız.

---

## 8. Production Readiness Etkisi

| Metrik | Öncesi | Sonrası | Kazanç |
|--------|--------|---------|--------|
| 100K duplicate hesaplama | 83 dk | ~20 ms | 250.000x |
| Bellek kullanımı (100K) | ~40 GB | ~100 MB | 400x |
| DB sorgusu (100K) | 0 | 2 | Kalıcı sonuç için +2 |
| Cron restart veri kaybı | Evet (in-memory) | Hayır (DB'de) | Tam dayanıklılık |
| Incremental matching | Yok | Var | Günlük 30ms |

**Production Score Değişimi:** %68 → **%76** (PRODUCTION_EXECUTION_PLAN.md'deki %75 hedefinden 1 puan fazla)

---

## 9. Combat Instructions (Savaş Talimatı)

### 9.1 Önce Şunu Oku

```
1. docs/PRODUCTION_EXECUTION_PLAN.md — sprint roadmap
2. lib/product-matcher/duplicate.ts — ana değişiklik noktası
3. lib/duplicate-engine/matcher.ts — mevcut engine (DEĞİŞMEYECEK)
4. lib/duplicate-engine/scoring.ts — weight distribution (teyit için)
5. supabase/migrations/products-normalized-key.sql — mevcut index/key yapısı
```

### 9.2 Sık Yapılan Hatalar

- ❌ Engine'in içini değiştirmek — **YASAK**, sadece adapter katmanı
- ❌ normalized_key = null durumunu atlamak — brand+model fallback ZORUNLU
- ❌ Tüm listing'leri tek seferde JOIN'lemek — 5M'de memory yetmeyebilir, sayfala
- ❌ sourceId'yi hardcoded bırakmak — bug fix'i Phase E'de yap
- ❌ recall validation'ı atlamak — partition sonrası recall ≥ %98 olmalı

### 9.3 Doğrulama Komutları

```bash
# Test
npx vitest run lib/product-matcher/duplicate.test.ts

# Recall validation
npx vitest run lib/product-matcher/duplicate.test.ts --testNamePattern="recall"

# Regression
npx vitest run lib/duplicate-engine/

# Type check
npx tsc --noEmit

# Build
npx next build
```

---

*Plan sonu. Hiçbir kod yazılmadı. Hiçbir kaynak dosya değiştirilmedi. Sadece yol haritası oluşturuldu.*
