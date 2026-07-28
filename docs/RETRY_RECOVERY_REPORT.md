# Retry & Recovery Sistemi — Sprint P-7 Raporu

## Genel Bakış

Sprint P-7 kapsamında 2ElBul platformuna **otomatik hata iyileştirme (self-healing) altyapısı** eklenmiştir. Sistem, bot adapter'larından gelen hataları sınıflandırır, geçici hatalarda devre kesici (circuit breaker) mekanizmasıyla kaynakları korur, kalıcı başarısızlıkları ölü kuyruğa (dead letter queue) yönlendirir ve tüm iyileşme aksiyonlarını metriklerle izler.

---

## Mimarî Kararlar

### 1. Auth İzolasyonu
401/403 hataları devre kesiciyi **tetiklemez** ve DLQ'ya **eklenmez**. Bu hatalar kalıcıdır (geçici değildir) ve doğrudan fırlatılır. Çözüm: API anahtarı yenileme veya kaynak yapılandırmasını güncelleme.

### 2. In-Memory Circuit Breaker
Devre kesici durumu **işlem içi (in-memory)** tutulur — Supabase'e yazılmaz. Singleton deseni kullanır. Bunun nedeni:
- Devre kesici kararları milisaniye seviyesinde alınmalıdır
- DB gecikmesi, koruma amacını baltalar
- Sunucu restart'ında tüm devre kesiciler sıfırlanır (kabul edilebilir)

### 3. Supabase-Backed DLQ ve Metrikler
Ölü kuyruk ve iyileşme metrikleri **Supabase'de kalıcıdır**. Bu sayede:
- Admin paneli geçmiş verileri görüntüleyebilir
- Başarısız istekler manuel müdahale ile yeniden denenebilir
- Metrikler zaman serisi analizine olanak tanır

### 4. Connector Wrapper (HOF)
`withRecoveryPolicy()` bir **higher-order function**'dır. Mevcut bot adapter'larının imzasını değiştirmez — sadece sarar (wrap). Bu sayede:
- Her adapter bağımsız test edilebilir
- Yeni adapter'lar eklenirken recovery otomatik gelir
- Tek sorumluluk prensibi korunur

---

## Modüller

### 1. `lib/recovery/types.ts` — Tip Tanımları

Tüm recovery modüllerinin ortak tiplerini barındırır:

| Tip | Açıklama |
|---|---|
| `ErrorCategory` | 9 kategori: network, timeout, http_server, http_client, rate_limit, auth, parser, schema, unknown |
| `CircuitState` | 3 durum: closed, open, half_open |
| `CircuitBreakerConfig` | Yapılandırma: failureThreshold + halfOpenTimeoutMs |
| `DLQStatus` | 4 durum: pending, retrying, resolved, dead |
| `RecoveryMetricType` | 8 metrik türü: cb_trip, cb_reset, cb_half_open, dlq_insert, dlq_retry, dlq_resolve, recovery_success, recovery_failure |

### 2. `lib/recovery/failure-classification.ts` — Hata Sınıflandırma

`classifyError(error)` ile çalışır:

| Girdi | Kategori | Tekrar Denenebilir mi? |
|---|---|---|
| HTTP 429 | `rate_limit` | ✅ Evet |
| HTTP 401/403 | `auth` | ❌ Hayır |
| HTTP 5xx | `http_server` | ✅ Evet |
| HTTP 4xx (diğer) | `http_client` | ❌ Hayır |
| `AbortError` | `timeout` | ✅ Evet |
| `TypeError` | `network` | ✅ Evet |
| `PGRST204` / schema/column mesajı | `schema` | ❌ Hayır |
| `SyntaxError` / parse/cheerio/selector mesajı | `parser` | ❌ Hayır |
| Diğer | `unknown` | ❌ Hayır |

`isRetryableByCategory(category)` retry edilebilir kategorileri `true`/`false` döndürür.

### 3. `lib/recovery/circuit-breaker.ts` — Devre Kesici (Circuit Breaker)

**Durum Makinesi:**

```
closed ──(eşik hata)──→ open
open ──(zaman aşımı)──→ half_open
half_open ──(başarı)──→ closed
half_open ──(hata)────→ open
```

**Özellikler:**
- Singleton (`CircuitBreakerRegistry.getInstance()`)
- Her kaynak için ayrı yapılandırma (`failureThreshold` + `halfOpenTimeoutMs`)
- Varsayılan yapılandırma: threshold=3, timeout=60s
- `getState()` shallow copy döndürür — dışarıdan mutasyon mümkün değildir
- `isAvailable()` sırasında zaman aşımı kontrolü yapılır, otomatik `half_open` geçişi
- `recordSuccess()` sadece `half_open` → `closed` geçişi yapar (açıkken başarı saymaz)

**Kaynak Bazlı Yapılandırma:**

| Kaynak | Eşik | Zaman Aşımı |
|---|---|---|
| easycep | 5 | 30s |
| getmobil | 5 | 30s |
| hepsiburada-yenilenmis | 3 | 60s |
| teknosa-yenilenmis | 3 | 60s |
| mediamarkt-yenilenmis | 3 | 60s |
| yenilenmis-market | 5 | 30s |
| sahibinden | 3 | 45s |

### 4. `lib/recovery/dead-letter-queue.ts` — Ölü Kuyruk (DLQ)

Supabase'in `dead_letter_queue` tablosunu kullanır.

| Metod | Açıklama |
|---|---|
| `insert(entry)` | Yeni DLQ kaydı ekler, ID döndürür |
| `list(filter?)` | Filtreli sorgulama (source_slug, status, error_category, limit, offset) |
| `getById(id)` | Tek kayıt getirme |
| `retry(id)` | Durumu `retrying` yapar |
| `resolve(id, notes?)` | Durumu `resolved` yapar, not ekler |
| `markDead(id)` | Durumu `dead` yapar |
| `getStats()` | Durum bazında sayım döndürür |
| `retryAllPending()` | Tüm `pending` kayıtları `retrying` yapar |

### 5. `lib/recovery/recovery-metrics.ts` — İyileşme Metrikleri

Supabase'in `recovery_metrics` tablosunu kullanır.

| Metrik Türü | Açıklama |
|---|---|
| `cb_trip` | Devre kesici açıldı |
| `cb_reset` | Devre kesici sıfırlandı |
| `cb_half_open` | Devre kesici yarı açık duruma geçti |
| `dlq_insert` | DLQ'ya kayıt eklendi |
| `dlq_retry` | DLQ kaydı tekrar denendi |
| `dlq_resolve` | DLQ kaydı çözüldü |
| `recovery_success` | Başarılı iyileşme |
| `recovery_failure` | Başarısız iyileşme |

| Metod | Açıklama |
|---|---|
| `record(metric)` | Yeni metrik kaydı |
| `getSummary(since?)` | Özet istatistikler (tip bazında sayım) |
| `getBySource(slug, since?)` | Kaynak bazında metrikler |

### 6. `lib/recovery/connector-wrapper.ts` — Bağlayıcı Sarmalayıcı

`withRecoveryPolicy(fetcher, sourceSlug)` — mevcut bot adapter'larını sarar.

**Akış:**
```
withRecoveryPolicy çağrılır
  ├─ CB açık mı? → Hayır → [] döndür (atla)
  ├─ Fetcher çalıştır
  │   ├─ Başarılı → recordSuccess() → sonucu döndür
  │   └─ Hata → classifyError()
  │       ├─ auth → doğrudan fırlat (CB/DLQ'ya dokunma)
  │       └─ diğer → recordFailure() + (retryable ise log) + fırlat
  └─
```

---

## Entegrasyon Noktaları

| Dosya | Değişiklik |
|---|---|
| `lib/bots/connectors.ts` | Her adapter `withRecoveryPolicy()` ile sarıldı |
| `lib/bots/html-utils.ts` | HTTP istekleri recovery ile sarıldı |
| `lib/bots/source-runner.ts` | Hata yönetiminde recovery metrikleri eklendi |
| `app/api/cron/process-search-queue/route.ts` | DLQ entegrasyonu eklendi |

---

## Admin UI

**Sayfa:** `/admin/recovery`

**3 Sekme:**
1. **Devre Kesiciler** — Tüm kaynakların CB durumu, hata/açılma sayıları, manuel sıfırlama
2. **Ölü Kuyruk** — DLQ girdileri, durum filtresi, toplu/tekil aksiyonlar (retry, resolve, mark-dead)
3. **Metrikler** — 8 metrik türünde özet kartlar ve tablo

**API Rotaları:**
- `GET/POST /api/admin/recovery/circuit-breakers`
- `GET/POST /api/admin/recovery/dead-letter`
- `GET /api/admin/recovery/metrics`

---

## Test Kapsamı

| Test Dosyası | Test Sayısı | Kapsam |
|---|---|---|
| `failure-classification.test.ts` | 36 | Tüm hata kategorileri + retry kararları |
| `circuit-breaker.test.ts` | 26 | Singleton, durum geçişleri, zaman aşımı, edge case'ler |
| `dead-letter-queue.test.ts` | 14 | CRUD, filtreleme, istatistik, toplu işlem |
| `recovery-metrics.test.ts` | 7 | Kayıt, özet, kaynak bazlı sorgu |
| `connector-wrapper.test.ts` | 8 | CB açık, başarılı, auth izolasyonu, retryable log |
| **Toplam** | **91** | |

---

## SQL Migration

**Dosya:** `supabase/migrations/2024XXYY_recovery_tables.sql`

İki tablo oluşturur:

```sql
-- Ölü kuyruk tablosu
create table public.dead_letter_queue (
  id uuid default gen_random_uuid() primary key,
  source_id int references public.sources(id) on delete set null,
  source_slug text not null,
  queue_type text not null check (queue_type in ('scrape', 'search_queue')),
  retry_count int not null default 0,
  max_retries int not null default 3,
  last_error text not null,
  error_category text not null,
  payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'retrying', 'resolved', 'dead')),
  next_retry_at timestamptz,
  resolved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- İyileşme metrikleri tablosu
create table public.recovery_metrics (
  id uuid default gen_random_uuid() primary key,
  source_id int references public.sources(id) on delete set null,
  source_slug text not null,
  metric_type text not null,
  recorded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'
);
```

Her iki tabloda da performans için indeksler tanımlanmıştır.

---

## Sonuç

Sprint P-7 ile 2ElBul platformu **otomatik hata iyileştirme kabiliyeti** kazanmıştır. Sistem, geçici hataları (network, timeout, 5xx, rate_limit) retry edilebilir olarak işaretler, kalıcı hataları (auth, parser, schema) ölü kuyruğa yönlendirir ve devre kesici mekanizmasıyla kaynakları korur. Admin paneli üzerinden tüm durum görüntülenebilir ve manuel müdahale yapılabilir.

**Toplam:** 13 yeni dosya, 91 otomasyon testi, 3 API rotası, 1 admin sayfası.
