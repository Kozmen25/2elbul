import {
  ArrowUpRight,
  CalendarDays,
  Heart,
  MapPin,
  Store,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FavoriteButton } from "@/components/favorite-button";
import { FollowedProductsList, type FollowedProduct } from "@/components/followed-products-list";
import { ListingImage } from "@/components/listing-image";
import { formatCurrencyTRY, formatDateTR } from "@/lib/formatters";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { listingOutboundPath } from "@/lib/listing-links";

export const metadata: Metadata = {
  title: "Favorilerim | 2ElBul",
  robots: {
    index: false,
    follow: false,
  },
};

const LISTED_STATUSES = ["published", "active"];

const formatPrice = (price: number) => formatCurrencyTRY(price);

const formatDate = (date: string) =>
  formatDateTR(date, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default async function FavoritesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: authData } = (await supabase?.auth.getUser()) ?? {
    data: { user: null },
  };

  if (!supabase || !authData.user) {
    redirect("/giris?next=/favoriler");
  }

  // One query: each favorite with its listing and product. The listing comes
  // back even after it was taken down (RLS lets users read what they follow),
  // so it can be shown as "no longer listed" instead of silently vanishing.
  const { data: favorites, error: favoritesError } = await supabase
    .from("favorites")
    .select(
      "listing_id, created_at, listings(id, title, price, previous_price, city, source, url, condition, image_url, created_at, status, products(name, slug))",
    )
    .eq("user_id", authData.user.id)
    .order("created_at", { ascending: false });

  if (favoritesError) {
    console.error("Supabase favorites page query failed:", favoritesError);
  }

  const listings = (favorites ?? []).flatMap((favorite) => {
    const listing = favorite.listings;
    if (!listing) return [];
    return [
      {
        id: String(listing.id),
        productName: listing.products?.name ?? "Ürün",
        productSlug: listing.products?.slug ?? null,
        title: listing.title,
        price: Number(listing.price),
        previousPrice: listing.previous_price == null ? null : Number(listing.previous_price),
        city: listing.city ?? "",
        source: listing.source,
        url: listing.url ?? "",
        condition: listing.condition,
        imageUrl: listing.image_url,
        createdAt: listing.created_at,
        isListed: LISTED_STATUSES.includes(listing.status),
      },
    ];
  });

  const hasError = Boolean(favoritesError);

  const { data: follows, error: followsError } = await supabase
    .from("product_follows")
    .select("product_id, products(name, slug)")
    .eq("user_id", authData.user.id)
    .order("created_at", { ascending: false });
  if (followsError) console.error("Supabase product follows page query failed:", followsError);

  const followedIds = (follows ?? []).map((follow) => follow.product_id);
  const { data: priceRows } = followedIds.length
    ? await supabase
        .from("product_price_stats")
        .select("product_id, min_price, listing_count")
        .in("product_id", followedIds)
    : { data: [] };
  const priceByProduct = new Map(
    (priceRows ?? []).flatMap((row) => (row.product_id == null ? [] : [[row.product_id, row] as const])),
  );
  const followedProducts: FollowedProduct[] = (follows ?? []).map((follow) => {
    const stats = priceByProduct.get(follow.product_id);
    return {
      productId: String(follow.product_id),
      name: follow.products?.name ?? "Ürün",
      slug: follow.products?.slug ?? null,
      lowestPrice: stats?.min_price != null ? Number(stats.min_price) : null,
      listingCount: stats?.listing_count ?? 0,
    };
  });

  return (
    <section className="min-h-[calc(100vh-145px)] bg-[#fafaf8] py-10 sm:py-14">
      <div className="container-shell">
        <div className="mb-8">
          <span className="grid size-12 place-items-center rounded-2xl bg-[#E4ECFF] text-[#3B66E0]">
            <Heart size={23} fill="currentColor" />
          </span>
          <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
            Favorilerim
          </h1>
          <p className="mt-2 text-black/50">
            Kaydettiğin ilanları tek yerde karşılaştır, takip ettiğin ürünleri izle.
          </p>
        </div>

        {hasError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700">
            Favoriler yüklenirken bir sorun oluştu. Veritabanı kurulumunu kontrol
            edip tekrar deneyin.
          </div>
        ) : listings.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {listings.map((listing) => (
              <article
                key={listing.id}
                className={`flex flex-col rounded-2xl border border-black/9 bg-white p-5 transition hover:border-[#3B66E0]/35 hover:shadow-[0_14px_40px_rgba(0,0,0,0.07)] ${
                  listing.isListed ? "" : "opacity-75"
                }`}
              >
                {!listing.isListed && (
                  <p className="mb-3 rounded-lg bg-amber-100 px-3 py-2 text-xs font-black text-amber-800">
                    Bu ilan artık yayında değil
                  </p>
                )}
                <ListingImage
                  imageUrl={listing.imageUrl}
                  productName={listing.productName}
                  alt={listing.title}
                />
                <div className="mt-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-[#3B66E0]">
                      {listing.productName}
                    </p>
                    <h2 className="mt-2 font-black leading-6">{listing.title}</h2>
                  </div>
                  <FavoriteButton
                    listingId={listing.id}
                    initialIsFavorite
                    isAuthenticated
                    loginNext="/favoriler"
                    compact
                  />
                </div>

                <p className="mt-4 text-2xl font-black tracking-[-0.04em] text-[#3B66E0]">
                  {formatPrice(listing.price)}
                </p>
                {listing.isListed &&
                listing.previousPrice !== null &&
                listing.previousPrice > listing.price ? (
                  <p className="mt-1 text-xs font-bold text-green-700">
                    Fiyat düştü: önceki {formatPrice(listing.previousPrice)}
                  </p>
                ) : null}
                <p className="mt-2 text-xs font-bold text-black/40">
                  {listing.condition}
                </p>

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

                <div className="mt-5 grid gap-2">
                  {listing.isListed && listing.url ? (
                    <a
                      href={listingOutboundPath(listing.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="orange-button py-3"
                    >
                      İlana git <ArrowUpRight size={17} />
                    </a>
                  ) : null}
                  {listing.productSlug ? (
                    <Link
                      href={`/product/${listing.productSlug}`}
                      className="rounded-xl border border-black/10 px-4 py-3 text-center text-sm font-bold text-black/65 transition hover:border-[#3B66E0]/35 hover:text-[#2A4FBF]"
                    >
                      Fiyat analizini gör
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-black/15 bg-white px-6 py-16 text-center">
            <Heart size={30} className="mx-auto text-black/20" />
            <h2 className="mt-4 text-xl font-black">
              Henüz favori ilanınız yok.
            </h2>
            <p className="mt-2 text-sm text-black/45">
              Arama sonuçlarındaki kalp düğmesine basarak ilanları kaydedebilirsin.
            </p>
            <a href="/search" className="orange-button mt-6 px-5 py-3">
              İlan ara
            </a>
          </div>
        )}

        <div className="mt-14">
          <h2 className="text-2xl font-black tracking-[-0.04em]">Takip ettiğim ürünler</h2>
          <p className="mt-2 mb-5 text-sm text-black/50">
            Fiyatı düşünce ya da daha uygun yeni ilan gelince bildirim alırsın. Aramalarını ve fiyat alarmlarını{" "}
            <Link href="/hesabim" className="font-bold text-[#2A4FBF] hover:underline">
              hesabından
            </Link>{" "}
            yönetebilirsin.
          </p>
          <FollowedProductsList products={followedProducts} />
        </div>
      </div>
    </section>
  );
}
