import { DEFAULT_OG_IMAGES, DEFAULT_TWITTER_IMAGES } from "@/lib/seo/metadata";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowUpRight,
  BadgePercent,
  BarChart3,
  Clock3,
  FolderSearch2,
  MapPin,
  Search,
  Sparkles,
  Store,
  TrendingDown,
} from "lucide-react";
import { ListingImage } from "@/components/listing-image";
import { SearchBar } from "@/components/search-bar";
import { formatCurrencyTRY, formatDateTR } from "@/lib/formatters";
import { createProductSlug } from "@/lib/product-slug";
import { getAbsoluteUrl } from "@/lib/site-url";
import {
  getHomeData,
  type HomeListing,
  type MarketPulseItem,
  type PriceOpportunity,
} from "@/lib/home-data";
import { getCategoryCatalog } from "@/lib/category-intelligence";
import { resolveCategoryIcon } from "@/lib/categories";
import { listingOutboundPath } from "@/lib/listing-links";

// ISR: public data, no per-visitor content. Must stay a literal (static analysis);
// keep equal to CACHE_SECONDS.publicPage in lib/cache-policy.ts.
export const revalidate = 300;

const homeUrl = getAbsoluteUrl("/");

export const metadata: Metadata = {
  title: "İkinci el ürünlerin gerçek piyasa fiyatını karşılaştır | 2ElBul",
  description:
    "Telefon, bilgisayar, konsol ve daha fazlası için ikinci el ilanları tek yerde karşılaştır; ortalama fiyatı, en ucuz ilanı ve fiyat geçmişini gör.",
  alternates: {
    canonical: homeUrl,
  },
  openGraph: {
    title: "İkinci el ürünlerin gerçek piyasa fiyatını karşılaştır | 2ElBul",
    description:
      "2ElBul ile ikinci el ilanlarını karşılaştır, ortalama fiyatı, en ucuz ilanı, fiyat geçmişini ve güven skorunu gör.",
    url: homeUrl,
    siteName: "2ElBul",
    locale: "tr_TR",
    type: "website",
    images: DEFAULT_OG_IMAGES,
  },
  twitter: {
    card: "summary_large_image",
    title: "İkinci el ürünlerin gerçek piyasa fiyatını karşılaştır | 2ElBul",
    description:
      "İkinci el piyasasını tek yerde karşılaştır; fiyat analizini, en ucuz ilanları ve fiyat geçmişini gör.",
    images: DEFAULT_TWITTER_IMAGES,
  },
};

type QuickCategory = {
  label: string;
  query: string;
  slug?: string;
  icon: React.ComponentType<{ size?: number }>;
  count?: number;
};

const EXTRA_QUICK_ENTRIES: QuickCategory[] = [
  { label: "Fiyatı düşenler", query: "fiyatı düşen", icon: TrendingDown },
  { label: "Fırsatlar", query: "fırsat", icon: BadgePercent },
  { label: "Yakınımdaki", query: "yakınımdaki", icon: MapPin },
  { label: "Tüm ilanlar", query: "", icon: Search },
];

async function buildQuickCategories(): Promise<QuickCategory[]> {
  // Same catalog (tree + counts) as the header menu and /category pages.
  const catalog = await getCategoryCatalog();

  return [
    ...catalog
      .filter((entry) => entry.parentSlug === null)
      .map((entry) => ({
        label: entry.label,
        query: entry.label,
        slug: entry.slug,
        icon: resolveCategoryIcon(entry.icon),
        count: entry.productCount,
      })),
    ...EXTRA_QUICK_ENTRIES,
  ];
}

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

const formatPrice = (price: number) => formatCurrencyTRY(price);

const formatDate = (date: string) =>
  formatDateTR(date, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function Home() {
  const {
    priceOpportunities,
    last24HourListings,
    sourceSummary,
    popularProducts,
    marketPulse,
    error,
  } = await getHomeData();
  const quickCategories = await buildQuickCategories();

  const totalListings = sourceSummary.reduce(
    (total, source) => total + source.listingCount,
    0,
  );
  const totalSources = sourceSummary.filter((source) => source.listingCount > 0).length;
  const decisionOpportunity = marketPulse.topOpportunities[0] ?? null;
  const heroSearches = popularProducts.length > 0
    ? popularProducts.map((item) => item.productName).slice(0, 6)
    : fallbackPopularSearches.slice(0, 6);
  const finalTotalListings = totalListings || last24HourListings.length;
  const finalTotalSources = totalSources || sourceSummary.length;

  return (
    <>
      <section className="relative overflow-hidden border-b border-black/7 bg-white pb-14 pt-14 sm:pb-20 sm:pt-16 lg:pb-24 lg:pt-20">
        {/* ambient background */}
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "radial-gradient(rgba(0,0,0,0.7) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
          <div className="absolute -right-6 -top-24 size-[220px] rounded-full bg-[#3B66E0]/15 blur-[90px]" />
          <div className="absolute -left-32 bottom-[-30%] size-[380px] rounded-full bg-[#3B66E0]/8 blur-[110px]" />
          <HeroDecor />
        </div>

        <div className="container-shell relative flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#EEF3FF] px-4 py-2 text-xs font-black text-[#2A4FBF]">
            <span className="size-2 rounded-full bg-[#3B66E0] shadow-[0_0_0_4px_rgba(59,102,224,0.16)]" />
            Güncel ikinci el piyasa verisi
          </div>

          <h1 className="mt-6 max-w-4xl text-[36px] font-black leading-[1.04] tracking-[-0.045em] text-black sm:text-6xl lg:text-[68px]">
            İkinci el ürünlerin{" "}
            <span className="text-[#3B66E0]">gerçek piyasa fiyatını</span>{" "}
            karşılaştır
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-black/55 sm:text-lg">
            Aradığın ürünü yaz; 2ElBul ilanları, fiyat aralığını, fırsatları ve
            piyasa sinyallerini tek ekranda toplasın.
          </p>

          <div
            id="home-search"
            className="mt-9 w-full max-w-3xl scroll-mt-28 sm:max-w-4xl"
          >
            <div className="rounded-[28px] border border-black/8 bg-white p-2 shadow-[0_30px_90px_rgba(0,0,0,0.12)] sm:p-3">
              <SearchBar actionPath="/search" showLocation={false} />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {quickCategories.slice(0, 6).map(({ label, query, slug, icon: Icon }) => (
              <Link
                key={label}
                href={slug ? `/category/${slug}` : `/search?q=${encodeURIComponent(query)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-[#fafaf8] px-4 py-2 text-sm font-bold text-black/70 transition hover:border-[#3B66E0]/40 hover:bg-[#EEF3FF] hover:text-[#2A4FBF]"
              >
                <Icon size={15} />
                {label}
              </Link>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2">
            {heroSearches.map((query) => (
              <Link
                key={query}
                href={`/search?q=${encodeURIComponent(query)}`}
                className="text-sm font-semibold text-black/40 underline decoration-black/15 underline-offset-4 transition hover:text-[#2A4FBF] hover:decoration-[#3B66E0]/60"
              >
                {query}
              </Link>
            ))}
          </div>

          <div className="mt-11 grid w-full max-w-2xl grid-cols-3 gap-4 border-t border-black/8 pt-8">
            <HeroStat value={finalTotalListings} label="Yayındaki ilan" />
            <HeroStat value={finalTotalSources} label="Aktif kaynak" />
            <HeroStat value={priceOpportunities.length} label="Güncel fırsat" />
          </div>
        </div>
      </section>

      <section className="border-b border-black/7 bg-white py-5">
        <div className="container-shell flex flex-col gap-4">
          <nav className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
            {quickAnchors.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-black transition hover:border-[#3B66E0]/35 hover:bg-[#EEF3FF] hover:text-[#2A4FBF]"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <HomepageDecisionCard
            opportunity={decisionOpportunity}
            totalListings={finalTotalListings}
            totalSources={finalTotalSources}
          />
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
            href="/categories"
            compact
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {quickCategories.slice(0, 9).map(({ label, query, slug, icon: Icon, count }) => (
              <Link
                key={label}
                href={slug ? `/category/${slug}` : `/search?q=${encodeURIComponent(query)}`}
                className="group rounded-3xl border border-black/8 bg-[#fafaf8] p-4 text-center transition hover:-translate-y-0.5 hover:border-[#3B66E0]/25 hover:bg-white hover:shadow-[0_16px_40px_rgba(0,0,0,0.05)]"
              >
                <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-white text-[#3B66E0] shadow-sm transition group-hover:bg-[#3B66E0] group-hover:text-white">
                  <Icon size={22} />
                </span>
                <span className="mt-3 block text-sm font-black leading-tight">
                  {label}
                </span>
                {typeof count === "number" && count > 0 && (
                  <span className="mt-1 block text-xs font-bold text-black/35">
                    {count} ilan
                  </span>
                )}
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
                <span className="grid size-10 place-items-center rounded-xl bg-[#E4ECFF] text-[#3B66E0]">
                  <Store size={19} />
                </span>
                <h3 className="mt-4 break-words text-sm font-black">
                  {item.source}
                </h3>
                <p className="mt-2 text-2xl font-black tracking-[-0.035em] text-[#3B66E0]">
                  {item.listingCount}
                </p>
                <p className="text-xs text-black/40">yayındaki ilan</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </>
  );
}

function HeroDecor() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {/* thin rings */}
      <svg
        className="absolute -left-10 top-10 size-40 text-black/[0.06] sm:size-52"
        viewBox="0 0 100 100"
        fill="none"
      >
        <circle cx="50" cy="50" r="49" stroke="currentColor" strokeWidth="0.6" />
      </svg>
      <svg
        className="absolute right-6 top-1/3 size-24 text-[#3B66E0]/20 sm:right-16 sm:size-32"
        viewBox="0 0 100 100"
        fill="none"
      >
        <circle cx="50" cy="50" r="49" stroke="currentColor" strokeWidth="0.8" />
      </svg>
      <svg
        className="absolute bottom-8 left-1/4 hidden size-16 text-black/[0.06] lg:block"
        viewBox="0 0 100 100"
        fill="none"
      >
        <circle cx="50" cy="50" r="49" stroke="currentColor" strokeWidth="0.6" />
      </svg>

      {/* sparkle stars */}
      <HeroSpark className="left-[12%] top-[22%] size-3 text-black/15" />
      <HeroSpark className="left-[8%] top-[62%] size-2.5 text-[#3B66E0]/35" />
      <HeroSpark className="right-[10%] top-[18%] size-4 text-black/10" />
      <HeroSpark className="right-[22%] top-[68%] size-2.5 text-black/10" />
      <HeroSpark className="left-[42%] top-[10%] size-2 text-black/10 hidden sm:block" />
      <HeroSpark className="right-[38%] bottom-[14%] size-3 text-[#3B66E0]/20 hidden sm:block" />

      {/* faint diagonal lines */}
      <svg
        className="absolute -right-20 bottom-0 h-64 w-64 text-black/[0.05]"
        viewBox="0 0 200 200"
        fill="none"
      >
        <line x1="0" y1="200" x2="200" y2="0" stroke="currentColor" strokeWidth="1" />
        <line x1="30" y1="200" x2="200" y2="30" stroke="currentColor" strokeWidth="1" />
        <line x1="60" y1="200" x2="200" y2="60" stroke="currentColor" strokeWidth="1" />
      </svg>
    </div>
  );
}

function HeroSpark({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`absolute ${className}`}
    >
      <path d="M12 0l2.59 9.41L24 12l-9.41 2.59L12 24l-2.59-9.41L0 12l9.41-2.59L12 0Z" />
    </svg>
  );
}

function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0">
      <p className="text-2xl font-black tracking-[-0.04em] text-black sm:text-3xl">
        {value.toLocaleString("tr-TR")}
      </p>
      <p className="mt-1 truncate text-xs font-bold uppercase tracking-[0.08em] text-black/40">
        {label}
      </p>
    </div>
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
      <section className="flex flex-col gap-3 rounded-2xl border border-dashed border-black/12 bg-[#fafaf8] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-[#3B66E0] shadow-sm">
            <Sparkles size={19} />
          </span>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#3B66E0]">
              AI Piyasa Kararı
            </p>
            <p className="text-sm font-bold text-black/60">
              Yeterli veri oluşunca karar sinyali burada görünecek.
            </p>
          </div>
        </div>
        <Link
          href="/market"
          className="orange-button shrink-0 justify-center px-5 py-2.5 text-sm"
        >
          Piyasa Merkezine Git
          <ArrowUpRight size={16} />
        </Link>
      </section>
    );
  }

  const riskLabel = getHomepageDecisionRiskLabel(opportunity);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-[#3B66E0]/18 bg-[#EEF3FF] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-[#3B66E0] shadow-sm">
          <Sparkles size={19} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#2A4FBF]">
            AI Piyasa Kararı
          </p>
          <p className="truncate text-sm font-black">
            {opportunity.productName}{" "}
            <span
              className={`ml-1 rounded-full border px-2 py-0.5 text-[11px] font-black ${getHomepageDecisionToneClassName(
                opportunity.decisionLabel,
              )}`}
            >
              {opportunity.decisionLabel}
            </span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <DecisionChip
          label="Ortalama"
          value={formatOptionalPrice(opportunity.averagePrice)}
        />
        <DecisionChip
          label="En düşük"
          value={formatOptionalPrice(opportunity.lowestPrice)}
        />
        <DecisionChip label="Fırsat skoru" value={`${opportunity.opportunityScore}/100`} />
        <DecisionChip label="Risk" value={riskLabel} />
        <span className="hidden text-xs font-semibold text-black/40 lg:inline">
          {totalListings} ilan · {totalSources} kaynak
        </span>
        <Link
          href="/market"
          className="orange-button shrink-0 justify-center px-5 py-2.5 text-sm"
        >
          Piyasa Merkezine Git
          <ArrowUpRight size={16} />
        </Link>
      </div>
    </section>
  );
}

function DecisionChip({ label, value }: { label: string; value: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-black/8 bg-white px-3 py-1.5 text-xs font-black text-black/65"
      title={label}
    >
      <span className="text-black/35">{label}</span>
      {value}
    </span>
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
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#E4ECFF] text-[#3B66E0]">
          <Icon size={21} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#3B66E0]">
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
          className="hidden shrink-0 items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-black transition hover:border-[#3B66E0]/35 hover:bg-[#EEF3FF] hover:text-[#2A4FBF] sm:inline-flex"
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
        <span className="rounded-full bg-[#E4ECFF] px-2.5 py-1 text-[11px] font-black text-[#2A4FBF]">
          {visibleItems.length} sinyal
        </span>
      </div>
      {visibleItems.length > 0 ? (
        <div className="grid gap-3">
          {visibleItems.map((item) => (
            <Link
              key={`${title}-${item.productName}`}
              href={item.href}
              className="group rounded-2xl border border-black/7 bg-[#fafaf8] p-4 transition hover:border-[#3B66E0]/35 hover:bg-[#EEF3FF]"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="break-words text-sm font-black group-hover:text-[#2A4FBF]">
                    {item.productName}
                  </h4>
                  <p className="mt-1 text-xs font-semibold text-black/45">
                    {item.listingCount} ilan · {item.searchCount} arama
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-[#3B66E0]/20 bg-white px-2.5 py-1 text-[11px] font-black text-[#2A4FBF]">
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
          accent ? "text-[#3B66E0]" : ""
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
    <article className="flex min-w-0 flex-col rounded-2xl border border-black/8 bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#3B66E0]/35 hover:shadow-[0_12px_35px_rgba(0,0,0,0.06)]">
      <Link href={productHref} className="block min-w-0">
        <ListingImage
          imageUrl={listing.imageUrl}
          productName={listing.productName}
          alt={listing.title}
          source={listing.source}
        />
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-xs font-black text-[#2A4FBF]">
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
      <p className="mt-3 text-xl font-black tracking-[-0.035em] text-[#3B66E0]">
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
        href={listingOutboundPath(listing.id)}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-black text-[#2A4FBF] hover:underline"
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
          source={listing.source}
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
        href={listingOutboundPath(listing.id)}
        target="_blank"
        rel="noopener noreferrer nofollow"
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
