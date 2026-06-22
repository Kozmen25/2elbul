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
katmanını hazırlar. Buna ek olarak EasyCep ve Getmobil için aşağıda açıklanan
tek sayfalık, en fazla 10 ürünle sınırlı yönetici test çekimi bulunur.

### Gerçek Kaynak Connector Altyapısı

`lib/bots/types.ts` tüm gerçek kaynak entegrasyonlarının uyması gereken ortak
veri sözleşmesini tanımlar. `lib/bots/connectors.ts` ise EasyCep, Getmobil ve
yenilenmiş cihaz kaynakları için API/scrape çalışma modlarını seçebilen
server-only connector iskeletini içerir.

Her kaynak adaptörü ilanları şu ortak formatta döndürmelidir:

```json
{
  "product_name": "iPhone 13",
  "title": "iPhone 13 128GB Yenilenmiş",
  "price": 21999,
  "city": "İstanbul",
  "source": "EasyCep",
  "url": "https://easycep.com/urun/ornek",
  "condition": "Yenilenmiş",
  "image_url": "https://cdn.example.com/main.jpg",
  "image_urls": [
    "https://cdn.example.com/main.jpg",
    "https://cdn.example.com/side.jpg"
  ],
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
  `extractImageUrls`, `normalizePrice` ve `normalizeCondition`
- `lib/bots/adapters/easycep.ts`: EasyCep ürün adı, fiyat, ürün linki, ana
  görsel ve galeri parser iskeleti
- `lib/bots/adapters/getmobil.ts`: Getmobil ürün adı, fiyat, ürün linki ve
  galeri parser iskeleti

EasyCep ve Getmobil kategori adaptörleri Cheerio ile sunucu tarafında çalışır.
Önce sayfadaki Schema.org `ItemList` / JSON-LD ürün verisini okur, gerektiğinde
DOM ürün şemasına düşer. Relative `src`, `data-src`, `srcset`, lazy-load ve Open
Graph görselleri mutlak URL'ye çevrilir. Kaynak sayfada geçerli görsel varsa bu
URL korunur; yalnızca görsel yoksa kartların mevcut ürün fallback SVG'si devreye
girer.

Gerçek entegrasyon eklerken:

1. Sağlayıcının resmi API veya yazılı izinli veri erişim yöntemini doğrulayın.
2. Kimlik bilgilerini yalnızca server-only environment variable olarak
   tanımlayın; `NEXT_PUBLIC_` ön eki kullanmayın.
3. Sağlayıcı cevabını `ExternalListingCandidate` formatına dönüştürün.
4. `product_limit` değerini uygulayın ve her çalışma için `bot_runs` kaydı
   oluşturun.
5. Başarılı çalışmada `sources.last_success`, her çalışmada
   `sources.last_run_at` alanını güncelleyin.

`cron_enabled` ve `cron_schedule` yalnızca zamanlama konfigürasyonunu saklar.
Cron'u gerçekten tetiklemek için Vercel Cron, Supabase Scheduled Functions veya
ayrı bir worker kullanılmalıdır.

### EasyCep ve Getmobil Gerçek Test Çekimi

Admin paneli EasyCep ve Getmobil telefon kategori sayfaları için sınırlı gerçek
test çekimini destekler:

```text
EasyCep: https://easycep.com/kategori/cep-telefonu-1
Getmobil: https://getmobil.com/satin-al/cep-telefonu/
```

Kullanım:

1. `supabase/source-integration-settings.sql` migration dosyasını çalıştırın.
2. Admin hesabıyla giriş yapıp `/admin/sources` sayfasını açın.
3. EasyCep veya Getmobil satırındaki **Gerçek test çekimi** butonuna basın.
4. Çalışmayı `/admin/bot-runs`, eklenen ilanları `/admin/listings` sayfasından
   kontrol edin.
5. İlanları kontrol ettikten sonra admin ilan yönetiminden yayınlayın.

Gerçek test çekimi yalnızca tek kategori sayfasına bir HTTP isteği gönderir,
ürün detay sayfalarını ayrıca açmaz ve en fazla 10 ürünü işler. İstekte açık bir
User-Agent, 15 saniyelik timeout ve 5 MB HTML sınırı kullanılır. Çekilen ilanlar
kaynak ayarından bağımsız olarak `pending` kaydedilir.

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
- `/admin/sources`: ilan kaynakları ve aktiflik yönetimi
- `/admin/bot-runs`: bot çalışma geçmişi ve hata kayıtları
- `/admin/users`: Supabase Auth kullanıcıları ve favori sayıları
- `/admin/import`: JSON, CSV ve Excel içe aktarma
- `/admin/stats`: platform istatistikleri
- `/admin/settings`: site ayarları taslağı

Erişim yalnızca `lib/admin.ts` içinde tanımlı admin e-posta adreslerine açıktır:

```text
kozmen25@gmail.com
ozmebomer9@gmail.com
```

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
normalize ederek Supabase'e aktarır. EasyCep ve Getmobil’in sınırlı kategori
testi ayrı olarak **EasyCep ve Getmobil Gerçek Test Çekimi** bölümünde
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
```

Aşağıdaki server-only değişkenlerden `SUPABASE_SERVICE_ROLE_KEY`,
`/admin/import` sayfası veya `POST /api/import/listings` API'si kullanılacaksa
gereklidir. `IMPORT_API_KEY` yalnızca API rotası için gereklidir:

```text
SUPABASE_SERVICE_ROLE_KEY
IMPORT_API_KEY
```

`SUPABASE_SERVICE_ROLE_KEY` ve `IMPORT_API_KEY` değerlerine `NEXT_PUBLIC_` ön
eki eklemeyin. Bu iki değer tarayıcı paketine dahil edilmemelidir.

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
