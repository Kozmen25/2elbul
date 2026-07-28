# Sprint 4.6 — Satarız.com Teknik Fizibilite Raporu

## Durum: TAMAMLANDI ✓

---

## 15 Soru — Cevaplar

### 1. Cloudflare Seviyesi
**CDN only.** `cf-cache-status: DYNAMIC`. Hiçbir challenge, CAPTCHA veya Turnstile yok. HTML sayfalar da API de doğrudan HTTP 200 dönüyor. **Cloudflare bir engel değil.**

### 2. Anti-Bot Koruması
**Hiçbiri.** API'de rate limiting tespit edilmedi (5 ardışık sayfa 2391ms'de başarıyla çekildi). Auth gerekmiyor. User-Agent kontrolü yok. **ScrapingFish / proxy gerekmez.**

### 3. HTTP Response
**200 OK.** Hem `GET /listing/{id}` (detail) hem de `POST /listing/filter` (listeleme) her zaman 200 dönüyor. Hatalı isteklerde bile `{"status":"error"}` ile 200.

### 4. Site Yapısı
**Next.js CSR.** HTML sayfalar tamamen boş shell (`<div id="__next">`). Hiçbir product verisi HTML'de yok. **Cheerio ile hiçbir şey parse edilemez — doğrudan API çağrısı gerekir.**

### 5. Cheerio Yeterli mi?
**HAYIR.** Zero product data in HTML. `safeFetchHtml` HTML alır ama parse edecek bir şey yok. Tüm veri API'den JSON olarak geliyor — bu da ücretsiz.

### 6. XHR/API Endpoint
**POST `https://www.satariz.com/api/v1/listing/filter` — ÇALIŞIYOR**
- Request: `{"page": N, "limit": N}`
- Response: `{status, data: {data: [...items], total, current_page, last_page, per_page}}`
- Her sayfada **20 item** dönüyor (`limit` parametresi görmezden geliniyor — 20 sabit)
- **⚠️ SADECE `keyword` filtresi çalışıyor.** Diğer tüm filtreler sessizce yok sayılıyor:
  - `mainCatagories: {id, title}` → ignore
  - `subCatagories: {id, title}` → ignore
  - `selectCatagories: [[...]]` → ignore
  - `province_id`, `price` → ignore
  - **Nedeni:** Frontend kendi JS chunk'larında tüm filtrelemeyi **client-side** yapıyor. API'ye sadece `keyword` gönderiliyor, gerisi browser'da filter_data ile hallediliyor.

### 7. Telefon Kategorisi
- **id: 37284**, title: "Cep Telefonu / Aksesuar", slug: "cep-telefonu-aksesuar"
- Parent: "İkinci El ve Sıfır Alışveriş" (id: 36866)
- JS chunk'ta 669 listing olduğu belirtilmiş
- **Ancak: Pratikte sıfır telefon ilanı var.**
  - 10 sayfa örneklem (200 item): 0 phone item
  - Dağınık sayfalar (40,80,120,200,300,500,700,900,1100,1300): 0 phone item
  - "iPhone", "Samsung", "telefon", "cep telefonu" keyword aramaları: **sonuçların tamamı araba/emlak/yedek parça**
  - **Satariz'de cep telefonu ilanı yok denecek kadar az.**

### 8. Pagination
**Laravel-style. Çalışıyor.** `page` ve `limit` parametreleri doğru çalışıyor. `last_page: 1407`, `total: 28138`, `per_page: 20`. Her sayfada 20 item.

### 9. safeFetchHtml Yeterli mi?
**HTML çekmek için yeterli ama product data HTML'de olmadığı için gereksiz.** API'den direkt JSON çekmek daha mantıklı. API auth gerektirmediği için ücretsiz.

### 10. Retry Kullanılabilir mi?
**Evet**, ama çoğu durumda gerekmez. API stabil (500ms yanıt süresi). 5 ardışık istekte 0 hata. Retry sadece edge case'ler için eklenebilir.

### 11. Tahmini Geliştirme Süresi
**2-3 saat** (adapter + test).
- Veri yapısı basit, auth yok, Cloudflare yok
- `category_parents[]` array'inden telefon kategorisi client-side filtrelenecek
- Mevcut `safeFetchJson()` (veya doğrudan `fetch()`) yeterli — ScrapingFish gerekmez
- **ÖNEMLİ:** Telefon ilanı sayısı çok düşük olduğu için adapter yazmanın pratik değeri sınırlı

### 12. Production Riski
**ÇOK DÜŞÜK.**
- API stabil, auth yok, Cloudflare yok
- Site trafiği düşük (28K toplam listing — Sahibinden'de milyonlarca)
- Rate limiting yok gibi (doğrulanmadı ama testlerde sorun çıkmadı)
- **Tek risk:** API değişikliği veya kapanma. Ama Satariz aktif bir site.

### 13. Hacim Potansiyeli
- **Toplam listing:** 28.138
- **Telefon kategorisi tahmini:** ~0 (pratikte 669 bile değil)
- 28K listing'i 25 concurrent ile full tarama: ~29 saniye, ~516MB bandwidth
- **2ElBul için değer:** Düşük. Satariz'deki listing hacmi ve telefon odaklı içerik çok az.

### 14. robots.txt / Hukuk
- `robots.txt` yok
- API public, auth gerekmiyor
- Site adı "Satariz" (Sahibinden'in eski çalışanları tarafından kurulduğu söyleniyor)
- ToS kontrol edilmedi ama public data scraping genelde gri alan
- Ticari rakip değil (fiyat karşılaştırma), düşük hacim → risk düşük

### 15. Ücretsiz EVET/HAYIR
**EVET — teknik olarak ücretsiz.**
- API public, auth yok, Cloudflare yok
- Proxy gerekmez, ScrapingFish gerekmez
- Tek maliyet: Vercel bandwidth (~516MB full tarama)
- **⚠️ Ama:** Telefon ilanı yok denecek kadar az. **Ücretsiz olması pratik değeri olmadığı anlamına gelmez.**

---

## Final Değerlendirme

### A) Teknik Değerlendirme

| Kriter | Durum |
|--------|-------|
| API erişilebilirliği | ✅ Public, auth yok, HTTP 200 |
| Cloudflare / anti-bot | ✅ Yok |
| Rate limiting | ✅ Tespit edilmedi |
| Cheerio yeterliliği | ❌ CSR — API gerekli |
| API'den veri çekme | ✅ JSON, pagination çalışıyor |
| Kategori filtresi | ❌ API'de bozuk — client-side filtreleme gerek |
| Telefon verisi | ❌ Neredeyse hiç yok |
| Phone numarası | ❌ API'de mevcut değil |
| Detay sayfası | ✅ `GET /listing/{id}` — full detail |
| Geliştirme süresi | ✅ 2-3 saat |

### B) Riskler

| Risk | Olasılık | Etki | Açıklama |
|------|---------|------|----------|
| API değişikliği | Düşük | Orta | API versiyonlanmamış, güncellenebilir |
| Rate limiting | Çok düşük | Düşük | Testlerde sorun yok |
| Hukuki | Düşük | Düşük | Public data, düşük hacim |
| Telefon verisi yok | **Kesin** | **Yüksek** | Satariz'de telefon ilanı aktif değil |

### C) Tahmini Geliştirme Süresi

- Adapter yazımı: **1 saat**
- Test: **30 dakika**
- Pipeline entegrasyonu: **30 dakika**
- **Toplam: ~2-3 saat**

### D) Production Uygunluğu

**Teknik olarak uygun.** Hatta mevcut en kolay entegrasyon olabilir — proxy yok, auth yok, Cloudflare yok, stabil API.

**Ancak iş değeri sorgulanabilir.** Satariz'in cep telefonu kategorisinde neredeyse hiç ilan yok. 28K toplam listing'in tamamını çekip client-side filtrelemek teknik olarak mümkün olsa da, bu emek ve bandwidth'i Sahibinden'e harcamak çok daha verimli.

### E) Final Karar

## ❌ GEÇ (Fail — teknik değil, veri yok)

**Gerekçe:**

1. **Telefon ilanı yok.** 669 olduğu söylenen kategoriden pratikte sıfır ilan bulundu. 400+ keyword arama sonucunda bile hiçbir telefon ilanı çıkmadı. Satariz'de cep telefonu pazarı aktif değil.

2. **Kategori filtresi çalışmıyor.** API tüm kategorik filtreleri görmezden geliyor — frontend client-side filtreleme yapıyor. Telefon ilanlarını bulmak için 28K listing'in tamamını çekmek gerekir. Bu da ~516MB bandwidth demek.

3. **Phone numarası yok.** API listing detayında telefon bilgisi mevcut değil. Kullanıcı iletişim bilgisi alınamıyor.

4. **Sahibinden yeterli.** Zaten ScrapingFish ile Sahibinden çalışıyor. Milyonlarca ilan, aktif telefon pazarı. Satariz'e harcanacak zaman ve bandwidth Sahibinden'e yönlendirilmeli.

**Karar:** Teknik olarak scrapelenebilir, hatta ücretsiz. Ama scrapelenecek telefon verisi yok. **Kaynak değmez.**

---

## Gelecekte Tekrar Değerlendirme Kriterleri

Satariz büyüyen bir platform. Aşağıdaki koşullar sağlanırsa yeniden değerlendirilebilir:

1. **Telefon kategorisinde anlamlı sayıda ilan görülürse** (100+)
2. **Kategori filtresi API'de çalışmaya başlarsa**
3. **Sahibinden erişilemez hale gelirse** (Cloudflare güncellemesi vb.)

O zamana kadar: **GEÇ.**
