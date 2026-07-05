import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowUpRight,
  BadgePercent,
  BarChart3,
  Car,
  Clock3,
  FolderSearch2,
  Gamepad2,
  HomeIcon,
  Laptop,
  MapPin,
  PackageSearch,
  Search,
  Smartphone,
  Store,
  TrendingDown,
  TriangleAlert,
  Tv,
} from "lucide-react";
import { ListingImage } from "@/components/listing-image";
import { SearchBar } from "@/components/search-bar";
import { createProductSlug } from "@/lib/product-slug";
import { getAbsoluteUrl } from "@/lib/site-url";
import {
  getHomeData,
  type HomeListing,
  type MarketPulseItem,
  type PriceOpportunity,
} from "@/lib/home-data";

export const dynamic = "force-dynamic";

const homeUrl = getAbsoluteUrl("/");

export const metadata: Metadata = {
  title: "Ikinci el urunlerin gercek piyasa fiyatini karsilastir | 2ElBul",
  description:
    "Telefon, bilgisayar, konsol ve daha fazlasi icin ikinci el ilanlari tek yerde karsilastir; ortalama fiyati, en ucuz ilani ve fiyat gecmisini gor.",
  alternates: {
    canonical: homeUrl,
  },
  openGraph: {
    title: "Ikinci el urunlerin gercek piyasa fiyatini karsilastir | 2ElBul",
    description:
      "2ElBul ile ikinci el ilanlari karsilastir, ortalama fiyati, en ucuz ilani, fiyat gecmisini ve guven skorunu gor.",
    url: homeUrl,
    siteName: "2ElBul",
    locale: "tr_TR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ikinci el urunlerin gercek piyasa fiyatini karsilastir | 2ElBul",
    description:
      "Ikinci el piyasasini tek yerde karsilastir; fiyat analizini, en ucuz ilanlari ve fiyat gecmisini gor.",
  },
};

const quickCategories = [
  { label: "Telefon", query: "telefon", icon: Smartphone },
  { label: "Bilgisayar", query: "bilgisayar", icon: Laptop },
  { label: "Konsol", query: "oyun konsolu", icon: Gamepad2 },
  { label: "TV / Ses", query: "tv", icon: Tv },
  { label: "Araç", query: "araba", icon: Car },
  { label: "Emlak", query: "emlak", icon: HomeIcon },
  { label: "Yedek Parça", query: "yedek parça", icon: Store },
  { label: "Ev / Yaşam", query: "mobilya", icon: FolderSearch2 },
  { label: "Fiyatı düşenler", query: "fiyatı düşen", icon: TrendingDown },
  { label: "Fırsatlar", query: "fırsat", icon: BadgePercent },
  { label: "Yakınımdaki", query: "yakınımdaki", icon: MapPin },
  { label: "Tüm ilanlar", query: "", icon: PackageSearch },
];

const quickAnchors = [
  { label: "Kategoriler", href: "#kategoriler" },
  { label: "En İyi Fırsatlar", href: "#firsatlar" },
  { label: "Piyasa Nabzı", href: "#piyasa" },
  { label: "Son İlanlar", href: "#yeni-ilanlar" },
  { label: "Kaynaklar", href: "#kaynaklar" },
];

const fallbackPopularSearches = [
  "iPhone",
  "Laptop",
  "PS5",
  "RTX 4060",
  "MacBook",
  "AirPods",
  "iPad",
  "Samsung",
];

const formatPrice = (price: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(price);

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));

export default async function Home() {
  const {
    priceOpportunities,
    last24HourListings,
    sourceSummary,
    popularProducts,
    marketPulse,
    error,
  } = await getHomeData();

  const totalListings = sourceSummary.reduce(
    (total, source) => total + source.listingCount,
    0,
  );
  const totalSources = sourceSummary.filter((source) => source.listingCount > 0).length;
  const decisionOpportunity = marketPulse.topOpportunities[0] ?? null;
  const heroSearches = popularProducts.length > 0
    ? popularProducts.map((item) => item.productName).slice(0, 6)
    : fallbackPopularSearches.slice(0, 6);

  return (
    <>
      <section className="relative overflow-hidden border-b border-black/7 bg-white pb-8 pt-8 sm:pb-12 sm:pt-12">
        <div className="absolute -right-24 top-6 size-72 rounded-full bg-[#ff6b00]/8 blur-3xl" />
        <div className="absolute -left-24 bottom-0 size-72 rounded-full bg-black/4 blur-3xl" />

        <div className="container-shell relative">
          <div className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#ff6b00]/15 bg-[#fff7f1] px-3 py-2 text-xs font-black text-[#d95700]">
                <span className="size-2 rounded-full bg-[#ff6b00] shadow-[0_0_0_4px_rgba(255,107,0,0.12)]" />
                Güncel ikinci el piyasa verisi
              </div>
              <h1 className="mt-4 max-w-4xl text-[34px] font-black leading-[1.02] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
                İkinci el ürünlerin{" "}
                <span className="text-[#ff6b00]">gerçek piyasa fiyatını</span>{" "}
                karşılaştır.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-black/55 sm:text-lg">
                Aradığın ürünü yaz; 2ElBul ilanları, fiyat aralığını, fırsatları
                ve piyasa sinyallerini tek ekranda toplasın.
              </p>

              <div id="home-search" className="mt-7 w-full max-w-3xl scroll-mt-28">
                <SearchBar actionPath="/search" showLocation={false} />
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {heroSearches.map((query) => (
                  <Link
                    key={query}
                    href={`/search?q=${encodeURIComponent(query)}`}
                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-bold transition hover:border-[#ff6b00]/40 hover:bg-[#fff7f1] hover:text-[#d95700]"
                  >
                    {query}
                  </Link>
                ))}
              </div>
            </div>

            <HomepageDecisionCard
              opportunity={decisionOpportunity}
              totalListings={totalListings || last24HourListings.length}
              totalSources={totalSources || sourceSummary.length}
            />
          </div>

          <nav className="mt-5 flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible sm:pb-0">
            {quickAnchors.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-black transition hover:border-[#ff6b00]/35 hover:bg-[#fff7f1] hover:text-[#d95700]"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </section>

      {error && (
        <div className="container-shell pt-8">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center text-sm font-semibold text-amber-800">
            {error}
          </div>
        </div>
      )}

      <section id="firsatlar" className="border-b border-black/7 bg-white py-10 sm:py-12">
        <div className="container-shell">
          <SectionHeader
            eyebrow="Bugün öne çıkan"
            title="En iyi fırsatlar"
            icon={BadgePercent}
            href="/search?q=fırsat"
          />
          {priceOpportunities.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {priceOpportunities.slice(0, 6).map((listing) => (
                <OpportunityCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <EmptyState text="Fiyat karşılaştırması için henüz yeterli ilan bulunmuyor." />
          )}
        </div>
      </section>

      <section id="piyasa" className="border-b border-black/7 bg-[#fafaf8] py-10 sm:py-12">
        <div className="container-shell">
          <SectionHeader
            eyebrow="Canlı veri alanı"
            title="Piyasa Nabzı"
            icon={BarChart3}
            href="/market"
          />
          <div className="grid gap-5 xl:grid-cols-3">
            <MarketPulseGroup
              title="En çok arananlar"
              items={marketPulse.mostSearchedProducts}
              emptyText="Yeterli piyasa verisi oluşunca burada sinyaller görünecek."
            />
            <MarketPulseGroup
              title="En çok ilanı olanlar"
              items={marketPulse.mostListedProducts}
              emptyText="Yeterli ilan verisi oluşunca burada ürün yoğunluğu görünecek."
            />
            <MarketPulseGroup
              title="Fiyatı düşenler"
              items={marketPulse.fallingPriceProducts}
              emptyText="Düşüş trendi yakalanınca burada ürünler listelenecek."
            />
          </div>
        </div>
      </section>

      <section id="yeni-ilanlar" className="border-b border-black/7 bg-white py-10 sm:py-12">
        <div className="container-shell">
          <SectionHeader
            eyebrow="Yeni gelenler"
            title="Son eklenen ilanlar"
            icon={Clock3}
            href="/search"
          />
          {last24HourListings.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {last24HourListings.slice(0, 8).map((listing) => (
                <CompactListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <EmptyState text="Henüz Supabase'de gösterilecek ilan bulunmuyor." />
          )}
        </div>
      </section>

      <section id="kategoriler" className="border-b border-black/7 bg-white py-10 sm:py-12">
        <div className="container-shell">
          <SectionHeader
            eyebrow="Piyasa keşfi"
            title="Kategoriler"
            description="Piyasa verisini kategoriye göre keşfet."
            icon={FolderSearch2}
            compact
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {quickCategories.slice(0, 8).map(({ label, query, icon: Icon }) => (
              <Link
                key={label}
                href={`/search?q=${encodeURIComponent(query)}`}
                className="group rounded-3xl border border-black/8 bg-[#fafaf8] p-4 text-center transition hover:-translate-y-0.5 hover:border-[#ff6b00]/25 hover:bg-white hover:shadow-[0_16px_40px_rgba(0,0,0,0.05)]"
              >
                <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-white text-[#ff6b00] shadow-sm transition group-hover:bg-[#ff6b00] group-hover:text-white">
                  <Icon size={22} />
                </span>
                <span className="mt-3 block text-sm font-black leading-tight">
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="kaynaklar" className="border-b border-black/7 bg-[#fafaf8] py-10 sm:py-12">
        <div className="container-shell">
          <SectionHeader
            eyebrow="Güven ağı"
            title="Kaynaklara göre ilanlar"
            icon={Store}
            compact
          />
          <p className="mt-4 max-w-3xl text-sm leading-6 text-black/55">
            2ElBul, aynı ürünün ilanlarını, fiyat ortalamasını ve fırsat sinyalini
            birlikte gösterir. Kaynak çeşitliliği arttıkça karar desteği güçlenir.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-black/8 bg-white px-3 py-1.5 text-xs font-black text-black/55">
              Güncel veri
            </span>
            <span className="rounded-full border border-black/8 bg-white px-3 py-1.5 text-xs font-black text-black/55">
              Kaynak çeşitliliği
            </span>
            <span className="rounded-full border border-black/8 bg-white px-3 py-1.5 text-xs font-black text-black/55">
              Fırsat sinyali
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {sourceSummary.map((item) => (
              <div
                key={item.source}
                className="min-w-0 rounded-2xl border border-black/8 bg-white p-4 sm:p-5"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-[#fff1e7] text-[#ff6b00]">
                  <Store size={19} />
                </span>
                <h3 className="mt-4 break-words text-sm font-black">
                  {item.source}
                </h3>
                <p className="mt-2 text-2xl font-black tracking-[-0.035em] text-[#ff6b00]">
                  {item.listingCount}
                </p>
                <p className="text-xs text-black/40">yayındaki ilan</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <MobileBottomNav />
    </>
  );
}

function MobileBottomNav() {
  const items = [
    { label: "Ana", href: "/", icon: HomeIcon },
    { label: "Ara", href: "#home-search", icon: Search },
    { label: "Piyasa", href: "/market", icon: BarChart3 },
    { label: "Kategori", href: "#kategoriler", icon: FolderSearch2 },
    { label: "Giriş", href: "/giris", icon: Store },
  ];

  return (
    <nav className="fixed inset-x-3 bottom-3 z-50 rounded-3xl border border-black/10 bg-white/95 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur md:hidden">
      <div className="grid grid-cols-5 gap-1">
        {items.map(({ label, href, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            className="flex flex-col items-center justify-center rounded-2xl px-2 py-2 text-[10px] font-black text-black/55 transition hover:bg-[#fff1e7] hover:text-[#d95700]"
          >
            <Icon size={18} />
            <span className="mt-1">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

function HomepageDecisionCard({
  opportunity,
  totalListings,
  totalSources,
}: {
  opportunity: MarketPulseItem | null;
  totalListings: number;
  totalSources: number;
}) {
  if (!opportunity) {
    return (
      <section className="rounded-3xl border border-dashed border-black/12 bg-[#fafaf8] p-5 shadow-[0_14px_45px_rgba(0,0,0,0.05)] sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ff6b00]">
          AI Kararı
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-[-0.04em]">
          Yeterli veri oluşunca karar sinyali burada görünecek.
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-black/55">
          Kaynaklar ve ilanlar çoğaldıkça 2ElBul, piyasa ortalaması ve fırsat
          sinyallerini bu kartta özetleyecek.
        </p>
        <Link
          href="/market"
          className="orange-button mt-5 inline-flex w-full justify-center py-3 text-sm"
        >
          Piyasa Merkezine Git
          <ArrowUpRight size={16} />
        </Link>
      </section>
    );
  }

  const riskLabel = getHomepageDecisionRiskLabel(opportunity);

  return (
    <section className="rounded-3xl border border-[#ff6b00]/18 bg-[#fff7f1] p-5 shadow-[0_14px_45px_rgba(0,0,0,0.05)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#d95700]">
            AI Kararı
          </p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.04em]">
            {opportunity.productName}
          </h2>
          <p className="mt-2 text-sm leading-6 text-black/55">
            Bu öneri {opportunity.listingCount} ilan, {totalSources} kaynak ve{" "}
            {opportunity.searchCount} arama sinyali üzerinden hesaplandı.
          </p>
        </div>
        <span className="rounded-full border border-[#ff6b00]/20 bg-white px-3 py-1.5 text-xs font-black text-[#d95700]">
          Piyasa Kararı
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <DecisionMetric
          label="Piyasa ortalaması"
          value={formatOptionalPrice(opportunity.averagePrice)}
        />
        <DecisionMetric
          label="En düşük fiyat"
          value={formatOptionalPrice(opportunity.lowestPrice)}
        />
        <DecisionMetric
          label="Fırsat skoru"
          value={`${opportunity.opportunityScore}/100`}
          toneClassName="border-[#ff6b00]/20 bg-white text-[#d95700]"
        />
        <DecisionMetric
          label="Karar"
          value={opportunity.decisionLabel}
          toneClassName={getHomepageDecisionToneClassName(
            opportunity.decisionLabel,
          )}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-black/8 bg-white px-3 py-1.5 text-xs font-black text-black/55">
          Risk: {riskLabel}
        </span>
        <span className="rounded-full border border-black/8 bg-white px-3 py-1.5 text-xs font-black text-black/55">
          {totalListings} ilan
        </span>
        <span className="rounded-full border border-black/8 bg-white px-3 py-1.5 text-xs font-black text-black/55">
          {totalSources} kaynak
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-black/55">
        {opportunity.opportunityLabel}
      </p>

      <Link
        href="/market"
        className="orange-button mt-5 inline-flex w-full justify-center py-3 text-sm"
      >
        Piyasa Merkezine Git
        <ArrowUpRight size={16} />
      </Link>
    </section>
  );
}

function DecisionMetric({
  label,
  value,
  toneClassName = "border-black/8 bg-white text-black/65",
}: {
  label: string;
  value: string;
  toneClassName?: string;
}) {
  return (
    <div className={`min-w-0 rounded-2xl border p-4 ${toneClassName}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-black/35">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-black leading-6" title={value}>
        {value}
      </p>
    </div>
  );
}

function formatOptionalPrice(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? formatPrice(value)
    : "—";
}

function getHomepageDecisionRiskLabel(opportunity: MarketPulseItem) {
  if (opportunity.opportunityScore >= 85) return "Düşük";
  if (opportunity.opportunityScore >= 70) return "Orta";
  if (opportunity.decisionLabel === "Şimdi Al") return "Düşük";
  if (opportunity.decisionLabel === "Takip Et") return "Orta";
  if (opportunity.decisionLabel === "Bekle") return "Temkinli";
  return "Belirsiz";
}

function getHomepageDecisionToneClassName(label: string) {
  if (label === "Şimdi Al") return "border-green-200 bg-green-50 text-green-700";
  if (label === "Takip Et") return "border-sky-200 bg-sky-50 text-sky-700";
  if (label === "Bekle") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function SectionHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  href,
  compact = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  icon: typeof Clock3;
  href?: string;
  compact?: boolean;
}) {
  return (
    <div className={`${compact ? "mb-5" : "mb-7"} flex items-end justify-between gap-4`}>
      <div className="flex min-w-0 items-end gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#fff1e7] text-[#ff6b00]">
          <Icon size={21} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ff6b00]">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
            {title}
          </h2>
          {description && (
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-black/45">
              {description}
            </p>
          )}
        </div>
      </div>
      {href && (
        <Link
          href={href}
          className="hidden shrink-0 items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-black transition hover:border-[#ff6b00]/35 hover:bg-[#fff7f1] hover:text-[#d95700] sm:inline-flex"
        >
          Tümünü gör
          <ArrowUpRight size={15} />
        </Link>
      )}
    </div>
  );
}

function MarketPulseGroup({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: MarketPulseItem[];
  emptyText: string;
}) {
  const visibleItems = items.slice(0, 3);

  return (
    <section className="rounded-2xl border border-black/8 bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-black">{title}</h3>
        <span className="rounded-full bg-[#fff1e7] px-2.5 py-1 text-[11px] font-black text-[#d95700]">
          {visibleItems.length} sinyal
        </span>
      </div>
      {visibleItems.length > 0 ? (
        <div className="grid gap-3">
          {visibleItems.map((item) => (
            <Link
              key={`${title}-${item.productName}`}
              href={item.href}
              className="group rounded-2xl border border-black/7 bg-[#fafaf8] p-4 transition hover:border-[#ff6b00]/35 hover:bg-[#fff7f1]"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="break-words text-sm font-black group-hover:text-[#d95700]">
                    {item.productName}
                  </h4>
                  <p className="mt-1 text-xs font-semibold text-black/45">
                    {item.listingCount} ilan · {item.searchCount} arama
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-[#ff6b00]/20 bg-white px-2.5 py-1 text-[11px] font-black text-[#d95700]">
                  {item.opportunityLabel}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <PulseMetric
                  label="Ortalama"
                  value={item.averagePrice ? formatPrice(item.averagePrice) : "—"}
                />
                <PulseMetric
                  label="En düşük"
                  value={item.lowestPrice ? formatPrice(item.lowestPrice) : "—"}
                  accent
                />
                <PulseMetric
                  label="Trend"
                  value={formatPulseTrend(item)}
                />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState text={emptyText} />
      )}
    </section>
  );
}

function PulseMetric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-black/7 bg-white p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.06em] text-black/35">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-xs font-black ${
          accent ? "text-[#ff6b00]" : ""
        }`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function formatPulseTrend(item: MarketPulseItem) {
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

function CompactListingCard({
  listing,
  badge,
}: {
  listing: HomeListing;
  badge?: string;
}) {
  const productHref = `/product/${createProductSlug(listing.productName)}`;

  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-black/8 bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#ff6b00]/35 hover:shadow-[0_12px_35px_rgba(0,0,0,0.06)]">
      <Link href={productHref} className="block min-w-0">
        <ListingImage
          imageUrl={listing.imageUrl}
          productName={listing.productName}
          alt={listing.title}
        />
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-xs font-black text-[#d95700]">
            {listing.productName}
          </span>
          {badge && (
            <span className="shrink-0 rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-black text-sky-700">
              {badge}
            </span>
          )}
        </div>
        <h3 className="mt-3 line-clamp-2 min-h-10 text-sm font-black leading-5">
          {listing.title}
        </h3>
      </Link>
      <p className="mt-3 text-xl font-black tracking-[-0.035em] text-[#ff6b00]">
        {formatPrice(listing.price)}
      </p>
      <div className="mt-3 grid gap-1.5 text-xs text-black/45">
        <span className="flex items-center gap-1.5">
          <Store size={13} /> {listing.source}
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin size={13} /> {listing.city}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock3 size={13} /> {formatDate(listing.createdAt)}
        </span>
      </div>
      <a
        href={listing.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-black text-[#d95700] hover:underline"
      >
        İlana git <ArrowUpRight size={15} />
      </a>
    </article>
  );
}

function OpportunityCard({ listing }: { listing: PriceOpportunity }) {
  const hasDiscount = listing.discountRate > 0;

  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-green-200 bg-green-50/45 p-4">
      <Link
        href={`/product/${createProductSlug(listing.productName)}`}
        className="block min-w-0"
      >
        <ListingImage
          imageUrl={listing.imageUrl}
          productName={listing.productName}
          alt={listing.title}
        />
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-xs font-black text-green-800">
            {listing.productName}
          </span>
          <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-[10px] font-black text-green-700">
            {hasDiscount
              ? `Ortalamanın %${listing.discountRate} altında`
              : "Düşük fiyat"}
          </span>
        </div>
        <h3 className="mt-3 line-clamp-2 min-h-10 text-sm font-black leading-5">
          {listing.title}
        </h3>
      </Link>
      <p className="mt-3 text-xl font-black tracking-[-0.035em] text-green-700">
        {formatPrice(listing.price)}
      </p>
      {hasDiscount && (
        <p className="mt-1 text-xs text-black/45">
          Ürün ortalaması: {formatPrice(listing.averagePrice)}
        </p>
      )}
      <div className="mt-3 flex items-center gap-1.5 text-xs text-black/45">
        <Store size={13} /> {listing.source}
      </div>
      <a
        href={listing.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-black text-green-700 hover:underline"
      >
        İlana git <ArrowUpRight size={15} />
      </a>
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/15 bg-white px-6 py-10 text-center text-sm font-semibold text-black/45">
      {text}
    </div>
  );
}
