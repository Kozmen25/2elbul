"use client";

import {
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  MapPin,
  RotateCcw,
  SlidersHorizontal,
  Store,
  Tag,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FavoriteButton } from "@/components/favorite-button";
import { ListingImage } from "@/components/listing-image";
import { LISTING_CONDITIONS, type Listing } from "@/lib/listings";
import {
  analyzeListingPrice,
  type ProductPriceStats,
} from "@/lib/price-analysis";
import { calculateOpportunityRating } from "@/lib/price-insights";
import { createProductSlug } from "@/lib/product-slug";
import { recordSearch } from "./actions";

type SortOption = "price-asc" | "price-desc" | "newest";

type SearchResultsClientProps = {
  query: string;
  initialListings: Listing[];
  productPriceStats: Record<string, ProductPriceStats>;
  loadError?: string;
  favoriteListingIds: string[];
  isAuthenticated: boolean;
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

export function SearchResultsClient({
  query,
  initialListings,
  productPriceStats,
  loadError = "",
  favoriteListingIds,
  isAuthenticated,
}: SearchResultsClientProps) {
  const [city, setCity] = useState("");
  const [source, setSource] = useState("");
  const [condition, setCondition] = useState("");
  const [minimumPrice, setMinimumPrice] = useState("");
  const [maximumPrice, setMaximumPrice] = useState("");
  const [sort, setSort] = useState<SortOption>("price-asc");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (!query) return;

    const trackingKey = `2elbul-search:${query.toLocaleLowerCase("tr-TR")}`;
    if (sessionStorage.getItem(trackingKey)) return;

    sessionStorage.setItem(trackingKey, "1");
    void recordSearch(query);
  }, [query]);

  const cities = useMemo(
    () => [...new Set(initialListings.map((listing) => listing.city))].sort(),
    [initialListings],
  );
  const sources = useMemo(
    () => [...new Set(initialListings.map((listing) => listing.source))].sort(),
    [initialListings],
  );

  const results = useMemo(() => {
    const min = minimumPrice === "" ? null : Number(minimumPrice);
    const max = maximumPrice === "" ? null : Number(maximumPrice);

    return initialListings
      .filter(
        (listing) =>
          (!city || listing.city === city) &&
          (!source || listing.source === source) &&
          (!condition || listing.condition === condition) &&
          (min === null || listing.price >= min) &&
          (max === null || listing.price <= max),
      )
      .sort((a, b) => {
        if (sort === "price-desc") return b.price - a.price;
        if (sort === "newest") {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return a.price - b.price;
      });
  }, [
    city,
    condition,
    initialListings,
    maximumPrice,
    minimumPrice,
    sort,
    source,
  ]);

  const prices = results.map((listing) => listing.price);
  const lowestPrice = prices.length ? Math.min(...prices) : 0;
  const highestPrice = prices.length ? Math.max(...prices) : 0;
  const averagePrice = prices.length
    ? Math.round(prices.reduce((total, price) => total + price, 0) / prices.length)
    : 0;
  const activeFilterCount = [
    city,
    source,
    condition,
    minimumPrice,
    maximumPrice,
  ].filter(Boolean).length;
  const favoriteIds = useMemo(
    () => new Set(favoriteListingIds),
    [favoriteListingIds],
  );
  const loginNext = query ? `/search?q=${encodeURIComponent(query)}` : "/search";

  function resetFilters() {
    setCity("");
    setSource("");
    setCondition("");
    setMinimumPrice("");
    setMaximumPrice("");
  }

  return (
    <section className="container-shell min-w-0 py-10 sm:py-14">
      <div className="mb-8">
        <p className="text-sm font-bold text-[#ff6b00]">Aranan ürün</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
          {query || "Bir ürün ara"}
        </h1>
        <p className="mt-2 text-black/45">
          {query
            ? `${results.length} ilan bulundu`
            : "Fiyatları karşılaştırmak için yukarıdaki kutudan arama yap."}
        </p>
      </div>

      {loadError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-10 text-center text-amber-800">
          <h2 className="text-lg font-black">İlanlar şu anda gösterilemiyor.</h2>
          <p className="mt-2 text-sm">{loadError}</p>
        </div>
      ) : initialListings.length > 0 ? (
        <>
          <div className="mb-6 flex items-center justify-between gap-3 lg:hidden">
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              className="flex flex-1 items-center justify-between rounded-xl border border-black/12 bg-white px-4 py-3.5 text-sm font-bold"
              aria-expanded={filtersOpen}
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal size={18} />
                Filtreler
                {activeFilterCount > 0 && (
                  <span className="grid size-5 place-items-center rounded-full bg-[#ff6b00] text-[11px] text-white">
                    {activeFilterCount}
                  </span>
                )}
              </span>
              {filtersOpen ? <X size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>

          <div
            className={`mb-8 rounded-2xl border border-black/9 bg-[#fafaf8] p-4 sm:p-5 ${
              filtersOpen ? "block" : "hidden"
            } lg:block`}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-black">
                <SlidersHorizontal size={18} className="text-[#ff6b00]" />
                Filtrele ve sırala
              </h2>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="flex items-center gap-1.5 text-xs font-bold text-black/50 hover:text-[#ff6b00]"
                >
                  <RotateCcw size={14} />
                  Temizle
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <FilterSelect label="Şehir" value={city} onChange={setCity}>
                <option value="">Tüm şehirler</option>
                {cities.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </FilterSelect>

              <FilterSelect label="Kaynak" value={source} onChange={setSource}>
                <option value="">Tüm kaynaklar</option>
                {sources.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </FilterSelect>

              <FilterSelect
                label="Durum"
                value={condition}
                onChange={setCondition}
              >
                <option value="">Tüm durumlar</option>
                {LISTING_CONDITIONS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </FilterSelect>

              <FilterInput
                label="Minimum fiyat"
                value={minimumPrice}
                onChange={setMinimumPrice}
                placeholder="0 TL"
              />
              <FilterInput
                label="Maksimum fiyat"
                value={maximumPrice}
                onChange={setMaximumPrice}
                placeholder="50.000 TL"
              />

              <FilterSelect
                label="Sıralama"
                value={sort}
                onChange={(value) => setSort(value as SortOption)}
                wide
              >
                <option value="price-asc">Ucuzdan pahalıya</option>
                <option value="price-desc">Pahalıdan ucuza</option>
                <option value="newest">En yeni</option>
              </FilterSelect>
            </div>
          </div>

          <div className="mb-10 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Bulunan ilan" value={`${results.length}`} />
            <StatCard
              label="En düşük fiyat"
              value={results.length ? formatPrice(lowestPrice) : "—"}
              accent
            />
            <StatCard
              label="Ortalama fiyat"
              value={results.length ? formatPrice(averagePrice) : "—"}
            />
            <StatCard
              label="En yüksek fiyat"
              value={results.length ? formatPrice(highestPrice) : "—"}
            />
          </div>

          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-xl font-black tracking-[-0.03em] sm:text-2xl">
              İlanlar
            </h2>
            <span className="text-sm font-semibold text-black/45">
              {sort === "price-desc"
                ? "Pahalıdan ucuza"
                : sort === "newest"
                  ? "En yeni"
                  : "Ucuzdan pahalıya"}
            </span>
          </div>

          {results.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {results.map((listing) => (
                <article
                  key={listing.id}
                  className="flex min-w-0 flex-col rounded-2xl border border-black/9 bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#ff6b00]/35 hover:shadow-[0_14px_40px_rgba(0,0,0,0.07)]"
                >
                  <ListingImage
                    imageUrl={listing.imageUrl}
                    productName={listing.productName}
                    alt={listing.title}
                  />
                  <div className="mb-4 mt-4 flex items-start justify-between gap-4">
                    <Link
                      href={`/product/${createProductSlug(listing.productName)}`}
                      className="min-w-0 truncate rounded-full bg-[#fff1e7] px-3 py-1.5 text-xs font-bold text-[#d95700] hover:bg-[#ffe5d2]"
                      title={`${listing.productName} ürün detayına git`}
                    >
                      {listing.productName}
                    </Link>
                    <FavoriteButton
                      listingId={listing.id}
                      initialIsFavorite={favoriteIds.has(listing.id)}
                      isAuthenticated={isAuthenticated}
                      loginNext={loginNext}
                      compact
                    />
                  </div>

                  <h3 className="min-h-12 break-words text-base font-black leading-6">
                    {listing.title}
                  </h3>
                  <p className="mt-3 text-2xl font-black tracking-[-0.04em] text-[#ff6b00]">
                    {formatPrice(listing.price)}
                  </p>
                  <SmartPriceRatingBadge
                    price={listing.price}
                    stats={
                      listing.productId
                        ? productPriceStats[listing.productId]
                        : undefined
                    }
                  />

                  <div className="mt-5 grid gap-2.5 border-t border-black/7 pt-4 text-sm text-black/55">
                    <p className="flex items-center gap-2">
                      <MapPin size={16} className="text-black/35" />
                      {listing.city}
                    </p>
                    <p className="flex items-center gap-2">
                      <Store size={16} className="text-black/35" />
                      {listing.source}
                    </p>
                    <p className="flex items-center gap-2">
                      <Tag size={16} className="text-black/35" />
                      <ConditionBadge condition={listing.condition} />
                    </p>
                    <p className="flex items-center gap-2">
                      <CalendarDays size={16} className="text-black/35" />
                      {formatDate(listing.createdAt)}
                    </p>
                  </div>

                  <a
                    href={listing.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="orange-button mt-5 w-full py-3"
                  >
                    İlana git
                    <ArrowUpRight size={17} />
                  </a>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-black/15 bg-[#fafaf8] px-6 py-16 text-center">
              <h2 className="text-xl font-black">Filtrelere uygun ilan bulunamadı.</h2>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 text-sm font-bold text-[#ff6b00] hover:underline"
              >
                Filtreleri temizle
              </button>
            </div>
          )}
        </>
      ) : query ? (
        <div className="rounded-2xl border border-dashed border-black/15 bg-[#fafaf8] px-6 py-16 text-center">
          <h2 className="text-xl font-black">
            Bu arama için henüz ilan bulunamadı.
          </h2>
        </div>
      ) : null}
    </section>
  );
}

function ConditionBadge({ condition }: { condition: string }) {
  return (
    <span
      className={
        condition === "Yenilenmiş"
          ? "rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-black text-sky-700"
          : ""
      }
    >
      {condition}
    </span>
  );
}

function SmartPriceRatingBadge({
  price,
  stats,
}: {
  price: number;
  stats: ProductPriceStats | undefined;
}) {
  const analysis = analyzeListingPrice(price, stats);

  return (
    <div className="mt-3">
      <span
        className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-bold ${analysis.className}`}
        title={
          analysis.average
            ? `Ortalama fiyat: ${formatPrice(analysis.average)}`
            : "Karşılaştırma için en az 3 aktif ilan gerekli"
        }
      >
        {analysis.label}
        {analysis.differencePercent !== null
          ? ` · %${Math.abs(analysis.differencePercent)} ${
              analysis.differencePercent < 0 ? "ucuz" : "pahalı"
            }`
          : ""}
      </span>
    </div>
  );
}

function PriceRatingBadge({
  price,
  averagePrice,
  listingCount,
}: {
  price: number;
  averagePrice: number;
  listingCount: number;
}) {
  const rating = calculateOpportunityRating(price, averagePrice, listingCount);
  const stars = "★★★★★".slice(0, rating.stars);

  return (
    <div className="mt-3">
      <span
        className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-bold ${rating.className}`}
        title={
          listingCount > 1
            ? `Piyasa değeri: ${formatPrice(Math.round(averagePrice))}`
            : "Karşılaştırılabilir tek ilan var"
        }
      >
        {stars} {rating.label}
        {listingCount > 1 && rating.percent !== 0
          ? ` · %${Math.abs(rating.percent)} ${
              rating.percent > 0 ? "ucuz" : "pahalı"
            }`
          : ""}
      </span>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
  wide = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "sm:col-span-2 lg:col-span-1" : ""}>
      <span className="mb-1.5 block text-xs font-bold text-black/50">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field h-12 px-3 text-sm font-semibold"
      >
        {children}
      </select>
    </label>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-bold text-black/50">{label}</span>
      <input
        type="number"
        min="0"
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="field h-12 px-3 text-sm font-semibold"
      />
    </label>
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
    <div
      className={`rounded-2xl border p-4 sm:p-5 ${
        accent
          ? "border-[#ff6b00]/20 bg-[#fff7f1]"
          : "border-black/8 bg-white"
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-black/40">
        {label}
      </p>
      <p
        className={`mt-2 text-xl font-black tracking-[-0.035em] sm:text-2xl ${
          accent ? "text-[#ff6b00]" : "text-black"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
