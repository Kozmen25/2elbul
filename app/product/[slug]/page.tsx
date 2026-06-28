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
  const lowestPrice = marketStats?.lowest ?? 0;
  const highestPrice = marketStats?.highest ?? 0;
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

        <div className="mt-8 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Toplam ilan" value={`${listingCount}`} />
          <StatCard
            label="Piyasa değeri"
            value={listingCount ? formatPrice(marketValue) : "—"}
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
            label="Son ilan tarihi"
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
          favoriteIds={favoriteIds}
          isAuthenticated={isAuthenticated}
          loginNext={loginNext}
          emptyMessage="Bu ürün için henüz yeni ilan bulunmuyor."
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
  favoriteIds,
  isAuthenticated,
  loginNext,
  emptyMessage,
}: {
  eyebrow: string;
  title: string;
  icon: typeof Tag;
  listings: Listing[];
  favoriteIds: Set<string>;
  isAuthenticated: boolean;
  loginNext: string;
  emptyMessage: string;
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

function ListingCard({
  listing,
  isFavorite,
  isAuthenticated,
  loginNext,
}: {
  listing: Listing;
  isFavorite: boolean;
  isAuthenticated: boolean;
  loginNext: string;
}) {
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

function countBy<T>(items: T[], getKey: (item: T) => string) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
