import Link from "next/link";
import {
  Activity,
  CalendarRange,
  Globe,
  MousePointerClick,
  PackageSearch,
  Search,
  UserRound,
} from "lucide-react";
import { AdminEmpty, AdminPageHeader, AdminStatCard } from "@/components/admin-ui";
import { formatDateTR } from "@/lib/formatters";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type {
  AnalyticsDevice,
  AnalyticsSource,
} from "@/lib/analytics/events";

const RANGES = [
  { key: "today", label: "Bugün", days: 0 },
  { key: "7d", label: "7 gün", days: 7 },
  { key: "30d", label: "30 gün", days: 30 },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

type GroupRow = { name: string; count: number };

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const { d } = await searchParams;
  const range = RANGES.find((r) => r.key === d) ?? RANGES[1];
  const supabase = createSupabaseAdminClient();

  const data = supabase
    ? await loadAnalytics(supabase, range.days)
    : loadUpstreamUnavailable();

  return (
    <>
      <AdminPageHeader
        eyebrow="İzleme"
        title="Site Analytics"
        description="Gizlilik-güvenli, salt istemci tarafı kimlik veya izleyici kullanmayan, yalnızca sunucu tarafında toplanan kaba ölçümler."
        action={<RangeChips selected={range.key} />}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label={`Olaylar · ${range.label}`}
          value={data.events}
          icon={Activity}
          note="analytics_events kayıtları"
        />
        <AdminStatCard
          label={`Aktif kullanıcı · ${range.label}`}
          value={data.distinctUsers}
          icon={UserRound}
          note="Oturumu tanımlanabilen kullanıcılar"
        />
        <AdminStatCard
          label={`Aramalar · ${range.label}`}
          value={data.searches}
          icon={Search}
          note="SEARCH olayları"
        />
        <AdminStatCard
          label="Şu an çevrimiçi"
          value={data.onlineNow}
          icon={CalendarRange}
          note="Son 15 dakikada aktif oturum"
        />
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-black/8 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.035)]">
          <h2 className="text-lg font-black">En çok aranan sorgular</h2>
          {data.topQueries.length ? (
            <ul className="mt-4 divide-y divide-black/6">
              {data.topQueries.map((row) => (
                <li
                  key={row.name}
                  className="flex items-center justify-between gap-4 py-3 text-sm"
                >
                  <span className="min-w-0 truncate font-bold text-black/80">
                    {row.name}
                  </span>
                  <span className="shrink-0 rounded-full bg-[#fff1e7] px-2.5 py-1 text-xs font-black text-[#d95700]">
                    {row.count}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4">
              <AdminEmpty>
                Henüz kaydedilmiş arama sorgusu yok.
              </AdminEmpty>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-black/8 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.035)]">
          <h2 className="text-lg font-black">Trafik kaynakları</h2>
          {data.trafficTotal ? (
            <div className="mt-4 grid gap-4">
              {data.traffic.map((row) => (
                <BarRow
                  key={row.name}
                  label={sourceLabel(row.name)}
                  count={row.count}
                  total={data.trafficTotal}
                />
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <AdminEmpty>
                Bu dönemde trafik kaynağı verisi yok.
              </AdminEmpty>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-black/8 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.035)]">
          <h2 className="text-lg font-black">Cihazlar</h2>
          {data.deviceTotal ? (
            <div className="mt-4 grid gap-4">
              {data.devices.map((row) => (
                <BarRow
                  key={row.name}
                  label={deviceLabel(row.name)}
                  count={row.count}
                  total={data.deviceTotal}
                />
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <AdminEmpty>
                Bu dönemde cihaz verisi yok.
              </AdminEmpty>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-black/8 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.035)]">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-lg font-black">Sayfa görüntüleme</h2>
            <span className="grid size-9 place-items-center rounded-xl bg-[#fff1e7] text-[#ff6b00]">
              <MousePointerClick size={18} />
            </span>
          </div>
          <div className="mt-4">
            <AdminEmpty>
              Sayfa görüntüleme / ürün görüntüleme / ilan tıklaması olayları bu
              gönderim kapsamında istemci tarafı izleyici eklenmediği için{" "}
              <span className="font-black">toplanmıyor</span> — bu panelde
              uydurma veri gösterilmez.
            </AdminEmpty>
          </div>
        </section>

        <section className="rounded-2xl border border-black/8 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.035)]">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-lg font-black">Coğrafi dağılım</h2>
            <span className="grid size-9 place-items-center rounded-xl bg-[#fff1e7] text-[#ff6b00]">
              <Globe size={18} />
            </span>
          </div>
          <div className="mt-4">
            <AdminEmpty>
              Konum analizi IP / kesin konum gerektirir; gizlilik ilkesi gereği
              toplanmıyor. Yalnızca kaba kategori (kaynak, cihaz) saklanır.
            </AdminEmpty>
          </div>
        </section>

        <section className="rounded-2xl border border-black/8 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.035)]">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-lg font-black">En çok görüntülenen ürünler</h2>
            <span className="grid size-9 place-items-center rounded-xl bg-[#fff1e7] text-[#ff6b00]">
              <PackageSearch size={18} />
            </span>
          </div>
          <div className="mt-4">
            <AdminEmpty>
              Ürün görüntüleme olayı istemci tarafı izleyici gerektirir — bu
              kapsamda toplanmıyor.
            </AdminEmpty>
          </div>
        </section>
      </div>

      <p className="mt-6 text-xs leading-5 text-black/40">
        Analytics yalnızca yönetici panelinden erişilebilir; herhangi bir
        genel API veya istemci tarafı veri isteği yoktur. Raw olay tabloları
        tek saklama alanıdır; özetler her istekte SQL ile canlı hesaplanır.
      </p>
    </>
  );
}

function RangeChips({ selected }: { selected: RangeKey }) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-black/8 bg-white p-1">
      {RANGES.map(({ key, label }) => (
        <Link
          key={key}
          href={key === "7d" ? "/admin/analytics" : `/admin/analytics?d=${key}`}
          className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${
            selected === key
              ? "bg-[#ff6b00] text-white"
              : "text-black/50 hover:text-[#d95700]"
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

function BarRow({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-bold text-black/80">{label}</span>
        <span className="text-xs font-black text-black/45">
          {count} · %{pct}
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#f3f1ec]">
        <div
          className="h-full rounded-full bg-[#ff6b00]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function sourceLabel(source: string): string {
  const map: Record<AnalyticsSource, string> = {
    direct: "Doğrudan",
    google: "Google / Bing",
    social: "Sosyal medya",
    search: "Diğer arama",
    referral: "Yönlendirme",
  };
  return map[source as AnalyticsSource] ?? source;
}

function deviceLabel(device: string): string {
  const map: Record<AnalyticsDevice, string> = {
    mobile: "Mobil",
    desktop: "Masaüstü",
    tablet: "Tablet",
  };
  return map[device as AnalyticsDevice] ?? device;
}

function countSafe(count: number | null): number {
  return typeof count === "number" ? count : 0;
}

type AnalyticsData = {
  events: number;
  distinctUsers: number;
  searches: number;
  onlineNow: number;
  traffic: GroupRow[];
  trafficTotal: number;
  devices: GroupRow[];
  deviceTotal: number;
  topQueries: GroupRow[];
};

async function loadAnalytics(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  days: number,
): Promise<AnalyticsData> {
  const now = new Date();
  const start =
    days === 0
      ? new Date(now.getTime() - 24 * 60 * 60 * 1000)
      : new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const startIso = start.toISOString();
  const onlineCutoff = new Date(now.getTime() - 15 * 60 * 1000).toISOString();

  const [events, distinctUsers, searches, online, trafficRows, deviceRows, queryRows] =
    await Promise.all([
      supabase
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startIso),
      supabase
        .from("analytics_events")
        .select("user_id", { count: "exact", head: true })
        .not("user_id", "is", null)
        .gte("created_at", startIso),
      supabase
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("event_name", "SEARCH")
        .gte("created_at", startIso),
      supabase
        .from("analytics_events")
        .select("user_id", { count: "exact", head: true })
        .not("user_id", "is", null)
        .gte("created_at", onlineCutoff),
      supabase
        .from("analytics_events")
        .select("traffic_source")
        .not("traffic_source", "is", null)
        .gte("created_at", startIso),
      supabase
        .from("analytics_events")
        .select("device_type")
        .not("device_type", "is", null)
        .gte("created_at", startIso),
      supabase
        .from("analytics_events")
        .select("search_query")
        .eq("event_name", "SEARCH")
        .not("search_query", "is", null)
        .gte("created_at", startIso),
    ]);

  return {
    events: countSafe(events.count),
    distinctUsers: countSafe(distinctUsers.count),
    searches: countSafe(searches.count),
    onlineNow: countSafe(online.count),
    traffic: topGroups(trafficRows.data, "traffic_source"),
    trafficTotal: sumGroupCounts(trafficRows.data, "traffic_source"),
    devices: topGroups(deviceRows.data, "device_type"),
    deviceTotal: sumGroupCounts(deviceRows.data, "device_type"),
    topQueries: topGroups(queryRows.data, "search_query").slice(0, 10),
  };
}

/**
 * Aggregates fetched rows into {name, count} buckets by a column, descending.
 * Fetches the column then buckets in JS — avoids PostgREST aggregate/view
 * quirks for a panel that stays within modest event volumes.
 */
function topGroups(rows: unknown, key: string): GroupRow[] {
  if (!Array.isArray(rows)) return [];
  const counts = new Map<string, number>();
  for (const row of rows as Record<string, unknown>[]) {
    const value = String(row[key] ?? "").trim();
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function sumGroupCounts(rows: unknown, key: string): number {
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((sum, row) => {
    const value = String((row as Record<string, unknown>)[key] ?? "").trim();
    return value ? sum + 1 : sum;
  }, 0);
}

function loadUpstreamUnavailable(): AnalyticsData {
  return {
    events: 0,
    distinctUsers: 0,
    searches: 0,
    onlineNow: 0,
    traffic: [],
    trafficTotal: 0,
    devices: [],
    deviceTotal: 0,
    topQueries: [],
  };
}
