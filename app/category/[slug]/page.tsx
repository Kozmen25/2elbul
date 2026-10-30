import { buildPageMetadata } from "@/lib/seo/metadata";
import {
  buildLandingDescription,
  buildLandingTitle,
  isIndexableSnapshot,
  snapshotFromMarketIntelligence,
} from "@/lib/seo/landing-content";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  ChevronRight,
  Clock3,
  PackageSearch,
  Store,
  TrendingDown,
  TriangleAlert,
} from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CategoryShell } from "@/components/category-shell";
import { loadCategoryHub } from "@/lib/category-hub";
import type { CategoryListingRecord } from "@/lib/category-intelligence";
import {
  getCategoryPageData,
  resolveCanonicalSlug,
  isCategoryAlias,
} from "@/lib/category-intelligence";
import {
  TrustBadge,
  confidenceToTrustLevel,
} from "@/lib/trust-badge";
import {
  formatMarketIntelligenceSources,
  formatMarketIntelligenceTimestamp,
} from "@/app/product/[slug]/market-intelligence-panel";
import { formatCurrencyTRY, formatDateTR } from "@/lib/formatters";
import {
  formatOpportunityFreshness,
  formatOpportunityLevel,
} from "@/lib/opportunity-engine";
import type { MarketPulseItem } from "@/lib/market-pulse";
import { getCategoryForProductType } from "@/lib/taxonomy/product-type-mapping";
import { listingOutboundPath } from "@/lib/listing-links";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
};

// ISR: public data, no per-visitor content. Must stay a literal (static analysis);
// keep equal to CACHE_SECONDS.publicPage in lib/cache-policy.ts.
export const revalidate = 300;

// No pages are built ahead of time, but exporting this lets each page be cached
// (ISR) the first time it is requested.
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;

  // Resolve aliases for metadata so alias URLs still get correct SEO metadata
  const canonicalSlug = isCategoryAlias(slug) ? resolveCanonicalSlug(slug) : slug;
  const categoryData = await getCategoryPageData(canonicalSlug);

  if (!categoryData) {
    return {
      title: "Kategori bulunamadı | 2ElBul",
      description:
        "Aradığınız kategori 2ElBul analizlerinde bulunamadı. İkinci el piyasa verilerini inceleyebilirsiniz.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const snapshot = snapshotFromMarketIntelligence(categoryData.marketIntelligence);
  const now = new Date();
  return buildPageMetadata({
    title: buildLandingTitle("category", categoryData.categoryName, now),
    description: buildLandingDescription("category", categoryData.categoryName, snapshot),
    path: new URL(categoryData.categoryUrl).pathname,
    // Empty pages stay reachable for visitors but are kept out of the index.
    noIndex: !isIndexableSnapshot(snapshot),
    followLinks: true,
  });
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;

  // Redirect alias URLs (e.g., /category/cep-telefonu → /category/telefon)
  if (isCategoryAlias(slug)) {
    redirect(`/category/${resolveCanonicalSlug(slug)}`);
  }

  const [categoryData, hub] = await Promise.all([
    getCategoryPageData(slug),
    loadCategoryHub(slug),
  ]);

  if (!categoryData) notFound();

  const {
    shortDescription,
    longDescription,
    productCount,
    listingCount,
    marketIntelligence,
    opportunityAnalysis,
    topOpportunities,
    popularProducts,
    latestListings,
    gridListings,
    brandDistribution,
    marketPulse,
    faqItems,
    jsonLd,
    expectedProductType,
    categoryName,
    parent: parentBreadcrumb,
    subcategories,
  } = categoryData;
  const hasEnoughData = marketIntelligence.sampleSize >= 3;
  const sourceLabel = formatMarketIntelligenceSources(
    marketIntelligence.sourcesUsed,
  );
  const summaryHighlights = marketIntelligence.marketSummary.highlights.slice(0, 4);
  const summaryWarnings = marketIntelligence.marketSummary.warnings.slice(0, 3);
  const totalBrandListings = brandDistribution.reduce(
    (total, brand) => total + brand.listingCount,
    0,
  );

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
        <Breadcrumbs
          items={[
            { label: "Ana Sayfa", href: "/" },
            ...(parentBreadcrumb
              ? [{ label: parentBreadcrumb.label, href: `/category/${parentBreadcrumb.slug}` }]
              : []),
            { label: categoryName },
          ]}
        />

        <CategoryShell hub={hub}>
        <section className="rounded-sm border border-black/20 border-t-[3px] border-t-[#161616] bg-white p-4 sm:p-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)] xl:items-end">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#3B66E0]">
                Kategori analizi
              </p>
              <h1 className="mt-3 break-words text-3xl font-black tracking-[-0.05em] sm:text-4xl">
                {categoryName}
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-black/58 sm:text-base">
                {longDescription}
              </p>
              <p className="mt-3 text-sm font-semibold text-black/48">
                {productCount.toLocaleString("tr-TR")} ürün ·{" "}
                {listingCount.toLocaleString("tr-TR")} ilan
              </p>
              {subcategories.length > 0 ? (
                <nav aria-label="Alt kategoriler" className="mt-4 flex flex-wrap gap-2">
                  {subcategories.map((subcategory) => (
                    <Link
                      key={subcategory.slug}
                      href={`/category/${subcategory.slug}`}
                      className="rounded-sm border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black/60 transition hover:border-[#3B66E0]/35 hover:text-[#2A4FBF]"
                    >
                      {subcategory.label}{" "}
                      <span className="text-black/35">{subcategory.productCount.toLocaleString("tr-TR")}</span>
                    </Link>
                  ))}
                </nav>
              ) : null}
            </div>

            <div className="rounded-sm border border-[#3B66E0]/18 bg-[#EEF3FF] p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#2A4FBF]/75">
                Karar özeti
              </p>
              <div className="mt-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-2xl font-black tracking-[-0.04em] text-[#2A4FBF]">
                    {opportunityAnalysis.recommendation.label}
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-black/60">
                    {opportunityAnalysis.recommendation.description}
                  </p>
                </div>
                <span className="rounded-sm border border-white/70 bg-white px-3 py-2 text-right text-xs font-black text-black ">
                  <span className="block text-[10px] uppercase tracking-[0.08em] text-black/35">
                    Fırsat skoru
                  </span>
                  <span className="mt-1 block text-lg text-[#2A4FBF]">
                    {opportunityAnalysis.opportunityScore}/100
                  </span>
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {opportunityAnalysis.positiveSignals.slice(0, 3).map((signal) => (
                  <span
                    key={signal}
                    className="rounded-sm border border-green-100 bg-green-50 px-3 py-1.5 text-xs font-semibold leading-5 text-green-800"
                  >
                    {signal}
                  </span>
                ))}
                {opportunityAnalysis.warningSignals.slice(0, 2).map((signal) => (
                  <span
                    key={signal}
                    className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold leading-5 text-amber-800"
                  >
                    {signal}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
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
            <div className="min-w-0 rounded-sm border border-[#3B66E0]/20 bg-[#EEF3FF] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.08em] text-black/35">
                Güven
              </p>
              <div className="mt-2">
                <TrustBadge
                  level={confidenceToTrustLevel(
                    marketIntelligence.confidenceLevel,
                    marketIntelligence.sampleSize,
                  )}
                  size="md"
                />
              </div>
            </div>
            <StatCard
              label="Risk seviyesi"
              value={formatOpportunityLevel(opportunityAnalysis.riskLevel)}
            />
          </div>

          {expectedProductType ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-sm border border-[#3B66E0]/18 bg-[#EEF3FF] px-3 py-1.5 text-xs font-black uppercase tracking-[0.04em] text-[#2A4FBF]">
                {getCategoryForProductType(expectedProductType) ?? expectedProductType}
              </span>
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="rounded-sm border border-black/15 bg-[#fafaf8] p-4">
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
                    className="rounded-sm border border-black/15 bg-white px-3 py-1.5 text-xs font-semibold leading-5 text-black/55"
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
                      className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold leading-5 text-amber-800"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded-sm border border-black/15 bg-[#fafaf8] p-4">
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
                <div className="mt-4 flex gap-3 rounded-sm border border-dashed border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
                  <TriangleAlert className="mt-0.5 shrink-0" size={17} />
                  <span>Yetersiz veri: karar notu daha fazla ilan geldikçe otomatik olarak güçlenecek.</span>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <nav className="mt-5 flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {[
            { label: "Fırsatlar", href: "#firsatlar" },
            { label: "Popüler ürünler", href: "#populer-urunler" },
            { label: "Son ilanlar", href: "#son-ilanlar" },
            { label: "Tüm ilanlar", href: "#tum-ilanlar" },
            { label: "Fiyatı düşenler", href: "#fiyati-dusenler" },
            { label: "Marka dağılımı", href: "#marka-dagilimi" },
            { label: "SSS", href: "#sss" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-sm border border-black/10 bg-white px-4 py-2 text-sm font-black transition hover:border-[#3B66E0]/35 hover:bg-[#EEF3FF] hover:text-[#2A4FBF]"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <section id="firsatlar" className="mt-5 rounded-sm border border-black/20 border-t-[3px] border-t-[#161616] bg-white p-4 sm:p-6">
          <SectionTitle
            icon={BarChart3}
            eyebrow="Öne çıkan fırsatlar"
            title="En İyi Fırsatlar"
          />
          {topOpportunities.length > 0 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {topOpportunities.map((item) => (
                <OpportunityCard key={item.productName} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState text="Bu kategori için henüz yeterli fırsat sinyali oluşmadı." />
          )}
        </section>

        <section id="populer-urunler" className="mt-5 rounded-sm border border-black/20 border-t-[3px] border-t-[#161616] bg-white p-4 sm:p-6">
          <SectionTitle
            icon={PackageSearch}
            eyebrow="Popüler sinyaller"
            title="En Popüler Ürünler"
          />
          {popularProducts.length > 0 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {popularProducts.map((item) => (
                <PopularProductCard key={item.productName} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState text="Bu kategori için henüz popüler ürün sinyali oluşmadı." />
          )}
        </section>

        <section id="son-ilanlar" className="mt-5 rounded-sm border border-black/20 border-t-[3px] border-t-[#161616] bg-white p-4 sm:p-6">
          <SectionTitle
            icon={Clock3}
            eyebrow="Yeni veri"
            title="Son Eklenen İlanlar"
          />
          {latestListings.length > 0 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {latestListings.map((listing) => (
                <LatestListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <EmptyState text="Bu kategori için henüz yeni ilan bulunmuyor." />
          )}
        </section>

        <section id="tum-ilanlar" className="mt-5 rounded-sm border border-black/20 border-t-[3px] border-t-[#161616] bg-white p-4 sm:p-6">
          <SectionTitle
            icon={PackageSearch}
            eyebrow="Gezinme"
            title="Tüm İlanlar"
          />
          {gridListings.length > 0 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {gridListings.map((listing) => (
                <LatestListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <EmptyState text="Bu kategori için henüz listelenecek ilan bulunmuyor." />
          )}
        </section>

        <section id="fiyati-dusenler" className="mt-5 rounded-sm border border-black/20 border-t-[3px] border-t-[#161616] bg-white p-4 sm:p-6">
          <SectionTitle
            icon={TrendingDown}
            eyebrow="Piyasa trendi"
            title="Fiyatı Düşen Ürünler"
          />
          {marketPulse.fallingPriceProducts.length > 0 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {marketPulse.fallingPriceProducts.map((item) => (
                <PopularProductCard key={item.productName} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState text="Bu kategori için şu an fiyatı düşen ürün sinyali yok." />
          )}
        </section>

        <section id="marka-dagilimi" className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-sm border border-black/15 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
            <SectionTitle
              icon={Store}
              eyebrow="Marka dağılımı"
              title="Kategorideki Markalar"
            />
            {brandDistribution.length > 0 ? (
              <div className="mt-6 grid gap-3">
                {brandDistribution.map((brand) => (
                  <BrandCard
                    key={brand.brandSlug}
                    brand={brand}
                    totalListings={totalBrandListings}
                  />
                ))}
              </div>
            ) : (
              <EmptyState text="Bu kategori için henüz marka dağılımı oluşmadı." />
            )}
          </div>

          <div className="rounded-sm border border-black/15 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
            <SectionTitle
              icon={BadgeCheck}
              eyebrow="Güven notları"
              title="Güven Özeti"
            />
            <div className="mt-6 grid gap-3">
              <TrustBadge level={confidenceToTrustLevel(marketIntelligence.confidenceLevel, marketIntelligence.sampleSize)} size="md" />
              <StatCard
                label="Güven nedeni"
                value={marketIntelligence.confidenceReasons[0] ?? "Henüz yeterli veri yok"}
                accent
              />
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {marketIntelligence.confidenceReasons.slice(0, 4).map((reason) => (
                <span
                  key={reason}
                  className="rounded-sm border border-black/15 bg-[#fafaf8] px-3 py-1.5 text-xs font-semibold leading-5 text-black/55"
                >
                  {reason}
                </span>
              ))}
            </div>
            <div className="mt-6 rounded-sm border border-black/15 bg-[#fafaf8] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.08em] text-black/35">
                İç linkleme
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/market"
                  className="rounded-sm border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black/60 transition hover:border-[#3B66E0]/35 hover:text-[#2A4FBF]"
                >
                  Piyasa merkezi
                </Link>
                <Link
                  href={`/search?q=${encodeURIComponent(categoryName)}`}
                  className="rounded-sm border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black/60 transition hover:border-[#3B66E0]/35 hover:text-[#2A4FBF]"
                >
                  {categoryName} araması
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id="sss" className="mt-5 rounded-sm border border-black/20 border-t-[3px] border-t-[#161616] bg-white p-4 sm:p-6">
          <SectionTitle icon={TriangleAlert} eyebrow="Sık sorulanlar" title="SSS" />
          <div className="mt-6 grid gap-3">
            {faqItems.map((faq) => (
              <details
                key={faq.question}
                className="rounded-sm border border-black/15 bg-[#fafaf8] p-4"
              >
                <summary className="cursor-pointer list-none text-sm font-black leading-6 text-black">
                  {faq.question}
                </summary>
                <p className="mt-3 text-sm leading-7 text-black/60">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
        </CategoryShell>
      </div>
    </main>
  );
}

function OpportunityCard({ item }: { item: MarketPulseItem }) {
  return (
    <article className="min-w-0 rounded-sm border border-black/15 bg-[#fafaf8] p-5 transition hover:-translate-y-0.5 hover:border-[#3B66E0]/35 hover:bg-white hover:shadow-[0_14px_40px_rgba(0,0,0,0.06)]">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-lg font-black leading-6">
            {item.productName}
          </h2>
          <p className="mt-2 text-xs font-bold text-black/40">
            {item.listingCount} ilan · {item.searchCount} arama
          </p>
        </div>
        <span className="rounded-sm border border-green-200 bg-white px-3 py-1.5 text-[11px] font-black text-green-700">
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
    <article className="min-w-0 rounded-sm border border-black/15 bg-[#fafaf8] p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-lg font-black leading-6">
            {item.productName}
          </h2>
          <p className="mt-2 text-xs font-bold text-black/40">
            {item.listingCount} ilan · {item.searchCount} arama
          </p>
        </div>
        <span className="rounded-sm border border-[#3B66E0]/20 bg-white px-3 py-1.5 text-[11px] font-black text-[#2A4FBF]">
          {item.opportunityLabel}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <MiniMetric label="Ortalama fiyat" value={formatPrice(item.averagePrice)} />
        <MiniMetric label="En düşük fiyat" value={formatPrice(item.lowestPrice)} accent />
        <MiniMetric label="Güven" value={`%${item.buyScore}`} />
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

function LatestListingCard({ listing }: { listing: CategoryListingRecord }) {
  return (
    <article className="min-w-0 rounded-sm border border-black/15 bg-[#fafaf8] p-5">
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
            <TrustBadge level={confidenceToTrustLevel(listing.confidenceLevel)} />
          ) : null}
      </div>

      <p className="mt-4 text-2xl font-black tracking-[-0.04em] text-[#3B66E0]">
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
        href={listingOutboundPath(listing.id)}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="orange-button mt-5 w-full justify-center py-3"
      >
        İlana Git
        <ArrowUpRight size={17} />
      </a>
    </article>
  );
}

function BrandCard({
  brand,
  totalListings,
}: {
  brand: {
    brandSlug: string;
    brandName: string;
    productCount: number;
    listingCount: number;
    share: number;
  };
  totalListings: number;
}) {
  return (
    <div className="rounded-sm border border-black/15 bg-[#fafaf8] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/brand/${brand.brandSlug}`}
            className="break-words text-sm font-black transition hover:text-[#2A4FBF]"
          >
            {brand.brandName}
          </Link>
          <p className="mt-1 text-xs font-semibold text-black/45">
            {brand.productCount} ürün · {brand.listingCount} ilan
          </p>
        </div>
        <span className="rounded-sm border border-white bg-white px-3 py-1.5 text-[11px] font-black text-[#2A4FBF]">
          %{Math.round(brand.share * 100)}
        </span>
      </div>
      {totalListings > 0 ? (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-sm bg-black/5">
          <div
            className="h-full rounded-sm bg-[#3B66E0]"
            style={{ width: `${Math.max(4, Math.round(brand.share * 100))}%` }}
          />
        </div>
      ) : null}
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
    <div className="min-w-0 rounded-sm border border-black/15 bg-[#fafaf8] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-black/35">
        {label}
      </p>
      <p
        className={`mt-2 break-words text-base font-black leading-6 ${
          accent ? "text-[#2A4FBF]" : ""
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
    <div className="min-w-0 rounded-sm border border-black/15 bg-white p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.06em] text-black/35">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-sm font-black ${
          accent ? "text-[#3B66E0]" : ""
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
      <span className="grid size-11 shrink-0 place-items-center rounded-sm bg-[#E4ECFF] text-[#3B66E0]">
        <Icon size={21} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#3B66E0]">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-2xl font-black tracking-[-0.035em]">{title}</h2>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-sm border border-dashed border-black/15 bg-[#fafaf8] px-6 py-12 text-center text-sm font-semibold text-black/45">
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
