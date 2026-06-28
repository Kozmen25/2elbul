import type { Metadata } from "next";
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
import { PriceHistoryChart } from "@/components/price-history-chart";
import type { Listing } from "@/lib/listings";
import {
  buildDailyPriceHistory,
  calculateMarketStats,
  summarizePriceHistory,
} from "@/lib/price-insights";
import {
  analyzeListingPrice,
  buildProductPriceStats,
  type ListingPriceAnalysis,
  type ProductPriceStats,
} from "@/lib/price-analysis";
import {
  getProductBySlug,
  getProductDetail,
} from "@/lib/product-detail";
import { createSupabaseServerClient } from "@/lib/supabase-server";

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
    };
  }

  return {
    title: `${product.name} ikinci el fiyatları | 2ElBul`,
    description: `${product.name} için ikinci el ilanları, ortalama fiyat, en ucuz ilanlar ve piyasa değeri.`,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const detail = await getProductDetail(slug);
  if (!detail) notFound();

  const { product, listings, priceHistory } = detail;
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
  const dailyPriceHistory = buildDailyPriceHistory(priceHistory);
  const priceHistorySummary = summarizePriceHistory(dailyPriceHistory);
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

  if (serverSupabase && authData.user && listings.length > 0) {
    const { data, error } = await serverSupabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", authData.user.id)
      .in(
        "listing_id",
        listings.map((listing) => listing.id),
      );

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
  const priceComment = buildPriceComment({
    productName: product.name,
    listingCount,
    averagePrice,
    bestDealListing,
    bestDealDiscount,
  });

  return (
    <main className="min-w-0 bg-[#fafaf8] py-10 sm:py-14">
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

        <div className="mt-6 max-w-md">
          <PriceAlertForm
            productId={product.id}
            productName={product.name}
            suggestedPrice={listingCount ? lowestPrice : null}
            isAuthenticated={isAuthenticated}
            loginNext={loginNext}
          />
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)]">
          <section className="rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
            <SectionTitle
              icon={ChartNoAxesCombined}
              eyebrow="Fiyat yorumu"
              title="Akıllı piyasa özeti"
            />
            <p className="mt-5 text-base font-semibold leading-8 text-black/65">
              {priceComment}
            </p>
            <p className="mt-4 text-sm leading-6 text-black/45">
              Bu yorum aynı ürüne bağlı aktif ilan fiyatlarından kural tabanlı olarak üretilir.
            </p>
          </section>

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

        <section className="mt-8 min-w-0 rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
          <SectionTitle
            icon={ChartNoAxesCombined}
            eyebrow="Fiyat geçmişi"
            title="Piyasa fiyat hareketi"
          />
          <PriceHistoryChart
            points={dailyPriceHistory}
            summary={priceHistorySummary}
          />
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
          listings={listings}
          priceStats={productPriceStats}
          favoriteIds={favoriteIds}
          isAuthenticated={isAuthenticated}
          loginNext={loginNext}
          emptyMessage="Ürün var ancak bu ürüne bağlı yayında ilan bulunmuyor."
          matchKey={product.slug}
        />

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

function buildPriceComment({
  productName,
  listingCount,
  averagePrice,
  bestDealListing,
  bestDealDiscount,
}: {
  productName: string;
  listingCount: number;
  averagePrice: number;
  bestDealListing: Listing | null;
  bestDealDiscount: number | null;
}) {
  if (!listingCount) {
    return `${productName} için henüz yayında ilan bulunmuyor. Yeni veri geldikçe fiyat özeti otomatik oluşacak.`;
  }

  if (!bestDealListing || !averagePrice || bestDealDiscount === null) {
    return `${productName} için fiyat bilgisi sınırlı. Daha fazla ilan geldikçe ortalama fiyat ve fırsat yorumu netleşecek.`;
  }

  if (bestDealDiscount > 0) {
    return `Bu ürünün ortalama ikinci el fiyatı ${formatPrice(averagePrice)}. En ucuz ilan ${formatPrice(bestDealListing.price)} ile ortalamanın %${bestDealDiscount} altında görünüyor.`;
  }

  return `Bu ürünün ortalama ikinci el fiyatı ${formatPrice(averagePrice)}. En ucuz ilan ${formatPrice(bestDealListing.price)} seviyesinde ve ortalamaya yakın görünüyor.`;
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
