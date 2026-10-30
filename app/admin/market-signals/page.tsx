import { ArrowUpRight, Flame, PackageSearch, ShieldAlert, TrendingDown, Users } from "lucide-react";
import Link from "next/link";
import { AdminEmpty, AdminPageHeader, AdminStatCard } from "@/components/admin-ui";
import { formatCurrencyTRY } from "@/lib/formatters";
import { loadMarketSignals, SIGNAL_TREND_DAYS, SUSPICIOUS_BELOW_PERCENT, type ListingSignal, type ProductSignal } from "@/lib/market-signals";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function AdminMarketSignalsPage() {
  const supabase = createSupabaseAdminClient();
  const signals = supabase
    ? await loadMarketSignals(supabase).catch((error) => {
        console.error("Admin market signals failed:", error);
        return null;
      })
    : null;

  if (!signals) {
    return (
      <>
        <AdminPageHeader eyebrow="Intelligence" title="Piyasa sinyalleri" description="Piyasadaki fırsatlar ve uyarılar." />
        <AdminEmpty>Piyasa sinyalleri hesaplanamadı. Service-role bağlantısını kontrol edin.</AdminEmpty>
      </>
    );
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Intelligence"
        title="Piyasa sinyalleri"
        description="Sitede gösterilen etiketlerle aynı kurallarla hesaplanır: yayındaki ilanlar, ürün fiyat ortalamaları ve kayıtlı fiyat geçmişi."
      />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AdminStatCard label="Fırsat ilanı" value={signals.opportunities.length} icon={Flame} note="Piyasanın altında" />
        <AdminStatCard label="Şüpheli ucuz" value={signals.suspiciousTotal} icon={ShieldAlert} note={`%${SUSPICIOUS_BELOW_PERCENT}+ altında`} />
        <AdminStatCard label="Fiyatı düşen ürün" value={signals.falling.length} icon={TrendingDown} note={`Son ${SIGNAL_TREND_DAYS} gün`} />
        <AdminStatCard label="Veri yetersiz ürün" value={signals.thinData.length} icon={PackageSearch} note="3'ten az ilan" />
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <ListingSection
          title="Fırsat ilanları"
          empty="Şu an piyasanın belirgin altında ilan yok."
          listings={signals.opportunities}
          tone="green"
        />
        <ListingSection
          title="Şüpheli ucuz ilanlar"
          empty="Şüpheli ucuz ilan yok."
          listings={signals.suspicious}
          tone="red"
          footer={
            signals.suspiciousTotal > 0 ? (
              <Link href="/admin/problem-listings?kind=suspicious_cheap" className="text-sm font-bold text-[#2A4FBF] hover:underline">
                Hatalı ilanlarda incele ve yönet →
              </Link>
            ) : null
          }
        />
        <ProductSection title="Fiyatı düşen ürünler" empty="Son 30 günde fiyatı düşen ürün yok (fiyat geçmişi birikiyor olabilir)." products={signals.falling} icon={TrendingDown} />
        <ProductSection title="En çok takip edilen ürünler" empty="Henüz takip edilen ürün yok." products={signals.mostFollowed} icon={Users} />
        <ProductSection title="Veri yetersiz ürünler" empty="Her ürünün yeterli ilanı var." products={signals.thinData} icon={PackageSearch} />
      </div>

      <p className="mt-5 text-xs font-semibold text-black/40">{signals.scannedListings.toLocaleString("tr-TR")} yayındaki ilan tarandı.</p>
    </>
  );
}

function Card({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-black/8 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.035)]">
      <h2 className="text-xl font-black tracking-[-0.03em]">{title}</h2>
      <div className="mt-4">{children}</div>
      {footer ? <div className="mt-4">{footer}</div> : null}
    </section>
  );
}

function ListingSection({
  title,
  empty,
  listings,
  tone,
  footer,
}: {
  title: string;
  empty: string;
  listings: ListingSignal[];
  tone: "green" | "red";
  footer?: React.ReactNode;
}) {
  return (
    <Card title={title} footer={footer}>
      {listings.length === 0 ? (
        <p className="text-sm font-semibold text-black/45">{empty}</p>
      ) : (
        <ul className="grid gap-2">
          {listings.map((listing) => (
            <li key={listing.id} className="flex items-center gap-3 rounded-xl border border-black/7 bg-[#fafaf8] p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black">{listing.productName}</p>
                <p className="truncate text-xs font-semibold text-black/45">
                  {listing.source} · {formatCurrencyTRY(listing.price)} (ortalama {formatCurrencyTRY(listing.marketAverage)})
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-black ${
                  tone === "green" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                %{Math.abs(listing.differencePercent).toLocaleString("tr-TR")} altında
              </span>
              {listing.url ? (
                <a href={listing.url} target="_blank" rel="noopener noreferrer nofollow" className="shrink-0 text-black/40 hover:text-[#2A4FBF]" aria-label="Kaynak ilanı aç">
                  <ArrowUpRight size={16} />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ProductSection({
  title,
  empty,
  products,
  icon: Icon,
}: {
  title: string;
  empty: string;
  products: ProductSignal[];
  icon: typeof Users;
}) {
  return (
    <Card title={title}>
      {products.length === 0 ? (
        <p className="text-sm font-semibold text-black/45">{empty}</p>
      ) : (
        <ul className="grid gap-2">
          {products.map((product) => (
            <li key={product.productId} className="flex items-center gap-3 rounded-xl border border-black/7 bg-[#fafaf8] p-3">
              <Icon size={16} className="shrink-0 text-[#3B66E0]" />
              <p className="min-w-0 flex-1 truncate text-sm font-black">{product.name}</p>
              <span className="shrink-0 text-xs font-bold text-black/50">{product.note}</span>
              {product.slug ? (
                <Link href={`/product/${product.slug}`} target="_blank" className="shrink-0 text-black/40 hover:text-[#2A4FBF]" aria-label="Ürün sayfasını aç">
                  <ArrowUpRight size={16} />
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
