import { AdminEmpty, AdminPageHeader } from "@/components/admin-ui";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type CountValue = { label: string; value: number };

export default async function AdminStatsPage() {
  const supabase = createSupabaseAdminClient();
  const [productsResult, listingsResult, favoritesResult] = supabase
    ? await Promise.all([
        supabase.from("products").select("id, name"),
        supabase
          .from("listings")
          .select(
            "id, product_id, title, price, city, source, condition, created_at",
          ),
        supabase.from("favorites").select("listing_id"),
      ])
    : [null, null, null];

  const products = new Map(
    (productsResult?.data ?? []).map((product) => [
      String(product.id),
      String(product.name),
    ]),
  );
  const listings = listingsResult?.data ?? [];

  const daily = countBy(
    listings,
    (listing) => String(listing.created_at).slice(0, 10),
  )
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(-14);
  const sources = countBy(listings, (listing) => String(listing.source));
  const conditionCounts = new Map(
    countBy(listings, (listing) => String(listing.condition)).map((item) => [
      item.label,
      item.value,
    ]),
  );
  const conditions = ["İkinci El", "Yeni gibi", "İyi", "Yenilenmiş"].map(
    (label) => ({
      label,
      value: conditionCounts.get(label) ?? 0,
    }),
  );
  const cities = countBy(listings, (listing) => String(listing.city)).slice(
    0,
    12,
  );
  const productCounts = countBy(
    listings,
    (listing) => products.get(String(listing.product_id)) ?? "Bilinmeyen",
  ).slice(0, 10);

  const favoriteCounts = countBy(
    favoritesResult?.data ?? [],
    (favorite) => String(favorite.listing_id),
  );
  const listingTitles = new Map(
    listings.map((listing) => [String(listing.id), String(listing.title)]),
  );
  const mostFavorited = favoriteCounts
    .map((item) => ({
      label: listingTitles.get(item.label) ?? `İlan #${item.label}`,
      value: item.value,
    }))
    .slice(0, 10);

  const priceStats = new Map<string, { total: number; count: number }>();
  for (const listing of listings) {
    const name = products.get(String(listing.product_id)) ?? "Bilinmeyen";
    const current = priceStats.get(name) ?? { total: 0, count: 0 };
    priceStats.set(name, {
      total: current.total + Number(listing.price),
      count: current.count + 1,
    });
  }
  const expensiveProducts = [...priceStats.entries()]
    .map(([label, stats]) => ({
      label,
      value: Math.round(stats.total / stats.count),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return (
    <>
      <AdminPageHeader
        eyebrow="Raporlama"
        title="İstatistikler"
        description="İlan hacmini, kaynak ve şehir dağılımını, ürün fiyatlarını ve favori eğilimlerini inceleyin."
      />
      {listingsResult?.error ? (
        <AdminEmpty>İstatistik verileri alınamadı.</AdminEmpty>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          <StatPanel title="Günlük ilan eklenme sayısı" items={daily} />
          <StatPanel title="Kaynaklara göre ilan sayısı" items={sources} />
          <StatPanel title="Durum dağılımı" items={conditions} />
          <StatPanel title="Şehirlere göre ilan sayısı" items={cities} />
          <StatPanel title="En çok ilana sahip ürünler" items={productCounts} />
          <StatPanel title="En çok favorilenen ilanlar" items={mostFavorited} />
          <StatPanel
            title="Ortalama fiyatı en yüksek ürünler"
            items={expensiveProducts}
            currency
          />
        </div>
      )}
    </>
  );
}

function countBy<T>(rows: T[], getLabel: (row: T) => string): CountValue[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = getLabel(row) || "Belirtilmemiş";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
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
