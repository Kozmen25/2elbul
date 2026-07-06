import {
  ArrowUpRight,
  CalendarDays,
  Heart,
  MapPin,
  Store,
} from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FavoriteButton } from "@/components/favorite-button";
import { ListingImage } from "@/components/listing-image";
import { formatCurrencyTRY, formatDateTR } from "@/lib/formatters";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "Favorilerim | 2ElBul",
  robots: {
    index: false,
    follow: false,
  },
};

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

  const { data: favorites, error: favoritesError } = await supabase
    .from("favorites")
    .select("listing_id, created_at")
    .eq("user_id", authData.user.id)
    .order("created_at", { ascending: false });

  if (favoritesError) {
    console.error("Supabase favorites page query failed:", favoritesError);
  }

  const listingIds = (favorites ?? []).map((favorite) => favorite.listing_id);
  const [listingsResult, productsResult] = listingIds.length
    ? await Promise.all([
        supabase
          .from("listings")
          .select(
            "id, product_id, title, price, city, source, url, condition, image_url, created_at",
          )
          .in("id", listingIds),
        supabase.from("products").select("id, name"),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];

  if (listingsResult.error) {
    console.error("Supabase favorite listings query failed:", listingsResult.error);
  }
  if (productsResult.error) {
    console.error("Supabase favorite products query failed:", productsResult.error);
  }

  const productNames = new Map(
    (productsResult.data ?? []).map((product) => [
      String(product.id),
      String(product.name),
    ]),
  );
  const listingOrder = new Map(
    listingIds.map((listingId, index) => [String(listingId), index]),
  );
  const listings = (listingsResult.data ?? [])
    .map((listing) => ({
      id: String(listing.id),
      productName: productNames.get(String(listing.product_id)) ?? "Ürün",
      title: String(listing.title),
      price: Number(listing.price),
      city: String(listing.city),
      source: String(listing.source),
      url: String(listing.url),
      condition: String(listing.condition),
      imageUrl: listing.image_url ? String(listing.image_url) : null,
      createdAt: String(listing.created_at),
    }))
    .sort(
      (a, b) =>
        (listingOrder.get(a.id) ?? 0) - (listingOrder.get(b.id) ?? 0),
    );

  const hasError = Boolean(
    favoritesError || listingsResult.error || productsResult.error,
  );

  return (
    <section className="min-h-[calc(100vh-145px)] bg-[#fafaf8] py-10 sm:py-14">
      <div className="container-shell">
        <div className="mb-8">
          <span className="grid size-12 place-items-center rounded-2xl bg-[#fff1e7] text-[#ff6b00]">
            <Heart size={23} fill="currentColor" />
          </span>
          <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
            Favorilerim
          </h1>
          <p className="mt-2 text-black/50">
            Kaydettiğin ilanları tek yerde karşılaştır.
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
                className="flex flex-col rounded-2xl border border-black/9 bg-white p-5 transition hover:border-[#ff6b00]/35 hover:shadow-[0_14px_40px_rgba(0,0,0,0.07)]"
              >
                <ListingImage
                  imageUrl={listing.imageUrl}
                  productName={listing.productName}
                  alt={listing.title}
                />
                <div className="mt-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-[#ff6b00]">
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

                <p className="mt-4 text-2xl font-black tracking-[-0.04em] text-[#ff6b00]">
                  {formatPrice(listing.price)}
                </p>
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

                <a
                  href={listing.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="orange-button mt-5 py-3"
                >
                  İlana git <ArrowUpRight size={17} />
                </a>
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
      </div>
    </section>
  );
}
