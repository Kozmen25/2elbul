# 2ElBul

2ElBul, farklı platformlardaki ikinci el ilanları karşılaştırmak ve piyasa
fiyatlarını değerlendirmek için hazırlanmış mobil uyumlu bir MVP uygulamasıdır.
İlanlar ve ürünler Supabase üzerinde saklanır.

## Teknolojiler

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase
- Lucide React

## Gereksinimler

- Node.js 20.9 veya üzeri
- npm 10 veya üzeri
- Bir Supabase projesi

## Yerel Kurulum

Bağımlılıkları yükleyin:

```bash
npm install
```

Örnek ortam dosyasını `.env.local` adıyla oluşturun:

```bash
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

`.env.local` içindeki değerleri Supabase projenize göre doldurun:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
IMPORT_API_KEY=use-a-long-random-secret
CRON_SECRET=use-another-long-random-secret
ADMIN_EMAILS=kozmen25@gmail.com,ozmebomer9@gmail.com
```

Bu değerleri Supabase panelindeki **Project Settings > API** bölümünden
alabilirsiniz. `NEXT_PUBLIC_SUPABASE_ANON_KEY` değişkenine Supabase'in
publishable key (`sb_publishable_...`) veya eski anon key değeri yazılabilir.
`.env.example` içindeki örnek metinler gerçek anahtar değildir.

`SUPABASE_SERVICE_ROLE_KEY` yalnızca sunucudaki aktarım rotasında kullanılır.
Bu anahtarı `.env.local` veya Vercel Environment Variables içinde tutun; repoya
commit etmeyin ve anahtara `NEXT_PUBLIC_` ön eki eklemeyin.

Admin panelindeki sayaçlar, kullanıcı yönetimi ve veri düzenleme işlemleri de
bu server-only anahtarı kullanır. Anahtar hiçbir client component içine
aktarılmaz.

`CRON_SECRET`, `/api/cron/daily`, `/api/cron/run-sources` ve
`/api/cron/process-search-queue` rotalarını korur. Bu değer de server-only
kalmalı ve `NEXT_PUBLIC_` ön eki almamalıdır.

Projedeki `.gitignore`, `.env*` dosyalarını yok sayar ve yalnızca
`.env.example` dosyasının repoya eklenmesine izin verir. `.vercelignore` da
Vercel CLI ile doğrudan deploy sırasında yerel ortam dosyalarını dışarıda tutar.

## Supabase Auth Kurulumu

Uygulama e-posta ve şifre ile kayıt, giriş ve çıkış akışlarını destekler.

1. Supabase panelinde **Authentication > Providers > Email** bölümünü açın.
2. Email provider seçeneğini etkinleştirin.
3. **Authentication > URL Configuration** bölümünde Site URL değerini yerelde
   `http://localhost:3000`, production ortamında Vercel alan adınız olarak
   ayarlayın.
4. Redirect URLs listesine aşağıdaki adresleri ekleyin:

```text
http://localhost:3000/auth/callback
https://your-domain.vercel.app/auth/callback
```

5. `.env.local` ve Vercel ortam değişkenlerine `NEXT_PUBLIC_SITE_URL` ekleyin.

E-posta doğrulaması açıksa kayıt işleminden sonra kullanıcıya doğrulama e-postası
gönderilir. Doğrulama bağlantısı `/auth/callback` rotasında oturuma çevrilir.
Header giriş durumuna göre `Giriş Yap` ve `Kayıt Ol` ya da `Hesabım`,
`Favoriler` ve `Çıkış Yap` bağlantılarını gösterir.

## Supabase Veritabanı Kurulumu

1. Supabase panelinde **SQL Editor** bölümünü açın.
2. `supabase/schema.sql` dosyasının tamamını çalıştırın.
3. SQL, `products`, `listings`, `search_events`, `favorites` ve
   `price_alerts` tablolarını, indeksleri,
   fiyat değişim trigger'ını ve RLS politikalarını oluşturur.
4. Beş başlangıç ürünü `products` tablosuna otomatik eklenir.

Tablolar daha önce boş olarak oluşturulduysa aynı SQL dosyasını tekrar
çalıştırabilirsiniz. Script mevcut tabloları silmez; eksik `product_id`,
`status`, fiyat ve ilan alanlarını ekleyerek şemayı tamamlar.

### Onerilen SQL Calisma Sirasi

Yeni kurulumda veya eksik migration tamamlamada Supabase SQL Editor icinde
asagidaki dosyalari bu sirayla calistirin:

```text
supabase/schema.sql
supabase/product-slugs.sql
supabase/listing-images.sql
supabase/listing-status.sql
supabase/favorites.sql
supabase/sources-and-bots.sql
supabase/source-bot-publish-mode.sql
supabase/source-integration-settings.sql
supabase/bot-scheduler.sql
supabase/bot-sync.sql
supabase/migrations/bot-center-monitoring.sql
supabase/price-history.sql
supabase/price-alerts.sql
supabase/search-demand-queue.sql
supabase/site-settings.sql
supabase/production-hardening.sql
```

`supabase/bot-sync.sql` dosyasi bot senkronizasyon RPC'sini ve fiyat gecmisi
tetiklerini tamamlar. `supabase/price-history.sql` dosyasi tek basina fiyat
gecmisi tablosunu kurmak icin de tekrar calistirilabilir.
`supabase/production-hardening.sql` yayin oncesi RLS policy'lerini sertlestirir:
anon kullanicilar yalnizca `published` veya `active` ilanlari okuyabilir,
favoriler sadece kullanicinin kendi kayitlarina aciktir, `sources` ve
`bot_runs` public policy almaz.

### Tablolar

`products`:

- `id`
- `name`
- `slug`
- `category`
- `created_at`

### Ürün Slug Kurulumu

Ürün detay sayfalarında `/product/iphone-13` biçimindeki adresleri kalıcı olarak
kullanmak için Supabase **SQL Editor** içinde şu dosyayı çalıştırın:

```text
supabase/product-slugs.sql
```

Migration mevcut ürünlerin slug değerlerini ürün adından üretir, benzersiz
indeks ekler ve yeni ürünlerde slug değerini otomatik oluşturan trigger'ı kurar.
Migration henüz uygulanmamışsa uygulama `products.name` alanından slug üreterek
ürün detay sayfalarını fallback olarak çalıştırır.

### İlan Görseli Kurulumu

İlanlara opsiyonel görsel bağlantısı eklemek için Supabase **SQL Editor** içinde
şu dosyayı çalıştırın:

```text
supabase/listing-images.sql
```

`listings.image_url` boşsa veya uzak görsel yüklenemezse uygulama ürün adına
göre telefon, ekran kartı, konsol, laptop veya genel SVG görseli gösterir.

### İlan Onay Sistemi

Admin panelinde ilanları beklemeye alma, yayınlama ve reddetme özelliklerini
etkinleştirmek için Supabase **SQL Editor** içinde şu dosyayı çalıştırın:

```text
supabase/listing-status.sql
```

Guncel not: Bu migration `listings.status`, `listings.updated_at` ve
`listings.inactive_at` kolonlarini tamamlar. Desteklenen status degerleri
`pending`, `published`, `rejected`, `active` ve `inactive` seklindedir. Bot
senkronizasyonunda yayindaki bot ilanlari `active`, artik kaynakta gorunmeyen
ilanlar `inactive` olabilir.

Migration `listings.status` kolonunu oluşturur. Desteklenen değerler:
`pending`, `published` ve `rejected`. Mevcut ilanlar `published` olarak
işaretlenir. Migration uygulanana kadar uygulama eski şemaya otomatik düşer ve
tüm ilanları göstermeye devam eder.

`listings`:

- `id`
- `product_id`
- `title`
- `external_id`
- `price`
- `previous_price`
- `price_updated_at`
- `city`
- `source`
- `url`
- `condition`
- `image_url`
- `status`
- `updated_at`
- `inactive_at`
- `published_at`
- `imported_at`
- `raw_payload`
- `user_id`
- `created_at`

`search_events`:

- `id`
- `product_id`
- `query`
- `created_at`

`favorites`:

- `id`
- `user_id`
- `listing_id`
- `created_at`

Favoriler tablosunda RLS aktiftir. Oturum açmış kullanıcı yalnızca kendi
favorilerini okuyabilir, ekleyebilir ve silebilir. `user_id + listing_id`
unique constraint'i aynı ilanın aynı kullanıcı tarafından birden fazla kez
favorilenmesini engeller.

### Favorites Tablosu Kurulumu

Favori özelliğini ilk kez kurmak veya eski composite primary key yapısını yeni
`id` primary key yapısına taşımak için Supabase **SQL Editor** içinde şu dosyayı
çalıştırın:

```text
supabase/favorites.sql
```

Bu SQL dosyası:

- `id bigint identity primary key` alanını oluşturur.
- `user_id` alanını `auth.users` tablosuna bağlar.
- `listing_id` alanını `listings` tablosuna bağlar.
- `user_id + listing_id` unique constraint'ini ekler.
- Kullanıcıların yalnızca kendi favorilerini yönetebildiği RLS politikalarını
  oluşturur.

Yeni bir kurulum için temel tablo SQL'i:

```sql
create table public.favorites (
  id bigint generated by default as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id bigint not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint favorites_user_id_listing_id_key unique (user_id, listing_id)
);

alter table public.favorites enable row level security;

create policy "Users can read their favorites"
  on public.favorites for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their favorites"
  on public.favorites for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can remove their favorites"
  on public.favorites for delete to authenticated
  using ((select auth.uid()) = user_id);
```

Tablo daha önce oluşturulduysa yukarıdaki temel SQL yerine tekrar çalıştırılabilir
ve migration içeren `supabase/favorites.sql` dosyasını kullanın.

`price_alerts`:

- `id`
- `user_id`
- `product_id`
- `target_price`
- `is_active`
- `created_at`

İlan ekleme sırasında kullanıcı giriş yaptıysa `listings.user_id` otomatik
olarak kaydedilir. Böylece kullanıcının ilanları Hesabım sayfasında gösterilir.

Ana sayfadaki bölümler şu Supabase verilerini kullanır:

- **Son eklenen ilanlar:** `listings.created_at`
- **En çok aranan ürünler:** `search_events`
- **Son 24 saatte düşen fiyatlar:** `previous_price` ve `price_updated_at`
- **Popüler kategoriler:** `products.category` ve ilan sayıları

Bir ilanın `price` değeri güncellendiğinde trigger eski fiyatı otomatik olarak
`previous_price` alanına, değişim zamanını da `price_updated_at` alanına yazar.

## Kaynaklardan İlan Aktarımı

### Kaynak ve Bot Altyapısı

Otomatik veya zamanlanmış ilan toplayıcılarının kaynaklarını ve çalışma
sonuçlarını saklamak için Supabase **SQL Editor** içinde şu migration dosyasını
çalıştırın:

```text
supabase/sources-and-bots.sql
```

Kaynak ve bot tabloları daha önce kurulduysa bot ilanlarının yayın davranışını
eklemek için ayrıca şu migration dosyasını çalıştırın:

```text
supabase/source-bot-publish-mode.sql
```

Bu migration `sources.bot_listing_status` kolonunu ekler. Değerler:

- `pending`: Bot ilanlarını yönetici onayına gönderir.
- `published`: Bot ilanlarını doğrudan arama sonuçlarında yayınlar.

EasyCep kaynağı migration sonrasında varsayılan olarak `published`, diğer
kaynaklar `pending` olarak ayarlanır. Ayar `/admin/sources` sayfasındaki kaynak
düzenleme penceresinden değiştirilebilir.

Gerçek API ve tarama entegrasyonu ayarlarını eklemek için mevcut kurulumlarda
şu migration dosyasını da çalıştırın:

```text
supabase/source-integration-settings.sql
```

Bu migration `sources` tablosuna şu alanları ekler:

- `api_url`: Kaynağın resmi veya izinli API adresi
- `scrape_url`: İzinli HTML/veri tarama başlangıç adresi
- `cron_enabled`: Zamanlanmış çekimin açık veya kapalı olması
- `cron_schedule`: Çekim sıklığını belirleyen cron ifadesi
- `product_limit`: Bir çalışmada işlenecek en fazla ürün
- `last_success`: Son başarılı bot çalışmasının zamanı

Bu alanlar `/admin/sources` düzenleme ekranından yönetilebilir. Arayüzde API
adresi, tarama adresi, saatlik/günlük çekim sıklığı, ürün limiti ve cron
aktifliği bulunur.

Migration şu tabloları oluşturur:

- `sources`: kaynak adı, slug, site adresi, kaynak tipi, aktiflik durumu, son
  çalışma zamanı ve toplam aktarılan ilan sayısı
- `bot_runs`: bot çalışma durumu, çalışma tipi, başlangıç/bitiş zamanları,
  bulunan/eklenen/atlanan ilan ve hata sayıları

Migration Sahibinden, Letgo, Facebook Marketplace, EasyCep, Getmobil,
Yenilenmiş Market, Teknosa Yenilenmiş, Hepsiburada Yenilenmiş ve MediaMarkt
Yenilenmiş kaynaklarını otomatik ekler.

Her iki tabloda RLS aktiftir ve public erişim politikası tanımlanmaz. Admin
sayfaları tablolara yalnızca server tarafındaki `SUPABASE_SERVICE_ROLE_KEY`
üzerinden erişir.

Admin kullanımı:

1. `/admin/sources` sayfasından kaynak ekleyin, düzenleyin, silin veya
   aktif/pasif durumunu değiştirin.
2. Bot çalışmaya başladığında `bot_runs` tablosuna `running` veya `pending`
   durumunda kayıt oluşturun.
3. Çalışma bittiğinde sayaçları, `finished_at`, `status` ve varsa
   `error_message` alanını güncelleyin.
4. Kaynağın `last_run_at` ve `total_imported` değerlerini güncelleyin.
5. Sonuçları `/admin/bot-runs` sayfasından takip edin.

Genel kaynak altyapısı resmi API, izinli veri sağlayıcı, webhook veya ayrı bir
bot worker çıktısının güvenli şekilde kaydedilmesi için yönetim ve kayıt
katmanını hazırlar. Buna ek olarak EasyCep, Getmobil, Hepsiburada Yenilenmiş,
Teknosa Yenilenmiş, MediaMarkt Yenilenmiş ve Yenilenmiş Market için aşağıda
açıklanan tek sayfalık, en fazla 10 ürünle sınırlı yönetici test çekimi bulunur.

### Gerçek Kaynak Connector Altyapısı

`lib/bots/types.ts` tüm gerçek kaynak entegrasyonlarının uyması gereken ortak
veri sözleşmesini tanımlar. `lib/bots/connectors.ts` ise EasyCep, Getmobil ve
yenilenmiş cihaz kaynakları için API/scrape çalışma modlarını seçebilen
server-only connector iskeletini içerir.

Her kaynak adaptörü ilanları şu ortak formatta döndürmelidir:

```json
{
  "external_id": "provider-product-123",
  "product_name": "iPhone 13",
  "title": "iPhone 13 128GB Yenilenmiş",
  "price": 21999,
  "old_price": 23999,
  "city": "İstanbul",
  "source": "EasyCep",
  "url": "https://easycep.com/urun/ornek",
  "condition": "Yenilenmiş",
  "image_url": "https://cdn.example.com/main.jpg",
  "image_urls": [
    "https://cdn.example.com/main.jpg",
    "https://cdn.example.com/side.jpg"
  ],
  "brand": "Apple",
  "model": "iPhone 13",
  "storage": "128GB",
  "ram": null,
  "color": "Siyah",
  "warranty": "12 ay",
  "seller_name": "EasyCep",
  "source_type": "refurbished_retailer",
  "category": "telefon",
  "status": "pending"
}
```

`image_url` ana ilan görselidir. `image_urls` JSON array veya JSON/string array
olarak gelebilir. Mevcut veritabanında yalnızca `listings.image_url` bulunduğu
için sistem `image_url` değerini, bu alan boşsa `image_urls` içindeki ilk
geçerli HTTP/HTTPS adresini kaydeder. Galeri listesi harici importlarda
`raw_payload` içinde korunabilir.

Gerçek HTML görsel ayrıştırma altyapısı:

- `lib/bots/html-utils.ts`: `absoluteUrl`, `extractImageUrl`,
  `extractImageUrls`, `validateImageUrls`, `safeFetchHtml`, `normalizePrice` ve
  `normalizeCondition`
- `lib/bots/adapters/easycep.ts`: EasyCep ürün adı, fiyat, ürün linki, ana
  görsel ve galeri parser iskeleti
- `lib/bots/adapters/getmobil.ts`: Getmobil ürün adı, fiyat, ürün linki ve
  galeri parser iskeleti
- `lib/bots/adapters/commerce.ts`: Hepsiburada Yenilenmiş, Teknosa Yenilenmiş,
  MediaMarkt Yenilenmiş ve Yenilenmiş Market için ortak JSON-LD / DOM ürün
  parser'ı
- `lib/bots/adapters/hepsiburada-yenilenmis.ts`
- `lib/bots/adapters/teknosa-yenilenmis.ts`
- `lib/bots/adapters/mediamarkt-yenilenmis.ts`
- `lib/bots/adapters/yenilenmis-market.ts`

Gerçek kaynak adaptörleri Cheerio ile sunucu tarafında çalışır. Önce sayfadaki
Schema.org `Product`, `ProductGroup` ve `ItemList` / JSON-LD ürün verisini okur,
gerektiğinde DOM ürün kartlarına düşer. Relative `src`, `data-src`, `srcset`,
lazy-load ve Open Graph görselleri mutlak URL'ye çevrilir. Görsel URL'leri
HEAD isteğiyle doğrulanır; 404 veya `image/*` olmayan adresler kaydedilmez.
Telefon, tablet, akıllı saat, bilgisayar, ekran kartı ve oyun konsolu
kategorileri ürün başlığından otomatik sınıflandırılır.

Gerçek entegrasyon eklerken:

1. Sağlayıcının resmi API veya yazılı izinli veri erişim yöntemini doğrulayın.
2. Kimlik bilgilerini yalnızca server-only environment variable olarak
   tanımlayın; `NEXT_PUBLIC_` ön eki kullanmayın.
3. Sağlayıcı cevabını `ExternalListingCandidate` formatına dönüştürün.
4. `product_limit` değerini uygulayın ve her çalışma için `bot_runs` kaydı
   oluşturun.
5. Başarılı çalışmada `sources.last_success`, her çalışmada
   `sources.last_run_at` alanını güncelleyin.

Otomatik bot zamanlayıcı alanlarını eklemek için şu migration dosyasını
çalıştırın:

```text
supabase/bot-scheduler.sql
```

Bu migration `sources` tablosuna veya mevcut kurulumlarda eksikse şu alanları
ekler:

- `cron_enabled`: Kaynağın otomatik çalışmaya dahil olup olmadığı
- `fetch_limit`: Her bot çalışmasında en fazla kaç ürün işleneceği
- `integration_type`: `manual`, `scrape` veya `api`
- `bot_import_mode`: Bot ilanlarının `pending` ya da `published` eklenmesi
- `last_run_at`: Son bot çalışma zamanı

`/api/cron/run-sources` rotası aktif, `cron_enabled = true`,
`integration_type = 'scrape'` ve gerçek adaptörü hazır olan kaynakları
çalıştırır. Desteklenen scrape kaynakları: EasyCep, Getmobil, Yenilenmiş
Market, Teknosa Yenilenmiş, Hepsiburada Yenilenmiş ve MediaMarkt Yenilenmiş.
Her kaynağın admin panelindeki `cron_schedule` değeri, son çalışmadan bu
yana geçen süre ile karşılaştırılır; aralık dolmadan kaynak atlanır. Vercel
Cron günde iki kez tetiklense bile saatlik planlı kaynaklar yalnızca aralık
dolduğunda çalışır. Her çalışma `bot_runs` tablosuna yazılır, `fetch_limit`
kadar ürünle sınırlanır ve aynı URL daha önce eklenmişse güncellenir veya
atlanır.

Cron rotası public kullanıma kapalıdır. İsteklerde aşağıdaki yöntemlerden
biriyle `CRON_SECRET` gönderilmelidir:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.vercel.app/api/cron/run-sources
curl -H "x-cron-secret: $CRON_SECRET" https://your-domain.vercel.app/api/cron/run-sources
curl "https://your-domain.vercel.app/api/cron/run-sources?secret=$CRON_SECRET"
```

Vercel Hobby planı günlük cron ile sınırlıdır. Bu yüzden production deploy'un
Hobby planda sorunsuz geçmesi için `vercel.json` tek bir günlük cron kullanır:

```json
{
  "crons": [
    {
      "path": "/api/cron/daily",
      "schedule": "0 6 * * *"
    }
  ]
}
```

Vercel cron ifadeleri UTC çalışır. `0 6 * * *`, Türkiye saatiyle yaklaşık
09:00 çalışır. `/api/cron/daily` endpoint'i aynı çalışmada önce
`/api/cron/run-sources`, sonra `/api/cron/process-search-queue`, ardından
`/api/cron/check-price-alerts` endpoint'lerini `CRON_SECRET` ile tetikler.

Pro plana geçildiğinde daha sık otomasyon için `vercel.json` kolayca iki ayrı
cron'a çevrilebilir:

```json
{
  "crons": [
    {
      "path": "/api/cron/run-sources",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/cron/process-search-queue",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

### Arama Tetiklemeli Bot Kuyruğu

Kullanıcı bir ürün aradığında sonuç sayısı 3'ten azsa uygulama aramayı arka
planda bot kuyruğuna ekler. Kullanıcıya şu bilgi gösterilir:

```text
Bu ürün için piyasayı tarıyoruz. Yeni ilanlar geldikçe sonuçlar güncellenecek.
```

Bu özellik canlı arama isteğini yavaşlatmaz; `/api/search-demand` endpoint'i
yalnızca talebi kaydeder ve aktif kaynaklar için `bot_queue` kayıtları üretir.
Gerçek dış platform scraping entegrasyonu bu aşamada başlatılmaz. Kuyruk,
gelecekte kaynak adapter'larına query bazlı arama bağlanabilecek şekilde
hazırlanmıştır.

Kurulum SQL'i:

```text
supabase/search-demand-queue.sql
```

Oluşan talepler `/admin/search-demands` sayfasından izlenir. Admin olmayan
kullanıcılar bu sayfaya erişemez. `bot_queue` tablosunda RLS açıktır ve public
okuma politikası yoktur; kuyruk sadece server-side service role ile yönetilir.

Kuyruk işleme cron endpoint'i:

```text
/api/cron/process-search-queue
```

Bu endpoint de `CRON_SECRET` ile korunur. Elle test için:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.vercel.app/api/cron/process-search-queue
```

Hobby planda bu endpoint doğrudan ayrı bir Vercel Cron olarak tanımlı değildir;
günlük `/api/cron/daily` çalışması içinde tetiklenir. Pro plana geçildiğinde
`vercel.json` içinde 30 dakikada bir ayrı cron olarak yeniden eklenebilir.

### Bot Senkronizasyon Sistemi

Botlar yeni kayıt eklemekle sınırlı değildir; aynı kaynak tekrar çalıştığında
ilanları senkronize eder. Mevcut kurulumlarda önce şu migration dosyasını
çalıştırın:

```text
supabase/bot-sync.sql
```

Bu migration şunları ekler:

- `listings.source_id`, `listings.external_id`, `listings.description`
- `listings.updated_at` ve otomatik update trigger'ı
- `listings.first_seen_at`, `listings.last_seen_at`, `listings.inactive_at`
- `status` değerlerine `active` ve `inactive`
- `bot_runs.updated_count`, `inactive_count`, `reactivated_count`
- `sync_source_listings(source_id, items)` RPC fonksiyonu

Eşleştirme önceliği:

1. `source_id + external_id`
2. Aynı kaynak içindeki `url`

Bot aynı ilanı yeniden bulursa yeni kayıt açılmaz. Fiyat, başlık/açıklama,
görsel, şehir, kaynak, link veya durum değiştiyse kayıt güncellenir ve
`updated_at` otomatik yenilenir. Önceki çekimde bulunan ama yeni çekimde
gelmeyen bot kaynaklı ilanlar silinmez; `status = inactive` yapılır ve
`inactive_at` set edilir. İlan tekrar bulunursa `status = active` olur ve
`inactive_at` temizlenir.

Her bot çalışması sonunda `/admin/bot-runs` ekranında şu sayaçlar görünür:

- Toplam bulunan
- Yeni eklenen
- Güncellenen
- Pasif yapılan
- Tekrar aktif olan
- Atlanan
- Hatalı

Senkronizasyon RPC fonksiyonu tek transaction içinde çalışır ve kaynak bazlı
advisory lock kullanır. `source_id + external_id` ve `source_id + url` unique
indexleri aynı anda çalışan botlarda duplicate kayıt oluşmasını engeller.

Manuel bot sync kontrolu icin Supabase SQL Editor'da once desteklenen bir
kaynak id'si bulun:

```sql
select id, name, slug from public.sources order by id;
```

Ardindan `/admin/sources` sayfasindan ayni kaynak icin demo veya gercek test
cekimi calistirin. Kontrol sorgulari:

```sql
select id, source_id, external_id, status, first_seen_at, last_seen_at, inactive_at
from public.listings
where source_id is not null
order by updated_at desc
limit 20;

select source, price, recorded_at
from public.price_history
order by recorded_at desc
limit 20;

select found_count, imported_count, updated_count, inactive_count,
       reactivated_count, skipped_count, error_count, error_message
from public.bot_runs
order by created_at desc
limit 10;
```

### Fiyat Geçmişi

Ürün detay sayfasındaki profesyonel fiyat geçmişi grafiği için Supabase **SQL
Editor** içinde şu migration dosyasını çalıştırın:

```text
supabase/price-history.sql
```

Bu migration `price_history` tablosunu oluşturur:

- `id`
- `product_id`
- `listing_id`
- `source`
- `price`
- `recorded_at`

Bot senkronizasyonu `sync_source_listings()` RPC fonksiyonu içinde fiyat
geçmişini otomatik günceller. Yeni bot ilanı eklendiğinde ilk fiyat kaydı
oluşturulur. Mevcut ilan tekrar bulunduğunda fiyat değişmişse yeni
`price_history` kaydı yazılır. Fiyat değişmemişse aynı gün aynı fiyat için ikinci
kayıt oluşturulmaz.

Ürün detay sayfası `/product/[slug]` altında Recharts tabanlı gerçek grafik
kullanır. Grafik şu aralıkları destekler:

- Son 7 gün
- Son 30 gün
- Son 90 gün
- Tümü

Grafikte en düşük fiyat yeşil, ortalama fiyat turuncu, en yüksek fiyat kırmızı
ve outlier filtreli piyasa değeri siyah kesikli çizgiyle gösterilir. Grafiğin
altında bugünkü fiyat, 7/30/90 günlük değişim yüzdeleri, en düşük ve en yüksek
fiyat kartları yer alır.

Piyasa değeri yalnızca basit ortalama değildir. Sistem önce çok uç fiyatları
IQR ve median tabanlı filtreyle çıkarır; sonra median ve ortalamayı ağırlıklı
birleştirerek daha dengeli piyasa değeri hesaplar. Arama kartlarındaki yıldızlı
fırsat rozeti de aynı piyasa değerini kullanır. Piyasanın yaklaşık `%40` altında
kalan ilanlar ürün detayında **Şüpheli ucuz ilanlar** bölümünde ayrıca gösterilir.

### Gerçek Test Çekimi

Admin paneli aşağıdaki kaynaklar için sınırlı gerçek test çekimini destekler:

```text
EasyCep: https://easycep.com/kategori/cep-telefonu-1
Getmobil: https://getmobil.com/satin-al/cep-telefonu/
Hepsiburada Yenilenmiş: https://www.hepsiburada.com/ara?q=yenilenmi%C5%9F
Teknosa Yenilenmiş: https://www.teknosa.com/arama/?s=yenilenmi%C5%9F
MediaMarkt Yenilenmiş: https://www.mediamarkt.com.tr/tr/search.html?query=yenilenmi%C5%9F
Yenilenmiş Market: https://www.yenilenmismarket.com/
```

Kullanım:

1. `supabase/source-integration-settings.sql` migration dosyasını çalıştırın.
2. Admin hesabıyla giriş yapıp `/admin/sources` sayfasını açın.
3. Desteklenen kaynak satırındaki **Gerçek test çekimi** butonuna basın.
4. Çalışmayı `/admin/bot-runs`, eklenen ilanları `/admin/listings` sayfasından
   kontrol edin.
5. İlanları kontrol ettikten sonra admin ilan yönetiminden yayınlayın.

Gerçek test çekimi yalnızca tek kategori/arama sayfasına sınırlı istek gönderir,
ürün detay sayfalarını ayrıca agresif şekilde açmaz ve en fazla 10 ürünü işler.
İstekte açık bir User-Agent, 15 saniyelik timeout, retry, kısa rate-limit
beklemeleri ve 5 MB HTML sınırı kullanılır. Çekilen ilanlar kaynak ayarından
bağımsız olarak `pending` kaydedilir.

Aynı URL daha önce `listings` tablosunda varsa kayıt atlanır. Eksik ürünler
`products` tablosunda oluşturulur. Çalışma sonunda `bot_runs` sayaçları ile
`sources.last_run_at`, `sources.last_success` ve `sources.total_imported`
alanları güncellenir.

Kaynak HTTP hatası döndürür, isteği engeller veya timeout oluşursa çalışma
`failed` olarak kaydedilir ve gerçek hata `bot_runs.error_message` alanında
gösterilir. Sayfa erişilebilir olduğu halde ürün bulunamazsa çalışma `success`
kalır; `error_message` alanına
`Ürün bulunamadı veya HTML yapısı değişmiş olabilir` uyarısı yazılır.

Bu özellik düşük hacimli yönetici testi içindir. Otomatik periyodik ve yüksek
hacimli çekim başlatmaz; üretim entegrasyonunda sağlayıcının kullanım şartları,
robots politikası ve resmi API seçenekleri ayrıca doğrulanmalıdır.

### Demo Bot Testi

Gerçek kaynaklara bağlanmadan bot ve moderasyon akışını test etmek için admin
panelindeki demo bot kullanılabilir:

1. Admin hesabıyla giriş yapın ve `/admin/sources` sayfasını açın.
2. Test etmek istediğiniz kaynağın **Demo test çekimi** butonuna basın.
3. Onaydan sonra sistem seçilen kaynak adına 10 adet sahte fakat gerçekçi ilan
   üretir.
4. Eksik ürünler `products` tablosuna eklenir, mevcut ürünlerin kimliği tekrar
   kullanılır.
5. Benzersiz demo URL'leri `https://demo.2elbul.com/{kaynak}/{çalışma}-{sıra}`
   formatında oluşturulur.
6. İlanlar kaynağın bot ayarına göre `pending` veya `published` olarak
   kaydedilir. EasyCep varsayılan olarak doğrudan yayınlanır.
7. Eklenen ilanları `/admin/listings`, çalışma sonucunu
   `/admin/bot-runs` sayfasından kontrol edin.

Demo çalışması başlarken `bot_runs.status = 'running'` ve
`run_type = 'test'` kaydedilir. İşlem sonunda bulunan, eklenen, atlanan ve
hatalı kayıt sayaçlarıyla birlikte durum `success` veya `failed` olarak
güncellenir. Kaynağın `last_run_at` ve `total_imported` alanları da otomatik
güncellenir.

EasyCep, Getmobil ve yenilenmiş cihaz mağazalarında üretilen demo ilanların
çoğu `Yenilenmiş`; diğer kaynaklarda ise `İkinci El`, `Yeni gibi`, `İyi` veya
`Yenilenmiş` durumlarından biri olur. Demo bot yalnızca server action içinde
çalışır, admin yetkisini tekrar doğrular ve gerçek üçüncü taraf sitelere istek
göndermez.

Pending ilanları toplu yayınlamak için:

1. `/admin/listings` sayfasını açın.
2. Satır seçim kutularından ilanları seçin veya başlıktaki kutuyla tüm görünen
   ilanları seçin.
3. **Seçilenleri Yayında yap** butonuna basın.

Toplu işlem yalnızca admin server action üzerinden çalışır ve seçilen ilanların
`status` değerini `published` olarak günceller.

### Admin JSON, CSV ve Excel Import

Yalnızca uygulamada tanımlanan admin e-posta adresleri `/admin/import`
sayfasından ortak formattaki JSON, CSV veya Excel ilanlarını toplu olarak
aktarabilir. Yetki hem sayfa açılırken hem de server action çalışırken yeniden
doğrulanır.

`.env.local` ve Vercel ortam değişkenlerinde
`SUPABASE_SERVICE_ROLE_KEY` tanımlı olmalıdır. Bu anahtar yalnızca server
action içinde kullanılır ve tarayıcıya gönderilmez.

Örnek JSON:

```json
[
  {
    "product_name": "iPhone 13",
    "title": "iPhone 13 128GB Temiz",
    "price": 21000,
    "city": "İstanbul",
    "source": "Sahibinden",
    "url": "https://example.com",
    "condition": "İkinci El",
    "image_url": "https://example.com/iphone-13.jpg",
    "image_urls": [
      "https://example.com/iphone-13.jpg",
      "https://example.com/iphone-13-side.jpg"
    ]
  }
]
```

Yenilenmiş cihaz örneği:

```json
[
  {
    "product_name": "Samsung S24",
    "title": "Samsung S24 256GB Yenilenmiş",
    "price": 28999,
    "city": "Ankara",
    "source": "EasyCep",
    "url": "https://example.com/yenilenmis-samsung-s24",
    "condition": "Yenilenmiş",
    "image_url": "https://example.com/samsung-s24.jpg"
  }
]
```

`condition` alanı ikinci el ilanlarda `İkinci El`, `Yeni gibi` veya `İyi`;
yenilenmiş cihazlarda `Yenilenmiş` olarak gönderilebilir.

Kullanım:

1. Uygulamaya giriş yapın.
2. `/admin/import` sayfasını açın.
3. İlanları JSON dizisi olarak textarea alanına yapıştırın veya `.csv`/`.xlsx`
   dosyası seçin.
4. İlk 10 kaydı ve toplam kayıt sayısını önizleme tablosunda kontrol edin.
5. **İlanları içe aktar** butonuna basın.
6. Eklenen, daha önce var olan ve hatalı ilan sayılarını sonuç panelinden
   kontrol edin.

CSV ve Excel dosyalarının ilk satırında şu kolon başlıkları bulunmalıdır:

```csv
product_name,title,price,city,source,url,condition,image_url,image_urls
```

Excel aktarımında `.xlsx` dosyasının yalnızca ilk sayfası okunur. CSV ve Excel
dosyaları tarayıcıda JSON'a dönüştürülerek aynı güvenli server action üzerinden
işlenir. `image_url` ve opsiyonel `image_urls` alanları boş bırakılabilir.
CSV içinde `image_urls` değeri JSON array metni veya virgül/satır ayrımlı URL
listesi olabilir.

Aktarım sırasında `product_name` değeri `products.name` alanında aranır. Ürün
yoksa oluşturulur, varsa mevcut `product_id` kullanılır. Aynı `listings.url`
değeri daha önce kaydedilmişse ilan tekrar eklenmez. Fiyat hem number hem de
sayısal string olarak kabul edilir. Tek seferde en fazla 500 kayıt işlenir.

Hatalı kayıtlar sıra numarası, ilan başlığı ve hata açıklamasıyla listelenir.

## Admin Paneli

Admin paneli aşağıdaki rotalardan oluşur:

- `/admin`: genel sayaçlar
- `/admin/listings`: ilan filtreleme, düzenleme, silme ve moderasyon
- `/admin/products`: ürün ve fiyat istatistikleri
- `/admin/price-alerts`: kullanıcı fiyat alarmları ve tetiklenme durumu
- `/admin/sources`: ilan kaynakları ve aktiflik yönetimi
- `/admin/bot-runs`: bot çalışma geçmişi ve hata kayıtları
- `/admin/search-demands`: az sonuçlu aramalardan oluşan bot kuyruğu talepleri
- `/admin/users`: Supabase Auth kullanıcıları ve favori sayıları
- `/admin/import`: JSON, CSV ve Excel içe aktarma
- `/admin/stats`: platform istatistikleri
- `/admin/settings`: site ayarları ve bakım modu

### Site Ayarları ve İstatistik RPC

Admin panelindeki site adı, açıklama ve bakım modu ayarlarını etkinleştirmek
için Supabase **SQL Editor** içinde şu dosyayı çalıştırın:

```text
supabase/site-settings.sql
```

Bu migration `site_settings` tablosunu, bakım modu varsayılanlarını ve
`/admin/stats` sayfasının kullandığı `get_admin_platform_stats()` RPC
fonksiyonunu oluşturur.

### Fiyat Alarmları

Kullanıcılar ürün detay sayfasından (`/product/[slug]`) hedef fiyat
belirleyerek fiyat alarmı oluşturabilir. Alarmlar Hesabım sayfasında
listelenir; hedef fiyat, mevcut fiyat, durum ve oluşturma tarihi gösterilir.
Kullanıcı kendi alarmını iptal edebilir.

Kurulum SQL'i:

```text
supabase/price-alerts.sql
```

Bu migration `price_alerts` tablosunu, `active`, `triggered`, `paused` ve
`cancelled` durumlarını, RLS politikalarını ve gerekli indeksleri kurar.
Mevcut eski `price_alerts` tablosu varsa eksik kolonları tamamlar.

Kullanıcı endpoint'i:

```text
GET /api/price-alerts
POST /api/price-alerts
PATCH /api/price-alerts
```

`POST` isteği oturum gerektirir ve `productId`, opsiyonel `listingId` ile
`targetPrice` alır. Aynı kullanıcı, aynı ürün ve aynı hedef fiyat için aktif
alarmı varsa ikinci kayıt oluşturulmaz.

Cron kontrol endpoint'i:

```text
/api/cron/check-price-alerts
```

Bu endpoint `CRON_SECRET` ile korunur. Aktif alarmları kontrol eder; ürünün en
düşük yayındaki ilan fiyatı veya doğrudan bağlı ilan fiyatı hedef fiyatın altına
düşerse alarmı `triggered` yapar, `triggered_at`, `last_checked_at` ve
`current_price` alanlarını günceller. Bu turda e-posta gönderimi yapılmaz;
ileride e-posta veya uygulama içi bildirim entegrasyonu bu tetiklenen kayıtlar
üzerinden bağlanabilir.

Admin takibi:

```text
/admin/price-alerts
```

Admin panelinde toplam, aktif, tetiklenen ve iptal edilen alarm sayıları ile son
alarm kayıtları izlenir.

Erişim yalnızca `ADMIN_EMAILS` ortam değişkeninde tanımlı (veya varsayılan)
admin e-posta adreslerine açıktır:

```env
ADMIN_EMAILS=kozmen25@gmail.com,ozmebomer9@gmail.com
```

`ADMIN_EMAILS` tanımlı değilse uygulama `lib/admin.ts` içindeki varsayılan
listeyi kullanır.

Admin güvenliği hem ortak `/admin` layout katmanında hem de veri değiştiren
server action fonksiyonlarında tekrar doğrulanır. Yetkisiz kullanıcılar admin
işlemlerini doğrudan çağırsa bile işlem yapılmaz.

Kurulum:

1. Admin e-posta adreslerinden biriyle Supabase Auth üzerinden kayıt olun.
2. `.env.local` ve Vercel ortamına `SUPABASE_SERVICE_ROLE_KEY` ekleyin.
3. `supabase/product-slugs.sql`, `supabase/listing-images.sql`,
   `supabase/listing-status.sql`, `supabase/sources-and-bots.sql` ve
   `supabase/source-bot-publish-mode.sql`,
   `supabase/source-integration-settings.sql` migration dosyalarını SQL
   Editor'da çalıştırın.
4. Oturum açtıktan sonra `/admin` adresine gidin.

Kullanıcı silme işlemi Supabase Auth Admin API üzerinden kalıcı olarak yapılır
ve işlem öncesinde onay penceresi gösterilir. Admin hesapları kullanıcı
listesinden silinmeye karşı korumalıdır.

Sahibinden, Letgo ve Facebook Marketplace için ortak bir aktarım API'si
bulunur. Bu üç kaynak için uygulama HTML çekimi yapmaz; kullanma yetkiniz olan
resmi API, veri sağlayıcı, CSV dönüştürücü veya şirket içi entegrasyon çıktısını
normalize ederek Supabase'e aktarır. EasyCep, Getmobil ve yenilenmiş cihaz
kaynaklarının sınırlı kategori testi ayrı olarak **Gerçek Test Çekimi** bölümünde
açıklanmıştır.

```text
POST /api/import/listings
Authorization: Bearer IMPORT_API_KEY
Content-Type: application/json
```

Örnek:

```json
{
  "source": "Sahibinden",
  "records": [
    {
      "ilan_no": "123456789",
      "urun": "iPhone 13",
      "kategori": "Telefon",
      "baslik": "iPhone 13 128 GB Temiz",
      "fiyat": "21.000 TL",
      "sehir": "İstanbul",
      "durum": "İkinci El",
      "url": "https://www.sahibinden.com/ilan/123456789",
      "published_at": "2026-06-13T10:00:00Z"
    }
  ]
}
```

Desteklenen `source` değerleri:

- `Sahibinden`
- `Letgo`
- `Facebook Marketplace`
- `EasyCep`
- `Getmobil`
- `Yenilenmiş Market`
- `Teknosa Yenilenmiş`
- `Hepsiburada Yenilenmiş`
- `MediaMarkt Yenilenmiş`

Her adaptör kaynak alanlarını ortak ilan modeline dönüştürür. Tek istekte en
fazla 100 ilan kabul edilir. `source + external_id` benzersiz olduğu için aynı
ilan yeniden aktarıldığında çoğaltılmaz, güncellenir. Kısmi hatalarda API `207`
ve başarısız kayıt indekslerini döndürür.

Yeni form kayıtları doğrudan `listings` tablosuna eklenir. Arama sonuçlarında
Supabase RLS politikası tarafından okunmasına izin verilen ilanlar gösterilir.
Mevcut basit şemada `status` alanı zorunlu değildir; moderasyon eklenecekse bu
alan ayrıca oluşturulup sorguya filtre olarak eklenebilir.

### Bağlantıyı Kontrol Etme

- `/listing-ekle` sayfasında ürün seçenekleri görünüyorsa `products` bağlantısı
  çalışıyordur.
- Form gönderildikten sonra kayıt `listings` tablosunda görünmelidir.
- Ürün adıyla `/search` sayfasında arama yapın.
- “Supabase bağlantısı yapılandırılmamış” mesajı görünüyorsa `.env.local`
  dosyasındaki iki değişkeni ve geliştirme sunucusunu yeniden başlattığınızı
  kontrol edin.
- Arama boş dönüyorsa `listings.product_id` değerinin karşılık gelen
  `products.id` değeriyle aynı olduğundan ve iki tablo için SELECT RLS
  politikasının açık olduğundan emin olun.

## Uygulamayı Çalıştırma

```bash
npm run dev
```

Uygulama [http://localhost:3000](http://localhost:3000) adresinde açılır.

## Kontrol Komutları

TypeScript kontrolü:

```bash
npm run lint
```

Otomatik testler:

```bash
npm run test
```

Production build:

```bash
npm run build
```

Production sunucusu:

```bash
npm run start
```

## Sayfalar

- `/` Ana sayfa ve ürün araması
- `/search?q=iPhone%2013` Supabase arama sonuçları, fiyat analizi ve filtreler
- `/product/iphone-13` Ürün fiyat özeti, trend grafiği ve ilanlar
- `/listing-ekle` Supabase ilan gönderme formu
- `/giris` E-posta ve şifre ile giriş
- `/kayit` Yeni kullanıcı kaydı
- `/hesabim` Korumalı kullanıcı hesabı
- `/favoriler` Korumalı favori ilanlar
- `/admin/import` Giriş gerektiren toplu JSON ilan aktarımı
- `/admin/search-demands` Arama tetiklemeli bot kuyruğu talepleri
- `/gizlilik` Gizlilik bilgilendirmesi
- `/kullanim-sartlari` Kullanım şartları
- `/iletisim` İletişim bilgileri

## Vercel'e Deploy

### Gerekli Environment Variables

Temel uygulama, Supabase sorguları ve Auth için aşağıdaki değişkenler
zorunludur:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SITE_URL
```

`NEXT_PUBLIC_SITE_URL` production ortamında Vercel adresi veya özel alan adı
olmalıdır:

```text
https://your-project.vercel.app
https://2elbul.com
```

Aşağıdaki server-only değişkenlerden `SUPABASE_SERVICE_ROLE_KEY`,
`/admin/import`, admin bot işlemleri veya cron bot rotası kullanılacaksa
gereklidir. `IMPORT_API_KEY` yalnızca import API rotası, `CRON_SECRET` ise
`/api/cron/daily`, `/api/cron/run-sources`, `/api/cron/process-search-queue`
ve Vercel Cron için gereklidir:

```text
SUPABASE_SERVICE_ROLE_KEY
IMPORT_API_KEY
CRON_SECRET
ADMIN_EMAILS
```

`SUPABASE_SERVICE_ROLE_KEY`, `IMPORT_API_KEY` ve `CRON_SECRET` değerlerine
`NEXT_PUBLIC_` ön eki eklemeyin. Bu değerler tarayıcı paketine dahil
edilmemelidir.

### Deploy Adımları

1. `.env.local` dosyasının commit edilmediğini kontrol edin.
2. Projeyi GitHub, GitLab veya Bitbucket deposuna gönderin.
3. Vercel panelinden **Add New > Project** seçeneğini açıp depoyu içe aktarın.
4. Repo yalnızca bu uygulamayı içeriyorsa Root Directory alanını boş bırakın.
   Monorepo kullanıyorsanız Root Directory olarak `2elbul` seçin.
5. Framework Preset değerini **Next.js** olarak bırakın.
6. Install Command için `npm install`, Build Command için `npm run build`
   kullanın. Output Directory alanını değiştirmeyin.
7. Yukarıdaki environment variables değerlerini **Production**, **Preview** ve
   gerektiğinde **Development** ortamlarına ekleyin.
   Vercel panelinde `CRON_SECRET` için uzun ve rastgele bir değer üretip aynı
   değeri environment variable olarak kaydedin.
8. İlk deploy sonrasında gerçek Vercel adresini
   `NEXT_PUBLIC_SITE_URL` olarak kaydedin ve yeniden deploy edin.
9. Supabase panelindeki **Authentication > URL Configuration** bölümünde:

```text
Site URL: https://your-project.vercel.app
Redirect URL: https://your-project.vercel.app/auth/callback
```

10. Özel alan adı kullanıyorsanız aynı Site URL ve callback ayarlarını özel
    alan adı için de ekleyin.
11. Deploy öncesinde yerelde doğrulama komutlarını çalıştırın:

```bash
npm run lint
npm run build
```

Environment Variables değiştirildiğinde yeni değerlerin aktif olması için
Vercel projesini yeniden deploy edin.

### Son Deploy Kontrolü

- `.env.local` dosyasının repoya dahil olmadığını doğrulayın.
- Vercel'de üç zorunlu environment variable değerinin tanımlı olduğunu kontrol
  edin.
- Supabase Site URL ve `/auth/callback` adresini production alan adına göre
  ayarlayın.
- `npm run lint` ve `npm run build` komutlarının hatasız tamamlandığını
  doğrulayın.
- Production deploy sonrasında ana sayfa, giriş, kayıt, arama ve favoriler
  rotalarını kontrol edin.

## Gelistirici Araclari

Windows uzerinde sik kullanilan gelistirme komutlari icin proje kokunde `2elbul-control.bat` dosyasi bulunur. Cift tiklayarak veya terminalden su komutla acabilirsiniz:

```bat
2elbul-control.bat
```

Menu uzerinden Git push, lint, build, lint + build, push + build ve git status islemleri tek adimda calistirilabilir.

Tekil komut dosyalari `tools` klasorundedir:

```text
tools/git-push.bat
tools/lint.bat
tools/build.bat
tools/lint-build.bat
tools/push-build.bat
```

## Admin Bot Merkezi

Admin panelinde `/admin/bot-center` sayfasi bot ve cron gorevlerini tek yerden calistirmak icin kullanilir. Sayfadaki butonlar tarayicidan dogrudan cron endpointlerine gitmez; once guvenli admin API rotasina istek atar:

```text
POST /api/admin/run-bot-task
```

Desteklenen gorevler:

```text
search_queue  -> /api/cron/process-search-queue
sources       -> /api/cron/run-sources
price_alerts  -> /api/cron/check-price-alerts
daily         -> /api/cron/daily
```

Bu API rotasi kullanicinin admin olup olmadigini server tarafinda kontrol eder. Admin olmayan kullanicilar 403 alir. `CRON_SECRET` yalnizca server tarafinda okunur ve client tarafina gonderilmez.

### Bot Merkezi Izleme

`/admin/bot-center` sayfasi manuel bot calistirma butonlarinin yaninda canli
izleme tablosu da gosterir. Tablo `bot_runs` kayitlarindan su alanlari okur:

- Bot adi
- Durum: `idle`, `running`, `success`, `failed`
- Son calisma zamani
- Son basarili calisma zamani
- Son hata zamani ve hata mesaji
- Son calismada bulunan, eklenen ve guncellenen ilan sayisi
- Son calismada eslesen urun sayisi
- Son calisma suresi

Manuel calistirma `/api/admin/run-bot-task` uzerinden yapilir. Bu endpoint once
`bot_runs.status = 'running'` kaydi olusturur, gorev bitince kaydi `success` veya
`failed` olarak gunceller. Hata mesaji ve sayaclar ayni kayit uzerinde saklanir.

Eslesen urun sayisini saklamak icin mevcut kurulumlarda su migration dosyasini
calistirin:

```text
supabase/migrations/bot-center-monitoring.sql
```

Migration yalnizca `bot_runs.matched_product_count` kolonunu ve run type indeksini
ekler. Kod kolon henuz yoksa fallback ile calismaya devam eder, fakat eslesen
urun sayisi kalici olarak saklanmaz.

## Urun Eslestirme Test Paneli

Admin panelindeki `/admin/product-matcher` sayfasi ilan basliklarinin urun
eslestirme motoru tarafindan nasil normalize edildigini dry-run olarak gosterir.
Panel gercek urun olusturmaz; yalnizca mevcut `products` kayitlari icinde hangi
urune baglanacagini veya yeni urun olusturulacaksa onerilen urun adini gosterir.

Test paneli su bilgileri dondurur:

- Girilen baslik
- `normalizeProductTitle` sonucu
- `extractProductSignals` sonucu
- `generateProductKey` sonucu
- Eslesen mevcut urun adi ve id bilgisi
- Eslesme yoksa "Yeni urun olusturulacak" bilgisi

Istekler guvenli admin API rotasindan calisir:

```text
POST /api/admin/product-matcher-test
```

Bu rota kullanicinin admin olup olmadigini server tarafinda kontrol eder.
`SUPABASE_SERVICE_ROLE_KEY` yalnizca server tarafinda kullanilir ve client
tarafina gonderilmez.

## Urun Detay Sayfasi 2.0 - Sprint 1

`/product/[slug]` sayfasi urun icin yalnizca ilan kartlari degil, fiyat odakli
profesyonel bir ozet de gosterir.

Gosterilen ana bolumler:

- Urun adi ve varsa kategori bilgisi
- Toplam ilan sayisi
- Ortalama, en dusuk, en yuksek ve medyan fiyat
- Son guncelleme zamani
- Kural tabanli akilli fiyat yorumu
- En iyi firsat karti
- Supheli ucuz ilanlar, en ucuz ilanlar, son eklenen ilanlar ve tum ilan listesi
- Ilan kartlarinda kaynak, tarih, ilan linki ve eslesme anahtari bilgisi

Bu ozellik mevcut `products`, `listings` ve varsa `price_history` verileriyle
calisir. Yeni SQL migration gerektirmez. `products.category` kolonu varsa
gosterilir; kolon yoksa sayfa mevcut semayla calismaya devam eder.

## Urun Detay Sayfasi 2.0 - Sprint 2 Fiyat Grafigi

`/product/[slug]` sayfasindaki fiyat gecmisi grafigi mevcut `listings`
verisinden uretilir. Yeni tablo veya SQL migration gerekmez.

Grafik davranisi:

- `listings.created_at` tarihi kullanilir.
- `listings.updated_at` kolonu varsa yedek tarih bilgisi olarak okunur.
- Her gun icin ortalama fiyat, en dusuk fiyat ve ilan sayisi hesaplanir.
- 7 gun, 30 gun, 90 gun ve tum zaman filtreleri vardir.
- Mobil uyumlu SVG tabanli hafif grafik kullanilir; yeni paket eklenmemistir.
- Yeterli tarih verisi yoksa bos durum mesaji gosterilir.

## Urun Detay Sayfasi 2.0 - Sprint 3 Guven Skoru

`/product/[slug]` sayfasi artik fiyat ozetinin yaninda karar destek kartlari da
gosterir:

- **Guven Skoru:** 100 uzerinden hesaplanir.
- **Gelismis Akilli Fiyat Yorumu:** Ortalama, medyan, en ucuz ilan farki,
  veri guvenilirligi ve fiyat dagilimi yorumlanir.

Skor tamamen kural tabanlidir; harici AI servisi kullanilmaz. Hesaplamada ilan
sayisi, fiyatlarin birbirine yakinligi, asiri fiyat sapmalari, fiyat gecmisi
varligi ve en ucuz ilanin ortalamaya uzakligi dikkate alinir.

Skor seviyeleri:

- 80-100: Yuksek guven
- 60-79: Orta guven
- 0-59: Dusuk guven
- Veri azsa: Veri yetersiz

Yeni SQL gerekmez. Hesaplama server tarafinda `lib/product-detail.ts` icinde
hazirlanir ve sayfaya guvenli ozet veri olarak gonderilir.

## Urun Detay Sayfasi 2.0 - Sprint 4 En Iyi Firsatlar ve Benzer Urunler

`/product/[slug]` sayfasi artik kullaniciya ayni urundeki en iyi ilanlari ve
alternatif benzer urunleri de gosterir.

Eklenen bolumler:

- **En Iyi Firsatlar:** Urunun fiyat bilgisi olan ilanlari icinden en dusuk
  fiyatli ilk 5 ilan listelenir. Ortalama fiyatin altindakiler "Ortalamanin
  altinda", cok dusuk olanlar "Dikkatli incele" etiketiyle gosterilir.
- **Benzer Urunler:** Mevcut urun haric tutulur. Varsa ayni kategori, yoksa
  urun adindaki marka/model sinyalleri kullanilarak maksimum 6 alternatif
  urun onerilir.

Her benzer urun kartinda urun adi, kategori, ilan sayisi, ortalama fiyat, en
dusuk fiyat ve urun detay linki bulunur. Yeni SQL gerekmez; kategori kolonu yoksa
fallback ile yalnizca isim sinyalleri kullanilir.

## Urun Detay Sayfasi 2.0 - Sprint 5 SEO ve Mobil Optimizasyon

`/product/[slug]` sayfasi SEO ve mobil kullanim icin guclendirildi.

Eklenen iyilestirmeler:

- Dinamik title ve description
- Open Graph ve Twitter card metadata
- Canonical URL
- Product schema JSON-LD
- Fiyat verisi varsa AggregateOffer ve Offer structured data
- Mobilde kartlarin tasmasini azaltan grid ve metin kirilimlari
- Buyuk ilan listelerinde ilk ekrani hafif tutmak icin ilan listesi onizleme limiti
- Favori sorgularinda yalnizca ekranda kullanilan ilan id'lerinin sorgulanmasi

Yeni SQL veya yeni paket gerekmez. `NEXT_PUBLIC_SITE_URL` tanimliysa canonical ve
structured data URL'leri bu alan uzerinden uretilir; yoksa production Vercel URL'i
fallback olarak kullanilir.

## Arama Deneyimi 2.0 - Sprint 1

`/search?q=...` sayfasi artik ilan listesinin yaninda urun odakli
karsilastirma deneyimi de sunar.

Eklenenler:

- Arama ozeti: aranan kelime, bulunan urun sayisi, toplam ilan sayisi, en dusuk
  fiyatli urun ve piyasa araligi
- Urun karsilastirma kartlari: urun adi, ilan sayisi, ortalama fiyat, en dusuk
  fiyat, en yuksek fiyat, guven skoru ve detay linki
- Siralama secenekleri: en ucuz, en cok ilan, en yuksek guven ve en yeni
- Bos sonuc durumunda daha acik mesaj ve aramanin izlemeye alindigini belirten
  bilgi

Yeni SQL gerekmez. Hesaplama mevcut arama sonucu ilanlarindan client tarafinda
hafif sekilde uretilir; service role key client'a gonderilmez.

## Arama Deneyimi 2.0 - Sprint 2 Filtreler

`/search` sayfasina URL ile senkron calisan filtre ve gorunum kontrolleri
eklendi.

Desteklenen query parametreleri:

- `min`: minimum fiyat
- `max`: maksimum fiyat
- `source`: kaynak/site filtresi
- `view`: `both`, `products` veya `listings`
- `sort`: mevcut siralama secimi

Filtreler sayfa yenilenmeden uygulanir ve URL guncellenir. Filtre ozeti,
secilen fiyat araligini, kaynagi ve gorunum modunu gosterir. "Filtreleri
temizle" butonu yalnizca `q` parametresini korur. Yeni SQL gerekmez; filtreleme
mevcut arama sonucu verisi uzerinden client tarafinda yapilir.

## Arama Deneyimi 2.0 - Sprint 3 Oneriler

Arama kutusu artik kullanici yazarken urun onerileri gosterir.

Eklenenler:

- `/api/search/suggestions?q=...` endpoint'i
- Maksimum 8 urun onerisi
- Bos aramada popüler urun onerileri
- 300ms debounce ile hafif autocomplete
- Oneriye tiklayinca `/search?q=...` sayfasina yonlendirme
- Bos veya az sonuc ekraninda "Bunlari deneyebilirsin" onerileri

Oneriler mevcut `products` ve `listings` verilerinden uretilir. En cok ilana
sahip urunler onceliklidir. Yeni SQL gerekmez; endpoint public anon Supabase
client ile RLS kurallarina uygun sekilde yalnizca sade arama onerisi verisi
dondurur.

## Ana Sayfa Landing Sprint 1

Ana sayfa satisa hazir landing deneyimine yaklastirildi.

Eklenenler:

- Daha net hero mesajı ve merkezi arama alani
- Autocomplete destekli arama kutusunun korunmasi
- Bes ana deger karti: piyasa fiyati, en ucuz ilanlar, fiyat gecmisi, akilli yorum ve fiyat alarmi
- "Nasil calisir?" bolumu
- Guven veren analiz bolumu
- "Hemen urun ara" CTA alani
- Sayfa seviyesinde title, description, Open Graph ve Twitter metadata

Populer urunler mevcut `products` ve `listings` verilerinden uretilir. En cok
ilana sahip urunler onceliklidir ve urun detay linkleri `/product/[slug]`
formatinda calisir. Yeni SQL gerekmez.

## Yayin Oncesi Kontrol

Public sayfalarda demo/test verilerin gorunmesini azaltmak icin ana sayfa,
arama onerileri, arama sonuclari, urun detay ve sitemap verileri ortak public
temizlik filtresinden gecirilir.

Kontrol edilen public yuzeyler:

- Ana sayfa landing ve veri bolumleri
- Arama sayfasi ve autocomplete onerileri
- Urun detay sayfasi, en iyi firsatlar ve benzer urunler
- `robots.txt`
- `sitemap.xml`

Demo veya test verileri veritabanindan otomatik silinmez. Canliya cikmadan once
Supabase'de demo kaynakli kayitlar kaldiysa manuel temizlik yapilabilir; admin
panel ve bot test akislari bu temizlikten etkilenmez.

## Admin Veri Temizligi

`/admin/data-cleanup` sayfasi demo/test kayitlari guvenli dry-run modunda
listeler.

Sayfa sunlari gosterir:

- Demo/test urun adaylari
- Demo/test ilan adaylari
- Supheli kaynak adaylari
- Her aday icin baslik/ad, kaynak, fiyat, olusturulma tarihi ve sebep

Bu ilk surum veri silmez. Toplu silme ve tekil silme ozellikle eklenmedi; amac
canliya cikmadan once hangi kayitlarin public filtrelere takildigini admin
panelden gormektir. Yeni SQL gerekmez.

## Veri Temizligi - Pasife Alma

`/admin/data-cleanup` sayfasinda demo/test filtresine takilan ilanlar artik
silinmeden tek tek pasife alinabilir.

Guvenlik kurallari:

- Sadece admin kullanicilar islem yapabilir.
- API route: `/api/admin/data-cleanup/deactivate`
- Service role key yalnizca server-side kullanilir.
- Rastgele gercek ilan ID'si gonderilirse islem yapilmaz; ilan once
  `lib/public-data-cleanup.ts` filtresinden tekrar gecirilir.
- Urun kayitlari bu sprintte pasife alinmaz.
- Toplu pasife alma yoktur.

Pasife alma oncelikle `listings.status = 'inactive'` ile calisir. Canli semada
`status` kolonu yok ama `is_active` kolonu varsa `is_active = false` fallback'i
kullanilir. Ikisi de yoksa yeni SQL gerekir:

```sql
alter table public.listings add column if not exists status text default 'published';
```

## 2ElBul Intelligence Engine v1

2ElBul Intelligence Engine, mevcut `products`, `listings`, `price_history` ve
`search_demands` verilerinden kural tabanli karar destek sinyali uretir.

Hesaplanan ciktılar:

- Piyasa degeri: ortalama, medyan, minimum, maksimum, fiyat araligi ve ilan sayisi
- Trend: yukselen, dusen, stabil veya bilinmeyen fiyat sinyali
- Talep: toplam ve son donem arama ilgisine gore dusuk, orta veya yuksek talep
- Firsat skoru: 0-100 arasi skor ve "Guclu firsat", "Takip etmeye deger",
  "Normal piyasa", "Dikkatli incele" veya "Veri yetersiz" etiketi
- Alim onerisi: `buy_now`, `watch`, `wait` veya `insufficient_data`

Motor saf fonksiyonlardan olusur ve database baglantisi kurmaz:
`lib/intelligence-engine.ts`. Urun detay sayfasinda "2ElBul Intelligence"
karti, arama urun kartlarinda ise kucuk intelligence rozeti olarak gosterilir.

Yeni SQL gerekmez. Veri azsa motor "Veri yetersiz" doner ve sistem mevcut
ilan karsilastirma akisini bozmadan calismaya devam eder.
