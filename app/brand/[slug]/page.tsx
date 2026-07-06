import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  ChevronRight,
  Clock3,
  PackageSearch,
  Store,
  TriangleAlert,
} from "lucide-react";
import type {
  BrandListingRecord,
} from "@/lib/brand-intelligence";
import { getBrandPageData } from "@/lib/brand-intelligence";
import {
  formatMarketConfidenceLevel,
  formatMarketIntelligenceSources,
  formatMarketIntelligenceTimestamp,
} from "@/app/product/[slug]/market-intelligence-panel";
import { formatCurrencyTRY, formatDateTR } from "@/lib/formatters";
import {
  formatOpportunityFreshness,
  formatOpportunityLevel,
} from "@/lib/opportunity-engine";
import type { MarketPulseItem } from "@/lib/market-pulse";

type BrandPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: BrandPageProps): Promise<Metadata> {
  const { slug } = await params;
  const brandData = await getBrandPageData(slug);

  if (!brandData) {
    return {
      title: "Marka bulunamadı | 2ElBul",
      description:
        "Aradığınız marka 2ElBul marka analizlerinde bulunamadı. İkinci el piyasa verilerini inceleyebilirsiniz.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title = `${brandData.brandName} ikinci el marka analizi | 2ElBul`;
  const description =
    brandData.marketIntelligence.sampleSize > 0
      ? `${brandData.brandName} için ${brandData.marketIntelligence.sampleSize} ilan, ${brandData.marketIntelligence.marketSummary.sourceCount} kaynak ve ${formatPrice(brandData.marketIntelligence.priceAnalysis.averagePrice)} ortalama fiyatla güncel marka analizi.`
      : `${brandData.brandName} için henüz yeterli ilan verisi oluşmadı. Marka analizi ve fırsat sinyalleri veri geldikçe güncellenecek.`;

  return {
    title,
    description,
    alternates: {
      canonical: brandData.brandUrl,
    },
    openGraph: {
      title,
      description,
      url: brandData.brandUrl,
      siteName: "2ElBul",
      locale: "tr_TR",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function BrandPage({ params }: BrandPageProps) {
  const { slug } = await params;
  const brandData = await getBrandPageData(slug);

  if (!brandData) notFound();

  const {
    brandName,
    productCount,
    listingCount,
    marketIntelligence,
    opportunityAnalysis,
    topOpportunities,
    popularProducts,
    latestListings,
    faqItems,
    jsonLd,
  } = brandData;
  const hasEnoughData = marketIntelligence.sampleSize >= 3;
  const sourceLabel = formatMarketIntelligenceSources(
    marketIntelligence.sourcesUsed,
  );
  const summaryHighlights = marketIntelligence.marketSummary.highlights.slice(0, 4);
  const summaryWarnings = marketIntelligence.marketSummary.warnings.slice(0, 3);

  return (
    <main className="min-w-0 bg-[#fafaf8] py-10 sm:py-14">
      {jsonLd.map((document, index) => (
        <script
          key={`${document["@type"]}-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(document).replace(/</g, "\\u003c"),
          }}
        />
      ))}

      <div className="container-shell min-w-0">
        <nav
          aria-label="breadcrumb"
          className="flex flex-wrap items-center gap-2 text-xs font-bold text-black/45"
        >
          <Link href="/" className="transition hover:text-[#d95700]">
            Ana Sayfa
          </Link>
          <ChevronRight size={12} />
          <span>{brandName}</span>
        </nav>

        <section className="mt-4 rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8 lg:p-10">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-end">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ff6b00]">
                Marka analizi
              </p>
              <h1 className="mt-3 break-words text-4xl font-black tracking-[-0.055em] sm:text-6xl">
                {brandName}
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-black/58 sm:text-base">
                {brandName} için ikinci el piyasa resmi, fırsat sinyalleri ve
                kaynak dağılımı tek ekranda.
              </p>
              <p className="mt-3 text-sm font-semibold text-black/48">
                {productCount.toLocaleString("tr-TR")} ürün ·{" "}
                {listingCount.toLocaleString("tr-TR")} ilan
              </p>
            </div>

            <div className="rounded-3xl border border-[#ff6b00]/18 bg-[#fff7f1] p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#d95700]/75">
                Karar özeti
              </p>
              <div className="mt-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-2xl font-black tracking-[-0.04em] text-[#d95700]">
                    {opportunityAnalysis.recommendation.label}
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-black/60">
                    {opportunityAnalysis.recommendation.description}
                  </p>
                </div>
                <span className="rounded-2xl border border-white/70 bg-white px-3 py-2 text-right text-xs font-black text-black shadow-sm">
                  <span className="block text-[10px] uppercase tracking-[0.08em] text-black/35">
                    Fırsat skoru
                  </span>
                  <span className="mt-1 block text-lg text-[#d95700]">
                    {opportunityAnalysis.opportunityScore}/100
                  </span>
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {opportunityAnalysis.positiveSignals.slice(0, 3).map((signal) => (
                  <span
                    key={signal}
                    className="rounded-full border border-green-100 bg-green-50 px-3 py-1.5 text-xs font-semibold leading-5 text-green-800"
                  >
                    {signal}
                  </span>
                ))}
                {opportunityAnalysis.warningSignals.slice(0, 2).map((signal) => (
                  <span
                    key={signal}
                    className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold leading-5 text-amber-800"
                  >
                    {signal}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <StatCard
              label="Analiz edilen ilan"
              value={marketIntelligence.sampleSize.toLocaleString("tr-TR")}
            />
            <StatCard
              label="Ortalama fiyat"
              value={formatPrice(marketIntelligence.priceAnalysis.averagePrice)}
            />
            <StatCard
              label="En düşük fiyat"
              value={formatPrice(marketIntelligence.priceAnalysis.minPrice)}
              accent
            />
            <StatCard
              label="Kaynak sayısı"
              value={marketIntelligence.marketSummary.sourceCount.toLocaleString("tr-TR")}
            />
            <StatCard
              label="Confidence"
              value={formatMarketConfidenceLevel(marketIntelligence.confidenceLevel)}
            />
            <StatCard
              label="Risk seviyesi"
              value={formatOpportunityLevel(opportunityAnalysis.riskLevel)}
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="rounded-2xl border border-black/8 bg-[#fafaf8] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.08em] text-black/35">
                Market Intelligence özeti
              </p>
              <p className="mt-3 text-sm font-semibold leading-6 text-black/60">
                {marketIntelligence.marketSummary.summary}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {summaryHighlights.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-black/8 bg-white px-3 py-1.5 text-xs font-semibold leading-5 text-black/55"
                  >
                    {item}
                  </span>
                ))}
              </div>
              {summaryWarnings.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {summaryWarnings.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold leading-5 text-amber-800"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-black/8 bg-[#fafaf8] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.08em] text-black/35">
                Analiz zamanı
              </p>
              <p className="mt-3 text-sm font-semibold leading-6 text-black/60">
                Son güncelleme:{" "}
                {formatMarketIntelligenceTimestamp(
                  marketIntelligence.analysisGeneratedAt,
                )}
              </p>
              <p className="mt-3 text-sm font-semibold leading-6 text-black/60">
                Kullanılan kaynaklar: {sourceLabel}
              </p>
              <p className="mt-3 text-xs font-semibold leading-6 text-black/45">
                Bu karar, {marketIntelligence.sampleSize.toLocaleString("tr-TR")} ilan
                üzerinden üretildi ve {formatOpportunityFreshness(opportunityAnalysis.dataFreshness)} sinyaliyle güncellendi.
              </p>
              {!hasEnoughData ? (
                <div className="mt-4 flex gap-3 rounded-2xl border border-dashed border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
                  <TriangleAlert className="mt-0.5 shrink-0" size={17} />
                  <span>Yetersiz veri: karar notu daha fazla ilan geldikçe otomatik olarak güçlenecek.</span>
                </div>
              ) : (
                <div className="mt-4 flex gap-3 rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-semibold leading-6 text-green-900">
                  <BadgeCheck className="mt-0.5 shrink-0 text-green-700" size={17} />
                  <span>Bu marka sayfası yeterli veriyle oluşturuldu.</span>
                </div>
              )}
            </div>
          </div>
        </section>

        <nav className="mt-5 flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {[
            { label: "Fırsatlar", href: "#firsatlar" },
            { label: "Popüler ürünler", href: "#populer-urunler" },
            { label: "Son ilanlar", href: "#son-ilanlar" },
            { label: "SSS", href: "#sss" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-black transition hover:border-[#ff6b00]/35 hover:bg-[#fff7f1] hover:text-[#d95700]"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <section id="firsatlar" className="mt-6 rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
          <SectionTitle
            icon={BarChart3}
            eyebrow="Öne çıkan fırsatlar"
            title="En İyi Fırsatlar"
          />
          {topOpportunities.length > 0 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {topOpportunities.map((item) => (
                <OpportunityCard key={item.productName} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState text="Bu marka için henüz yeterli fırsat sinyali oluşmadı." />
          )}
        </section>

        <section id="populer-urunler" className="mt-6 rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
          <SectionTitle
            icon={PackageSearch}
            eyebrow="Popüler sinyaller"
            title="En Popüler Ürünler"
          />
          {popularProducts.length > 0 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {popularProducts.map((item) => (
                <PopularProductCard key={item.productName} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState text="Bu marka için henüz popüler ürün sinyali oluşmadı." />
          )}
        </section>

        <section id="son-ilanlar" className="mt-6 rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
          <SectionTitle
            icon={Clock3}
            eyebrow="Yeni veri"
            title="Son Eklenen İlanlar"
          />
          {latestListings.length > 0 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {latestListings.map((listing) => (
                <LatestListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <EmptyState text="Bu marka için henüz yeni ilan bulunmuyor." />
          )}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
            <SectionTitle
              icon={Store}
              eyebrow="Kaynak dağılımı"
              title="Market Intelligence Kaynakları"
            />
            <div className="mt-6 grid gap-3">
              {marketIntelligence.marketSummary.sourceBreakdown.length > 0 ? (
                marketIntelligence.marketSummary.sourceBreakdown.map((source) => (
                  <SourceCard key={source.source} source={source} />
                ))
              ) : (
                <EmptyState text="Kaynak dağılımı için henüz veri yok." />
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
            <SectionTitle
              icon={BadgeCheck}
              eyebrow="Güven notları"
              title="Confidence Özeti"
            />
            <div className="mt-6 grid gap-3">
              <StatCard
                label="Confidence düzeyi"
                value={formatMarketConfidenceLevel(marketIntelligence.confidenceLevel)}
              />
              <StatCard
                label="Confidence nedeni"
                value={marketIntelligence.confidenceReasons[0] ?? "Henüz yeterli veri yok"}
                accent
              />
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {marketIntelligence.confidenceReasons.slice(0, 4).map((reason) => (
                <span
                  key={reason}
                  className="rounded-full border border-black/8 bg-[#fafaf8] px-3 py-1.5 text-xs font-semibold leading-5 text-black/55"
                >
                  {reason}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section id="sss" className="mt-6 rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
          <SectionTitle icon={TriangleAlert} eyebrow="Sık sorulanlar" title="SSS" />
          <div className="mt-6 grid gap-3">
            {faqItems.map((faq) => (
              <details
                key={faq.question}
                className="rounded-2xl border border-black/8 bg-[#fafaf8] p-4"
              >
                <summary className="cursor-pointer list-none text-sm font-black leading-6 text-black">
                  {faq.question}
                </summary>
                <p className="mt-3 text-sm leading-7 text-black/60">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function OpportunityCard({ item }: { item: MarketPulseItem }) {
  return (
    <article className="min-w-0 rounded-2xl border border-black/8 bg-[#fafaf8] p-5 transition hover:-translate-y-0.5 hover:border-[#ff6b00]/35 hover:bg-white hover:shadow-[0_14px_40px_rgba(0,0,0,0.06)]">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-lg font-black leading-6">
            {item.productName}
          </h2>
          <p className="mt-2 text-xs font-bold text-black/40">
            {item.listingCount} ilan · {item.searchCount} arama
          </p>
        </div>
        <span className="rounded-full border border-green-200 bg-white px-3 py-1.5 text-[11px] font-black text-green-700">
          {item.decisionLabel}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <MiniMetric label="Fırsat skoru" value={`${item.opportunityScore}/100`} accent />
        <MiniMetric
          label="Piyasa avantajı"
          value={item.lowestPrice && item.averagePrice
            ? `${Math.max(0, Math.round(((item.averagePrice - item.lowestPrice) / item.averagePrice) * 100))}%`
            : "—"}
        />
        <MiniMetric
          label="Ortalama fiyat"
          value={formatPrice(item.averagePrice)}
        />
        <MiniMetric label="En düşük fiyat" value={formatPrice(item.lowestPrice)} />
      </div>

      <Link href={item.href} className="orange-button mt-5 w-full justify-center py-3">
        Ürün detayına git
        <ArrowUpRight size={17} />
      </Link>
    </article>
  );
}

function PopularProductCard({ item }: { item: MarketPulseItem }) {
  return (
    <article className="min-w-0 rounded-2xl border border-black/8 bg-[#fafaf8] p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-lg font-black leading-6">
            {item.productName}
          </h2>
          <p className="mt-2 text-xs font-bold text-black/40">
            {item.listingCount} ilan · {item.searchCount} arama
          </p>
        </div>
        <span className="rounded-full border border-[#ff6b00]/20 bg-white px-3 py-1.5 text-[11px] font-black text-[#d95700]">
          {item.opportunityLabel}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <MiniMetric label="Ortalama fiyat" value={formatPrice(item.averagePrice)} />
        <MiniMetric label="En düşük fiyat" value={formatPrice(item.lowestPrice)} accent />
        <MiniMetric label="Confidence" value={`%${item.buyScore}`} />
        <MiniMetric
          label="Trend"
          value={formatTrend(item.trendDirection, item.trendChangePercent)}
        />
      </div>

      <Link href={item.href} className="orange-button mt-5 w-full justify-center py-3">
        Ürün detayına git
        <ArrowUpRight size={17} />
      </Link>
    </article>
  );
}

function LatestListingCard({ listing }: { listing: BrandListingRecord }) {
  return (
    <article className="min-w-0 rounded-2xl border border-black/8 bg-[#fafaf8] p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.08em] text-black/35">
            {listing.productName}
          </p>
          <h2 className="mt-2 break-words text-lg font-black leading-6">
            {listing.title}
          </h2>
        </div>
        {listing.confidenceLevel ? (
          <span className="rounded-full border border-black/8 bg-white px-3 py-1.5 text-[11px] font-black text-black/55">
            {formatMarketConfidenceLevel(listing.confidenceLevel)}
          </span>
        ) : null}
      </div>

      <p className="mt-4 text-2xl font-black tracking-[-0.05em] text-[#ff6b00]">
        {formatPrice(listing.price)}
      </p>

      <div className="mt-4 grid gap-2 border-t border-black/7 pt-4 text-xs font-semibold text-black/50">
        <span className="inline-flex items-center gap-2">
          <Store size={14} /> {listing.source}
        </span>
        <span className="inline-flex items-center gap-2">
          <Clock3 size={14} /> {formatListingDate(listing.createdAt)}
        </span>
        <span className="inline-flex items-center gap-2">
          <ChevronRight size={14} /> {listing.city}
        </span>
      </div>

      <a
        href={listing.url}
        target="_blank"
        rel="noopener noreferrer"
        className="orange-button mt-5 w-full justify-center py-3"
      >
        İlana Git
        <ArrowUpRight size={17} />
      </a>
    </article>
  );
}

function SourceCard({
  source,
}: {
  source: {
    source: string;
    listingCount: number;
    share: number;
    averagePrice: number | null;
    lowestPrice: number | null;
    highestPrice: number | null;
  };
}) {
  return (
    <div className="rounded-2xl border border-black/8 bg-[#fafaf8] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-black">{source.source}</p>
          <p className="mt-1 text-xs font-semibold text-black/45">
            {source.listingCount} ilan · %{Math.round(source.share * 100)} pay
          </p>
        </div>
        <span className="rounded-full border border-white bg-white px-3 py-1.5 text-[11px] font-black text-[#d95700]">
          {formatPrice(source.averagePrice)}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-black/45">
        <span>En düşük: {formatPrice(source.lowestPrice)}</span>
        <span>En yüksek: {formatPrice(source.highestPrice)}</span>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-black/8 bg-[#fafaf8] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-black/35">
        {label}
      </p>
      <p
        className={`mt-2 break-words text-base font-black leading-6 ${
          accent ? "text-[#d95700]" : ""
        }`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function MiniMetric({
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
        className={`mt-1 truncate text-sm font-black ${
          accent ? "text-[#ff6b00]" : ""
        }`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  eyebrow,
  title,
}: {
  icon: typeof BarChart3;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#fff1e7] text-[#ff6b00]">
        <Icon size={21} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#ff6b00]">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-2xl font-black tracking-[-0.035em]">{title}</h2>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/15 bg-[#fafaf8] px-6 py-12 text-center text-sm font-semibold text-black/45">
      {text}
    </div>
  );
}

function formatTrend(
  direction: "rising" | "falling" | "stable" | "unknown",
  changePercent: number | null,
) {
  if (direction === "unknown") return "—";
  const label =
    direction === "falling"
      ? "Düşüyor"
      : direction === "rising"
        ? "Yükseliyor"
        : "Stabil";
  return changePercent === null ? label : `${label} %${Math.abs(changePercent)}`;
}

function formatListingDate(value: string) {
  return formatDateTR(value, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPrice(value: number | null | undefined) {
  return formatCurrencyTRY(value);
}
