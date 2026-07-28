# Sprint P-3: Veri Doğrulama Raporu

**Tarih:** 2026-07-11  
**Kapsam:** 61 listing, 21 product, 24 BRAND_RULES, 40 edge case  
**Üst ölçek perspektifi:** Milyonlarca listing, her kategoride gürültülü/eksik/bozuk başlıklar  
**Analiz:** `extractProductSignals()` çıktıları üzerinden 7 metrik

---

## Uyarı: Mevcut Veri Seti Sınırlamaları

Bu rapor iki veri kaynağına dayanır:
1. **61 gerçek listing** — sadece Apple (56) ve Samsung (5) içerir, %100 başarı
2. **40 sentetik edge case** — gürültülü, eksik, farklı kategorilerden başlıklar

Aşağıdaki tablo, her metrik için **mevcut verideki değer**, **edge case test sonucu** ve **milyon ölçeğinde beklenen gerçek değer** arasındaki farkı gösterir:

| Metrik | 61 listing | Edge case (40) | Milyon ölçeğinde (tahmini) |
|--------|-----------|----------------|---------------------------|
| Brand başarısı | %100 | **%100** | ~%70-85 |
| Model başarısı | %100 | **%70** (28/40) | ~%60-80 |
| normalized_key başarısı | %100 | **12/40 key'de duplikasyon sorunu** | ~%55-80 |
| Kategori başarısı | %100 | **%97.5** (39/40) | ~%75-90 |
| Cross-brand çarpışma | 0 | 0 | 0 (matematiksel) |
| Normalize key null oranı | %0 | %0 (hepsi key üretir) | ~%10-25 |

**Edge case testi,** 40 başlık üzerinden engine'in gerçek sınırlarını ölçer. %70 model başarısı, engine'in tanıdık markalarda (Apple, Samsung) kusursuz, tanımadık markalarda ve gürültülü başlıklarda zayıf olduğunu gösterir. Ayrıntılı döküm için Bkz. [Bölüm 9: Edge Case Stress Test](#9-edge-case-stress-test-sonuçları).

---

## 1. Marka (Brand) Çıkarım Başarı Oranı

### Mevcut Veri

| Metrik | Değer |
|--------|-------|
| Toplam Listing | 61 |
| Tespit Edilen | 61 |
| Tespit Edilemeyen | 0 |
| **Başarı Oranı** | **%100** |

Tespit edilen markalar: apple (56), samsung (5)

### Edge Case Sonuçları

| Metrik | Değer |
|--------|-------|
| Toplam Edge Case | 40 |
| Brand Doğru | 40 |
| **Başarı Oranı** | **%100** |

Engine, tüm edge case'lerde brand'i doğru tespit etti veya doğru şekilde null döndü:
- **Apple iPhone** varyasyonları (emoji, HTML, Kiril, spam, büyük/küçük harf): hepsi başarılı
- **Bare iPhone** ("16 pro max 256 gb") → apple (isBareIphoneModel)
- **Bare Samsung** ("s23 128 gb") → samsung (isBareSamsungModel)
- **Xiaomi, Huawei, Google, OnePlus** → doğru tespit (BRAND_RULES'de var)
- **Dell, HP, Lenovo, ASUS, MSI** → doğru tespit
- **Nintendo, Xbox** → null (BRAND_RULES'de yok) — doğru
- **Arapça** ("ايفون 15 برو ماكس") → null — doğru (Arapça karakterler eşleşmez)
- **Anlamsız başlık** ("telefon", "HARİKA DURUMDA...") → null — doğru

### Milyon Ölçeğinde Beklenen

**Tahmini başarı: ~%70-85.** Nedenleri:

| Senaryo | Etki |
|---------|------|
| BRAND_RULES dışı markalar | Her ay yeni markalar eklenir (Xiaomi, Oppo, Vivo, TCL, Vestel, Arçelik, vb.). Rule seti güncel kalsa bile bot kaynaklı listing'lerde marka adı yanlış yazılabilir. |
| Türkçe karakter/transliterasyon farkları | "Samsung" → "Samsun", "Samsong", "Xiaomi" → "Shiaomi", "Xaomi" |
| Kısaltma/alternatif yazım | "APPLE IPHONE", "apple-iphone", "Apple iPhone 15 128GB" (büyük/küçük harf farkı normalize edilir) |
| Markasız listing | "16 pro max 256 gb siyah" — marka belirtilmemiş |
| Kategori dışı ürünler | Saat, mücevher, aksesuar, oyuncak — BRAND_RULES'de olmayan markalar |

**Ölçek etkisi:** 24 BRAND_RULES, milyonlarca listing'deki markaların ancak bir kısmını kapsar. Yeni kaynaklar (eşya, mobilya, spor aletleri) marka bilgisi içermeyebilir.

---

## 2. Model Çıkarım Başarı Oranı

### Mevcut Veri

| Metrik | Değer |
|--------|-------|
| Toplam Listing | 61 |
| Tespit Edilen | 61 |
| Tespit Edilemeyen | 0 |
| **Başarı Oranı** | **%100** |

### Edge Case Sonuçları

| Metrik | Değer |
|--------|-------|
| Toplam Edge Case | 40 |
| Model Doğru | 28 |
| **Başarı Oranı** | **%70** |

12 başarısızlığın sınıflandırması:

| Kategori | Sayı | Açıklama |
|----------|------|----------|
| **Genuine bug** | 6 | Engine'in yanlış model ürettiği durumlar |
| **Kabul edilebilir fallback** | 4 | Brand bilinmiyor, fallback anlamlı ama test beklentisi null'dı |
| **Gürültü fallback** | 2 | Brand bilinmiyor, fallback anlamsız token'lar üretti |

**6 genuine bug** (detaylı analiz için Bkz. [Bölüm 9.3](#93-tespit-edilen-engine-bugları)):
1. Samsung Tab S9 → Samsung Galaxy markası "Telefon" regex'ini tetikler, model "samsung-galaxy-tab-s9" (brand x2)
2. Huawei Mate 60 Pro → "yeni-nesil-5g-destekli" (gürültü token'lar)
3. Apple iPhone (sadece brand+model) → "iphone" (model null olmalıydı — collapse riski)
4. Samsung Telefon 128GB → "samsung-telefon-128gb" (brand x2 + anlamsız)
5. Dell/HP/Lenovo/ASUS/MSI → model fallback brand+storage içerir → key'de duplikasyon
6. Samsung S24+ → "+" kaybolur, "plus" eklenmez

**Kabul edilebilir fallback** (test beklentisi null → engine fallback üretir):
- Xbox, Nintendo, A2644, SM-S918B, Saat 45mm → brand bilinmez, model fallback çalışır ama anlamsız key üretir

### Milyon Ölçeğinde Beklenen

**Tahmini başarı: ~%60-80.** Nedenleri:

| Senaryo | Etki |
|---------|------|
| iPhone regex sınırlı | `\b(?:iphone\s*)?(1[1-6])...` — sadece iPhone 11-16 aralığını kapsar. iPhone 17+, iPhone SE, iPhone X/XS/XR serisi kaçırılır. |
| Samsung regex | `(?:s|a|m)\d{2}` — S/A/M serilerini kapsar ama Note, Z Fold/Flip gibi modelleri kısmen yakalar. J serisi, F serisi, Tab serisi yok. |
| Diğer telefon markaları | Xiaomi Redmi Note, Oppo Reno, Huawei P serisi — hiçbir model regex'i yok |
| Telefon dışı kategoriler | PlayStation 5, RTX 3060, MacBook Air M1 için özel regex'ler mevcut ama genişletilebilir değil |
| Gürültülü başlık | "S23 256GB çok temiz garantili" — model "s23-256gb-cok-temiz-garantili" olarak yanlış algılanabilir (fallback) |
| Model numarası formatı | "A2644" (iPhone 13'ün model kodu) — hiçbir regex eşleşmez |

---

## 3. normalized_key Başarı ve Güvenlik Analizi

### normalized_key Hesaplama Mantığı

```typescript
const keyParts = [brand, model, storage, ram && category !== "Telefon" ? ram : null].filter(Boolean);
const normalizedKey = keyParts.length
  ? keyParts.join("-").replace(/[^a-z0-9]+/g, "-")
  : normalized.replace(/\s+/g, "-");     // ← fallback: normalleştirilmiş başlık
```

### Mevcut Veri

| Metrik | Değer |
|--------|-------|
| Toplam Listing | 61 |
| Geçerli Key | 61 (31 benzersiz) |
| Başarı Oranı | %100 |

### Edge Case Key Duplikasyon Problemi

Model fallback mekanizması (`tokens.slice(0, 4).join("-")`), brand+storage bilgisini model içinde tekrar ettiği için key'de duplikasyon oluşur:

| Başlık | Üretilen Key | Sorun |
|--------|-------------|-------|
| Dell XPS 13 512GB | `dell-dell-xps-13-512gb-512gb` | Brand x2, Storage x2 |
| HP Pavilion 15 256GB | `hp-hp-pavilion-15-256gb-256gb` | Brand x2, Storage x2 |
| Lenovo ThinkPad X1 512GB | `lenovo-lenovo-thinkpad-x1-512gb-512gb` | Brand x2, Storage x2 |
| ASUS ROG Zephyrus 1TB | `asus-asus-rog-zephyrus-1tb-1tb` | Brand x2, Storage x2 |
| MSI GF63 Thin 512GB | `msi-ms-gf63-thin-512gb-512gb` | Brand x2, Storage x2, Türkçe ı |
| Xiaomi Redmi Note 12 256GB | `xiaomi-xiaomi-redmi-note-12-256gb-8gb` | Brand x2, RAM key'de |
| Huawei P60 Pro 256GB | `huawei-huawei-p60-pro-256gb-256gb` | Brand x2, Storage x2 |
| Google Pixel 8 Pro 128GB | `google-google-pixel-8-pro-128gb` | Brand x2 |
| OnePlus 12 16GB RAM 512GB | `oneplus-oneplus-12-16gb-ram-16gb-16gb` | Brand x2, Yanlış storage, RAM key'de |
| Samsung Tab S9 256GB | `samsung-samsung-galaxy-tab-s9-256gb` | Brand x2 |
| Sony PlayStation 5 825GB | `sony-playstation-5-825gb-dijital-825gb` | Storage x2 |
| RTX 4090 24GB | `nvidia-rtx-4090-24gb-ekran-24gb` | Storage x2 |

**12/40 edge case key'inde duplikasyon var.** Bu key'ler eşleme için hala kullanılabilir (içerdikleri bilgi doğru) ancak gereksiz uzunluk ve potansiyel çakışma riski taşır.

### normalized_key Çarpışma Matrisi

Aşağıdaki matris, extraction'ın hangi alanlarda başarısız olduğuna bağlı olarak key'in nasıl etkilendiğini gösterir:

| Brand | Model | Kategori | keyParts | Key Tipi | Risk |
|-------|-------|----------|----------|----------|------|
| ✅ | ✅ | ✅ | [brand, model, storage] | **Yapısal** | Yok |
| ✅ | ✅ | ❌ | [brand, model, storage] | **Yapısal** | Düşük (category'siz) |
| ✅ | ❌ | ❌ | [brand] | **Collapse** | **YÜKSEK** — aynı markadaki tüm modeller çakışır |
| ✅ | ❌ | ✅ | [brand] | **Collapse** | **YÜKSEK** — kategori olsa da brand-level collapse devam eder |
| ❌ | ✅ | ❌ | [model, storage] | **Yarı-yapısal** | Orta — brandsiz model çarpışması |
| ❌ | ❌ | ❌ | [] | **Fallback** | **ÇOK YÜKSEK** — normalized title, eşleme için kullanılamaz |
| ❌ | ❌ | ✅ | [] | **Fallback** | Çok yüksek — kategori bilinse de key işe yaramaz |

**Collapse senaryosu (Brand=✅, Model=❌):**

En tehlikeli senaryo. Brand tespit edilir ama model kaçırılırsa, tüm o markanın modelsiz listing'leri aynı key'e çakılır.

```
"Apple Watch Series 8 45mm"       → key = "apple"
"Apple AirPods Pro 2"             → key = "apple"  ← ÇAKIŞMA!
"Apple iPhone 15 Pro Max"         → key = "apple-iphone-15-pro-max"  ← AYRI (model var)
"Apple MacBook Air M1"            → key = "apple-macbook-air-m1"    ← AYRI (model var)
```

**Burada kategori kurtarıcı olur:**
- Category="Saat" altında "apple" → sadece saatler
- Category="Kulaklık" altında "apple" → sadece kulaklıklar
- Category eklenmemiş olsaydı → tüm apple listing'leri aynı partition'da → saatin key'i airpods'un key'iyle çakışır

---

## 4. Kategori Tespit Başarı Oranı

### Mevcut Veri

| Metrik | Değer |
|--------|-------|
| Toplam Listing | 61 |
| Tespit Edilen | 61 |
| Tespit Edilemeyen | 0 |
| **Başarı Oranı** | **%100** |

Dağılım: Telefon (60), Tablet (1)

### Edge Case Sonuçları

| Metrik | Değer |
|--------|-------|
| Toplam Edge Case | 40 |
| Kategori Doğru | 39 |
| **Başarı Oranı** | **%97.5** |

**Tek başarısızlık: Samsung Galaxy Tab S9** → "Telefon" olarak algılandı.
- **Kök neden:** `detectCategory()`'de Samsung Galaxy kontrolü (`brand === "samsung" && /\bgalaxy\b/.test(normalized)`) Tablet kontrolünden ÖNCE gelir (engine.ts:549 vs 552). "Samsung Galaxy Tab S9" başlığındaki "Galaxy" kelimesi telefon regex'ini tetikler.
- **Düzeltme:** Sıralama değişmeli: Tablet kontrolü → Telefon kontrolü.

### Milyon Ölçeğinde Beklenen

**Tahmini başarı: ~%75-90.** Nedenleri:

| Kategori | Mevcut Durum | Ölçek Sorunu |
|----------|-------------|-------------|
| Telefon | ✅ iPhone regex başarılı | Samsung, Xiaomi, Oppo, Huawei, Google Pixel... |
| Tablet | ✅ iPad tespiti | Samsung Tab, Huawei MatePad, Lenovo Tab... |
| Laptop | ❌ MacBook regex var ama test edilmedi | Dell, HP, Lenovo, ASUS, Acer, MSI... |
| Oyun Konsolu | ❌ PlayStation regex var ama test edilmedi | Xbox, Nintendo Switch... |
| Ekran Kartı | ❌ RTX regex var ama test edilmedi | AMD Radeon, Intel Arc... |
| Diğer (Saat, Kulaklık, Monitör, vb.) | ❌ Hiçbir regex yok | Tüm aksesuar ve ev elektroniği kategorileri |

---

## 5. Marka Bazında Dağıtım İstatistikleri

### Mevcut Veri

**Apple:** 56 listing, 13 model, model başına ortalama 4.3 listing
**Samsung:** 5 listing, 2 model, model başına ortalama 2.5 listing

### Milyon Ölçeğinde Beklenen Dağıtım

Gerçek bir pazaryerinde marka dağılımı power-law (Pareto) izler:

| Marka Grubu | Listing Yüzdesi | Örnek |
|-------------|----------------|-------|
| Apple | ~%15-25 | En yüksek hacim, en çok varyant |
| Samsung | ~%10-15 | İkinci büyük |
| Xiaomi, Huawei, Oppo | ~%5-10 each | Orta segment |
| Diğer 50+ marka | ~%30-40 | Uzun kuyruk |
| Markasız/bilinmeyen | ~%10-25 | Bot kaynaklı, düşük kaliteli listing |

**Partition boyutları:**

| Partition | Tahmini Listing | normalleştirilmiş key |
|-----------|---------------|----------------------|
| apple/Telefon | 150K-250K | organized |
| samsung/Telefon | 100K-150K | organized |
| apple/(category collapse) | ~%5-15 | **collapse riski** |
| (unknown)/Telefon | 50K-150K | brandsiz ama kategorili |
| (unknown)/(unknown) | 50K-200K | **en tehlikeli** |

---

## 6. Null Bucket Analizi

### Mevcut Veri

**null key sayısı: 0** — veri setinde tüm extraction'lar başarılı.

### Edge Case Null Key Durumu

**40 edge case'de null key sayısı: 0.** Engine her başlık için bir key üretir — ya yapısal (brand-model-storage) ya da fallback (normalized title). Hiçbir başlık boş key döndürmez.

Edge case'lerde fallback key üreten durumlar (brand=null olduğu için):
- Arapça başlık: key = `-15-256gb` (**leading hyphen bug** — engine.ts:472'de non-ASCII karakterler silinince başta tire kalır)
- Xbox: key = `xbox-series-x-1tb-1tb`
- Nintendo: key = `nintendo-switch-oled-64gb-64gb`
- A2644: key = `a2644-128gb-uzay-grisi-128gb`
- SM-S918B: key = `sm-s918b-256gb-256gb`
- "telefon": key = `telefon`
- "HARİKA DURUMDA...": key = `harika-durumda-telefon-arayanlar`
- "Saat 45mm": key = `saat-45mm`

### Milyon Ölçeğinde Beklenen

**Tahmini null/malformed key oranı: ~%10-25.** Sınıflandırma:

| Kategori | Tahmini Oran | Açıklama |
|----------|-------------|----------|
| **Brand null + Model var** | ~%5-10 | BRAND_RULES dışı marka, model tespit edilebilir. Key=model-storage (yarı kullanışlı) |
| **Brand null + Model null** | ~%5-15 | Tamamen tanınmayan ürün. Key=normalized_title (kullanışsız) |
| **Brand var + Model null** | ~%2-5 | Brand biliniyor ama model regex'i kaçırdı. Key=brand (collapse riski) |
| **Storage+RAM hepsi null** | ~%5-10 | Tüm teknik detaylar eksik. Key=brand-model (kullanışlı ama storage'siz) |

### Null Key Yönetim Stratejisi

Her null key durumu için farklı bir strateji gerekir:

```
null key?
├── brand null + model var
│   └── → brand+model fallback: model bazında fuzzy match + category filtresi
│
├── brand var + model null
│   └── → BRAND COLLAPSE! category partition zorunlu: category/brand altında fuzzy match
│
├── brand null + model null
│   └── → category partition zorunlu: category altında title similarity match
│
└── her şey null
    └── → global fuzzy match (en pahalı, en düşük başarı)
```

---

## 7. Duplicate Engine Güvenlik ve Mimari Analizi

### normalized_key Çarpışma Analizi (Mevcut Veri)

| Metrik | Değer |
|--------|-------|
| Toplam Benzersiz Key | 31 |
| Çoklu Listing'e Sahip Key | 18 |
| Cross-brand Çarpışma | **0** |
| Collapse Vakası | **0** |

Mevcut veride hiçbir güvenlik sorunu yoktur. Aşağıdaki analiz milyon ölçeği içindir.

### Edge Case Çarpışma Analizi

40 edge case'de cross-brand çarpışma: **0**. Tüm key'ler kendi brand'leri altında unique kaldı. Ancak key duplikasyonu (brand x2, storage x2) future matching'de sorun çıkarabilir:
- Aynı ürünün farklı başlıkları farklı key'ler üretebilir (ör: "Dell XPS 13 512GB" → `dell-dell-xps-13-512gb-512gb` vs "Dell XPS 13 512GB Siyah" → `dell-dell-xps-13-512gb-512gb` — bu durumda aynı)
- Farklı kapasiteler aynı key'de birleşebilir (storage model fallback'inde sabitlendiği için)

### Mimari Analiz: Brand → normalized_key vs Category → Brand → normalized_key

#### 1. Doğru Yaklaşım: Partition = Güvenlik Katmanıdır

Partition'ın amacı, **bir partition'daki listing'lerin başka bir partition'daki listing'lerle asla karşılaştırılmamasını garanti etmektir**. Bu bir optimizasyon değil, güvenlik katmanıdır.

#### 2. Brand → normalized_key'in Zayıf Noktası: Brand Collapse

Brand outer partition, model extraction başarısız olduğunda **işlevsiz kalır**:

```
Category'siz mimari:
  apple partition
  ├── "apple-iphone-15-pro-max-256gb"    ✅ model var, güvenli
  ├── "apple-macbook-air-m1"              ✅ model var, güvenli
  ├── "apple" (Apple Watch 8 → model null) ← collapse!
  └── "apple" (AirPods Pro → model null)  ← FALSE POSITIVE! saat=kulaklık
```

İki farklı ürün (saat ve kulaklık) aynı key'de birleşir → duplicate skoru >= 70 çıkabilir → false positive.

#### 3. Category → Brand → normalized_key'in Koruyucu Rolü

Category eklendiğinde, brand collapse senaryosunda bile kategori filtresi çalışır:

```
Kategorili mimari:
  Telefon/apple partition
  ├── "apple-iphone-15-pro-max-256gb"     ✅ güvenli
  ├── "apple" (iPhone modeli kaçırıldı)   ← sadece telefonlarla karşılaştırılır
  └── "apple" (başka bir iPhone)          ← aynı kategori, makul karşılaştırma

  Saat/apple partition
  └── "apple" (Apple Watch 8)             ← SADECE saatlerle karşılaştırılır
```

**Category, brand collapse'in false positive üretmesini engeller.**

#### 4. Matematiksel Güvence Karşılaştırması

| Senaryo | Brand → key | Category → Brand → key |
|---------|------------|----------------------|
| Brand farklı, model aynı | **Güvenli** (farklı partition) | **Güvenli** (farklı partition) |
| Brand aynı, model farklı, kategori farklı | **RİSKLİ** (collapse) | **Güvenli** (farklı partition) |
| Brand aynı, model farklı, kategori aynı | **RİSKLİ** (collapse) | Kabul edilebilir (gerçek duplicate adayı) |
| Brand null, model farklı | **RİSKLİ** (bilinmeyen partition) | **Daha güvenli** (kategori sınırlar) |
| Brand null, model null | **Güvensiz** (fallback) | **Daha güvenli** (kategori daraltır) |

#### 5. Category Performance Impact

Category eklemenin maliyeti **ihmal edilebilir düzeydedir**:

- **Index:** `(category, brand, normalized_key)` — üç alanlı B-tree index, brand+collapse'daki tekrarları önler
- **Partition sayısı:** ~20 kategori × ~100 marka = ~2000 partition (bir MySQL tablosu kadar)
- **Sorgu deseni:** `WHERE category = ? AND brand = ? AND normalized_key = ?` — her zaman 3 alan da filter'da

Category outer partition eklemek, sadece güvenlik sağlamakla kalmaz, **NULL category için** de çalışır:
- `category = 'bilinmeyen'` veya `category IS NULL` → bu partition kendi içinde yönetilir
- Sorunsuz degradation: category bilinmese bile sistem çalışır, sadece partition daha büyük olur

#### 6. Mimari Karar: Category → Brand → normalized_key

```
         ┌──────────────────────────────────────────────────────────┐
         │                    outer partition                      │
         │              category (detected veya null)              │
         ├──────────────────────────────────────────────────────────┤
         │                    inner partition                      │
         │              brand (detected veya null)                 │
         ├──────────────────────────────────────────────────────────┤
         │                    index (B-tree)                      │
         │              normalized_key (hepsi)                     │
         └──────────────────────────────────────────────────────────┘
```

**İşleyiş:**

1. Gelen listing'den `extractProductSignals()` ile category, brand, model, storage, ram çıkarılır
2. `normalized_key` = `{brand}-{model}-{storage}(-{ram})` hesaplanır
3. Partition = `{category}/{brand}` — ikisi de null olabilir
4. Aynı partition içinde normalized_key üzerinden B-tree index'te eşleme yapılır
5. Eşleşme bulunamazsa → aynı partition içinde fuzzy matching (duplicate engine)
6. Partition dışına asla çıkılmaz

**Category tespit edilemezse:** `bilinmeyen/{brand}` partition'ı kullanılır. Brand de null'sa: `bilinmeyen/bilinmeyen`. Sistem degrade olur ama çalışır.

---

## 8. Extraction Limitasyonları ve İyileştirme Önerileri

### Mevcut Extraction'ın Zayıf Noktaları

| # | Sorun | Etki | Çözüm Önerisi |
|---|-------|------|--------------|
| 1 | iPhone regex sadece 11-16 aralığı | iPhone SE, X, XS, XR, 17+ kaçar | Regex aralığını genişlet: `1[0-9]` veya configüre edilebilir yap |
| 2 | Samsung regex sınırlı | Note, J, F, Tab serileri, Z Fold detayı eksik | Regex setini genişlet |
| 3 | Model fallback brand+storage içerir | Dell/HP/Lenovo/ASUS/MSI/Xiaomi/Huawei/Google/OnePlus → key'de brand x2, storage x2 | Model fallback'ten brand ve storage token'larını çıkar |
| 4 | Telefon dışı kategorilerde model regex yok | Monitör, TV, beyaz eşya, spor aletleri | Kategori bazlı model regex'leri (ör: TV için "55\\s*inch\|OLED\|QLED") |
| 5 | Category detection çok kırılgan | Sadece 4 kategori tanımlı | Kategori eşleme sistemini genişlet |
| 6 | Samsung Galaxy + Telefon sıralaması hatalı | Samsung Tab → Telefon (edge case testinde doğrulandı) | Tablet kontrolünü Telefon'dan önce koy |
| 7 | Storage regex greedy: ilk eşleşmeyi alır | OnePlus 12 16GB RAM 512GB → storage=16gb (RAM'deki değer) | Storage regex'inin RAM'den sonraki değere bakması gerek |
| 8 | Model fallback brand öncesi token'ları alır | "YENİ NESİL 5G DESTEKLİ HUAWEİ MATE 60 PRO" → model="yeni-nesil-5g-destekli" | Fallback'te brand'den sonraki token'lardan başla |
| 9 | non-ASCII karakterler key'de sorun çıkarır | Arapça başlık → key="-15-256gb" (leading hyphen) | Boş keyParts durumunda leading hyphen temizle |
| 10 | S24+ ve benzeri "+" varyantları kaybolur | Samsung S24+ → galaxy-s24 (+ → plus dönüşmez) | Normalizasyonda "+" → "plus" dönüşümü ekle |
| 11 | MSI Türkçe 'ı' normalizasyonu | MSI → msı (toLocaleLowerCase('tr-TR')), key'de "msi-ms-" | MSI özel durumu için normalizasyon muafiyeti |
| 12 | Storage regex GB/TB ile sınırlı | "128 GB", "256GB" çalışır ama "512 gb" veya "1 TB" test edilmedi | Yeterli test + normalizasyon |
| 13 | RAM sadece "N GB RAM" formatını tanır | "8GB", "12 GB RAM", "6gb" varyasyonları | RAM regex'ini genişlet |
| 14 | color detection var ama extractProductSignals çıktısında renk önemli değil | Renk duplicate matching'de kullanılmıyor (doğru karar) | Mevcut durum yeterli |

### Ölçek İçin Extraction İyileştirmeleri

1. **BRAND_RULES genişletilebilir olmalı** — yeni markalar eklemek için kod değişikliği gerektirmemeli (config/JSON tabanlı)
2. **Model regex'leri marka bazlı olmalı** — her markanın kendi regex seti olmalı (ör: apple için iPhone/iPad/MacBook, samsung için Galaxy S/A/M/Note/Z/Tab)
3. **Model fallback brand+storage duplikasyonu** — fallback model'den brand ve storage değerlerini çıkar
4. **Category detection genişletilmeli** — en az 15-20 kategoriyi kapsamalı, sıralama doğru olmalı (özgün→genel)
5. **Extraction başarısızlık oranı loglanmalı** — marka/model/kategori bazında başarısızlık oranlarını canlı takip

---

## 9. Edge Case Stress Test Sonuçları

### 9.1 Test Metodolojisi

40 sentetik başlık, 7 kategoride tasarlandı:
- **Çapraz kategori benzerleri** (11): iPad, Samsung Tab, PlayStation, Xbox, Nintendo, MacBook, Dell/HP/Lenovo/ASUS/MSI
- **Non-Latin/transliterasyon** (4): Arapça, Kiril, Türkçe İ, tamamen küçük harf
- **Gürültülü/spam** (7): Ünlem, büyük harf, bare iPhone/Samsung, anlamsız, RAM'li
- **SKU kodları** (2): A2644, SM-S918B
- **Eksik bilgi** (3): Sadece brand, brand+model, storage'siz
- **Emoji/HTML** (3): Emoji, HTML entity, S24+ modeli
- **Uzun/karmaşık** (4): Uzun başlık, Huawei gürültülü, saat, RTX ekran kartı

Her başlık için beklenen brand, model, category değerleri önceden tanımlandı ve engine çıktısıyla karşılaştırıldı.

### 9.2 Toplu Sonuçlar

| Metrik | Başarı | Detay |
|--------|--------|-------|
| Brand | **40/40 (%100)** | Tüm markalar doğru tespit edildi veya doğru null döndü |
| Model | **28/40 (%70)** | 12 başarısızlık: 6 genuine bug, 4 kabul edilebilir fallback, 2 gürültü |
| Kategori | **39/40 (%97.5)** | 1 genuine bug: Samsung Tab → Telefon |
| Cross-brand çarpışma | **0** | Hiçbir key farklı brand'ler arasında çakışmadı |
| Null key | **0** | Engine her başlık için bir key üretti |
| Key duplikasyonu | **12/40** | Brand x2 veya storage x2 içeren key'ler |

### 9.3 Tespit Edilen Engine Bug'ları

Aşağıdaki 8 bug, edge case testi sırasında tespit edilmiş ve kod seviyesinde doğrulanmıştır:

| # | Bug | Edge Case | Kök Neden (engine.ts satır) | Etki |
|---|-----|-----------|----------------------------|------|
| 1 | **Samsung Tab → Telefon** | "Samsung Galaxy Tab S9 256GB" | `detectCategory()`:549 — Samsung Galaxy kontrolü, Tablet kontrolünden (552) önce gelir. "Galaxy" regex'i telefon olarak sınıflar. | Kategori hatası, Samsung tabletlerin tamamı Telefon olarak algılanır |
| 2 | **Key'de brand x2 + storage x2** | Dell XPS 13, HP Pavilion, Lenovo ThinkPad, ASUS ROG, MSI GF63, Xiaomi Redmi Note, Huawei P60, Google Pixel 8, OnePlus 12 | `detectModel()`:490-523 — `tokens.slice(0,4)` fallback'i brand+storage token'larını da içerir. `normalizedKey` assembly'sinde brand ve storage tekrar eklenir. | Key'ler gereksiz uzun, potansiyel false negative |
| 3 | **Arabic → leading hyphen key** | "ايفون 15 برو ماكس 256GB" | `normalizedKey`:472 — `replace(/[^a-z0-9]+/g, "-")` Arapça karakterleri temizler, geriye "-15-256gb" kalır | Geçersiz key formatı, leading hyphen |
| 4 | **Storage greedy regex** | "OnePlus 12 16GB RAM 512GB", "Samsung Galaxy S23 Ultra 12GB RAM 256GB" | `detectStorage()`:526 — `\b(\d{2,4}gb|\d+tb)\b` ilk eşleşmeyi alır (16gb veya 12gb), RAM'deki değeri storage sanır | Yanlış storage tespiti → yanlış key |
| 5 | **Huawei Mate 60 Pro → gürültülü model** | "YENİ NESİL 5G DESTEKLİ HUAWEİ MATE 60 PRO 512GB" | `detectModel()`:522 — fallback `tokens.slice(0,4)` brand'den önceki gürültü token'larını alır: "yeni-nesil-5g-destekli" | Anlamsız model string'i |
| 6 | **S24+ → "+" kaybolur** | "Samsung S24+ 256GB" | `normalizeProductTitle()`:132 — `toLocaleLowerCase('tr-TR')` ve regex temizliği "+" karakterini siler. Samsung regex "s24" eşleşir ama "plus" eklenmez. | Model "galaxy-s24" olur, "galaxy-s24-plus" olmalı |
| 7 | **MSI Türkçe 'ı' normalizasyonu** | "MSI GF63 Thin 512GB" | `normalizeProductTitle()`:132 — `toLocaleLowerCase('tr-TR')` "MSI" → "msı". BRAND_RULES "msı" içerir (doğru). Model fallback: "msı-gf63-thin-512gb". Key'de "msi-ms-" | Model'de "ms" (hatalı), key'de brand+model çakışması |
| 8 | **iPad 10. Nesil → model "ipad-10"** | "iPad 10. Nesil 64GB Wi-Fi" | `detectModel()`:516 — `/\bipad\s*(\d+\|air\|pro\|mini)?(?:\s*nesil)?\b/` regex'i "10." ile eşleşir, "nesil" normalize edilir. Model "ipad-10" olur. | Minör: "nesil" bilgisi kaybolur, "ipad-10-nesil" olmalı |

### 9.4 Gerçek Veriye Etki Analizi

61 gerçek listing'de **bu bug'ların hiçbiri görülmez**:

| Bug # | Gerçek Veride Var mı? | Açıklama |
|-------|----------------------|----------|
| 1 (Samsung Tab) | **Hayır** | Gerçek veride Samsung Tab yok (sadece 1 iPad var, doğru tespit) |
| 2 (Key duplikasyonu) | **Hayır** | Tüm gerçek listing'ler Apple/Samsung iPhone — model regex'leri var, fallback kullanılmaz |
| 3 (Arapça) | **Hayır** | Tüm başlıklar Latin karakterli |
| 4 (Storage greedy) | **Hayır** | Gerçek listing'lerde RAM model'den sonra gelir veya hiç yoktur |
| 5 (Huawei gürültü) | **Hayır** | Gerçek veride Huawei yok |
| 6 (S24+) | **Hayır** | Gerçek veride S24+ yok (S24 ve S23 modelleri var) |
| 7 (MSI ı) | **Hayır** | Gerçek veride MSI yok |
| 8 (iPad nesil) | **Kısmen** | iPad 9. Nesil mevcut — model="ipad-9" çalışır (nesil'siz) |

**Sonuç:** Mevcut 61 listing için engine %100 doğru çalışır. 8 bug, yeni kaynaklardan gelecek listing'lerde (Samsung Tab, Dell/HP dizüstü, Huawei telefon, OnePlus, Arapça pazar) ortaya çıkacaktır.

### 9.5 Başarılı Edge Case Örnekleri

Edge case testinde başarıyla geçilen zorlu senaryolar:

| Senaryo | Başlık | Sonuç |
|---------|--------|-------|
| Emoji | "iPhone 15 Pro Max 256GB ❤️ SIFIR" | apple-iphone-15-pro-max-256gb ✅ |
| HTML entity | "iPhone 13 128GB &amp; Kılıf Hediyeli" | apple-iphone-13-128gb ✅ |
| Kiril karakter | "iPhone 15 Pro Max 256GB сірий" | apple-iphone-15-pro-max-256gb ✅ |
| Türkçe İ | "IPhone 15 PRO MAX 256GB PİXEL ÇOK TEMİZ" | apple-iphone-15-pro-max-256gb ✅ |
| Bare iPhone | "16 pro max 256 gb siyah" | apple-iphone-16-pro-max-256gb ✅ |
| Bare Samsung | "s23 128 gb" | samsung-galaxy-s23-128gb ✅ |
| Uzun başlık | "2024 Model SIFIR AYARINDA Samsung Galaxy S24 Ultra 256GB 12GB RAM..." | samsung-galaxy-s24-ultra-256gb ✅ |
| PlayStation | "PlayStation 5 825GB Dijital" | sony-playstation-5-825gb-dijital-825gb ✅ |
| MacBook | "MacBook Air M1 256GB" | apple-macbook-air-m1-256gb ✅ |
| RTX Ekran Kartı | "RTX 4090 24GB Ekran Kartı" | nvidia-rtx-4090-24gb-ekran-24gb ✅ |

---

## Özet ve Mimari Tavsiyeler

### Doğrulama Sonuçları

| Metrik | 61 listing | Edge case (40) | Milyon ölçeği (tahmini) |
|--------|-----------|----------------|----------------------|
| Brand çıkarımı | %100 | %100 | ~%70-85 |
| Model çıkarımı | %100 | %70 | ~%60-80 |
| normalized_key | %100 | %70 (28/40 temiz) | ~%55-80 |
| Kategori tespiti | %100 | %97.5 | ~%75-90 |
| Cross-brand çarpışma | 0 | 0 | 0 (matematiksel garanti) |

### Mimari Kararlar

1. **Category → Brand → normalized_key** üç katmanlı mimari kullanılmalıdır. Category, model extraction başarısız olduğunda (brand collapse) false positive'leri engelleyen kritik güvenlik katmanıdır.

2. **Tüm katmanlar NULL tolere etmelidir.** Category null → "bilinmeyen" partition'ı. Brand null → markasız partition. Sistem degrade olur ama çökmez.

3. **normalized_key migration'ı uygulanabilir.** Mevcut 21 product için JS tarafında key hesaplanır. Migration sonrası tüm yeni product'lar application katmanında key alır.

4. **Extraction'ın zayıf noktaları bilinmelidir.** Edge case testi, engine'in tanıdık markalarda (Apple, Samsung) kusursuz, tanımadık markalarda ve gürültülü başlıklarda zayıf olduğunu göstermiştir. 8 bug tespit edilmiş olup bunlardan hiçbiri mevcut 61 listing'i etkilemez.

5. **Fallback mekanizması tasarımın birinci sınıf vatandaşı olmalıdır.** Null key durumları istisna değil, beklenen durumdur. Her seviyede (category→brand→key) fallback tanımlanmalıdır.

### Uygulama Sırası

```
1. ✅ Data validation (bu rapor) — 40 edge case testiyle genişletildi
2. ⬜ normalized_key migration (SQL + backfill)
3. ⬜ Category→Brand→normalized_key üç katmanlı architecture
4. ⬜ Repository refactor: paginated scan → indexed query
5. ⬜ Duplicate engine update (category-aware scoring)
6. ⬜ Extraction iyileştirmeleri (yeni marka/model regex'leri + 8 bug fix)
```
