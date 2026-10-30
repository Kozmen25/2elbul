# VDS yayını (2elbul.projedemolari.com)

Sunucu: Plesk (nginx + Apache), Ubuntu 22.04. Uygulama diğer sitelerden ayrı çalışır.

| Parça | Yer |
|---|---|
| Uygulama kodu | `/srv/2elbul/app` (sahibi: `elbul` sistem kullanıcısı) |
| Ortam değişkenleri | `/srv/2elbul/app/.env.production` (izin 600, git'e girmez) |
| Servis | `systemctl status 2elbul` (`/etc/systemd/system/2elbul.service`), yalnızca `127.0.0.1:3217` |
| nginx | `/var/www/vhosts/system/2elbul.projedemolari.com/conf/vhost_nginx.conf` (yalnızca bu domain) |
| Node | `/opt/plesk/node/24/bin/node` (Plesk Node.js Toolkit) |
| SSL | Plesk Let's Encrypt (otomatik yenilenir) |

## Güncelleme
1. Yerelde kaynağı paketle (node_modules, .next, .env*, _work, .claude hariç) ve sunucuya `/root/2elbul-src.tgz` olarak yükle. macOS'ta `COPYFILE_DISABLE=1 tar ...` kullan.
2. Sunucuda: `/srv/2elbul/redeploy.sh`. Betik:
   - paketi **boş** bir klasöre (`app.new`) açar; eski sürümün hiçbir dosyası kalmaz,
   - `.env.production`'ı taşır ve `build.sh app.new` ile orada `npm ci` ve `npm run build` yapar; bu sırada eski sürüm yayında kalır,
   - derleme başarılıysa klasörleri değiştirir, servisi yeniden başlatır ve sağlık kontrolü 200 dönerse eski sürümü siler.
3. Sağlık kontrolü başarısız olursa eski sürüm `/srv/2elbul/app.prev` adıyla bırakılır. Geri dönmek için: `cd /srv/2elbul && mv app app.failed && mv app.prev app && systemctl restart 2elbul`.

## Sorun giderme
- Log: `journalctl -u 2elbul -f`
- Yeniden başlat: `systemctl restart 2elbul`
- nginx ayarını geri almak: `rm .../conf/vhost_nginx.conf && /usr/local/psa/admin/bin/httpdmng --reconfigure-domain 2elbul.projedemolari.com`
- Servis, diğer siteleri korumak için `MemoryMax=3G` ve `Nice=5` ile sınırlıdır.

## Notlar
- Canlı ortam şu an `.env.local`'deki Supabase (test) projesine bağlıdır; ayrı bir canlı veritabanı kullanılacaksa `.env.production` içindeki Supabase anahtarları değiştirilip yeniden başlatılmalıdır (ve migration'lar o projede çalıştırılmalıdır).
- Zamanlanmış görevler (`vercel.json` -> `/api/cron/daily`) bu sunucuda **kurulu değildir**; bot taraması bilerek kapalı tutulmaktadır. İlan link kontrolü de bu günlük görevin içinde çalışır.
- nginx, `X-Forwarded-For` başlığını `$proxy_add_x_forwarded_for` ile iletir. Uygulama bu yüzden listenin en sağındaki IP'yi kullanır (`TRUSTED_PROXY_COUNT` varsayılanı 1).
- Uygulama nginx'in arkasında `127.0.0.1:3217` üzerinde çalıştığı için route handler'larda `request.url` iç adresi gösterir. Site içi yönlendirmeler `lib/relative-redirect.ts` ile göreli yapılmalıdır.
