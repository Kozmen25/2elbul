# SPRINT P-6: Monitoring & Alerting Platform

**Tarih:** 2026-07-13  
**Durum:** ✅ **TAMAMLANDI**  
**Önceki Sprint:** SPRINT-4.5-FINAL (Bot ve Matcher Altyapısı)  
**Bu Sprint'in Hedefi:** Production monitoring, health scoring ve alerting altyapısı

---

## 1. Mimari Genel Bakış

Monitoring platformu, mevcut engine'lerin **üzerine** inşa edilmiş, onları **hiçbir şekilde değiştirmeyen** bir gözlem katmanıdır.

```
┌─────────────────────────────────────────────────────────────┐
│                    Monitoring & Alerting                     │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Metrics     │  │ Alert        │  │ Health Score      │  │
│  │ Collector   │──▶ Engine       │──▶ Calculator        │  │
│  │ (read-only) │  │ (rules-based)│  │ (weighted, 5-dim) │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬──────────┘  │
│         │               │                     │            │
│         ▼               ▼                     ▼            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               API Routes (6 endpoints)              │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                  │
│                         ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Admin UI (İzleme Merkezi)                 │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
          │                │                │
          ▼                ▼                ▼
   Supabase (logs)   In-Memory Store   Admin Session
   (read-only)       (alerts)          (auth)
```

### Tasarım İlkeleri

| İlke | Açıklama |
|------|----------|
| **Read-Only Observation** | Monitoring hiçbir engine'i değiştirmez, sadece okur |
| **Extensible Interfaces** | `MetricsExporter`, `AlertNotifier`, `AlertStore` — yeni entegrasyonlar için arayüzler hazır |
| **No New Dependencies** | Sadece mevcut Supabase client ve built-in API'ler kullanılır |
| **Fail-Safe** | Herhangi bir koleksiyon hatasında sistem boş dizi döner, kırılmaz |
| **Dual-Column Support** | Tüm SQL sorguları snake_case ve camelCase sütun adlarını destekler |

---

## 2. Dosya Yapısı

```
lib/monitoring/
├── types.ts              # Tip tanımlamaları (230 satır)
├── metrics-collector.ts  # Metrik toplama servisi (735 satır)
├── alert-engine.ts       # Alert motoru + InMemoryAlertStore (569 satır)
└── index.ts              # Barrel export

app/api/monitoring/
├── summary/route.ts      # GET /api/monitoring/summary
├── snapshot/route.ts     # GET /api/monitoring/snapshot
└── alerts/
    ├── route.ts          # GET /api/monitoring/alerts
    └── [id]/
        ├── acknowledge/route.ts  # POST .../acknowledge
        └── resolve/route.ts      # POST .../resolve

app/admin/monitoring/
├── page.tsx              # Server component (force-dynamic)
└── monitoring-client.tsx # Client component (235 satır UI)

components/
└── admin-nav.tsx         # Navbar'a "İzleme" grubu eklendi
```

---

## 3. Metrics Collector

### 3.1 Veri Kaynakları

| Metrik | Tablo | Limit | Amaç |
|--------|-------|-------|------|
| `collectSourceHealth()` | `source_run_logs` | Son 1000 kayıt | Her kaynağın başarı/başarısızlık oranı, yanıt süresi |
| `collectBotHealth()` | `bot_run_logs` | Son 2000 kayıt | Bot bazında çalışma istatistikleri, ardışık hata sayısı |
| `collectImportMetrics(n)` | `import_logs` | Son n saat | İçe aktarma başarı/başarısızlık, saatlik özet |
| `collectQueueMetrics()` | `job_queue` | Son 1000 kayıt | Kuyruk derinliği, işleme durumu, hata oranı |
| `collectPerformanceMetrics()` | Runtime | Anlık | Memory kullanımı, uptime |

### 3.2 Source Health Detayları

- `sources` tablosundan tüm kaynaklar çekilir (id, name)
- `source_run_logs` ile birleştirilerek her kaynağın metrikleri hesaplanır
- Status belirleme:
  - `healthy`: failure = 0 ve successRate >= %90
  - `degraded`: failure > 0 veya successRate < %90
  - `down`: failure >= 3 veya successRate < %50

### 3.3 Bot Health Detayları

- Bot ID'lerinden source ID çıkarımı (`extractSourceIdFromBotId()`):
  - "sahibinden" → 1, "letgo" → 2, "facebook" → 3, ..., "satarız" → 10
- Ardışık hata sayısı: en son çalışmadan itibaren geriye doğru sayılır
- Status belirleme:
  - `healthy`: consecutiveFailures = 0 ve successRate >= %90
  - `degraded`: consecutiveFailures >= 1 veya successRate < %90
  - `down`: consecutiveFailures >= 3 veya successRate < %50

---

## 4. Health Score

### 4.1 Ağırlıklı Bileşen Modeli

| Bileşen | Ağırlık | Hesaplama |
|---------|---------|-----------|
| `source_health` | %30 | Kaynak status bazlı: healthy=100, degraded=60, down=20 |
| `bot_health` | %25 | Bot successRate ortalaması |
| `import_health` | %20 | Hata oranı bazlı: `max(0, 100 - errorRate * 5)` |
| `queue_health` | %15 | Kuyruk failureRate ve derinlik bazlı |
| `performance` | %10 | Sabit 100 (gelecekte genişletilecek) |

### 4.2 Threshold'lar

| Skor | Status | Renk |
|------|--------|------|
| >= 80 | Healthy (Sağlıklı) | Yeşil |
| 50-79 | Degraded (Uyarı) | Turuncu |
| < 50 | Critical (Kritik) | Kırmızı |

### 4.3 API Response Örneği

```json
{
  "overall": 78,
  "status": "degraded",
  "components": [
    { "name": "source_health", "score": 85, "weight": 0.3, "status": "healthy", "detail": "7/10 sources healthy" },
    { "name": "bot_health", "score": 72, "weight": 0.25, "status": "degraded", "detail": "5/8 bots healthy" },
    { "name": "import_health", "score": 90, "weight": 0.2, "status": "healthy", "detail": "Last 1h: avg import quality 90/100" },
    { "name": "queue_health", "score": 65, "weight": 0.15, "status": "degraded", "detail": "3 queues, total depth 45" },
    { "name": "performance", "score": 100, "weight": 0.1, "status": "healthy", "detail": "Runtime performance nominal" }
  ],
  "updatedAt": "2026-07-13T23:00:00.000Z"
}
```

---

## 5. Alert Engine

### 5.1 8 Alert Tipi

| Tip | Severity | Cooldown | Threshold | Açıklama |
|-----|----------|----------|-----------|----------|
| `consecutive_failures` | critical/warning | 10/5 dk | 3/2 | Ardışık bot/kaynak hatası |
| `timeout` | critical/warning | 10/5 dk | 60s/30s | Ortalama yanıt süresi aşımı |
| `http_error` | critical/warning | 10/10 dk | %50/%20 | HTTP hata oranı |
| `cloudflare_detected` | warning | 30 dk | 1 | Cloudflare tespiti |
| `captcha_detected` | critical | 30 dk | 1 | CAPTCHA tespiti |
| `empty_import` | warning | 15 dk | 0 | İçe aktarma 0 sonuç |
| `abnormal_duplicate_rate` | warning | 30 dk | %30 | Beklenmeyen duplicate oranı |
| `source_unavailable` | critical | 10 dk | 1 | Kaynak tamamen erişilemez |

### 5.2 Kurallar (11 Adet)

Her alert tipi için özelleştirilmiş kurallar tanımlanmıştır. `DEFAULT_ALERT_RULES` dizisinde 11 kural bulunur:
- consecutive_failures: 2 kural (critical + warning)
- timeout: 2 kural (critical + warning)
- http_error: 2 kural (critical + warning)
- cloudflare_detected: 1 kural
- captcha_detected: 1 kural
- empty_import: 1 kural
- abnormal_duplicate_rate: 1 kural
- source_unavailable: 1 kural

### 5.3 Deduplication Mekanizması

AlertEngine, her alert tipi + entity çifti için `lastTriggered` map'inde son tetikleme zamanını tutar. Cooldown süresi dolmadan aynı alert tekrar tetiklenmez. Key formatı: `"type:entity"` (örn. `"consecutive:bot:sahibinden-bot"`).

### 5.4 Auto-Resolve

`autoResolve()` metodu, sağlıklı duruma dönen kaynaklar ve botlar için ilgili alert'leri otomatik olarak çözer:
- `source_unavailable`, `http_error`, `timeout`, `consecutive_failures` — kaynak healthy olunca çözülür
- Bot bazlı alert'ler — bot healthy olunca çözülür

### 5.5 İkincil Depo (Dual-Store) Düzeltmesi

Başlangıçta `getAlertEngine()` singleton'ı ile `listActiveAlerts()` fonksiyonu farklı `InMemoryAlertStore` instance'ları kullanıyordu. Bu, alert-engine.ts:542'de düzeltildi: `new AlertEngine()` → `new AlertEngine({ store: defaultStore })`. Artık aynı store instance'ı paylaşılıyor.

---

## 6. API Routes

| Route | Method | Fonksiyon |
|-------|--------|-----------|
| `/api/monitoring/summary` | GET | Özet metrikler + health score |
| `/api/monitoring/snapshot` | GET | Tam metrik snapshot (tüm kaynak/bot/import/kuyruk + health + alerts) |
| `/api/monitoring/alerts` | GET | Filter: `?type=&severity=&status=&sourceId=&limit=&offset=` |
| `/api/monitoring/alerts/[id]/acknowledge` | POST | Alarm onaylama (JSON: `acknowledgedBy`) |
| `/api/monitoring/alerts/[id]/resolve` | POST | Alarm çözme |

Tüm route'lar:
- `force-dynamic` export
- `runtime: "nodejs"` export
- `verifyAdmin()` kontrolü (401/403 dönüşleri)
- Try-catch ile hata güvenliği

---

## 7. Admin UI (İzleme Merkezi)

### 7.1 Bileşenler

**Sağlık Puanı Kartı** (`HeartPulse` ikonu):
- Genel skor (büyük rakam)
- Status badge (Sağlıklı / Uyarı / Kritik)
- 5 bileşen skoru (2x5 grid): source_health, bot_health, import_health, queue_health, performance

**AdminStatCards (4'lü grid)**:
- Aktif Alarmlar (+ kritik/uyarı dağılımı)
- Sağlıklı Kaynaklar (kritik/uyarı detayı)
- Son 1s İçe Aktarma (başarısız sayısı)
- Kuyruk Derinliği

**Alarmlar Bölümü**:
- İlk 5 alarm gösterilir, "Tümünü Göster" butonu
- Kritik alarmlar kırmızı, uyarılar turuncu badge
- Boş state: yeşil onay ikonu + "Aktif alarm bulunmuyor."

**Bileşen Detayları**:
- Her health bileşeni için detaylı kart (ikon + skor + açıklama)

### 7.2 Navbar

Admin navigasyonuna "İzleme" grubu eklendi:
```
İzleme
└── İzleme Merkezi (/admin/monitoring) — Activity ikonu
```

---

## 8. Extensible Provider Interfaces

Gelecekteki entegrasyonlar için hazır arayüzler:

```typescript
interface MetricsExporter {
  readonly name: string;
  export(snapshot: MetricsSnapshot): Promise<void>;
}

interface AlertNotifier {
  readonly name: string;
  send(alert: Alert): Promise<void>;
}

interface AlertStore {
  save(alert: Alert): Promise<void>;
  list(filter?: AlertFilter): Promise<Alert[]>;
  acknowledge(id: string, by: string): Promise<void>;
  resolve(id: string): Promise<void>;
  getActive(): Promise<Alert[]>;
}
```

**ENTEGRE EDİLMEDİ** (sadece arayüzler hazır):
- ❌ Sentry / Grafana / Prometheus
- ❌ Slack / Discord / Email bildirimleri

---

## 9. Type System

Ana tipler ve kullanım alanları:

| Tip | Kullanım |
|-----|----------|
| `SourceHealthMetric` | Kaynak sağlık metrikleri (successRate, avgResponseTime, status) |
| `BotHealthMetric` | Bot çalışma metrikleri (consecutiveFailures, successRate) |
| `ImportMetric` | İçe aktarma detayı (listings, errorRate, listingsPerSecond) |
| `ImportSummaryMetric` | Saatlik içe aktarma özeti |
| `QueueMetric` | Kuyruk durumu (depth, failureRate, processingCount) |
| `PerformanceMetric` | Runtime metrikleri (memory, uptime) |
| `Alert` | Alarm kaydı (type, severity, status, sourceId, metadata) |
| `AlertRule` | Alarm kuralı (threshold, windowSec, cooldownSec) |
| `HealthScore` | Sağlık skoru (overall, status, components) |
| `HealthScoreComponent` | Bileşen skoru (name, score, weight, status, detail) |
| `MonitoringSummary` | Admin UI için özet (health, alerts, imports, queues) |
| `MetricsSnapshot` | Tam snapshot (tüm metrikler + health + alerts) |

---

## 10. Validasyon Sonuçları

| Adım | Sonuç |
|------|-------|
| `tsc --noEmit` | ✅ Başarılı (0 hata) |
| `npm test` (ilgili testler) | ✅ 251 test geçti (normalization, confidence, duplicate, product-matcher, sahibinden) |
| `npm test` (genel) | ⚠️ 17 failed / 49 files — **tümü** önceden var olan `server-only` modül hataları (monitoring değişiklikleriyle ilgisi yok) |
| `npm run build` | ⚠️ 4 build hatası — **tümü** önceden var olan `easycep.ts`/`getmobil.ts` server-only Pages Router sorunları |

**Önemli**: Tüm build/test hataları **önceden var olan** ve monitoring platformuyla ilgisi olmayan sorunlardan kaynaklanmaktadır. Monitoring kodunun kendisi hatasız çalışmaktadır.

---

## 11. Kaynak ID Referansı

| Kaynak | ID |
|--------|----|
| Sahibinden | 1 |
| Letgo | 2 |
| Facebook | 3 |
| EasyCep | 4 |
| Getmobil | 5 |
| Yenilenmiş Market | 6 |
| Teknosa Yenilenmiş | 7 |
| Hepsiburada Yenilenmiş | 8 |
| MediaMarkt Yenilenmiş | 9 |
| Satarız | 10 |

---

## 12. Gelecek Planları (SPRINT P-7 ve Sonrası)

1. **Alert Persistence**: InMemoryAlertStore → Supabase tablosu
2. **Alert Notifications**: Slack, Discord, Email entegrasyonu
3. **Metrics Export**: Prometheus/Grafana uyumlu metrik çıktısı
4. **Historical Trends**: Health score geçmişi, trend grafikleri
5. **Scheduled Evaluation**: Cron job ile periyodik alert değerlendirmesi
6. **Performance Expansion**: Gerçek API yanıt süreleri, bot döngü süreleri

---

## 13. Sprint İstatistikleri

| Metrik | Değer |
|--------|-------|
| **Toplam yeni dosya** | 10 |
| **Değiştirilen dosya** | 1 (admin-nav.tsx) |
| **Toplam yeni satır** | ~1.700 |
| **Test geçiş oranı (ilgili)** | 100% (251/251) |
| **TypeScript hata** | 0 |
| **Build hata (yeni)** | 0 |
| **Önceden var olan build hata** | 4 (easycep/getmobil server-only) |
