import { AdminEmpty, AdminPageHeader } from "@/components/admin-ui";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type CountValue = { label: string; value: number };

type StatsPayload = {
  daily: CountValue[];
  sources: CountValue[];
  conditions: CountValue[];
  cities: CountValue[];
  products: CountValue[];
  favorites: CountValue[];
  expensiveProducts: CountValue[];
};

export default async function AdminStatsPage() {
  const supabase = createSupabaseAdminClient();
  const statsResult = supabase
    ? await supabase.rpc("get_admin_platform_stats")
    : { data: null, error: { message: "no client" } };

  if (statsResult.error) {
    console.error("Admin platform stats RPC failed:", statsResult.error);
  }

  const stats = parseStats(statsResult.data);

  return (
    <>
      <AdminPageHeader
        eyebrow="Raporlama"
        title="İstatistikler"
        description="İlan hacmini, kaynak ve şehir dağılımını, ürün fiyatlarını ve favori eğilimlerini inceleyin."
      />
      {statsResult.error ? (
        <AdminEmpty>
          İstatistik verileri alınamadı. `supabase/site-settings.sql` dosyasını
          çalıştırdığınızdan emin olun.
        </AdminEmpty>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          <StatPanel title="Günlük ilan eklenme sayısı" items={stats.daily} />
          <StatPanel title="Kaynaklara göre ilan sayısı" items={stats.sources} />
          <StatPanel title="Durum dağılımı" items={stats.conditions} />
          <StatPanel title="Şehirlere göre ilan sayısı" items={stats.cities} />
          <StatPanel title="En çok ilana sahip ürünler" items={stats.products} />
          <StatPanel title="En çok favorilenen ilanlar" items={stats.favorites} />
          <StatPanel
            title="Ortalama fiyatı en yüksek ürünler"
            items={stats.expensiveProducts}
            currency
          />
        </div>
      )}
    </>
  );
}

function parseStats(value: unknown): StatsPayload {
  const empty: StatsPayload = {
    daily: [],
    sources: [],
    conditions: [],
    cities: [],
    products: [],
    favorites: [],
    expensiveProducts: [],
  };
  if (!value || typeof value !== "object") return empty;

  const record = value as Record<string, unknown>;
  return {
    daily: parseCountArray(record.daily),
    sources: parseCountArray(record.sources),
    conditions: parseCountArray(record.conditions),
    cities: parseCountArray(record.cities),
    products: parseCountArray(record.products),
    favorites: parseCountArray(record.favorites),
    expensiveProducts: parseCountArray(record.expensiveProducts),
  };
}

function parseCountArray(value: unknown): CountValue[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as { label?: unknown; value?: unknown };
      return {
        label: String(record.label ?? ""),
        value: Number(record.value ?? 0),
      };
    })
    .filter((item): item is CountValue => Boolean(item?.label));
}

function StatPanel({
  title,
  items,
  currency,
}: {
  title: string;
  items: CountValue[];
  currency?: boolean;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <section className="min-w-0 rounded-2xl border border-black/7 bg-white p-5">
      <h2 className="font-black">{title}</h2>
      {items.length ? (
        <div className="mt-5 grid gap-3">
          {items.map((item) => (
            <div key={item.label} className="min-w-0">
              <div className="mb-1.5 flex justify-between gap-4 text-xs">
                <span className="truncate font-bold">{item.label}</span>
                <span className="shrink-0 font-black text-black/55">
                  {currency ? formatPrice(item.value) : item.value}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-black/6">
                <div
                  className="h-full rounded-full bg-[#ff6b00]"
                  style={{ width: `${Math.max((item.value / max) * 100, 3)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-5 text-sm text-black/40">Henüz veri yok.</p>
      )}
    </section>
  );
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}
