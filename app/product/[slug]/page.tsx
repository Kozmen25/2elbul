import type { Metadata } from "next";
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
import { ListingImage } from "@/components/listing-image";
import { PriceAlertForm } from "@/components/price-alert-form";
import type { ProductIntelligence } from "@/lib/intelligence-engine";
import type { Listing } from "@/lib/listings";
import { calculateMarketStats } from "@/lib/price-insights";
import {
  analyzeListingPrice,
  buildProductPriceStats,
  type ListingPriceAnalysis,
  type ProductPriceStats,
} from "@/lib/price-analysis";
import {
  getProductBySlug,
  getProductDetail,
  type ProductBestDeal,
  type ProductDecisionInsight,
  type ProductRecord,
  type RelatedProductSummary,
} from "@/lib/product-detail";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { MarketIntelligencePanel } from "./market-intelligence-panel";
import {
  ListingPriceHistoryChart,
  type ListingPriceHistoryPoint,
} from "./listing-price-history-chart";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

const formatPrice = (price: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(price);

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return {
      title: "Ürün bulunamadı | 2ElBul",
      description:
        "Aradığınız ürün 2ElBul fiyat rehberinde bulunamadı. İkinci el piyasa fiyatlarını arayarak keşfedebilirsiniz.",
      robots: { index: false, follow: false },
    };
  }

  const title = `${product.name} ikinci el fiyatları ve piyasa analizi | 2ElBul`;
  const description = `${product.name} için ikinci el ilanları, ortalama fiyat, en ucuz ilan, fiyat geçmişi ve güven skoru 2ElBul'da.`;
  const canonicalUrl = getAbsoluteUrl(`/product/${product.slug}`);

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "2ElBul",
      locale: "tr_TR",
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const detail = await getProductDetail(slug);
  if (!detail) notFound();

  const {
    product,
    listings,
    intelligence,
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
  const medianPrice = marketStats?.median ?? 0;
  const marketValue = marketStats?.marketValue ?? 0;
  const listingPriceHistory = buildListingPriceHistory(listings);
  const newestListing = [...listings].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];
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
  const latestListings = [...listings]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 5);
  const suspiciousListings = marketValue
    ? listings
        .filter((listing) => listing.price <= marketValue * 0.6)
        .sort((a, b) => a.price - b.price)
        .slice(0, 5)
    : [];
  const listingPreview = listings.slice(0, 24);
  const favoriteScopeListingIds = [
    ...new Set(
      [
        ...suspiciousListings,
        ...cheapestListings,
        ...latestListings,
        ...listingPreview,
        bestDealListing,
      ]
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

  const serverSupabase = await createSupabaseServerClient();
  const { data: authData } = (await serverSupabase?.auth.getUser()) ?? {
    data: { user: null },
  };
  const isAuthenticated = Boolean(authData.user);
  let favoriteListingIds: string[] = [];

  if (serverSupabase && authData.user && favoriteScopeListingIds.length > 0) {
    const { data, error } = await serverSupabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", authData.user.id)
      .in("listing_id", favoriteScopeListingIds);

    if (error) {
      console.error("Supabase product favorites query failed:", error);
    } else {
      favoriteListingIds = (data ?? []).map((favorite) =>
        String(favorite.listing_id),
      );
    }
  }

  const favoriteIds = new Set(favoriteListingIds);
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
        <div className="max-w-4xl">
          <p className="text-sm font-bold text-[#ff6b00]">
            İkinci el fiyat rehberi
          </p>
          <h1 className="mt-2 break-words text-3xl font-black tracking-[-0.045em] sm:text-5xl">
            {product.name}
          </h1>
          <p className="mt-3 text-black/50">
            Güncel ilanları, fiyat aralığını ve şehir dağılımını karşılaştır.
          </p>
        </div>

        {product.category ? (
          <p className="mt-4 inline-flex rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-black text-black/55">
            Kategori: {product.category}
          </p>
        ) : null}

        <div className="mt-8 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-6">
          <StatCard label="Toplam ilan" value={`${listingCount}`} />
          <StatCard
            label="Ortalama fiyat"
            value={listingCount ? formatPrice(averagePrice) : "—"}
          />
          <StatCard
            label="En düşük fiyat"
            value={listingCount ? formatPrice(lowestPrice) : "—"}
            accent
          />
          <StatCard
            label="En yüksek fiyat"
            value={listingCount ? formatPrice(highestPrice) : "—"}
          />
          <StatCard
            label="Medyan fiyat"
            value={listingCount ? formatPrice(medianPrice) : "—"}
          />
          <StatCard
            label="Son güncelleme"
            value={newestListing ? formatDate(newestListing.createdAt) : "—"}
            wide
          />
        </div>

        <MarketIntelligencePanel marketIntelligence={marketIntelligence} />

        <div className="mt-6 max-w-md">
          <PriceAlertForm
            productId={product.id}
            productName={product.name}
            suggestedPrice={listingCount ? lowestPrice : null}
            isAuthenticated={isAuthenticated}
            loginNext={loginNext}
          />
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.7fr)_minmax(300px,0.8fr)]">
          <IntelligenceCard intelligence={intelligence} />

          <DecisionSupportCard intelligence={intelligence} />

          <AdvancedPriceInsightCard insight={decisionInsight.smartPrice} />
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(300px,0.8fr)]">
          <ConfidenceScoreCard insight={decisionInsight.confidence} />

          <BestDealCard
            listing={bestDealListing}
            averagePrice={averagePrice}
            discountPercent={bestDealDiscount}
            priceStats={productPriceStats}
            isFavorite={bestDealListing ? favoriteIds.has(bestDealListing.id) : false}
            isAuthenticated={isAuthenticated}
            loginNext={loginNext}
          />
        </div>

        <PriceAnalysisBox
          stats={productPriceStats}
          analysis={bestListingAnalysis}
        />

        <BestDealsSection deals={bestDeals} />

        <section className="mt-8 min-w-0 rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
          <SectionTitle
            icon={ChartNoAxesCombined}
            eyebrow="Fiyat Geçmişi"
            title="Fiyat Geçmişi"
          />
          <p className="mt-4 text-sm leading-6 text-black/55">
            Bu ürün için toplanan ilan fiyatlarının zamana göre değişimi.
          </p>
          <ListingPriceHistoryChart points={listingPriceHistory} />
        </section>

        <ProductListingSection
          eyebrow="Riskli fiyat"
          title="Şüpheli ucuz ilanlar"
          icon={TriangleAlert}
          listings={suspiciousListings}
          priceStats={productPriceStats}
          favoriteIds={favoriteIds}
          isAuthenticated={isAuthenticated}
          loginNext={loginNext}
          emptyMessage="Piyasanın çok altında şüpheli ilan bulunmadı."
        />

        <ProductListingSection
          eyebrow="Fiyat avantajı"
          title="En ucuz ilanlar"
          icon={Tag}
          listings={cheapestListings}
          priceStats={productPriceStats}
          favoriteIds={favoriteIds}
          isAuthenticated={isAuthenticated}
          loginNext={loginNext}
          emptyMessage="Bu ürün için henüz ilan bulunamadı."
        />

        <ProductListingSection
          eyebrow="Yeni fırsatlar"
          title="Son eklenen ilanlar"
          icon={Clock3}
          listings={latestListings}
          priceStats={productPriceStats}
          favoriteIds={favoriteIds}
          isAuthenticated={isAuthenticated}
          loginNext={loginNext}
          emptyMessage="Bu ürün için henüz yeni ilan bulunmuyor."
        />

        <ProductListingSection
          eyebrow="Tüm kaynaklar"
          title="İlan listesi"
          icon={Store}
          listings={listingPreview}
          priceStats={productPriceStats}
          favoriteIds={favoriteIds}
          isAuthenticated={isAuthenticated}
          loginNext={loginNext}
          emptyMessage="Bu ürün için yayında ilan bulunmuyor. Yeni ilanlar geldikçe liste otomatik güncellenecek."
          matchKey={product.slug}
        />

        <RelatedProductsSection products={relatedProducts} />

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <section className="rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
            <SectionTitle
              icon={MapPin}
              eyebrow="Konum analizi"
              title="Şehir dağılımı"
            />
            {cityCounts.length > 0 ? (
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                {cityCounts.map(({ city, count }) => (
                  <div
                    key={city}
                    className="min-w-0 rounded-2xl border border-black/8 bg-[#fafaf8] p-4"
                  >
                    <p className="truncate text-sm font-black" title={city}>
                      {city}
                    </p>
                    <p className="mt-2 text-2xl font-black text-[#ff6b00]">
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

          <section className="rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
            <SectionTitle
              icon={Tag}
              eyebrow="Cihaz durumu"
              title="Durum dağılımı"
            />
            <div className="mt-6 grid grid-cols-2 gap-3">
              {conditionCounts.map(({ condition, count }) => (
                <div
                  key={condition}
                  className={`rounded-2xl border p-5 ${
                    condition === "Yenilenmiş"
                      ? "border-sky-200 bg-sky-50"
                      : "border-black/8 bg-[#fafaf8]"
                  }`}
                >
                  <p className="text-sm font-black">{condition}</p>
                  <p
                    className={`mt-3 text-3xl font-black ${
                      condition === "Yenilenmiş"
                        ? "text-sky-700"
                        : "text-[#ff6b00]"
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
      </div>
    </main>
  );
}

function ProductListingSection({
  eyebrow,
  title,
  icon,
  listings,
  priceStats,
  favoriteIds,
  isAuthenticated,
  loginNext,
  emptyMessage,
  matchKey,
}: {
  eyebrow: string;
  title: string;
  icon: typeof Tag;
  listings: Listing[];
  priceStats: ProductPriceStats | null;
  favoriteIds: Set<string>;
  isAuthenticated: boolean;
  loginNext: string;
  emptyMessage: string;
  matchKey?: string;
}) {
  return (
    <section className="mt-8 rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
      <SectionTitle icon={icon} eyebrow={eyebrow} title={title} />
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
              matchKey={matchKey}
            />
          ))}
        </div>
      ) : (
        <EmptyState text={emptyMessage} />
      )}
    </section>
  );
}

function BestDealsSection({ deals }: { deals: ProductBestDeal[] }) {
  return (
    <section className="mt-8 rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
      <SectionTitle icon={Tag} eyebrow="Fırsat seçkisi" title="En İyi Fırsatlar" />
      {deals.length > 0 ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {deals.map((deal) => (
            <article
              key={deal.listing.id}
              className="flex min-w-0 flex-col rounded-2xl border border-black/8 bg-[#fafaf8] p-4"
            >
              <span
                className={`w-fit rounded-full border px-3 py-1.5 text-xs font-black ${deal.className}`}
              >
                {deal.label}
              </span>
              <h3 className="mt-4 line-clamp-3 break-words text-sm font-black leading-6">
                {deal.listing.title}
              </h3>
              <p className="mt-3 text-2xl font-black tracking-[-0.05em] text-[#ff6b00]">
                {formatPrice(deal.listing.price)}
              </p>
              <p className="mt-2 text-xs font-bold leading-5 text-black/50">
                Ortalama fiyata göre {formatDealDifference(deal.differencePercent)}.
              </p>
              <div className="mt-4 grid gap-2 border-t border-black/7 pt-4 text-xs font-semibold text-black/50">
                <span className="inline-flex items-center gap-2">
                  <Store size={14} /> {deal.listing.source}
                </span>
                <span className="inline-flex items-center gap-2">
                  <CalendarDays size={14} /> {formatDate(deal.listing.createdAt)}
                </span>
              </div>
              {deal.listing.url ? (
                <a
                  href={deal.listing.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="orange-button mt-4 py-2.5 text-sm"
                >
                  İlana git <ArrowUpRight size={16} />
                </a>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState text="Bu ürün için fırsat karşılaştırması yapılacak ilan bulunmuyor." />
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
    <section className="mt-8 rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
      <SectionTitle icon={Store} eyebrow="Alternatifler" title="Benzer Ürünler" />
      {products.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/product/${product.slug}`}
              className="group min-w-0 rounded-2xl border border-black/8 bg-[#fafaf8] p-5 transition hover:-translate-y-0.5 hover:border-[#ff6b00]/30 hover:bg-white hover:shadow-[0_18px_45px_rgba(0,0,0,0.06)]"
            >
              {product.category ? (
                <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] font-black text-black/45">
                  {product.category}
                </span>
              ) : null}
              <h3 className="mt-4 break-words text-lg font-black leading-6 group-hover:text-[#ff6b00]">
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
              <p className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#ff6b00]">
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
    <div className="min-w-0 rounded-xl border border-black/8 bg-white p-3">
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
    <section className="rounded-3xl border border-[#ff6b00]/20 bg-[#fff7f1] p-5 shadow-[0_18px_60px_rgba(255,107,0,0.08)] sm:p-8">
      <SectionTitle
        icon={ChartNoAxesCombined}
        eyebrow="Karar destek motoru"
        title="2ElBul Intelligence"
      />
      <div className="mt-5 rounded-2xl border border-[#ff6b00]/20 bg-white p-4">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-[#d95700]">
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
    <div className="min-w-0 rounded-2xl border border-black/8 bg-white p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-black/35">
        {label}
      </p>
      <p className="mt-2 truncate text-base font-black" title={value}>
        {value}
      </p>
      <span className="mt-3 inline-flex max-w-full truncate rounded-full bg-[#fff1e7] px-3 py-1 text-[11px] font-black text-[#d95700]">
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
    <section className="rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
      <SectionTitle
        icon={Clock3}
        eyebrow="Karar destek"
        title="Satın Alma Tavsiyesi"
      />

      <div className="mt-5 rounded-2xl border border-black/8 bg-[#fafaf8] p-4">
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
    <section className="rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
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
            className="rounded-2xl border border-black/8 bg-[#fafaf8] px-4 py-3 text-sm font-semibold leading-6 text-black/58"
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
              className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-800"
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
    <section className="rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
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
          className="h-full rounded-full bg-[#ff6b00]"
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
            className="rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-bold leading-6 text-green-800"
          >
            {reason}
          </p>
        ))}
        {insight.warnings.map((warning) => (
          <p
            key={warning}
            className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-800"
          >
            <TriangleAlert className="mt-0.5 shrink-0" size={17} />
            {warning}
          </p>
        ))}
      </div>
    </section>
  );
}

function BestDealCard({
  listing,
  averagePrice,
  discountPercent,
  priceStats,
  isFavorite,
  isAuthenticated,
  loginNext,
}: {
  listing: Listing | null;
  averagePrice: number;
  discountPercent: number | null;
  priceStats: ProductPriceStats | null;
  isFavorite: boolean;
  isAuthenticated: boolean;
  loginNext: string;
}) {
  if (!listing) {
    return (
      <section className="rounded-3xl border border-dashed border-black/15 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
        <SectionTitle icon={Tag} eyebrow="En iyi fırsat" title="Henüz ilan yok" />
        <p className="mt-5 text-sm font-semibold leading-6 text-black/45">
          Bu ürün için yayında ilan geldiğinde en düşük fiyatlı seçenek burada görünecek.
        </p>
      </section>
    );
  }

  const priceAnalysis = analyzeListingPrice(listing.price, priceStats);
  const discountText =
    discountPercent !== null && averagePrice
      ? `Ortalama fiyata göre %${discountPercent} daha ucuz.`
      : "Karşılaştırma için daha fazla fiyat verisi gerekiyor.";

  return (
    <section className="rounded-3xl border border-[#ff6b00]/20 bg-[#fff7f1] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
      <SectionTitle icon={Tag} eyebrow="En iyi fırsat" title="En düşük fiyatlı ilan" />
      <div className="mt-5">
        <ListingImage
          imageUrl={listing.imageUrl}
          productName={listing.productName}
          alt={listing.title}
        />
      </div>
      <h3 className="mt-4 break-words text-lg font-black leading-6">
        {listing.title}
      </h3>
      <p className="mt-3 text-3xl font-black tracking-[-0.05em] text-[#ff6b00]">
        {formatPrice(listing.price)}
      </p>
      <p className="mt-3 text-sm font-bold text-black/60">{discountText}</p>
      <span
        className={`mt-4 inline-flex rounded-full border px-3 py-1.5 text-xs font-black ${priceAnalysis.className}`}
      >
        {priceAnalysis.label}
      </span>
      <div className="mt-5 flex flex-wrap items-center gap-3 text-sm font-semibold text-black/55">
        <span className="inline-flex items-center gap-2">
          <Store size={16} /> {listing.source}
        </span>
        <span className="inline-flex items-center gap-2">
          <CalendarDays size={16} /> {formatDate(listing.createdAt)}
        </span>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="orange-button flex-1 py-3"
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
      </div>
    </section>
  );
}

function PriceAnalysisBox({
  stats,
  analysis,
}: {
  stats: ProductPriceStats | null;
  analysis: ListingPriceAnalysis;
}) {
  return (
    <section className="mt-8 rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
      <SectionTitle
        icon={ChartNoAxesCombined}
        eyebrow="Akıllı fiyat analizi"
        title="Piyasaya göre fiyat durumu"
      />
      <p className="mt-4 text-sm leading-6 text-black/55">
        Bu analiz aynı ürüne ait aktif ilanlar üzerinden hesaplanır.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <AnalysisStat label="Ortalama fiyat" value={stats ? formatPrice(stats.average) : "—"} />
        <AnalysisStat label="En düşük fiyat" value={stats ? formatPrice(stats.min) : "—"} />
        <AnalysisStat label="En yüksek fiyat" value={stats ? formatPrice(stats.max) : "—"} />
        <AnalysisStat label="İlan sayısı" value={stats ? String(stats.count) : "0"} />
        <div className="rounded-2xl border border-black/8 bg-[#fafaf8] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.07em] text-black/40">
            Fırsat etiketi
          </p>
          <span
            className={`mt-3 inline-flex rounded-full border px-3 py-1.5 text-xs font-black ${analysis.className}`}
          >
            {analysis.label}
          </span>
        </div>
      </div>
    </section>
  );
}

function AnalysisStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/8 bg-[#fafaf8] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.07em] text-black/40">
        {label}
      </p>
      <p className="mt-2 break-words text-lg font-black">{value}</p>
    </div>
  );
}

function ListingCard({
  listing,
  priceStats,
  isFavorite,
  isAuthenticated,
  loginNext,
  matchKey,
}: {
  listing: Listing;
  priceStats: ProductPriceStats | null;
  isFavorite: boolean;
  isAuthenticated: boolean;
  loginNext: string;
  matchKey?: string;
}) {
  const priceAnalysis = analyzeListingPrice(listing.price, priceStats);

  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-black/8 bg-[#fafaf8] p-5">
      <ListingImage
        imageUrl={listing.imageUrl}
        productName={listing.productName}
        alt={listing.title}
      />
      <div className="mt-4 flex items-start justify-between gap-3">
        <span
          className={`rounded-full px-3 py-1.5 text-xs font-bold ${
            listing.condition === "Yenilenmiş"
              ? "border border-sky-200 bg-sky-50 text-sky-700"
              : "bg-white text-black/50"
          }`}
        >
          {listing.condition}
        </span>
        <FavoriteButton
          listingId={listing.id}
          initialIsFavorite={isFavorite}
          isAuthenticated={isAuthenticated}
          loginNext={loginNext}
          compact
        />
      </div>
      <h3 className="mt-4 break-words font-black leading-6">{listing.title}</h3>
      <p className="mt-3 text-2xl font-black tracking-[-0.04em] text-[#ff6b00]">
        {formatPrice(listing.price)}
      </p>
      <span
        className={`mt-3 inline-flex w-fit rounded-full border px-3 py-1.5 text-xs font-black ${priceAnalysis.className}`}
      >
        {priceAnalysis.label}
      </span>
      <div className="mt-5 grid gap-2.5 border-t border-black/7 pt-4 text-sm text-black/55">
        <p className="flex items-center gap-2">
          <MapPin size={16} /> {listing.city}
        </p>
        <p className="flex items-center gap-2">
          <Store size={16} /> {listing.source}
        </p>
        <p className="flex items-center gap-2">
          <Tag size={16} /> {listing.condition}
        </p>
        <p className="flex items-center gap-2">
          <CalendarDays size={16} /> {formatDate(listing.createdAt)}
        </p>
        {matchKey ? (
          <p className="flex items-center gap-2 break-all">
            <Tag size={16} /> Eşleşme: {matchKey}
          </p>
        ) : null}
      </div>
      <a
        href={listing.url}
        target="_blank"
        rel="noopener noreferrer"
        className="orange-button mt-5 py-3"
      >
        İlana git <ArrowUpRight size={17} />
      </a>
    </article>
  );
}

function SectionTitle({
  icon: Icon,
  eyebrow,
  title,
}: {
  icon: typeof Tag;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="flex items-end gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#fff1e7] text-[#ff6b00]">
        <Icon size={21} />
      </span>
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ff6b00]">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-2xl font-black tracking-[-0.035em]">
          {title}
        </h2>
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
      className={`min-w-0 rounded-2xl border p-4 sm:p-5 ${
        accent
          ? "border-[#ff6b00]/20 bg-[#fff7f1]"
          : "border-black/8 bg-white"
      } ${wide ? "min-[420px]:col-span-2 lg:col-span-1" : ""}`}
    >
      <p className="text-xs font-bold uppercase tracking-[0.07em] text-black/40">
        {label}
      </p>
      <p
        className={`mt-2 break-words text-lg font-black tracking-[-0.03em] ${
          accent ? "text-[#ff6b00]" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-black/15 bg-[#fafaf8] px-6 py-10 text-center text-sm font-semibold text-black/45">
      {text}
    </div>
  );
}

function buildListingPriceHistory(
  listings: Listing[],
): ListingPriceHistoryPoint[] {
  const grouped = new Map<string, number[]>();

  for (const listing of listings) {
    const date = getListingHistoryDate(listing);
    if (!date || !Number.isFinite(listing.price) || listing.price <= 0) continue;
    grouped.set(date, [...(grouped.get(date) ?? []), listing.price]);
  }

  return [...grouped.entries()]
    .map(([date, prices]) => {
      const total = prices.reduce((sum, price) => sum + price, 0);
      return {
        date,
        average: Math.round(total / prices.length),
        lowest: Math.min(...prices),
        count: prices.length,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

function getListingHistoryDate(listing: Listing) {
  const rawDate = listing.createdAt || listing.updatedAt;
  if (!rawDate) return null;
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
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
  label: ProductIntelligence["decisionSupport"]["label"],
) {
  if (label === "Şimdi Al") return "border-green-200 bg-green-50 text-green-700";
  if (label === "Bekle") return "border-blue-200 bg-blue-50 text-blue-700";
  if (label === "Takip Et") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-600";
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
    category: product.category ?? undefined,
    url: productUrl,
    brand: brandName ?? undefined,
    offers,
  };
}

function getAbsoluteUrl(path: string) {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://2elbul.vercel.app";
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
