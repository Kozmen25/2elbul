import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BarChart3, Flame, PackageSearch, TrendingDown } from "lucide-react";
import { getHomeData, type MarketPulseItem } from "@/lib/home-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "İkinci El Piyasa Merkezi | 2ElBul",
  description:
    "2ElBul Piyasa Merkezi, ikinci el piyasasındaki arama, ilan ve fiyat sinyallerini analiz ederek öne çıkan ürünleri gösterir.",
  alternates: {
    canonical: "/market",
  },
  openGraph: {
    title: "İkinci El Piyasa Merkezi | 2ElBul",
    description:
      "İkinci el piyasasında en çok aranan ürünleri, fırsatları ve fiyatı düşen ürünleri 2ElBul Piyasa Merkezi'nde incele.",
    url: "/market",
    siteName: "2ElBul",
    locale: "tr_TR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "İkinci El Piyasa Merkezi | 2ElBul",
    description:
      "2ElBul, ikinci el piyasasındaki arama, ilan ve fiyat sinyallerini analiz eder.",
  },
};

type MarketPageProps = {
  searchParams: Promise<{
    view?: string | string[];
  }>;
};

type MarketView =
  | "all"
  | "opportunities"
  | "falling"
  | "searched"
  | "listed";

const views: Array<{ value: MarketView; label: string }> = [
  { value: "all", label: "Tüm sinyaller" },
  { value: "opportunities", label: "Fırsatlar" },
  { value: "falling", label: "Fiyatı düşenler" },
  { value: "searched", label: "En çok arananlar" },
  { value: "listed", label: "En çok ilanı olanlar" },
];

export default async function MarketPage({ searchParams }: MarketPageProps) {
  const params = await searchParams;
  const rawView = Array.isArray(params.view) ? params.view[0] : params.view;
  const activeView = parseMarketView(rawView);
  const { marketPulse, error } = await getHomeData();
  const sections = [
    {
      key: "searched" as const,
      title: "En çok aranan ürünler",
      description: "Kullanıcıların en çok takip ettiği ürün sinyalleri.",
      icon: Flame,
      items: marketPulse.mostSearchedProducts,
      emptyText: "Yeterli arama verisi oluşunca burada sinyaller görünecek.",
    },
    {
      key: "listed" as const,
      title: "En çok ilanı olan ürünler",
      description: "Piyasada en çok ilan hacmine sahip ürünler.",
      icon: PackageSearch,
      items: marketPulse.mostListedProducts,
      emptyText: "Yeterli ilan verisi oluşunca burada ürün yoğunluğu görünecek.",
    },
    {
      key: "opportunities" as const,
      title: "Öne çıkan fırsatlar",
      description: "Intelligence Engine fırsat skoruna göre öne çıkan ürünler.",
      icon: BarChart3,
      items: marketPulse.topOpportunities,
      emptyText: "Fırsat skoru için yeterli piyasa verisi oluşunca burada görünecek.",
    },
    {
      key: "falling" as const,
      title: "Fiyatı düşen ürünler",
      description: "Fiyat sinyali aşağı yönlü görünen ürünler.",
      icon: TrendingDown,
      items: marketPulse.fallingPriceProducts,
      emptyText: "Düşüş trendi yakalanınca burada ürünler listelenecek.",
    },
    {
      key: "insufficient" as const,
      title: "Veri yetersiz ürünler",
      description: "Takip edilen ama henüz karar desteği için yeterli verisi olmayan ürünler.",
      icon: PackageSearch,
      items: marketPulse.insufficientDataProducts,
      emptyText: "Veri yetersiz ürünler oluşunca burada görünecek.",
    },
  ];
  const visibleSections =
    activeView === "all"
      ? sections
      : sections.filter((section) => section.key === activeView);
  const totalSignals = sections.reduce((total, section) => total + section.items.length, 0);

  return (
    <main className="min-w-0 bg-[#fafaf8] py-10 sm:py-14">
      <div className="container-shell min-w-0">
        <section className="rounded-3xl border border-black/8 bg-white p-6 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8 lg:p-10">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ff6b00]">
            Piyasa zekası
          </p>
          <div className="mt-3 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h1 className="max-w-4xl text-3xl font-black tracking-[-0.045em] sm:text-5xl">
                İkinci El Piyasa Merkezi
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-black/58 sm:text-base">
                2ElBul, ikinci el piyasasındaki arama, ilan ve fiyat
                sinyallerini analiz ederek öne çıkan ürünleri gösterir.
              </p>
            </div>
            <div className="rounded-2xl border border-[#ff6b00]/20 bg-[#fff7f1] p-4 text-center">
              <p className="text-3xl font-black text-[#ff6b00]">{totalSignals}</p>
              <p className="text-xs font-black uppercase tracking-[0.08em] text-[#d95700]">
                piyasa sinyali
              </p>
            </div>
          </div>
        </section>

        {error ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
            {error}
          </div>
        ) : null}

        <nav className="mt-6 flex gap-2 overflow-x-auto pb-2">
          {views.map((view) => (
            <Link
              key={view.value}
              href={view.value === "all" ? "/market" : `/market?view=${view.value}`}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-black transition ${
                activeView === view.value
                  ? "border-[#ff6b00] bg-[#ff6b00] text-white"
                  : "border-black/10 bg-white text-black/60 hover:border-[#ff6b00]/35 hover:text-[#d95700]"
              }`}
            >
              {view.label}
            </Link>
          ))}
        </nav>

        <div className="mt-6 grid gap-6">
          {visibleSections.map((section) => (
            <MarketSection
              key={section.key}
              title={section.title}
              description={section.description}
              icon={section.icon}
              items={section.items}
              emptyText={section.emptyText}
            />
          ))}
        </div>
      </div>
    </main>
  );
}

function MarketSection({
  title,
  description,
  icon: Icon,
  items,
  emptyText,
}: {
  title: string;
  description: string;
  icon: typeof BarChart3;
  items: MarketPulseItem[];
  emptyText: string;
}) {
  return (
    <section className="rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#fff1e7] text-[#ff6b00]">
            <Icon size={21} />
          </span>
          <div className="min-w-0">
            <h2 className="text-2xl font-black tracking-[-0.035em]">{title}</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-black/45">
              {description}
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-[#fafaf8] px-3 py-1.5 text-xs font-black text-black/45">
          {items.length} ürün
        </span>
      </div>

      {items.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <MarketProductCard key={`${title}-${item.productName}`} item={item} />
          ))}
        </div>
      ) : (
        <EmptyPulseState text={emptyText} />
      )}
    </section>
  );
}

function MarketProductCard({ item }: { item: MarketPulseItem }) {
  return (
    <article className="min-w-0 rounded-2xl border border-black/8 bg-[#fafaf8] p-5 transition hover:-translate-y-0.5 hover:border-[#ff6b00]/35 hover:bg-white hover:shadow-[0_14px_40px_rgba(0,0,0,0.06)]">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-lg font-black leading-6">
            {item.productName}
          </h3>
          <p className="mt-2 text-xs font-bold text-black/40">
            {item.listingCount} ilan · {item.searchCount} arama
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-[#ff6b00]/20 bg-white px-3 py-1.5 text-[11px] font-black text-[#d95700]">
          {item.opportunityLabel}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Metric label="Ortalama fiyat" value={item.averagePrice ? formatPrice(item.averagePrice) : "—"} />
        <Metric label="En düşük fiyat" value={item.lowestPrice ? formatPrice(item.lowestPrice) : "—"} accent />
        <Metric label="Trend" value={formatTrend(item)} />
        <Metric label="Talep" value={formatDemand(item)} />
      </div>

      <Link href={item.href} className="orange-button mt-5 w-full justify-center py-3">
        Detaya git
        <ArrowUpRight size={17} />
      </Link>
    </article>
  );
}

function Metric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-black/8 bg-white p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.06em] text-black/35">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-sm font-black ${accent ? "text-[#ff6b00]" : ""}`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function EmptyPulseState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/15 bg-[#fafaf8] px-6 py-12 text-center text-sm font-semibold text-black/45">
      {text || "Yeterli piyasa verisi oluşunca burada sinyaller görünecek."}
    </div>
  );
}

function parseMarketView(value: string | undefined): MarketView {
  return value === "opportunities" ||
    value === "falling" ||
    value === "searched" ||
    value === "listed"
    ? value
    : "all";
}

function formatTrend(item: MarketPulseItem) {
  if (item.trendDirection === "unknown") return "—";
  const label =
    item.trendDirection === "falling"
      ? "Düşüyor"
      : item.trendDirection === "rising"
        ? "Yükseliyor"
        : "Stabil";
  return item.trendChangePercent === null
    ? label
    : `${label} %${Math.abs(item.trendChangePercent)}`;
}

function formatDemand(item: MarketPulseItem) {
  if (item.searchCount >= 25) return "Yüksek";
  if (item.searchCount >= 8) return "Orta";
  if (item.searchCount > 0) return "Düşük";
  return "—";
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(price);
}
