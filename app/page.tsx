import Link from "next/link";
import {
  ArrowUpRight,
  BadgePercent,
  BarChart3,
  Clock3,
  Flame,
  FolderSearch2,
  PackageSearch,
  MapPin,
  Search,
  Smartphone,
  Store,
  TrendingDown,
  TriangleAlert,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ListingImage } from "@/components/listing-image";
import { SearchBar } from "@/components/search-bar";
import { createProductSlug } from "@/lib/product-slug";
import {
  getHomeData,
  type HomeListing,
  type PriceOpportunity,
  type PriceDrop,
} from "@/lib/home-data";

export const dynamic = "force-dynamic";

const features = [
  {
    title: "Piyasa Fiyatı",
    description: "Gerçek piyasa değerini öğren",
    icon: BarChart3,
  },
  {
    title: "En Ucuz İlanlar",
    description: "Farklı platformları karşılaştır",
    icon: Search,
  },
  {
    title: "Şüpheli Fiyat Uyarısı",
    description: "Dolandırıcılık risklerini gör",
    icon: TriangleAlert,
  },
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
    refurbishedListings,
    priceOpportunities,
    last24HourListings,
    sourceSummary,
    popularProducts,
    popularListedProducts,
    priceDrops,
    popularCategories,
    error,
  } = await getHomeData();

  return (
    <>
      <section className="relative flex min-h-[calc(100vh-145px)] items-center overflow-hidden bg-white py-9 sm:py-24">
        <div className="absolute -right-24 top-8 size-80 rounded-full bg-[#ff6b00]/6 blur-3xl" />
        <div className="absolute -left-24 bottom-0 size-72 rounded-full bg-black/4 blur-3xl" />

        <div className="container-shell relative text-center">
          <div className="mb-5 flex justify-center sm:mb-7">
            <BrandLogo size="lg" linked={false} centered />
          </div>

          <h1 className="mx-auto max-w-4xl text-[28px] font-black leading-[1.04] tracking-[-0.04em] min-[420px]:text-3xl sm:text-6xl sm:leading-[1.08] sm:tracking-[-0.055em] lg:text-7xl">
            En uygun ikinci el ilanları{" "}
            <span className="text-[#ff6b00]">tek yerde bul.</span>
          </h1>

          <div className="mt-5 inline-flex max-w-full items-center gap-2 rounded-full border border-[#ff6b00]/15 bg-[#fff7f1] px-3 py-2 text-xs font-bold text-[#d95700] sm:px-4 sm:text-sm">
            <span className="size-2 rounded-full bg-[#ff6b00] shadow-[0_0_0_4px_rgba(255,107,0,0.12)]" />
            Güncel ikinci el ilanları taranıyor
          </div>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-black/55 sm:text-lg">
            İkinci el piyasasını tara, en doğru fiyatı bul.
          </p>

          <div className="mx-auto mt-8 w-full max-w-4xl sm:mt-10">
            <SearchBar actionPath="/search" showLocation={false} />
          </div>

          <div className="mx-auto mt-8 grid w-full max-w-4xl grid-cols-1 gap-3 text-left sm:grid-cols-3">
            {features.map(({ title, description, icon: Icon }) => (
              <div
                key={title}
                className="flex min-w-0 items-center gap-4 rounded-2xl border border-black/8 bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)]"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#fff1e7] text-[#ff6b00]">
                  <Icon size={21} strokeWidth={2.2} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-black">{title}</h2>
                  <p className="mt-1 text-xs leading-5 text-black/45">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {popularProducts.length > 0 && (
            <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
              <span className="text-sm font-bold text-black/45">
                Popüler aramalar:
              </span>
              <div className="flex flex-wrap justify-center gap-2">
                {popularProducts.map((item) => (
                  <Link
                    key={item.productName}
                    href={`/search?q=${encodeURIComponent(item.productName)}`}
                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold transition hover:border-[#ff6b00]/40 hover:bg-[#fff7f1] hover:text-[#e75f00]"
                  >
                    {item.productName}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {error && (
        <div className="container-shell pt-10">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center text-sm font-semibold text-amber-800">
            {error}
          </div>
        </div>
      )}

      <HomeSection
        eyebrow="Güncel piyasa"
        title="Son 24 saatte eklenenler"
        icon={Clock3}
      >
        {last24HourListings.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {last24HourListings.map((listing) => (
              <CompactListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <EmptyState text="Henüz Supabase'de gösterilecek ilan bulunmuyor." />
        )}
      </HomeSection>

      <HomeSection
        eyebrow="Kontrollü alternatifler"
        title="Yenilenmiş cihaz fırsatları"
        icon={Smartphone}
        muted
      >
        {refurbishedListings.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {refurbishedListings.map((listing) => (
              <CompactListingCard
                key={listing.id}
                listing={listing}
                badge="Yenilenmiş"
              />
            ))}
          </div>
        ) : (
          <EmptyState text="Yayınlanmış yenilenmiş cihaz ilanı henüz bulunmuyor." />
        )}
      </HomeSection>

      <HomeSection
        eyebrow="Piyasanın altında"
        title="En ucuz ilanlar"
        icon={BadgePercent}
      >
        {priceOpportunities.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {priceOpportunities.map((listing) => (
              <OpportunityCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <EmptyState text="Fiyat karşılaştırması için henüz yeterli ilan bulunmuyor." />
        )}
      </HomeSection>

      <HomeSection
        eyebrow="Platform dağılımı"
        title="Kaynaklara göre ilanlar"
        icon={Store}
        muted
      >
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
      </HomeSection>

      <HomeSection
        eyebrow="Piyasa özeti"
        title="Popüler ürünler"
        icon={PackageSearch}
      >
        {popularListedProducts.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
            {popularListedProducts.map((product) => (
              <Link
                key={product.productName}
                href={`/product/${createProductSlug(product.productName)}`}
                className="min-w-0 rounded-2xl border border-black/8 bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#ff6b00]/35 hover:shadow-[0_12px_35px_rgba(0,0,0,0.05)] sm:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 break-words font-black">
                    {product.productName}
                  </h3>
                  <span className="shrink-0 rounded-full bg-[#fff1e7] px-2.5 py-1 text-xs font-black text-[#d95700]">
                    {product.listingCount} ilan
                  </span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-black/7 pt-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-black/40">
                      En düşük
                    </p>
                    <p className="mt-1 text-sm font-black text-[#ff6b00] sm:text-base">
                      {formatPrice(product.lowestPrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-black/40">
                      Ortalama
                    </p>
                    <p className="mt-1 text-sm font-black sm:text-base">
                      {formatPrice(product.averagePrice)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState text="Ürün istatistikleri ilanlar eklendikçe burada görünecek." />
        )}
      </HomeSection>

      <HomeSection
        eyebrow="Arama trendleri"
        title="En çok aranan ürünler"
        icon={Flame}
      >
        {popularProducts.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {popularProducts.map((product, index) => (
              <Link
                key={product.productName}
                href={`/product/${createProductSlug(product.productName)}`}
                className="rounded-2xl border border-black/8 bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#ff6b00]/35 sm:p-5"
              >
                <span className="text-xs font-black text-[#ff6b00]">
                  #{index + 1}
                </span>
                <h3 className="mt-2 text-sm font-black sm:text-base">
                  {product.productName}
                </h3>
                <p className="mt-3 text-xs text-black/45">
                  {product.searchCount} arama
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState text="Arama trendleri, kullanıcı aramaları arttıkça burada görünecek." />
        )}
      </HomeSection>

      <HomeSection
        eyebrow="Fiyat hareketleri"
        title="Son 24 saatte düşen fiyatlar"
        icon={TrendingDown}
      >
        {priceDrops.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {priceDrops.map((listing) => (
              <PriceDropCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <EmptyState text="Son 24 saatte kaydedilmiş bir fiyat düşüşü bulunmuyor." />
        )}
      </HomeSection>

      <HomeSection
        eyebrow="Ürün grupları"
        title="Popüler kategoriler"
        icon={FolderSearch2}
        muted
      >
        {popularCategories.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {popularCategories.map((category) => (
              <div
                key={category.name}
                className="rounded-2xl border border-black/8 bg-white p-4 sm:p-5"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-[#fff1e7] text-[#ff6b00]">
                  <FolderSearch2 size={19} />
                </span>
                <h3 className="mt-5 text-sm font-black">{category.name}</h3>
                <p className="mt-1 text-xs text-black/45">
                  {category.listingCount} ilan
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="Ürünlere kategori atandığında popüler kategoriler burada görünecek." />
        )}
      </HomeSection>
    </>
  );
}

function HomeSection({
  eyebrow,
  title,
  icon: Icon,
  muted = false,
  children,
}: {
  eyebrow: string;
  title: string;
  icon: typeof Clock3;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`border-t border-black/7 py-12 sm:py-16 ${
        muted ? "bg-[#fafaf8]" : "bg-white"
      }`}
    >
      <div className="container-shell">
        <div className="mb-7 flex items-end gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#fff1e7] text-[#ff6b00]">
            <Icon size={21} />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ff6b00]">
              {eyebrow}
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
              {title}
            </h2>
          </div>
        </div>
        {children}
      </div>
    </section>
  );
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

function PriceDropCard({ listing }: { listing: PriceDrop }) {
  return (
    <article className="rounded-2xl border border-green-200 bg-green-50/50 p-5">
      <ListingImage
        imageUrl={listing.imageUrl}
        productName={listing.productName}
        alt={listing.title}
      />
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="rounded-full bg-green-100 px-3 py-1.5 text-xs font-black text-green-700">
          %{listing.discountRate} düştü
        </span>
        <span className="text-xs text-black/35">{listing.productName}</span>
      </div>
      <h3 className="mt-4 text-base font-black">{listing.title}</h3>
      <div className="mt-3 flex items-end gap-2">
        <span className="text-2xl font-black text-green-700">
          {formatPrice(listing.price)}
        </span>
        <span className="pb-1 text-sm text-black/35 line-through">
          {formatPrice(listing.previousPrice)}
        </span>
      </div>
      <a
        href={listing.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-green-700 hover:underline"
      >
        İlana git <ArrowUpRight size={16} />
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
