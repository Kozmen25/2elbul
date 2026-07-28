# Sprint P-2 — Product Matcher Hardenma Planı

> **Hedef:** Product Matcher'i massive production data'ya hazır hale getirmek
> **Süre:** 5 iş günü
> **Mevcut Skor:** %62 → **Hedef Skor:** %68
> **Dil:** Türkçe (dökümantasyon), İngilizce (commit mesajları)

---

## 1. Mevcut Mimari

### 1.1 Katmanlı Yapı

```
Client (app/)                    API (app/api/)                 Business Logic (lib/)
─────────────────────────────────────────────────────────────────────────────────────
app/admin/import/actions.ts  →  ─  →  lib/product-matcher/
                                       ├── index.ts          (barrel export)
                                       ├── matcher.ts         (core: dryRun + findOrCreate)
                                       ├── repository.ts      (DB queries)
                                       ├── signals.ts         (signal extraction + key gen)
                                       ├── canonical.ts       (canonical name builder)
                                       ├── confidence.ts      (confidence engine bridge)
                                       ├── helpers.ts         (norm re-export + utilities)
                                       ├── duplicate.ts       (duplicate detection)
                                       ├── summary.ts         (duplicate summary)
                                       └── types.ts           (type definitions)
```

### 1.2 Dosya Sorumlulukları

| Dosya | Uzunluk | Sorumluluk |
|-------|---------|------------|
| `matcher.ts` | 151 satır | `dryRunProductMatch()`, `findOrCreateMatchedProduct()`, `prepareMatcherState()` |
| `repository.ts` | 41 satır | `findExistingMatchedProduct()` — **LIMIT 2000 burada** |
| `signals.ts` | 147 satır | `extractProductSignals()`, `generateProductKey()` |
| `canonical.ts` | 36 satır | `createCanonicalProductName()` |
| `confidence.ts` | 30 satır | `buildProductConfidenceMetadata()` — confidence engine bridge |
| `helpers.ts` | 33 satır | `normalizeProductTitle` re-export, `isDuplicateError()`, utilities |
| `duplicate.ts` | 86 satır | `detectListingDuplicates()`, `groupListingDuplicates()` |
| `summary.ts` | 56 satır | `summarizeDuplicateGroups()` |
| `types.ts` | 89 satır | Tüm type definitions |
| `index.ts` | ~10 satır | Barrel exports |

### 1.3 Bağımlılık Grafiği

```
matcher.ts ──→ repository.ts (DB)
             ──→ signals.ts (extraction + key gen)
             ──→ canonical.ts (name builder)
             ──→ confidence.ts (confidence engine)
             ──→ helpers.ts (normalizeProductTitle, isDuplicateError)

repository.ts ──→ signals.ts (generateProductKey for fallback scan)

signals.ts ──→ normalization engine (brand extraction via normalizeProductTitle)
            ──→ taxonomy resolver (category resolution)

confidence.ts ──→ confidence engine pipeline
```

### 1.4 Harici Bağımlılıklar

- **Supabase**: `products` tablosu (`id, name, category` kolonları)
- **Normalizasyon Engine**: `lib/normalization` → `normalizeProductTitle`
- **Confidence Engine**: `lib/confidence-engine` → `buildProductMatcherConfidenceInput → calculateConfidence → toConfidenceMetadata`
- **Duplicate Engine**: `lib/duplicate-engine` → `compareListings`, `groupDuplicatesEngine`
- **Taxonomy Resolver**: `lib/taxonomy` → kategorik sinyal çözümleme

---

## 2. Mevcut Çalışma Akışı

### 2.1 `findOrCreateMatchedProduct()` — Tam Akış

```
1. prepareMatcherState(title, productName, resolver)
   ├── combineTitle = productName + " " + title
   ├── normalizeProductTitle(combinedTitle)
   ├── extractProductSignals(combinedTitle, resolver)
   │   ├── normalizeProductTitle (brand extraction)
   │   ├── Model regex (iPhone/Samsung/... pattern match)
   │   ├── Storage regex (64GB-1TB)
   │   ├── RAM regex
   │   ├── Color extraction (29 renk)
   │   ├── Category resolver
   │   └── normalizedKey = [brand,model,storage,ram].join("-")
   └── createCanonicalProductName(signals, fallback)

2. buildProductConfidenceMetadata(signals, context)
   └── confidence-engine pipeline

3. findExistingMatchedProduct(supabase, canonicalName, canonicalKey)
   ├── Query 1: SELECT id, name, category FROM products WHERE name = $1
   │            (exact match — indexed, O(1))
   ├── If found → return (early exit)
   └── Query 2: SELECT id, name, category FROM products LIMIT 2000
                (fallback scan — NO WHERE clause, NO index)
       └── Client-side: Array.find(k => generateProductKey(k.name) === canonicalKey)
           (O(n) linear scan on up to 2000 rows)

4. If matched → return (existing product found)
   If NOT matched:
   ├── INSERT INTO products (name, category) VALUES (...)
   ├── If error.code === "23505" (duplicate key):
   │   └── SELECT id, name FROM products WHERE name = $1 .maybeSingle()
   └── Return created product

   Query count per call: 1-4 DB queries
   - Best case: 1 query (exact match found)
   - Normal case: 2 queries (exact miss → fallback scan → hit)
   - Insert case: 2-4 queries (exact miss → fallback miss → insert → [retry if 23505])
```

### 2.2 `dryRunProductMatch()` — Akış

```
1. prepareMatcherState (same as above)
2. findExistingMatchedProduct (same DB queries)
3. Return result with confidence metadata (no DB writes)
```

### 2.3 Çağrı Noktaları (Entry Points)

| Çağrı Noktası | Dosya:SATIR | Fonksiyon | Başına Çağrı | Batch Boyutu |
|--------------|------------|-----------|-------------|-------------|
| Import pipeline | `lib/import/import-listings.ts:85` | `findOrCreateMatchedProduct` | Her listing için 1 | 500 (max) |
| Bot sync | `lib/bots/listing-sync.ts:381` | `findOrCreateMatchedProduct` | Her listing için 1 | 200-1000 |
| Instant bot search | `app/api/search/instant-bot/route.ts:421` | `findOrCreateMatchedProduct` | Her listing için 1 | 3-10 |
| Cron search queue | `app/api/cron/process-search-queue/route.ts:445` | `findOrCreateMatchedProduct` | Her listing için 1 | 20 |
| Admin import | `app/admin/import/actions.ts:115` | `findOrCreateMatchedProduct` | Her listing için 1 | 500 (max) |
| Admin test | `app/api/admin/product-matcher-test/route.ts:35` | `dryRunProductMatch` | Request başına 1 | 1 |

### 2.4 Veri Akış Şeması

```
                     ┌─────────────────────────────┐
                     │      Caller (per-listing)    │
                     │  import / bot / search / cron│
                     └──────────────┬──────────────┘
                                    │ title, productName
                                    ▼
                     ┌─────────────────────────────┐
                     │    prepareMatcherState()     │
                     │  normalize + signals + key   │
                     └──────────────┬──────────────┘
                                    │ canonicalName, canonicalKey
                                    ▼
                     ┌─────────────────────────────┐
                     │  findExistingMatchedProduct()│
                     │  ┌─ Exact match (indexed)    │
                     │  └─ LIMIT 2000 scan (unindex)│
                     └──────────────┬──────────────┘
                          ┌────────┴────────┐
                          ▼                 ▼
                     FOUND ✅           NOT FOUND ❌
                                          │
                                          ▼
                          ┌─────────────────────────┐
                          │  INSERT + 23505 retry    │
                          └──────────┬──────────────┘
                                     ▼
                          ┌─────────────────────────┐
                          │   Return MatchedProduct  │
                          └─────────────────────────┘
```

---

## 3. Mevcut Darboğazlar

### 3.1 Bottleneck #1 — LIMIT 2000 Fallacy (KRİTİK)

**Lokasyon:** `lib/product-matcher/repository.ts:27`
**Kod:** `.limit(2000)` sonra `Array.find()` ile `generateProductKey` eşleştirmesi
**Problem:**
- `products` tablosunda ~50.000 satır olduğunu varsayarsak, LIMIT 2000 sadece %4'ünü tarar
- Doğru eşleşme 2001-50000 arasındaysa → false negative → duplicate product oluşturulur
- `SELECT`'te `WHERE` koşulu yok — tüm tabloyu memory'ye çekmeye çalışır, Supabase sadece 2000 satır döndürür
- `Array.find()` her seferinde `generateProductKey(product.name)` çağırır → her fallback scan'de her row için regex + string işlemesi yapılır
- **Sonuç:** Product matcher'ın en kritik bug'ı. İsme tam eşleşme başarısız olduğunda doğru ürünü bulma şansı %4.

### 3.2 Bottleneck #2 — N+1 Query Pattern

**Lokasyon:** Tüm caller'larda per-listing döngüsü
**Problem:**
- 5 caller'ın tamamı `findOrCreateMatchedProduct()`'ı listing başına 1 kez çağırır
- Her çağrı 1-4 DB sorgusu yapar
- 500 listing import = 500-2000 DB sorgusu
- Bot sync 1000 listing = 1000-4000 DB sorgusu
- **Sonuç:** Her import/sync işlemi gereksiz yere çok sayıda round-trip yapar

### 3.3 Bottleneck #3 — Sıfır Önbellekleme

**Lokasyon:** Matcher state'te hiçbir cache yok
**Problem:**
- Aynı `canonicalKey` dakikalar içinde birden fazla kez sorgulanabilir
- Her çağrı baştan: normalize → signal extract → canonical name → DB query
- Aynı ürün adı (örn. "iPhone 16 Pro Max 256GB") 10 listing'de geçiyorsa, 10 kez aynı işlem tekrarlanır
- **Sonuç:** Tekrarlı iş CPU ve DB kaynağı israfı

### 3.4 Bottleneck #4 — Full Processing Per Call

**Lokasyon:** `prepareMatcherState()` her çağrıldığında
**Problem:**
- `normalizeProductTitle` her çağrıda regex pipeline'ından geçer
- `extractProductSignals` her çağrıda tüm regex pattern'larını dener
- `generateProductKey` aynı product name için aynı sonucu üretir
- Confidence engine her çağrıda pipeline'ı çalıştırır
- **Sonuç:** %80+ oranında tekrarlanan CPU işi

### 3.5 Etki Matrisi

| Bottleneck | Sıklık | DB Yükü | CPU Yükü | Data Integrity | Öncelik |
|-----------|--------|---------|----------|---------------|---------|
| LIMIT 2000 | Her fallback | Düşük | Orta | **KRİTİK** | P0 |
| N+1 Query | Her batch | **Yüksek** | Düşük | Yok | P1 |
| Zero Cache | Her çağrı | Orta | **Yüksek** | Yok | P1 |
| Full Processing | Her çağrı | Yok | Orta | Yok | P2 |

---

## 4. Root Cause Analizi

### 4.1 LIMIT 2000'in Kökeni

`repository.ts:27`'deki `.limit(2000)` muhtemelen development ortamında, products tablosunda az sayıda satır varken yazılmıştır. Erken aşamada (100-200 product) bu yaklaşım sorunsuz çalışır. Probleme dönüşmesi için products tablosunun 2000+ satıra ulaşması gerekir — bu da production'da sessizce oluşan bir bug'dır.

**Mimari neden:** Normalizasyon engine'i farklı kaynaklardan gelen ürün isimlerini aynı canonical form'a indirgeyemeyebilir. Örneğin:
- Kaynak A: "iPhone 16 Pro Max 256GB Deep Purple"
- Kaynak B: "iPhone 16 Pro Max (256 GB) - Mor"
- Normalizasyon: İkisi de "iPhone 16 Pro Max 256GB" üretmeli
- **Eğer normalizasyon başarısız olursa:** İsim farklı olur, exact match `eq("name")` bulamaz, fallback scan devreye girer

Bu da fallback scan'in _normalizasyon kusurlarını telafi etmek_ için var olduğunu gösterir — LIMIT 2000 bir güvenlik ağıdır.

### 4.2 N+1'in Kökeni

Product matcher başlangıçta tek-listing kullanımı için tasarlandı (admin test tool). Batch import/sync sonradan eklendiğinde, mevcut API tekrarlı çağrılacak şekilde kullanıldı. Batch endpoint hiç eklenmedi.

### 4.3 Cache'sizliğin Kökeni

Cache ihtiyacı ancak yüksek sayıda tekrarlı product name olduğunda ortaya çıkar. Erken aşamada her listing farklı bir ürün olduğu için cache'in değeri yoktu. Production'da aynı ürünün 10-50 farklı listing'i olması cache'i gerekli kılar.

### 4.4 Bağımlılık Zinciri (Sorunlar Birbirini Nasıl Besler)

```
Zayıf normalizasyon (farklı kaynaklar, farklı formatlar)
    │
    ▼
Exact match (eq name) başarısız
    │
    ▼
LIMIT 2000 fallback devreye girer
    │
    ├── Products >2000 ise → FALSE NEGATIVE → DUPLICATE PRODUCT
    │
    └── Products ≤2000 ise → O(n) find → yavaş ama doğru
    │
    ▼
N+1 pattern: her listing için bu süreç tekrarlanır
    │
    ▼
Cache yok: aynı product name 10 kez işlenir
```

---

## 5. Güvenli Migration Stratejisi

4 fazlı, her faz bir öncekinin üzerine inşa edilir. Her faz bağımsız olarak deploy edilebilir ve geri alınabilir.

---

### FAZ 1: In-Memory Cache (Gün 1-2)

**Hedef:** Tekrarlı `findOrCreateMatchedProduct` çağrılarında DB ve CPU yükünü azaltmak
**Risk:** En düşük — sadece cache eklenir, mevcut mantık değişmez
**Geri Alma:** Bir satırı silmek yeterli

#### Yapılacaklar:

**1.1 — matcher.ts: Cache katmanı ekle**

```typescript
// matcher.ts
const productMatchCache = new Map<string, {
  product: MatchedProduct;
  expiresAt: number;
}>();

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 dakika

function getCachedProduct(key: string): MatchedProduct | null {
  const entry = productMatchCache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    productMatchCache.delete(key);
    return null;
  }
  return entry.product;
}

function setCachedProduct(key: string, product: MatchedProduct): void {
  productMatchCache.set(key, {
    product,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}
```

**Değişiklikler:**
- `findOrCreateMatchedProduct()`: Başlangıçta `getCachedProduct(canonicalKey)` kontrolü
- Başarılı eşleşme/oluşturma sonrası `setCachedProduct(canonicalKey, result)`
- TTL: 5 dakika (canonicalKey'e göre, isme göre değil)
- Map kullanılır (LRU cache gerekmez — 5 dk TTL yeterli)
- `dryRunProductMatch()` için de aynı cache kullanılabilir (read-only)

**1.2 — `findOrCreateMatchedProduct()` güncellemesi**

```
GİRİŞ: canonicalKey hesaplandıktan sonra
  ├── getCachedProduct(canonicalKey) → varsa return
  ├── findExistingMatchedProduct (normal akış)
  ├── [success path] setCachedProduct(canonicalKey, result)
  └── return result
```

**Değiştirilen Dosyalar:**
- `lib/product-matcher/matcher.ts` (+30 satır)

**Doğrulama:**
- Aynı product name ile 2. çağrıda DB query sayısı 0 olmalı
- Test: console.log ile cache hit/miss sayısı

---

### FAZ 2: productKey Index + Fallback Kaldırma (Gün 2-3)

**Hedef:** LIMIT 2000 fallacy'yi ortadan kaldırmak
**Risk:** Orta — veritabanı migration'ı gerektirir (yeni kolon + index)
**Geri Alma:** SQL migration'ı geri almak

#### Analiz:

LIMIT 2000 fallback'ini kaldırmak için önce exact match'in başarı oranını artırmalıyız. Fallback'in var olma sebebi: farklı kaynaklardan gelen aynı ürünün farklı formatlarda yazılması. Eğer products tablosunda `normalized_key` kolonu olursa, bu key üzerinden index'li sorgu yapabiliriz.

#### Yapılacaklar:

**2.1 — products tablosuna `normalized_key` kolonu ekle**

SQL:
```sql
ALTER TABLE products ADD COLUMN normalized_key TEXT;
CREATE INDEX idx_products_normalized_key ON products (normalized_key);

-- Mevcut product'ları backfill:
UPDATE products SET normalized_key = ...; -- MD5(canonicalKey) veya direkt key
```

**2.2 — repository.ts: Fallback scan'i index'li sorguyla değiştir**

```
ESKİ:
  exact match eq("name") → miss → SELECT LIMIT 2000 → Array.find()

YENİ:
  exact match eq("name") → miss → SELECT .eq("normalized_key", canonicalKey).maybeSingle()
```

**2.3 — matcher.ts: Insert sırasında normalized_key ekle**

```
Insert payload'a normalized_key alanını ekle:
  name: canonicalName,
  normalized_key: canonicalKey,
  category: ...
```

**2.4 — 23505 duplicate retry'i güncelle**

Duplicate retry `eq("name")` yapıyordu → `eq("normalized_key")` veya `eq("name")` ile dene.

**2.5 — Cache key'i güncelle (normalized_key bazlı)**

Cache `canonicalKey` üzerinden çalışıyor — bu zaten normalized_key ile aynı. Değişiklik gerekmez.

**Değiştirilen Dosyalar:**
- `lib/product-matcher/repository.ts` (LIMIT 2000 → index'li sorgu)
- `lib/product-matcher/matcher.ts` (insert payload'a normalized_key)
- `lib/product-matcher/helpers.ts` (opsiyonel: isDuplicateError güncellemesi)
- `supabase/migrations/XXX_add_normalized_key.sql` (yeni)

**Doğrulama:**
- `eq("name")` miss → `eq("normalized_key")` hit senaryosu çalışır
- Mevcut product'larla backfill doğru çalışır
- Fallback scan tamamen kalktığında duplicate product oluşmaz

---

### FAZ 3: Batch Matching API (Gün 3-4)

**Hedef:** N+1 query pattern'ini kırmak
**Risk:** Orta — test coverage yüksek olmalı
**Geri Alma:** Caller'ları eski API'ye döndürmek

#### Yapılacaklar:

**3.1 — matcher.ts: `batchFindOrCreateMatchedProduct()` ekle**

```typescript
export async function batchFindOrCreateMatchedProduct(
  supabase: SupabaseClient,
  inputs: FindOrCreateMatchedProductInput[],
): Promise<Map<number, MatchedProduct>> {
  // 1. Her input için state + key hesapla (parallel Promise.all)
  // 2. Cache'den bulunanları ayır
  // 3. Exact match: .in("name", canonicalNames) — tek sorgu
  // 4. (FAZ 2 sonrası) Normalized key match: .in("normalized_key", missedKeys)
  // 5. Kalanlar için batch insert (birden çok row tek sorguda)
  // 6. Sonuçları cache'e yaz
  // 7. Map<index, MatchedProduct> döndür
}
```

**Batch stratejisi:**

| Adım | Sorgu | Max DB Call |
|------|-------|-------------|
| 1. Cache lookup | Yok (in-memory) | 0 |
| 2. Exact match batch | `SELECT .in("name", [...])` | 1 |
| 3. Normalized key batch | `SELECT .in("normalized_key", [...])` | 1 |
| 4. Batch insert | `INSERT INTO products VALUES (...), (...), (...)` | 1 |
| Toplam | | 3 (500 listing için eskiden 500-2000) |

**3.2 — Tek-listing wrapper'ı güncelle (opsiyonel)**

`findOrCreateMatchedProduct()` batch'i çağıracak şekilde refactor edilebilir (N=1 ile) — ama bu gerekli değil, mevcut kod çalışmaya devam eder.

**Değiştirilen Dosyalar:**
- `lib/product-matcher/matcher.ts` (+60 satır)
- `lib/product-matcher/index.ts` (yeni export)
- `lib/product-matcher/types.ts` (opsiyonel: batch input/output type)

---

### FAZ 4: Caller'ları Batch'e Geçir (Gün 4-5)

**Hedef:** N+1 kazancını gerçek production'a yansıtmak
**Risk:** Düşük — her caller ayrı ayrı test edilir
**Geri Alma:** Tek bir import satırını değiştirmek

#### Yapılacaklar:

**4.1 — import-listings.ts: Batch'e geçir**

```
ESKİ:
  for (const { index, listing } of normalizedListings) {
    const matchedProduct = await findOrCreateMatchedProduct({...});
  }

YENİ:
  const productMap = await batchFindOrCreateMatchedProduct(
    supabase,
    normalizedListings.map(({ listing }) => ({...})),
  );
  for (const [index, listing] of normalizedListings.entries()) {
    const matchedProduct = productMap.get(index);
    // ... listing insert (değişmedi)
  }
```

**4.2 — listing-sync.ts: `resolveMatchedProductIds()`'i batch'e geçir**

```
ESKİ:
  for (const listing of listings) {
    const product = await findOrCreateMatchedProduct({...});
  }

YENİ:
  const results = await batchFindOrCreateMatchedProduct(supabase, inputs);
```

**4.3 — Cron search queue ve instant bot: Batch'e geçir**

```
ESKİ:
  for (const listing of listings) {
    const productId = await ensureProduct(supabase, listing, query);
  }

YENİ:
  const productMap = await batchFindOrCreateMatchedProduct(supabase, inputs);
```

**4.4 — Admin import: Batch'e geçir**

```
ESKİ:
  for (const [index, rawRecord] of payload.entries()) {
    const matchedProduct = await findOrCreateMatchedProduct({...});
  }

YENİ:
  const productMap = await batchFindOrCreateMatchedProduct(supabase, inputs);
```

**4.5 — Admin test tool: Batch kullanmaz (tek-listing)**

Admin test tool (`product-matcher-test/route.ts`) zaten tek listing ile çalışır. Mevcut `dryRunProductMatch()` kullanılmaya devam eder. Cache otomatik olarak bu çağrıları da optimize eder.

**Değiştirilen Dosyalar:**
- `lib/import/import-listings.ts` (±5 satır)
- `lib/bots/listing-sync.ts` (±5 satır)
- `app/api/search/instant-bot/route.ts` (±5 satır)
- `app/api/cron/process-search-queue/route.ts` (±5 satır)
- `app/admin/import/actions.ts` (±5 satır)

---

## 6. Rollback Stratejisi

### FAZ 1 Rollback (In-Memory Cache)

```typescript
// Cache satırını yorumla veya sil
// productMatchCache.get, setCachedProduct, getCachedProduct çağrılarını kaldır
// Safe: DB değişikliği yok, cache sadece performans etkiler
```

**Süre:** 2 dakika
**Risk:** Yok (cache miss = normal akış)

### FAZ 2 Rollback (Normalized Key Index)

```sql
DROP INDEX IF EXISTS idx_products_normalized_key;
ALTER TABLE products DROP COLUMN IF EXISTS normalized_key;
```

Kod değişikliği:
- `repository.ts`: `.eq("normalized_key")` → `.limit(2000)` + `Array.find()` geri al
- `matcher.ts`: Insert'tan `normalized_key` alanını kaldır

**Süre:** 5 dakika
**Risk:** Düşük (SQL migration + 2 dosyada değişiklik)

### FAZ 3 Rollback (Batch API)

- `batchFindOrCreateMatchedProduct()` fonksiyonunu yorumla veya sil
- Caller'lar eski API'yi kullanmaya devam eder (değişmedikleri için)

**Süre:** 1 dakika
**Risk:** Yok (yeni fonksiyon, kimse bağımlı değil)

### FAZ 4 Rollback (Caller Migration)

Her caller için bağımsız rollback:
- Her caller'da `batchFindOrCreateMatchedProduct` → `findOrCreateMatchedProduct` döndür

**Süre:** 2 dakika/caller
**Risk:** Düşük (eski API hala çalışıyor, hiç kaldırılmadı)

### Toplam Rollback Süresi: < 10 dakika (tüm fazlar)

---

## 7. Validation Stratejisi

### 7.1 Birim Testler

| Faz | Test | Kriter |
|-----|------|--------|
| Faz 1 | Cache hit → DB query 0 | Aynı input 2. çağrıda DB'ye gitmez |
| Faz 1 | Cache TTL → expires sonra DB query | 5 dk sonra cache fresh'lenir |
| Faz 1 | Cache miss → normal akış | İlk çağrı normal çalışır |
| Faz 1 | Farklı canonicalKey → ayrı cache entry | Her key bağımsız |
| Faz 2 | normalized_key index query → doğru sonuç | eq("name") miss → eq("normalized_key") hit |
| Faz 2 | LIMIT 2000 kaldırıldı → products >2000'de doğru match | Data integrity testi |
| Faz 2 | Backfill → mevcut product'ların key'i doğru | Tüm product'lar için normalized_key dolu |
| Faz 3 | Batch: 500 input → max 3 DB call | Performans testi |
| Faz 3 | Batch: karışık hit/miss/insert | Her durum doğru sonuç |
| Faz 3 | Batch: 23505 duplicate → retry | Edge case |
| Faz 4 | Her caller → batch sonuçları doğru | Aynı output, farklı execution path |

### 7.2 Entegrasyon Testleri

- **Import pipeline test:** 500 listing import → product sayısı + listing sayısı doğru
- **Bot sync test:** 200 listing sync → duplicate product oluşmamalı
- **Admin import test:** 500 listing admin import → doğru sayılar
- **Cron + Instant bot test:** 20 queue job → doğru product eşleşmesi

### 7.3 Production Validation (Canary)

1. **Önce staging'de deploy** (varsa)
2. **Cache hit/miss metrikleri** ekle (`console.log` veya metric)
3. **Product duplicate rate** monitoring:
   - Her faz sonrası duplicate product sayısını karşılaştır
   - Beklenen: Faz 2 sonrası sıfır yeni duplicate
4. **Query count monitoring**:
   - Import başına DB query sayısı
   - Beklenen: Faz 3-4 sonrası %90+ azalma

### 7.4 Build & Test Validation

```
# Her faz sonrası:
npm run typecheck    # TypeScript strict
npm run test         # Tüm test suite
npm run build        # next build
```

---

## 8. Risk Değerlendirmesi

### 8.1 Risk Matrisi

| Risk | Olasılık | Etki | Faz | Azaltma |
|------|---------|------|-----|---------|
| Cache stale → eski product döner | Düşük | Düşük | F1 | 5 dk TTL, product'lar nadiren değişir |
| Cache OOM (çok fazla unique key) | Düşük | Düşük | F1 | Map yerine LRU, max 10000 entry |
| normalizasyon hatası → cache'de yanlış key | Orta | Orta | F1 | Cache key canonicalKey'e göre — bu zaten mevcut |
| Backfill SQL hatası (prod'da) | Düşük | Yüksek | F2 | Önce staging'de test et, batch update kullan |
| normalized_key uniqueness violation | Düşük | Orta | F2 | UNIQUE constraint koymadan index ekle |
| Batch insert 23505 (2+ aynı anda) | Düşük | Düşük | F3 | Retry mantığı zaten var |
| Caller migration'da edge case (null input) | Düşük | Orta | F4 | Batch null input'u handle eder |
| 5 caller da aynı anda hata | Çok düşük | Yüksek | F4 | Her caller bağımsız deploy, arka arkaya test |

### 8.2 Data Integrity Riskleri — Detaylı

**En büyük risk:** Faz 2'de LIMIT 2000 kaldırıldığında, daha önce LIMIT 2000 yüzünden oluşmuş duplicate product'ların varlığı.

**Etki:** Eğer product "iPhone 16 Pro Max 256GB" zaten 2 kopya olarak varsa (biri fallback scan bulamadı diye oluşturulmuş), yeni batch insert `normalized_key` UNIQUE değilse ikisini de bulur — hangisinin kullanılacağı belirsiz.

**Azaltma:**
1. Backfill öncesi duplicate product'ları tespit et
2. Aynı normalized_key'e sahip product'ları birleştir (merge)
3. Sonra normalized_key index'ini ekle

### 8.3 Performance Riskleri — Detaylı

**Faz 3 Batch:** `Promise.all(inputs.map(prepareMatcherState))` — CPU-bound iş (regex + string işleme). 500 input'un hepsini aynı anda Promise.all ile çalıştırmak event loop'u bloke edebilir.

**Azaltma:** Batch processing'i chunk'lara böl (örn. 50'şerli groups). Veya `prepareMatcherState`'i micro-optimization yap (daha sonra).

---

## 9. Beklenen Performans İyileştirmesi

### 9.1 DB Query Sayısı

| Senaryo | Şu An (max) | Faz 1 | Faz 2 | Faz 3 | Faz 4 |
|---------|------------|-------|-------|-------|-------|
| 500 listing import | 2000 | 1000 | 502 | **3-6** | **3-6** |
| 200 listing sync | 800 | 400 | 202 | **3** | **3** |
| 20 queue job (cron) | 80 | 40 | 22 | **3** | **3** |
| 10 listing instant bot | 40 | 20 | 12 | **3** | **3** |

### 9.2 Latency

| Metric | Şu An | Hedef |
|--------|-------|-------|
| 500 listing import (DB time) | ~5-10s | ~50-100ms |
| 200 listing sync (DB time) | ~2-5s | ~50ms |
| Cache hit (no DB) | N/A | ~0.1ms |
| LIMIT 2000 scan | ~100-200ms | N/A (kalktı) |

### 9.3 Data Integrity

| Metric | Şu An | Hedef |
|--------|-------|-------|
| Duplicate product rate (fallback) | ~%96 hata (products >2000) | %0 |
| Exact match success rate | ~%70 | %85+ |
| Normalized key match rate | N/A | %95+ |

### 9.4 CPU Yükü

- **Faz 1:** Tekrarlı çağrılarda %100 CPU reduction (cache hit'te sıfır işlem)
- **Faz 3:** Promise.all parallel processing (toplam süre azalır, anlık CPU artar)
- **Genel:** ~%70-80 CPU reduction (tekrarlı işlemler cache + batch ile optimize edilir)

---

## 10. Değiştirilecek Dosyalar

### FAZ 1 — In-Memory Cache (Gün 1-2)

| Dosya | Değişiklik | Satır |
|-------|-----------|-------|
| `lib/product-matcher/matcher.ts` | Cache map + get/set + findOrCreate/dryRun cache integration | +30 |

### FAZ 2 — Normalized Key Index (Gün 2-3)

| Dosya | Değişiklik | Satır |
|-------|-----------|-------|
| `supabase/migrations/XXX_add_normalized_key.sql` | YENİ: normalized_key kolonu + index + backfill SQL | +20 |
| `lib/product-matcher/repository.ts` | LIMIT 2000 → `.eq("normalized_key", canonicalKey).maybeSingle()` | ±3 |
| `lib/product-matcher/matcher.ts` | Insert payload'a `normalized_key` ekle | +1 |
| `lib/product-matcher/types.ts` | Opsiyonel: type update | ±2 |

### FAZ 3 — Batch Matching API (Gün 3-4)

| Dosya | Değişiklik | Satır |
|-------|-----------|-------|
| `lib/product-matcher/matcher.ts` | YENİ: `batchFindOrCreateMatchedProduct()` + internal helpers | +60 |
| `lib/product-matcher/index.ts` | Yeni export (`batchFindOrCreateMatchedProduct`) | +1 |
| `lib/product-matcher/types.ts` | Opsiyonel: batch input/output type'ları | ±5 |

### FAZ 4 — Caller Migration (Gün 4-5)

| Dosya | Değişiklik | Satır |
|-------|-----------|-------|
| `lib/import/import-listings.ts:83-122` | `for` döngüsü → `batchFindOrCreateMatchedProduct()` | ±5 |
| `lib/bots/listing-sync.ts:372-398` | `resolveMatchedProductIds` batch'e geçer | ±5 |
| `app/api/search/instant-bot/route.ts:415-433` | `ensureProduct` batch'e geçer | ±5 |
| `app/api/cron/process-search-queue/route.ts:440-456` | `ensureProduct` batch'e geçer | ±5 |
| `app/admin/import/actions.ts:112-127` | `for` döngüsü → `batchFindOrCreateMatchedProduct()` | ±5 |

### Toplam Değişiklik

| Faz | Yeni Dosya | Değiştirilen | Toplam Satır |
|-----|-----------|-------------|-------------|
| Faz 1 | 0 | 1 | +30 |
| Faz 2 | 1 (SQL) | 3 | +26 |
| Faz 3 | 0 | 3 | +66 |
| Faz 4 | 0 | 5 | ±25 |
| **Toplam** | **1** | **10** | **~+120** |

### Değişmeyen Dosyalar

- `lib/product-matcher/signals.ts` — Hiçbir değişiklik gerekmez
- `lib/product-matcher/canonical.ts` — Hiçbir değişiklik gerekmez
- `lib/product-matcher/confidence.ts` — Hiçbir değişiklik gerekmez
- `lib/product-matcher/helpers.ts` — (Opsiyonel: isDuplicateError güncellemesi hariç)
- `lib/product-matcher/duplicate.ts` — Scope dışı (duplicate detection, product matching değil)
- `lib/product-matcher/summary.ts` — Scope dışı
- `app/api/admin/product-matcher-test/route.ts` — Scope dışı (tek listing ile çalışır, cache yeterli)

---

## Sprint Girlü

### Günlük Plan

| Gün | Faz | İş | Çıktı |
|-----|-----|-----|-------|
| Gün 1 | F1 | In-memory cache implementasyonu + test | Cache'li matcher.ts, tüm testler geçer |
| Gün 2 | F2 | SQL migration yaz + repository.ts güncelle + backfill | normalized_key kolonu + index, güncellenmiş repository.ts |
| Gün 3 | F3 | Batch matching API implementasyonu + test | batchFindOrCreateMatchedProduct(), tüm testler geçer |
| Gün 4 | F4 | import-listings.ts + listing-sync.ts batch migration | İki büyük caller batch'e geçti |
| Gün 5 | F4 | Instant bot + Cron + Admin import batch migration + test | Tüm caller'lar batch'te, full test suite geçer |

### Kabul Kriterleri

- [ ] 500 listing import → max 6 DB query (şu an 2000)
- [ ] Aynı product 10 listing'de geçiyorsa → 9 cache hit, 1 DB query
- [ ] 50.000 products varken fallback scan doğru çalışır (LIMIT 2000 hatası yok)
- [ ] Hiçbir duplicate product oluşmaz
- [ ] Tüm mevcut testler geçer
- [ ] `next build` başarılı
- [ ] Rollback < 10 dakika

### Risk Göstergeleri

- **KIRMIZI:** Backfill SQL production'da çalışmazsa → Faz 2'yi atla, Faz 3-4'ü LIMIT 2000 hala varken yap (limitli kazanç)
- **SARI:** Batch insert'te 23505 sık görülürse → UNIQUE constraint eklemeyi düşün
- **YEŞİL:** Her şey planlandığı gibi giderse → son 2 günde caller migration'ları tamamla

---

## Ek: Migration Sırası — Kritik Yol

```
Gün 1: F1 Cache
  └── Test: performans doğrulama
       │
Gün 2: F2 Index (bağımsız, F1'den bağımsız çalışabilir)
  └── Test: data integrity + query plan
       │
Gün 3: F3 Batch API (F1+F2 altyapısını kullanır)
  └── Test: batch doğruluğu + edge cases
       │
Gün 4-5: F4 Caller migration (F3 gerektirir)
  └── import-listings.ts
  └── listing-sync.ts
  └── cron search queue
  └── instant bot
  └── admin import
       │
       ▼
  Full test + build + deploy
```

**Not:** Faz 1 ve Faz 2 birbirinden bağımsızdır. Paralel çalışılabilir (Gün 1-2'de 2 developer). Faz 3 ve Faz 4 sıralıdır — Faz 4, Faz 3'teki batch API'yi kullanır.
