import type { Metadata } from "next";
import {
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  Clock3,
  MapPin,
  Store,
  Tag,
} from "lucide-react";
import { notFound } from "next/navigation";
import { FavoriteButton } from "@/components/favorite-button";
import { ListingImage } from "@/components/listing-image";
import type { Listing } from "@/lib/listings";
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

  const { product, listings } = detail;
  const prices = listings.map((listing) => listing.price);
  const listingCount = listings.length;
  const lowestPrice = listingCount ? Math.min(...prices) : 0;
  const highestPrice = listingCount ? Math.max(...prices) : 0;
  const averagePrice = listingCount
    ? Math.round(prices.reduce((total, price) => total + price, 0) / listingCount)
    : 0;
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

  const cityCounts = [...countBy(listings, (listing) => listing.city).entries()]
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city, "tr"));

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
            label="Son ilan tarihi"
            value={newestListing ? formatDate(newestListing.createdAt) : "—"}
            wide
          />
        </div>

        <section className="mt-8 min-w-0 rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
          <SectionTitle
            icon={ChartNoAxesCombined}
            eyebrow="Fiyat hareketi"
            title="Fiyat trendi"
          />
          <PriceTrendChart listings={listings} />
        </section>

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

        <section className="mt-8 rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
          <SectionTitle
            icon={MapPin}
            eyebrow="Konum analizi"
            title="Şehir dağılımı"
          />
          {cityCounts.length > 0 ? (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
      </div>
    </main>
  );
}

function PriceTrendChart({ listings }: { listings: Listing[] }) {
  const grouped = new Map<string, { total: number; count: number }>();
  for (const listing of listings) {
    const date = listing.createdAt.slice(0, 10);
    const current = grouped.get(date) ?? { total: 0, count: 0 };
    grouped.set(date, {
      total: current.total + listing.price,
      count: current.count + 1,
    });
  }

  const points = [...grouped.entries()]
    .map(([date, value]) => ({
      date,
      price: Math.round(value.total / value.count),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (points.length < 2) {
    return (
      <EmptyState text="Fiyat grafiği için daha fazla veri gerekli." />
    );
  }

  const width = 720;
  const height = 260;
  const paddingX = 34;
  const paddingY = 30;
  const minPrice = Math.min(...points.map((point) => point.price));
  const maxPrice = Math.max(...points.map((point) => point.price));
  const priceRange = Math.max(maxPrice - minPrice, 1);
  const coordinates = points.map((point, index) => ({
    ...point,
    x:
      paddingX +
      (index / Math.max(points.length - 1, 1)) * (width - paddingX * 2),
    y:
      paddingY +
      ((maxPrice - point.price) / priceRange) * (height - paddingY * 2),
  }));
  const polyline = coordinates
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

  return (
    <div className="mt-6 min-w-0">
      <div className="mb-3 flex flex-wrap justify-between gap-2 text-xs font-bold text-black/45">
        <span>En yüksek: {formatPrice(maxPrice)}</span>
        <span>En düşük: {formatPrice(minPrice)}</span>
      </div>
      <div className="w-full overflow-hidden rounded-2xl border border-black/8 bg-[#fafaf8] p-2 sm:p-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${points[0].date} ile ${points.at(-1)?.date} arasındaki fiyat trendi`}
          className="h-auto w-full"
        >
          <defs>
            <linearGradient id="priceArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff6b00" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#ff6b00" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((line) => {
            const y = paddingY + (line / 3) * (height - paddingY * 2);
            return (
              <line
                key={line}
                x1={paddingX}
                y1={y}
                x2={width - paddingX}
                y2={y}
                stroke="#e5e5e5"
                strokeDasharray="5 6"
              />
            );
          })}
          <polygon
            points={`${paddingX},${height - paddingY} ${polyline} ${width - paddingX},${height - paddingY}`}
            fill="url(#priceArea)"
          />
          <polyline
            points={polyline}
            fill="none"
            stroke="#ff6b00"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {coordinates.map((point) => (
            <circle
              key={point.date}
              cx={point.x}
              cy={point.y}
              r="5"
              fill="#ffffff"
              stroke="#ff6b00"
              strokeWidth="4"
            >
              <title>
                {formatDate(point.date)}: {formatPrice(point.price)}
              </title>
            </circle>
          ))}
        </svg>
      </div>
      <div className="mt-3 flex justify-between gap-4 text-xs text-black/40">
        <span>{formatDate(points[0].date)}</span>
        <span className="text-right">{formatDate(points.at(-1)!.date)}</span>
      </div>
    </div>
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
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-black/50">
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
