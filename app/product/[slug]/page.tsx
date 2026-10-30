import { buildPageMetadata } from "@/lib/seo/metadata";
import {
  buildLandingDescription,
  buildLandingTitle,
  isIndexableSnapshot,
  snapshotFromListings,
} from "@/lib/seo/landing-content";
import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  Clock3,
  MapPin,
  Store,
  Tag,
  TriangleAlert,
} from "lucide-react";
import { notFound } from "next/navigation";
import { FavoriteButton } from "@/components/favorite-button";
import { FollowProductButton } from "@/components/follow-product-button";
import { ListingImage } from "@/components/listing-image";
import { CompareButton } from "@/components/compare-button";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { SafeShoppingBanner } from "@/components/safe-shopping-banner";
import { PriceAlertForm } from "@/components/price-alert-form";
import type { ProductIntelligence } from "@/lib/intelligence-engine";
import type { Listing } from "@/lib/listings";
import { buildDailyPriceHistory, calculateMarketStats, calculateOpportunityRating } from "@/lib/price-insights";
import { createProductSlug } from "@/lib/product-slug";
import {
  analyzeListingPrice,
  buildProductPriceStats,
  type ProductPriceStats,
} from "@/lib/price-analysis";
import {
  getProductDetail,
  type ProductBestDeal,
  type ProductDecisionInsight,
  type ProductDetailMarketIntelligence,
  type ProductRecord,
  type RelatedProductSummary,
} from "@/lib/product-detail";
import { getAbsoluteUrl } from "@/lib/site-url";
import { formatCurrencyTRY, formatDateTR } from "@/lib/formatters";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  TrustBadge,
  TrustMeter,
  confidenceToTrustLevel,
} from "@/lib/trust-badge";
import {
  MarketIntelligencePanel,
  formatMarketIntelligenceSources,
  formatMarketIntelligenceTimestamp,
} from "./market-intelligence-panel";
import { OpportunityScorePanel } from "./opportunity-score-panel";
import { formatOpportunityFreshness, formatOpportunityLevel } from "@/lib/opportunity-engine";
import {
  ListingPriceHistoryChart,
  type ListingPriceHistoryPoint,
} from "./listing-price-history-chart";
import { PriceBandPanel } from "./price-band-panel";
import { SourceComparison } from "./source-comparison";
import { PriceGuideSection } from "./price-guide-section";
import { buildSourceComparison } from "@/lib/source-comparison";
import { toBigintId, toBigintIds } from "@/lib/supabase-ids";
import { listingOutboundPath } from "@/lib/listing-links";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

/** Listings shown in the main list; the rest stay reachable through the source sites. */
const MAX_LISTED_LISTINGS = 24;

const formatPrice = (price: number) => formatCurrencyTRY(price);

const formatOptionalPrice = (price: number | null | undefined) =>
  typeof price === "number" && Number.isFinite(price) && price > 0
    ? formatPrice(price)
    : "—";

const formatDate = (date: string) =>
  formatDateTR(date, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

// generateMetadata and the page run in the same request: share one detail load.
const loadProductDetail = cache((slug: string) => getProductDetail(slug));

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const detail = await loadProductDetail(slug);

  if (!detail) {
    return {
      title: "Ürün bulunamadı | 2ElBul",
      description:
        "Aradığınız ürün 2ElBul fiyat rehberinde bulunamadı. İkinci el piyasa fiyatlarını arayarak keşfedebilirsiniz.",
      robots: { index: false, follow: false },
    };
  }

  const { product } = detail;
  const snapshot = snapshotFromListings(detail.listings);
  return buildPageMetadata({
    title: buildLandingTitle("product", product.name, new Date()),
    description: buildLandingDescription("product", product.name, snapshot),
    path: `/product/${product.slug}`,
    // A model without live listings stays reachable but is kept out of the index.
    noIndex: !isIndexableSnapshot(snapshot),
    followLinks: true,
  });
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  // The session lookup is independent of the product data: start it first so
  // both run at the same time.
  const authPromise = getCurrentUser();
  const detail = await loadProductDetail(slug);
  if (!detail) notFound();

  const {
    product,
    listings,
    sourceOffers,
    decisionInsight,
    bestDeals,
    relatedProducts,
    marketIntelligence,
  } = detail;
  const prices = listings.map((listing) => listing.price);
  const listingCount = listings.length;
  const marketStats = calculateMarketStats(prices);
  const productPriceStats =
    buildProductPriceStats(
      listings.map((listing) => ({
        productId: product.id,
        price: listing.price,
      })),
    )[product.id] ?? null;
  const lowestPrice = marketStats?.lowest ?? 0;
  const highestPrice = marketStats?.highest ?? 0;
  const averagePrice = marketStats?.average ?? 0;
  const marketValue = marketStats?.marketValue ?? 0;
  const listingPriceHistory: ListingPriceHistoryPoint[] = buildDailyPriceHistory(
    detail.priceHistory,
  ).map(({ date, average, lowest, highest, count }) => ({ date, average, lowest, highest, count }));
  const cheapestListings = [...listings]
    .sort((a, b) => a.price - b.price)
    .slice(0, 5);
  const bestDealListing = cheapestListings[0] ?? null;
  const bestDealDiscount =
    bestDealListing && averagePrice
      ? Math.max(
          0,
          Math.round(
            ((averagePrice - bestDealListing.price) / averagePrice) * 100,
          ),
        )
      : null;
  const bestListingAnalysis = cheapestListings[0]
    ? analyzeListingPrice(cheapestListings[0].price, productPriceStats)
    : analyzeListingPrice(null, productPriceStats);
  const suspiciousListings = marketValue
    ? listings
        .filter((listing) => listing.price <= marketValue * 0.6)
        .sort((a, b) => a.price - b.price)
        .slice(0, 5)
    : [];
  const listingsByPrice = [...listings].sort((a, b) => a.price - b.price).slice(0, MAX_LISTED_LISTINGS);
  const favoriteScopeListingIds = [
    ...new Set(
      [...suspiciousListings, ...listingsByPrice, bestDealListing]
        .filter((listing): listing is Listing => Boolean(listing))
        .map((listing) => listing.id),
    ),
  ];

  const cityCounts = [...countBy(listings, (listing) => listing.city).entries()]
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city, "tr"));
  const conditionCounts = ["İkinci El", "Yenilenmiş"].map((condition) => ({
    condition,
    count: listings.filter((listing) => listing.condition === condition).length,
  }));

  const { supabase: serverSupabase, user: authUser } = await authPromise;
  const authData = { user: authUser };
  const isAuthenticated = Boolean(authData.user);
  let favoriteListingIds: string[] = [];

  if (serverSupabase && authData.user && favoriteScopeListingIds.length > 0) {
    const { data, error } = await serverSupabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", authData.user.id)
      .in("listing_id", toBigintIds(favoriteScopeListingIds));

    if (error) {
      console.error("Supabase product favorites query failed:", error);
    } else {
      favoriteListingIds = (data ?? []).map((favorite) =>
        String(favorite.listing_id),
      );
    }
  }

  const favoriteIds = new Set(favoriteListingIds);

  let isFollowing = false;
  if (serverSupabase && authData.user) {
    const { data: follow, error: followError } = await serverSupabase
      .from("product_follows")
      .select("id")
      .eq("user_id", authData.user.id)
      .eq("product_id", toBigintId(product.id))
      .maybeSingle();
    if (followError) console.error("Supabase product follow query failed:", followError);
    isFollowing = Boolean(follow);
  }
  const loginNext = `/product/${product.slug}`;
  const productJsonLd = buildProductJsonLd({
    product,
    listingCount,
    lowestPrice,
    highestPrice,
    bestDeals,
    brandName: marketIntelligence.scope.brand,
  });
  return (
    <main className="min-w-0 bg-[#fafaf8] py-10 sm:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(marketIntelligence.structuredData).replace(
            /</g,
            "\\u003c",
          ),
        }}
      />
      <div className="container-shell min-w-0">
        <Breadcrumbs
          items={[
            { label: "Ana Sayfa", href: "/" },
            ...product.categoryPath.map((category) => ({
              label: category.label,
              href: `/category/${category.slug}`,
            })),
            ...(marketIntelligence.scope.brand
              ? [{ label: marketIntelligence.scope.brand, href: `/brand/${createProductSlug(marketIntelligence.scope.brand)}` }]
              : []),
            { label: product.name },
          ]}
        />
        <ProductSummary
          product={product}
          listing={bestDealListing}
          averagePrice={averagePrice}
          listingCount={listingCount}
          discountPercent={bestDealDiscount}
          priceStats={productPriceStats}
          decisionLabel={marketIntelligence.opportunityAnalysis.recommendation.label}
          isFavorite={bestDealListing ? favoriteIds.has(bestDealListing.id) : false}
          isFollowing={isFollowing}
          isAuthenticated={isAuthenticated}
          loginNext={loginNext}
        />

        <div className="mt-6 max-w-md">
          <PriceAlertForm
            productId={product.id}
            productName={product.name}
            suggestedPrice={listingCount ? lowestPrice : null}
            isAuthenticated={isAuthenticated}
            loginNext={loginNext}
          />
        </div>

        <SourceComparison rows={buildSourceComparison(sourceOffers)} />

        <ProductListingSection
          title="İlanlar"
          icon={Store}
          listings={listingsByPrice}
          priceStats={productPriceStats}
          favoriteIds={favoriteIds}
          isAuthenticated={isAuthenticated}
          loginNext={loginNext}
          emptyMessage="Bu ürün için yayında ilan bulunmuyor. Yeni ilanlar geldikçe liste otomatik güncellenecek."
        />

        <div className="mt-8">
          <SafeShoppingBanner />
        </div>

        <div id="piyasa-analizi" className="mt-14 scroll-mt-24">
          <h2 className="text-2xl font-black tracking-[-0.035em] sm:text-3xl">
            Piyasa analizi
          </h2>
        </div>

        <DecisionDashboardHero
          marketIntelligence={marketIntelligence}
          decisionInsight={decisionInsight}
          bestDealDiscount={bestDealDiscount}
        />

        <PriceBandPanel
          marketStats={marketStats}
          listingPriceHistory={listingPriceHistory}
          currentPrice={bestDealListing?.price ?? 0}
        />

        <section className="mt-8 min-w-0 rounded-sm border border-black/20 border-t-[3px] border-t-[#161616] bg-white p-5 sm:p-8">
          <SectionTitle icon={ChartNoAxesCombined} title="Fiyat geçmişi" />
          <ListingPriceHistoryChart points={listingPriceHistory} />
        </section>

        {suspiciousListings.length > 0 ? (
          <ProductListingSection
            title="Şüpheli ucuz ilanlar"
            icon={TriangleAlert}
            listings={suspiciousListings}
            priceStats={productPriceStats}
            favoriteIds={favoriteIds}
            isAuthenticated={isAuthenticated}
            loginNext={loginNext}
            emptyMessage=""
          />
        ) : null}

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <section className="rounded-sm border border-black/20 border-t-[3px] border-t-[#161616] bg-white p-5 sm:p-8">
            <SectionTitle icon={MapPin} title="Şehir dağılımı" />
            {cityCounts.length > 0 ? (
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                {cityCounts.map(({ city, count }) => (
                  <div
                    key={city}
                    className="min-w-0 rounded-sm border border-black/20 bg-[#fafaf8] p-4"
                  >
                    <p className="truncate text-sm font-black" title={city}>
                      {city}
                    </p>
                    <p className="mt-2 text-2xl font-black text-[#3B66E0]">
                      {count}
                    </p>
                    <p className="text-xs text-black/40">ilan</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="Şehir dağılımı için henüz veri yok." />
            )}
          </section>

          <section className="rounded-sm border border-black/20 border-t-[3px] border-t-[#161616] bg-white p-5 sm:p-8">
            <SectionTitle icon={Tag} title="Durum dağılımı" />
            <div className="mt-6 grid grid-cols-2 gap-3">
              {conditionCounts.map(({ condition, count }) => (
                <div
                  key={condition}
                  className={`rounded-sm border p-5 ${
                    condition === "Yenilenmiş"
                      ? "border-sky-200 bg-sky-50"
                      : "border-black/20 bg-[#fafaf8]"
                  }`}
                >
                  <p className="text-sm font-black">{condition}</p>
                  <p
                    className={`mt-3 text-3xl font-black ${
                      condition === "Yenilenmiş"
                        ? "text-sky-700"
                        : "text-[#3B66E0]"
                    }`}
                  >
                    {count}
                  </p>
                  <p className="text-xs text-black/40">ilan</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <MarketIntelligencePanel marketIntelligence={marketIntelligence} />

        <OpportunityScorePanel
          opportunityAnalysis={marketIntelligence.opportunityAnalysis}
          marketIntelligence={marketIntelligence}
        />

        <PriceGuideSection
          productName={product.name}
          productUrl={getAbsoluteUrl(`/product/${product.slug}`)}
          snapshot={snapshotFromListings(listings)}
          now={new Date()}
        />

        <RelatedProductsSection products={relatedProducts} />
      </div>
    </main>
  );
}

export function DecisionDashboardHero({
  marketIntelligence,
  decisionInsight,
  bestDealDiscount,
}: {
  marketIntelligence: ProductDetailMarketIntelligence;
  decisionInsight: ProductDecisionInsight;
  bestDealDiscount: number | null;
}) {
  const opportunityAnalysis = marketIntelligence.opportunityAnalysis;
  const hasInsufficientData = marketIntelligence.sampleSize < 3;
  const sourceLabel = formatMarketIntelligenceSources(
    marketIntelligence.sourcesUsed,
  );

  return (
    <section className="mt-8 rounded-sm border border-black/20 border-t-[3px] border-t-[#161616] bg-white p-5 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <h3 className="break-words text-2xl font-black tracking-[-0.035em] sm:text-3xl">
            AI Kararı
          </h3>
          <p className="mt-3 text-sm leading-6 text-black/55">
            {decisionInsight.smartPrice.summary}
          </p>
        </div>
        <span
          className={`inline-flex rounded-full border px-4 py-2 text-xs font-black ${getDecisionBadgeClassName(opportunityAnalysis.recommendation.label)}`}
        >
          {opportunityAnalysis.recommendation.label}
        </span>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <div className="rounded-sm border border-[#3B66E0]/20 bg-[#EEF3FF] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#2A4FBF]/75">
                Fırsat skoru
              </p>
              <p className="mt-2 text-5xl font-black tracking-[-0.08em] text-[#2A4FBF]">
                {opportunityAnalysis.opportunityScore}
                <span className="text-xl text-black/35">/100</span>
              </p>
              <p className="mt-3 text-sm font-semibold leading-6 text-black/60">
                {opportunityAnalysis.recommendation.description}
              </p>
            </div>
            <div className="rounded-sm border border-white/70 bg-white/90 px-4 py-3 text-right shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.08em] text-black/35">
                Güçlü fırsat mı?
              </p>
              <p className="mt-2 text-xl font-black tracking-[-0.03em] text-black">
                {formatOpportunityLevel(opportunityAnalysis.opportunityLevel)}
              </p>
              <p className="mt-1 text-xs font-semibold text-black/45">
                Risk: {formatOpportunityLevel(opportunityAnalysis.riskLevel)}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="min-w-0 rounded-sm border border-[#3B66E0]/20 bg-[#EEF3FF] p-4 sm:p-5">
              <TrustMeter
                score={marketIntelligence.confidenceScore ?? 0}
                level={marketIntelligence.confidenceLevel}
              />
            </div>
            <StatCard
              label="Örneklem"
              value={`${marketIntelligence.sampleSize}`}
            />
            <StatCard
              label="Veri tazeliği"
              value={formatOpportunityFreshness(
                opportunityAnalysis.dataFreshness,
              )}
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <StatCard
              label="Ortalama fiyat"
              value={formatOptionalPrice(marketIntelligence.priceAnalysis.averagePrice)}
            />
            <StatCard
              label="En düşük fiyat"
              value={formatOptionalPrice(marketIntelligence.priceAnalysis.minPrice)}
              accent
            />
            <StatCard
              label="Medyan fiyat"
              value={formatOptionalPrice(marketIntelligence.priceAnalysis.medianPrice)}
            />
            <StatCard
              label="Fiyat avantajı"
              value={bestDealDiscount !== null ? `%${bestDealDiscount}` : "—"}
              accent
            />
          </div>

          <div className="mt-5 rounded-sm border border-black/20 bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-black/35">
              Karar nedenleri
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
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
            <p className="mt-4 text-sm font-semibold leading-6 text-black/58">
              {decisionInsight.confidence.description}
            </p>
          </div>
        </div>

        <div className="rounded-sm border border-black/20 bg-[#fafaf8] p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.08em] text-black/35">
            Piyasa özeti
          </p>
          <p className="mt-3 text-sm font-semibold leading-6 text-black/60">
            Son güncelleme:{" "}
            {formatMarketIntelligenceTimestamp(
              marketIntelligence.analysisGeneratedAt,
            )}
          </p>
          <p className="mt-4 text-xs font-semibold leading-6 text-black/45">
            Kullanılan kaynaklar: {sourceLabel}
          </p>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <StatCard
              label="Kaynak sayısı"
              value={`${marketIntelligence.marketSummary.sourceCount}`}
            />
            <StatCard
              label="Toplam ilan"
              value={`${marketIntelligence.marketSummary.totalListingCount}`}
            />
            <StatCard
              label="Aktif ilan"
              value={`${marketIntelligence.marketSummary.activeListingCount}`}
            />
          </div>

          {hasInsufficientData ? (
            <div className="mt-5 flex gap-3 rounded-sm border border-dashed border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
              <TriangleAlert className="mt-0.5 shrink-0" size={17} />
              <span>
                Yetersiz veri: karar notu daha fazla ilan geldikçe otomatik olarak güçlenecek.
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ProductListingSection({
  title,
  icon,
  listings,
  priceStats,
  favoriteIds,
  isAuthenticated,
  loginNext,
  emptyMessage,
}: {
  title: string;
  icon: typeof Tag;
  listings: Listing[];
  priceStats: ProductPriceStats | null;
  favoriteIds: Set<string>;
  isAuthenticated: boolean;
  loginNext: string;
  emptyMessage: string;
}) {
  return (
    <section className="mt-8 rounded-sm border border-black/20 border-t-[3px] border-t-[#161616] bg-white p-5 sm:p-8">
      <SectionTitle icon={icon} title={title} />
      {listings.length > 0 ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              priceStats={priceStats}
              isFavorite={favoriteIds.has(listing.id)}
              isAuthenticated={isAuthenticated}
              loginNext={loginNext}
            />
          ))}
        </div>
      ) : (
        <EmptyState text={emptyMessage} />
      )}
    </section>
  );
}

function RelatedProductsSection({
  products,
}: {
  products: RelatedProductSummary[];
}) {
  return (
    <section className="mt-8 rounded-sm border border-black/20 border-t-[3px] border-t-[#161616] bg-white p-5 sm:p-8">
      <SectionTitle icon={Store} eyebrow="Benzer ürünler" title="Benzer Ürünler" />
      {products.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/product/${product.slug}`}
              className="group min-w-0 rounded-sm border border-black/20 bg-[#fafaf8] p-5 transition hover:-translate-y-0.5 hover:border-[#3B66E0]/30 hover:bg-white hover:shadow-[0_18px_45px_rgba(0,0,0,0.06)]"
            >
              {product.category ? (
                <span className="rounded-full border border-black/20 bg-white px-3 py-1.5 text-[11px] font-black text-black/45">
                  {product.category}
                </span>
              ) : null}
              <h3 className="mt-4 break-words text-lg font-black leading-6 group-hover:text-[#3B66E0]">
                {product.name}
              </h3>
              <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
                <RelatedMetric label="İlan" value={`${product.listingCount}`} />
                <RelatedMetric
                  label="Ortalama"
                  value={
                    product.averagePrice ? formatPrice(product.averagePrice) : "—"
                  }
                />
                <RelatedMetric
                  label="En düşük"
                  value={product.minPrice ? formatPrice(product.minPrice) : "—"}
                />
              </div>
              <p className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#3B66E0]">
                Detaya git <ArrowUpRight size={16} />
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState text="Bu ürün için benzer ürün önerisi henüz oluşturulamadı." />
      )}
    </section>
  );
}

function RelatedMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-sm border border-black/20 bg-white p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.06em] text-black/35">
        {label}
      </p>
      <p className="mt-1 truncate text-xs font-black" title={value}>
        {value}
      </p>
    </div>
  );
}

function IntelligenceCard({
  intelligence,
}: {
  intelligence: ProductIntelligence;
}) {
  return (
    <section className="rounded-sm border border-[#3B66E0]/20 bg-[#EEF3FF] p-5  sm:p-8">
      <SectionTitle
        icon={ChartNoAxesCombined}
        eyebrow="Karar destek motoru"
        title="2ElBul Intelligence"
      />
      <div className="mt-5 rounded-sm border border-[#3B66E0]/20 bg-white p-4">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-[#2A4FBF]">
          Alim onerisi
        </p>
        <h3 className="mt-2 text-2xl font-black tracking-[-0.04em]">
          {intelligence.recommendation.title}
        </h3>
        <p className="mt-3 text-sm font-semibold leading-6 text-black/58">
          {intelligence.recommendation.description}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <IntelligenceMetric
          label="Firsat skoru"
          value={`${intelligence.opportunity.score}/100`}
          badge={intelligence.opportunity.label}
        />
        <IntelligenceMetric
          label="Piyasa trendi"
          value={formatTrendDirection(intelligence.trend.direction)}
          badge={intelligence.trend.changePercent === null ? "Veri yok" : `%${Math.abs(intelligence.trend.changePercent)} ${intelligence.trend.changePercent < 0 ? "dusus" : "degisim"}`}
        />
        <IntelligenceMetric
          label="Talep seviyesi"
          value={formatDemandLevel(intelligence.demand.demandLevel)}
          badge={`${intelligence.demand.recentSearchCount} yeni arama`}
        />
      </div>

      <div className="mt-4 space-y-2 text-sm font-semibold leading-6 text-black/58">
        <p>{intelligence.opportunity.explanation}</p>
        <p>{intelligence.trend.explanation}</p>
        <p>{intelligence.demand.explanation}</p>
      </div>
    </section>
  );
}

function IntelligenceMetric({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge: string;
}) {
  return (
    <div className="min-w-0 rounded-sm border border-black/20 bg-white p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-black/35">
        {label}
      </p>
      <p className="mt-2 truncate text-base font-black" title={value}>
        {value}
      </p>
      <span className="mt-3 inline-flex max-w-full truncate rounded-full bg-[#E4ECFF] px-3 py-1 text-[11px] font-black text-[#2A4FBF]">
        {badge}
      </span>
    </div>
  );
}

function DecisionSupportCard({
  intelligence,
}: {
  intelligence: ProductIntelligence;
}) {
  const decision = intelligence.decisionSupport;

  return (
    <section className="rounded-sm border border-black/20 border-t-[3px] border-t-[#161616] bg-white p-5 sm:p-8">
      <SectionTitle
        icon={Clock3}
        eyebrow="Karar destek"
        title="Satın Alma Tavsiyesi"
      />

      <div className="mt-5 rounded-sm border border-black/20 bg-[#fafaf8] p-4">
        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${getDecisionBadgeClassName(decision.label)}`}>
          {decision.label}
        </span>
        <p className="mt-3 text-sm font-semibold leading-6 text-black/60">
          {decision.explanation}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <IntelligenceMetric
          label="Buy Score"
          value={`${decision.buyScore}/100`}
          badge="Alım gücü"
        />
        <IntelligenceMetric
          label="Wait Score"
          value={`${decision.waitScore}/100`}
          badge="Bekleme sinyali"
        />
        <IntelligenceMetric
          label="Volatility"
          value={`${decision.volatilityScore}/100`}
          badge={formatScoreLevel(decision.volatilityLevel)}
        />
        <IntelligenceMetric
          label="Liquidity"
          value={`${decision.liquidityScore}/100`}
          badge={formatScoreLevel(decision.liquidityLevel)}
        />
      </div>
    </section>
  );
}

function AdvancedPriceInsightCard({
  insight,
}: {
  insight: ProductDecisionInsight["smartPrice"];
}) {
  return (
    <section className="rounded-sm border border-black/20 border-t-[3px] border-t-[#161616] bg-white p-5 sm:p-8">
      <SectionTitle
        icon={ChartNoAxesCombined}
        eyebrow="Gelişmiş analiz"
        title="Akıllı fiyat yorumu"
      />
      <p className="mt-5 text-base font-semibold leading-8 text-black/65">
        {insight.summary}
      </p>
      <div className="mt-5 space-y-3">
        {insight.details.map((detail) => (
          <p
            key={detail}
            className="rounded-sm border border-black/20 bg-[#fafaf8] px-4 py-3 text-sm font-semibold leading-6 text-black/58"
          >
            {detail}
          </p>
        ))}
      </div>
      {insight.warnings.length > 0 ? (
        <div className="mt-5 space-y-2">
          {insight.warnings.map((warning) => (
            <p
              key={warning}
              className="flex gap-2 rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-800"
            >
              <TriangleAlert className="mt-0.5 shrink-0" size={17} />
              {warning}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ConfidenceScoreCard({
  insight,
}: {
  insight: ProductDecisionInsight["confidence"];
}) {
  const score = insight.score ?? 0;

  return (
    <section className="rounded-sm border border-black/20 border-t-[3px] border-t-[#161616] bg-white p-5 sm:p-8">
      <SectionTitle icon={Tag} eyebrow="Güven Skoru" title="Karar güveni" />
      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.08em] text-black/40">
            Skor
          </p>
          <p className="mt-1 text-5xl font-black tracking-[-0.07em]">
            {insight.score === null ? "—" : insight.score}
            <span className="text-xl text-black/35">/100</span>
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1.5 text-xs font-black ${insight.className}`}
        >
          {insight.level}
        </span>
      </div>
      <div className="mt-5 h-3 overflow-hidden rounded-full bg-black/8">
        <div
          className="h-full rounded-full bg-[#3B66E0]"
          style={{ width: `${insight.score === null ? 12 : score}%` }}
        />
      </div>
      <p className="mt-5 text-sm font-semibold leading-6 text-black/60">
        {insight.description}
      </p>
      <div className="mt-5 space-y-2">
        {insight.reasons.map((reason) => (
          <p
            key={reason}
            className="rounded-sm border border-green-100 bg-green-50 px-4 py-3 text-sm font-bold leading-6 text-green-800"
          >
            {reason}
          </p>
        ))}
        {insight.warnings.map((warning) => (
          <p
            key={warning}
            className="flex gap-2 rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-800"
          >
            <TriangleAlert className="mt-0.5 shrink-0" size={17} />
            {warning}
          </p>
        ))}
      </div>
    </section>
  );
}

export function ProductSummary({
  product,
  listing,
  averagePrice,
  listingCount,
  discountPercent,
  priceStats,
  decisionLabel,
  isFavorite,
  isFollowing,
  isAuthenticated,
  loginNext,
}: {
  product: ProductRecord;
  /** The cheapest listing: its photo, price, location, condition and source lead the page. */
  listing: Listing | null;
  averagePrice: number;
  listingCount: number;
  discountPercent: number | null;
  priceStats: ProductPriceStats | null;
  decisionLabel: string;
  isFavorite: boolean;
  isFollowing: boolean;
  isAuthenticated: boolean;
  loginNext: string;
}) {
  const category = product.categoryPath[product.categoryPath.length - 1];
  const priceAnalysis = analyzeListingPrice(listing?.price ?? null, priceStats);
  const facts = listing
    ? [
        { icon: MapPin, label: "Konum", value: listing.city },
        { icon: Tag, label: "Ürün durumu", value: listing.condition },
        { icon: Store, label: "İlan kaynağı", value: listing.source },
        { icon: CalendarDays, label: "İlan tarihi", value: formatDate(listing.createdAt) },
      ]
    : [];

  return (
    <section className="mt-6 rounded-sm border border-black/20 border-t-[3px] border-t-[#161616] bg-white p-5 sm:p-8">
      <div className="grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-8">
        <ListingImage
          imageUrl={listing?.imageUrl ?? null}
          productName={product.name}
          alt={listing?.title ?? product.name}
          source={listing?.source}
          priority
        />

        <div className="min-w-0">
          {category ? (
            <Link
              href={`/category/${category.slug}`}
              className="inline-flex rounded-full border border-black/20 px-3 py-1 text-xs font-black text-black/55 transition hover:border-[#3B66E0]/35 hover:text-[#2A4FBF]"
            >
              {category.label}
            </Link>
          ) : null}
          <h1 className="mt-3 break-words text-3xl font-black tracking-[-0.045em] sm:text-4xl">
            {product.name}
          </h1>

          {listing ? (
            <>
              <div className="mt-5">
                <p className="text-xs font-bold uppercase tracking-[0.07em] text-black/40">
                  En düşük fiyat
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <p className="text-4xl font-black tracking-[-0.05em] text-[#3B66E0] sm:text-5xl">
                    {formatPrice(listing.price)}
                  </p>
                  <span
                    className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-black ${priceAnalysis.className}`}
                  >
                    {priceAnalysis.label}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-black/55">
                  {listingCount} ilan
                  {averagePrice ? ` · ortalama ${formatPrice(averagePrice)}` : ""}
                  {discountPercent ? ` · ortalamanın %${discountPercent} altında` : ""}
                </p>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-3">
                {facts.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="min-w-0 rounded-sm border border-black/15 bg-[#fafaf8] p-3">
                    <dt className="flex items-center gap-1.5 text-xs font-bold text-black/40">
                      <Icon size={14} /> {label}
                    </dt>
                    <dd className="mt-1 break-words text-sm font-black">{value}</dd>
                  </div>
                ))}
              </dl>

              <AlsoListedOn alsoOn={listing.alsoOn} />

              <div className="mt-5 flex items-center gap-3">
                <a
                  href={listingOutboundPath(listing.id)}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="orange-button flex-1 whitespace-nowrap px-5 py-3 sm:flex-none"
                >
                  İlana git <ArrowUpRight size={17} />
                </a>
                <FavoriteButton
                  listingId={listing.id}
                  initialIsFavorite={isFavorite}
                  isAuthenticated={isAuthenticated}
                  loginNext={loginNext}
                  compact
                />
                <CompareButton
                  listingId={listing.id}
                  productName={listing.productName}
                  compact
                />
              </div>

              <div className="mt-4">
                <FollowProductButton
                  productId={product.id}
                  initialFollowing={isFollowing}
                  isAuthenticated={isAuthenticated}
                  loginNext={loginNext}
                />
              </div>

              <a
                href="#piyasa-analizi"
                className="mt-5 flex flex-wrap items-center gap-2 text-sm font-bold text-black/55 hover:text-[#2A4FBF]"
              >
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${getDecisionBadgeClassName(decisionLabel)}`}
                >
                  {decisionLabel}
                </span>
                Piyasa analizini gör ↓
              </a>
            </>
          ) : (
            <p className="mt-5 text-sm font-semibold leading-6 text-black/50">
              Bu ürün için şu an yayında ilan yok. Takip ederek yeni ilan geldiğinde haber alabilirsiniz.
            </p>
          )}
          {!listing && (
            <div className="mt-4">
              <FollowProductButton
                productId={product.id}
                initialFollowing={isFollowing}
                isAuthenticated={isAuthenticated}
                loginNext={loginNext}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ListingCard({
  listing,
  priceStats,
  isFavorite,
  isAuthenticated,
  loginNext,
  trustLevel,
}: {
  listing: Listing;
  priceStats: ProductPriceStats | null;
  isFavorite: boolean;
  isAuthenticated: boolean;
  loginNext: string;
  trustLevel?: ReturnType<typeof confidenceToTrustLevel>;
}) {
  const priceAnalysis = analyzeListingPrice(listing.price, priceStats);

  return (
    <article className="flex min-w-0 flex-col rounded-sm border border-black/20 bg-[#fafaf8] p-5">
      <ListingImage
        imageUrl={listing.imageUrl}
        productName={listing.productName}
        alt={listing.title}
      />
      <div className="flex items-start justify-between gap-3">
        <span
          className={`rounded-full px-3 py-1.5 text-xs font-bold ${
            listing.condition === "Yenilenmiş"
              ? "border border-sky-200 bg-sky-50 text-sky-700"
              : "bg-white text-black/50"
          }`}
        >
          {listing.condition}
        </span>
        {trustLevel && (
          <TrustBadge level={trustLevel} />
        )}
        <div className="flex items-center gap-2">
          <CompareButton
            listingId={listing.id}
            productName={listing.productName}
            compact
          />
          <FavoriteButton
            listingId={listing.id}
            initialIsFavorite={isFavorite}
            isAuthenticated={isAuthenticated}
            loginNext={loginNext}
            compact
          />
        </div>
      </div>
      <h3 className="mt-4 break-words font-black leading-6">{listing.title}</h3>
      <p className="mt-3 text-2xl font-black tracking-[-0.04em] text-[#3B66E0]">
        {formatPrice(listing.price)}
      </p>
      <span
        className={`mt-3 inline-flex w-fit rounded-full border px-3 py-1.5 text-xs font-black ${priceAnalysis.className}`}
      >
        {priceAnalysis.label}
      </span>
      <AlsoListedOn alsoOn={listing.alsoOn} />
      <div className="mt-5 grid gap-2.5 border-t border-black/7 pt-4 text-sm text-black/55">
        <p className="flex items-center gap-2">
          <MapPin size={16} /> {listing.city}
        </p>
        <p className="flex items-center gap-2">
          <Store size={16} /> {listing.source}
        </p>
        <p className="flex items-center gap-2">
          <CalendarDays size={16} /> {formatDate(listing.createdAt)}
        </p>
      </div>
      <a
        href={listingOutboundPath(listing.id)}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="orange-button mt-5 py-3"
      >
        İlana git <ArrowUpRight size={17} />
      </a>
    </article>
  );
}

/** The same item on other platforms (duplicate group): shown, never counted twice. */
function AlsoListedOn({ alsoOn }: { alsoOn: Listing["alsoOn"] }) {
  if (!alsoOn || alsoOn.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-black/50">
      <span>Aynı ilan:</span>
      {alsoOn.map((other) => (
        <a
          key={other.id}
          href={listingOutboundPath(other.id)}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="rounded-full border border-black/15 bg-white px-2.5 py-1 font-bold transition hover:border-[#3B66E0]/40 hover:text-[#2A4FBF]"
        >
          {other.source} {formatPrice(other.price)}
        </a>
      ))}
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  eyebrow,
  title,
}: {
  icon: typeof Tag;
  eyebrow?: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-sm bg-[#E4ECFF] text-[#3B66E0]">
        <Icon size={21} />
      </span>
      <div>
        {eyebrow ? (
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#3B66E0]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-2xl font-black tracking-[-0.035em]">{title}</h2>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = false,
  wide = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  wide?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-sm border p-4 sm:p-5 ${
        accent
          ? "border-[#3B66E0]/20 bg-[#EEF3FF]"
          : "border-black/20 bg-white"
      } ${wide ? "min-[420px]:col-span-2 lg:col-span-1" : ""}`}
    >
      <p className="text-xs font-bold uppercase tracking-[0.07em] text-black/40">
        {label}
      </p>
      <p
        className={`mt-2 break-words text-lg font-black tracking-[-0.03em] ${
          accent ? "text-[#3B66E0]" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mt-6 rounded-sm border border-dashed border-black/15 bg-[#fafaf8] px-6 py-10 text-center text-sm font-semibold text-black/45">
      {text}
    </div>
  );
}

function formatDealDifference(value: number | null) {
  if (value === null) return "karşılaştırma verisi sınırlı";
  const absolute = Math.abs(value).toLocaleString("tr-TR");
  if (value < 0) return `%${absolute} altında`;
  if (value > 0) return `%${absolute} üstünde`;
  return "ortalama seviyesinde";
}

function formatTrendDirection(direction: ProductIntelligence["trend"]["direction"]) {
  if (direction === "rising") return "Yukseliyor";
  if (direction === "falling") return "Dusuyor";
  if (direction === "stable") return "Stabil";
  return "Bilinmiyor";
}

function formatDemandLevel(level: ProductIntelligence["demand"]["demandLevel"]) {
  if (level === "high") return "Yuksek";
  if (level === "medium") return "Orta";
  if (level === "low") return "Dusuk";
  return "Bilinmiyor";
}

function formatScoreLevel(
  level: ProductIntelligence["decisionSupport"]["volatilityLevel"],
) {
  if (level === "high") return "Yuksek";
  if (level === "medium") return "Orta";
  if (level === "low") return "Dusuk";
  return "Veri yok";
}

function getDecisionBadgeClassName(
  label: string,
) {
  const normalized = label.toLocaleLowerCase("tr-TR");
  if (normalized === "şimdi al") return "border-green-200 bg-green-50 text-green-700";
  if (normalized === "bekle") return "border-blue-200 bg-blue-50 text-blue-700";
  if (normalized === "takip et") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  return { supabase, user: data.user };
}

function buildProductJsonLd({
  product,
  listingCount,
  lowestPrice,
  highestPrice,
  bestDeals,
  brandName,
}: {
  product: ProductRecord;
  listingCount: number;
  lowestPrice: number;
  highestPrice: number;
  bestDeals: ProductBestDeal[];
  brandName?: string | null;
}) {
  const productUrl = getAbsoluteUrl(`/product/${product.slug}`);
  const offers =
    listingCount > 0 && lowestPrice > 0 && highestPrice > 0
      ? {
          "@type": "AggregateOffer",
          priceCurrency: "TRY",
          lowPrice: lowestPrice,
          highPrice: highestPrice,
          offerCount: listingCount,
          url: productUrl,
          offers: bestDeals
            .filter((deal) => deal.listing.url && deal.listing.price > 0)
            .slice(0, 5)
            .map((deal) => ({
              "@type": "Offer",
              priceCurrency: "TRY",
              price: deal.listing.price,
              url: deal.listing.url,
              availability: "https://schema.org/InStock",
              itemCondition: "https://schema.org/UsedCondition",
              seller: {
                "@type": "Organization",
                name: deal.listing.source,
              },
            })),
        }
      : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: `${product.name} için ikinci el ilanları, piyasa fiyat aralığı ve fiyat analizi.`,
    category: product.category ?? undefined,
    url: productUrl,
    image:
      bestDeals.find((deal) => deal.listing.imageUrl)?.listing.imageUrl ??
      getAbsoluteUrl("/og-image.png"),
    brand: brandName ? { "@type": "Brand", name: brandName } : undefined,
    offers,
  };
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
