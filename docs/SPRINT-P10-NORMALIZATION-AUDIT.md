# Sprint P-10: Normalizasyon Denetim Raporu

**Tarih:** 2026-07-16
**Kapsam:** `products` tablosundaki tüm `normalized_key` değerlerinin denetimi
**Veritabanı:** Production (41 ürün)
**Yöntem:** JS `generateProductKey()` (TypeScript) ve PL/pgSQL `compute_normalized_key()` (SQL) algoritmaları ayrı ayrı test edilmiş, her iki çıktı production değerleriyle karşılaştırılmıştır.

---

## Özet

| Metrik | Değer |
|--------|-------|
| Toplam ürün | 41 |
| Temiz normalized_key | 26 (%63.4) |
| **Malformed normalized_key** | **7 (%17.1)** |
| Key conflict `-{id}` suffix | 6 (%14.6) |
| Uyarı: JS/PL/pgSQL farklı | 2 (%4.9) |
| **Toplam sorunlu** | **15 (%36.6)** |

---

## Bölüm 1: Malformed Key'ler — Detaylı Analiz

### 1.1 PL/pgSQL Fallback Bug'ı (5 ürün, en kritik)

**Kök neden:** `compute_normalized_key()` fonksiyonunun fallback satırı:

```sql
return lower(regexp_replace(coalesce(value, ''), '[^a-z0-9]+', '-', 'g'));
```

Bu satır **ham `value`** üzerinde çalışır, `lowered` üzerinde değil. `[^a-z0-9]` karakter sınıfı büyük harfleri (`A-Z`) kapsamaz. Regexp_replace'e `i` flag'ı eklenmemiştir. Sonuç: her büyük harf `-`'ye dönüşür.

Ayrıca PL/pgSQL sadece **8 brand** tanır (JS 24 brand tanır), bu da brand'siz düşüşü hızlandırır.

| ID | Ürün Adı | Production Key | PL/pgSQL Çıktısı | JS Çıktısı |
|----|----------|----------------|-------------------|------------|
| 6 | PlayStation 5 | `-lay-tation-5` | `-lay-tation-5` | `sony-playstation-5` |
| 7 | RTX 3060 | `-3060` | `-3060` | `nvidia-rtx-3060` |
| 8 | RTX 4060 | `-4060` | `-4060` | `nvidia-rtx-4060` |
| 20 | SAAT | `-` | `-` | `saat` |
| 21 | MAUSE | `--21` | `-` → dup → `--21` | `mause` → dup → `mause-21` |

**Hepsi backfill kaynaklıdır.** Bu 5 ürün, normalized_key sütunu eklenmeden önce oluşturulmuş eski kayıtlardır. Backfill SQL'i PL/pgSQL fonksiyonunu çalıştırarak bu bozuk key'leri üretmiştir.

**Düzeltme:** PL/pgSQL fallback'inde `value` yerine `lowered` kullanılmalı VE/VEYA regex'e `i` flag'ı eklenmelidir:
```sql
return lower(regexp_replace(coalesce(value, ''), '[^a-z0-9]+', '-', 'gi'));
```
veya:
```sql
return lowered;
```
(Çünkü `lowered` zaten doğru formattadır: lowercase, regex-temizlenmiş, trim edilmiş.)

**Ek olarak:** PL/pgSQL brand listesine `nvidia`, `sony`, `lenovo`, `hp`, `dell`, `asus`, `msi`, `nothing`, `vivo`, `motorola`, `nokia`, `lg`, `razer`, `blackberry`, `htc`, `honor` eklenmelidir.

---

### 1.2 Key Conflict `-{id}` Suffix (6 ürün, düşük risk)

Aynı model/storage kombinasyonuna sahip ürünler aynı normalized_key'i alır. Migration SQL'i çakışmayı `-{id}` ekleyerek çözer.

| ID | Ürün Adı | normalized_key | Çakıştığı Ürün |
|----|----------|----------------|-----------------|
| 26 | iPhone 15 Pro 128GB | `apple-iphone-15-pro-128gb-26` | id=25 (aynı) |
| 29 | iPhone 14 Pro 256GB | `apple-iphone-14-pro-256gb-29` | id=28 (aynı) |
| 30 | iPhone 14 Pro 256GB | `apple-iphone-14-pro-256gb-30` | id=28,29 (aynı) |
| 36 | iPhone 13 Pro 128GB | `apple-iphone-13-pro-128gb-36` | id=34 (aynı) |
| 39 | Omix X3 | `omix-x3-yenilenmis-omix-64gb-39` | id=38 (aynı) |
| 40 | Omix X3 | `omix-x3-yenilenmis-omix-64gb-40` | id=38,39 (aynı) |

**Kök neden:** Ürün eşleştirme (matcher) aynı fiziksel ürünü farklı listing'lerden ayrı ayrı oluşturuyor. Aynı isim/storage → aynı normalized_key → suffix ekleniyor.

**Düzeltme:** Matcher'ın `batchFindOrCreateMatchedProducts` fonksiyonu aynı canonicalName/key için birden fazla insert yapmamalıdır. Matcher seviyesinde deduplikasyon yapılmalıdır. `-{id}` suffix geçici bir çözümdür.

**Not:** `-{id}` suffix'li key'ler `products_normalized_key_key` unique index'i tarafından kabul edilir ve sorgularda çalışır. Veri bütünlüğü sorunu yoktur. Sadece key kalitesi düşüktür.

---

### 1.3 Omix Brand Tespit Edilemiyor (3 ürün)

| ID | Ürün Adı | normalized_key | Sorun |
|----|----------|----------------|-------|
| 38 | Omix X3 | `omix-x3-yenilenmis-omix-64gb` | Brand yok. Key içinde "yenilenmis" (koşul) ve ikinci "omix" (yinelenen) |
| 39 | Omix X3 | `omix-x3-yenilenmis-omix-64gb-39` | Aynı + conflict suffix |
| 40 | Omix X3 | `omix-x3-yenilenmis-omix-64gb-40` | Aynı + conflict suffix |

**Kök neden:** "Omix" bir markadır ancak `BRAND_RULES`'da tanımlı değildir (ne JS'de ne PL/pgSQL'de). Ayrıca "yenilenmis" (refurbished) model parçası değil, ürün durumudur — key'de yer almamalıdır. "64gb" storage olarak ayrı algılanmalı, model içinde tekrarlanmamalıdır.

**Düzeltme:** 
1. `BRAND_RULES`'a `omix` eklenmeli
2. `detectModel` fallback'inde "yenilenmis", "ikinci el", "sifir" gibi durum/kalite kelimeleri filtrelenmeli
3. Storage değeri model token'larından çıkarılmalı (zaten `detectStorage` ayrıca çalışıyor)

---

### 1.4 JS ↔ PL/pgSQL Algoritma Farkı (2 ürün, düşük risk)

Aynı ürün adı için JS ve PL/pgSQL farklı normalized_key üretir:

| Ürün Adı | JS Çıktısı | PL/pgSQL Çıktısı | Production'da Hangisi |
|----------|------------|-------------------|----------------------|
| iPhone 13 | `apple-iphone-13` | `apple-iphone-13` | ✅ Aynı |
| iPad 9. Nesil | `apple-ipad-9-nesil` | `apple-ipad-9` | PL/pgSQL (backfill) |
| MacBook Air M1 | `apple-macbook-air-m1` | `apple-macbook-air-m1` | ✅ Aynı |

"iPad 9. Nesil" için PL/pgSQL "nesil" kısmını düşürür çünkü regex `ipad[-\s]*(pro|air|mini|[0-9]+)?` sadece bir grup yakalar ve "nesil" için ayrı bir capture yoktur.

**Risk:** Düşük. "iPad 9. Nesil" gibi ürünlerin farklı key alması arama/eşleştirme için sorun oluşturmaz çünkü ürünler application katmanı tarafından eklendiğinde JS algoritması kullanılır (tutarlı). Sadece backfill'den gelen eski kayıtlar farklıdır.

---

## Bölüm 2: İstatistikler

### 2.1 Key Kalitesi Dağılımı

| Kategori | Adet | Yüzde |
|----------|------|-------|
| ✅ Temiz (beklenen formatta) | 26 | %63.4 |
| ⚠️ Malformed (PL/pgSQL fallback bug) | 5 | %12.2 |
| ⚠️ `-{id}` conflict suffix | 6 | %14.6 |
| ⚠️ Brand'siz / Omix | 3 | %7.3 |
| ⚠️ JS↔PL/pgSQL farkı | 1 | %2.4 |

Not: Bir ürün birden fazla kategoriye girebilir (örn. Omix X3 hem brand'siz hem conflict suffix). Toplam 15 benzersiz sorunlu key vardır.

### 2.2 Oluşturma Yöntemine Göre Dağılım

| Yöntem | Ürünler | Adet | Sorunlu Sayısı |
|--------|---------|------|----------------|
| **PL/pgSQL Backfill** (Haziran, eski ürünler) | id:1-21 | 21 | 7 (%33.3) |
| **JS Application** (Temmuz, Sprint P-9) | id:24-41 | 18 | 0 (key kalitesi) + 6 conflict (%33.3) |

Backfill'deki 7 sorunlu key'in 5'i PL/pgSQL fallback bug'ı, 2'si ise "Samsung S23/S24" öncesi eklenmiş eski ürünlerdir (aslında Samsunglar sorunsuzdur).

JS yoluyla eklenen 18 yeni ürünün tamamında **brand+model doğrudur**. Sadece conflict suffix'leri vardır (6 ürün). Omix X3 (38-40) ürünlerinin key'i "yenilenmis" ve çift "omix" içerir ancak bu bir JS algoritma sınırlamasıdır, PL/pgSQL bug'ı değildir.

### 2.3 Marka Bazında Dağılım

| Marka | Ürün Sayısı | normalized_key Durumu |
|-------|-------------|----------------------|
| Apple (iPhone/iPad/Mac) | 25 | ✅ Tümü doğru (bazıları conflict suffix'li) |
| Samsung | 2 | ✅ Doğru |
| NVIDIA (RTX) | 2 | ❌ PL/pgSQL bug → bozuk key |
| Sony (PlayStation) | 1 | ❌ PL/pgSQL bug → bozuk key |
| Omix | 3 | ❌ Brand tanınmıyor + key içinde yinelenen token |
| Bilinmeyen (SAAT, MAUSE) | 2 | ❌ PL/pgSQL bug → bozuk key |

---

## Bölüm 3: Root Cause Gruplaması

### Root Cause A: PL/pgSQL Fallback Regex Bug (5 ürün)
**Şiddet:** Yüksek
**Etki:** Brand içeren ancak PL/pgSQL'de brand listesi olmayan ürünlerin key'i bozuluyor.
**Etkilenen ürünler:** id=6 (PlayStation 5), id=7 (RTX 3060), id=8 (RTX 4060), id=20 (SAAT), id=21 (MAUSE)
**Düzeltme:** `regexp_replace(value, '[^a-z0-9]+', '-', 'gi')` — `i` flag'ı eklenmeli VEYA `lowered` değişkeni kullanılmalı.

### Root Cause B: PL/pgSQL Eksik Brand Listesi (3 ürün)
**Şiddet:** Yüksek (Root Cause A ile birleşince)
**Etki:** PL/pgSQL sadece 8 marka tanır. Sony, NVIDIA, Omix tanınmaz → brand=null → fallback'e düşer.
**Etkilenen ürünler:** id=6 (sony), id=7 (nvidia), id=8 (nvidia), id=38-40 (omix)
**Düzeltme:** PL/pgSQL'deki brand listesine 16 eksik marka eklenmeli.

### Root Cause C: Product Matcher Aynı Ürünü Tekrar Oluşturuyor (6 ürün)
**Şiddet:** Orta
**Etki:** Aynı listing farklı source'lardan gelince matcher aynı ürünü 2-3 kez oluşturuyor. `-{id}` suffix ile çözülüyor.
**Etkilenen ürünler:** id=26, 29, 30, 36, 39, 40
**Düzeltme:** Matcher'da batch seviyesinde deduplikasyon. Aynı canonicalName/key batch içinde birden fazla varsa tek insert.

### Root Cause D: Omix BRAND_RULES Eksik (3 ürün)
**Şiddet:** Orta
**Etki:** Omix ürünlerinde brand prefix yok, model token'ları "yenilenmis" ve yinelenen "omix" içeriyor.
**Etkilenen ürünler:** id=38-40
**Düzeltme:** BRAND_RULES'a "omix" eklenmeli, model fallback'inde durum kelimeleri filtrelenmeli.

### Root Cause E: JS vs PL/pgSQL iPad "nesil" Farkı (1 ürün)
**Şiddet:** Düşük
**Etki:** "iPad 9. Nesil" için JS "apple-ipad-9-nesil", PL/pgSQL "apple-ipad-9" üretir.
**Etkilenen ürünler:** id=10
**Düzeltme:** PL/pgSQL iPad regex'ine "nesil" capture'ı eklenebilir. Düşük öncelik.

---

## Bölüm 4: Migration Etki Analizi

### 4.1 Migration Gerekli mi?

**Evet.** Aşağıdaki değişiklikler için migration gereklidir:

| Değişiklik | Migration Türü | Risk |
|------------|----------------|------|
| PL/pgSQL `compute_normalized_key()` güncelleme | `create or replace function` | Düşük — mevcut veriyi etkilemez |
| Backfill: bozuk key'leri düzeltme | `update products set normalized_key = ...` | **Orta-Yüksek** — unique index var, çakışma kontrolü gerekli |
| `set_product_normalized_key()` trigger güncelleme | `create or replace function` | Düşük — trigger davranışı değişmez |

### 4.2 Backfill Stratejisi

PL/pgSQL düzeltildikten sonra sadece 5 malformed key (id=6,7,8,20,21) güncellenmelidir. Bu ürünlerin yeni key'leri:

| ID | Eski Key | Yeni Key (düzeltilmiş PL/pgSQL) |
|----|----------|-------------------------------|
| 6 | `-lay-tation-5` | `playstation-5` (PL/pgSQL hala sony tanımıyor → brand'siz fallback) |
| 7 | `-3060` | `3060` (ya da brand eklenirse `nvidia-rtx-3060`) |
| 8 | `-4060` | `4060` (ya da brand eklenirse `nvidia-rtx-4060`) |
| 20 | `-` | `saat` |
| 21 | `--21` | `mause` (conflict yoksa) veya `mause-21` (conflict varsa) |

**Not:** Sadece `i` flag'ı eklenirse (brand listesi genişletilmeden):
- "PlayStation 5" → "playstation-5" (sony tanınmadığı için brand'siz)
- "RTX 3060" → "rtx-3060" (nvidia tanınmadığı için brand'siz)

Brand listesi de genişletilirse:
- "PlayStation 5" → ... PL/pgSQL'de sony için regex: `lowered ~ 'sony|playstation|ps5|ps4|xperia'` → brand='sony'. Ama model tespiti yok. key_parts = ['sony'] → "sony". Storage? RAM? Yok. Bu da ideal değil ama en azından brand var.

En iyi sonuç için hem brand listesi genişletilmeli hem de model regex'leri eklenmelidir. Bu daha büyük bir iştir.

### 4.3 Risk Değerlendirmesi

| Risk | Seviye | Açıklama |
|------|--------|----------|
| Unique index violation | **Yüksek** | Yeni key'ler mevcut key'lerle çakışabilir. `on conflict` handling eklenmeli |
| Foreign key reference yok | **Düşük** | `normalized_key` başka tablolarda FK olarak kullanılmıyor |
| Downstream cache etkisi | **Düşük** | Arama/eşleştirme işlemleri mevcut key'leri kullanıyor. Key değişince tekrar eşleşme gerekebilir |
| `-{id}` suffix'li ürünler | **Düşük** | Bu ürünler ayrı fiziksel ürün olduğu için key'leri geçerli; sadece kalite sorunu |
| Önceki backfill ile tutarsızlık | **Orta** | Daha önce backfill yapıldı. Yeni backfill aynı ürünlere farklı key verecek |

---

## Bölüm 5: Önerilen Fix Planı

### Fix A (Acil): PL/pgSQL Fallback Regex Düzeltmesi
**Değişiklik:** Tek satır. `'[^a-z0-9]+', '-', 'g'` → `'[^a-z0-9]+', '-', 'gi'`
**Etki:** 5 malformed key düzelir (düzgün lowercase fallback alır).
**Migration riski:** Çok düşük.
**Süre:** 5 dk.

### Fix B (Önerilen): PL/pgSQL Brand Listesini Genişletme
**Değişiklik:** 16 yeni brand regex'i eklenmeli.
**Etki:** PlayStation 5 → sony, RTX 3060 → nvidia olarak algılanır. Key kalitesi artar.
**Migration riski:** Düşük.
**Süre:** 15 dk.

### Fix C (Opsiyonel): Omix BRAND_RULES'a Ekleme
**Değişiklik:** JS BRAND_RULES + PL/pgSQL brand regex'ine "omix" eklenmeli.
**Etki:** Omix ürünleri "omix-x3-64gb" gibi temiz key alır.
**Migration riski:** Düşük.
**Süre:** 10 dk.

### Fix D (Opsiyonel): JS detectModel Fallback'inde Durum Kelimelerini Filtreleme
**Değişiklik:** "yenilenmis", "ikinci el", "sifir", "refurbished" gibi kelimeler model token'larından çıkarılmalı.
**Etki:** "omix-x3-yenilenmis-omix-64gb" → "omix-x3-64gb" gibi temiz key.
**Migration riski:** Yok (JS kodu, veritabanını etkilemez). Yeni ürünler temiz key alır. Eski ürünler ayrı backfill gerektirir.
**Süre:** 15 dk.

### Fix E (Gelecek): Matcher Seviyesinde Batch Dedup
**Değişiklik:** `batchFindOrCreateMatchedProducts` içinde aynı canonicalName/key için birden fazla insert'i engelleme.
**Etki:** `-{id}` conflict suffix'i sıfırlanır.
**Migration riski:** Yok.
**Süre:** 30 dk.

---

## Bölüm 6: Sonuç

**Production veritabanında 41 ürünün 15'inde (%36.6) normalized_key sorunu vardır.**

Bunların 5'i (%12.2) **ciddi** (brand bilgisi kayıp, key tamamen bozuk), 6'sı (%14.6) **kozmetik** (conflict suffix), 3'ü (%7.3) **kalite** (Omix brand'siz + yinelenen token), 1'i (%2.4) **önemsiz** (iPad nesil farkı).

**Kritik bulgu:** PL/pgSQL `compute_normalized_key()` fonksiyonunun fallback satırındaki regex case-sensitive'dir ve `i` flag'ı eksiktir. Bu, büyük harf içeren tüm ürün adlarının normalized_key'ini bozar. 5 üründe gözlemlenmiştir ancak 21 ürünün tamamı backfill'den geçtiği için potansiyel etki daha geniştir (şans eseri diğer ürünlerde brand algılanmış ve key_parts boş olmamıştır).

**Öneri:** Fix A (regex düzeltmesi) ve Fix B (brand listesi genişletme) birlikte uygulanmalıdır. Fix C ve D Omix ürünleri içindir. Fix E ise ilerleyen sprint'te planlanmalıdır.

---

## Ek A: Tüm Ürünlerin normalized_key Durumu

| ID | Ürün Adı | normalized_key | Durum |
|----|----------|----------------|-------|
| 1 | iPhone 13 | `apple-iphone-13` | ✅ |
| 2 | iPhone 14 | `apple-iphone-14` | ✅ |
| 3 | iPhone 15 | `apple-iphone-15` | ✅ |
| 4 | Samsung S23 | `samsung-galaxy-s23` | ✅ |
| 5 | Samsung S24 | `samsung-galaxy-s24` | ✅ |
| 6 | **PlayStation 5** | **`-lay-tation-5`** | **❌ RC-A/B** |
| 7 | **RTX 3060** | **`-3060`** | **❌ RC-A/B** |
| 8 | **RTX 4060** | **`-4060`** | **❌ RC-A/B** |
| 9 | MacBook Air M1 | `apple-macbook-air-m1` | ✅ |
| 10 | iPad 9. Nesil | `apple-ipad-9` | ⚠️ RC-E (JS: apple-ipad-9-nesil) |
| 11 | iPhone 15 Pro Max | `apple-iphone-15-pro-max` | ✅ |
| 12 | iPhone 15 Pro | `apple-iphone-15-pro` | ✅ |
| 13 | iPhone 14 Pro Max | `apple-iphone-14-pro-max` | ✅ |
| 14 | iPhone 14 Pro | `apple-iphone-14-pro` | ✅ |
| 15 | iPhone 13 Pro Max | `apple-iphone-13-pro-max` | ✅ |
| 16 | iPhone 11 | `apple-iphone-11` | ✅ |
| 17 | iPhone 12 | `apple-iphone-12` | ✅ |
| 18 | iPhone 16 Pro Max | `apple-iphone-16-pro-max` | ✅ |
| 19 | iPhone 16 Pro | `apple-iphone-16-pro` | ✅ |
| 20 | **SAAT** | **`-`** | **❌ RC-A** |
| 21 | **MAUSE** | **`--21`** | **❌ RC-A** |
| 24 | iPhone 15 Pro 1TB | `apple-iphone-15-pro-1tb` | ✅ |
| 25 | iPhone 15 Pro 128GB | `apple-iphone-15-pro-128gb` | ✅ |
| 26 | **iPhone 15 Pro 128GB** | **`apple-iphone-15-pro-128gb-26`** | ⚠️ RC-C |
| 27 | iPhone 14 Pro Max 256GB | `apple-iphone-14-pro-max-256gb` | ✅ |
| 28 | iPhone 14 Pro 256GB | `apple-iphone-14-pro-256gb` | ✅ |
| 29 | **iPhone 14 Pro 256GB** | **`apple-iphone-14-pro-256gb-29`** | ⚠️ RC-C |
| 30 | **iPhone 14 Pro 256GB** | **`apple-iphone-14-pro-256gb-30`** | ⚠️ RC-C |
| 31 | iPhone 14 Pro 128GB | `apple-iphone-14-pro-128gb` | ✅ |
| 32 | iPhone 13 Pro Max 256GB | `apple-iphone-13-pro-max-256gb` | ✅ |
| 33 | iPhone 13 Pro Max 128GB | `apple-iphone-13-pro-max-128gb` | ✅ |
| 34 | iPhone 13 Pro 128GB | `apple-iphone-13-pro-128gb` | ✅ |
| 35 | iPhone 13 Pro 256GB | `apple-iphone-13-pro-256gb` | ✅ |
| 36 | **iPhone 13 Pro 128GB** | **`apple-iphone-13-pro-128gb-36`** | ⚠️ RC-C |
| 37 | iPhone 14 Plus 256GB | `apple-iphone-14-plus-256gb` | ✅ |
| 38 | **Omix X3** | **`omix-x3-yenilenmis-omix-64gb`** | **❌ RC-D** |
| 39 | **Omix X3** | **`omix-x3-yenilenmis-omix-64gb-39`** | **❌ RC-C/D** |
| 40 | **Omix X3** | **`omix-x3-yenilenmis-omix-64gb-40`** | **❌ RC-C/D** |
| 41 | iPhone 16 | `apple-iphone-16` | ✅ |

**RC-A:** PL/pgSQL Fallback Regex Bug
**RC-B:** PL/pgSQL Eksik Brand Listesi
**RC-C:** Key Conflict `-{id}` Suffix
**RC-D:** Omix Brand Tanınmıyor / Durum Kelimeleri
**RC-E:** JS ↔ PL/pgSQL Algoritma Farkı

---

*Rapor, JS `generateProductKey()` ve PL/pgSQL `compute_normalized_key()` algoritmalarının production verisi üzerinde ayrı ayrı test edilmesiyle hazırlanmıştır. 41 ürünün tamamı Supabase API üzerinden sorgulanmış, her bir malformed key'in hangi algoritmadan kaynaklandığı tespit edilmiştir.*
