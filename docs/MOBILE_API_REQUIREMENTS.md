# 2ElBul Mobile API Requirements

**Durum:** Talep listesi  
**Amaç:** Mobil uygulamanın web ile aynı davranışı koruması için eksik backend sözleşmesini belgelemek

## Not

Mevcut web uygulaması bazı verileri server-side yardımcı fonksiyonlarla hazırlıyor. Mobil taraf için bunların bir kısmı doğrudan yeniden kullanılabilir, bir kısmı ise ayrı bir API yüzeyi gerektiriyor. Aşağıdaki uçlar henüz bu repo içinde tamamlanmış bir mobil sözleşme olarak yok.

## Requirements

| Priority | Endpoint | Request | Response | Reason |
| --- | --- | --- | --- | --- |
| P0 | `GET /api/mobile/home` | `locale`, `timezone`, `includeAuthState` | Hero, kategoriler, AI kartları, trend ürünler, son ilanlar, piyasa özeti | Ana ekranı tek çağrıyla doldurmak ve web ile pariteyi korumak |
| P0 | `GET /api/mobile/search` | `q`, `min`, `max`, `source`, `sort`, `page`, `limit` | Ürünler, ilanlar, filtre özetleri, pagination, arama niyeti | Arama ekranı için web davranışının mobil karşılığı |
| P0 | `GET /api/mobile/products/{slug}` | `slug`, `includeListings`, `includeHistory`, `includeSimilar` | Ürün, ilanlar, fiyat geçmişi, market intelligence, confidence, similar products | Ürün detay ekranı için tek kaynak |
| P0 | `GET /api/mobile/favorites` | auth session | Kullanıcının favori ilanları ve ürünleri | Favoriler ekranı ve hızlı senkron |
| P0 | `POST /api/mobile/favorites` | `listingId` | Oluşturulan favori kaydı | Favori ekleme işlemi |
| P0 | `DELETE /api/mobile/favorites/{id}` | `id` | Silme sonucu | Favori kaldırma işlemi |
| P1 | `GET /api/mobile/price-alerts` | auth session | Kullanıcının aktif / beklemede / iptal edilmiş alarmları | Fiyat alarmı ekranı |
| P1 | `POST /api/mobile/price-alerts` | `productId` veya `listingId`, `targetPrice` | Alarm kaydı, duplicate durumu | Alarm oluşturma akışı |
| P1 | `PATCH /api/mobile/price-alerts/{id}` | `status` | Güncellenen alarm | Duraklat / iptal et |
| P1 | `GET /api/mobile/notifications` | auth session, `cursor` | Bildirim listesi, okunma durumu | Push ve in-app bildirim merkezi |
| P1 | `POST /api/mobile/device-tokens` | `platform`, `token`, `deviceId` | Kayıt sonucu | Firebase push kaydı için cihaz eşleme |
| P1 | `DELETE /api/mobile/device-tokens/{deviceId}` | `deviceId` | Kaldırma sonucu | Cihaz oturumu temizliği |
| P2 | `GET /api/mobile/profile` | auth session | Profil, tercihleri, dil, bildirim ayarları | Hesabım ve ayarlar ekranları |
| P2 | `PATCH /api/mobile/profile` | profil alanları | Güncellenen profil | Profil düzenleme |
| P2 | `GET /api/mobile/market` | `view`, `limit` | Piyasa sinyalleri, fırsatlar, düşen fiyatlar | Market Center mobil görünümü |

## Existing endpoints that can be reused now

- `GET /api/search/suggestions`
- `GET /api/price-alerts`
- `POST /api/price-alerts`
- `POST /api/search/instant-bot`
- `GET /api/monitoring/summary`
- `GET /api/monitoring/snapshot`

## Notes

- Auth için Supabase oturumu kullanılabilir; ayrı bir kimlik sunucusu zorunlu görünmüyor.
- Mobil arama ve ürün detayında web’deki karar destek metrikleri mümkün olduğunca aynı hesaplamadan gelmeli.
- Yeni endpoint yazılana kadar, Flutter tarafında repository arayüzleri ile mevcut Supabase tabloları ve web sözleşmesi üzerinden ilerlenebilir.
