import { AdminEmpty, AdminPageHeader } from "@/components/admin-ui";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { LISTING_CONDITIONS } from "@/lib/listings";
import { ListingManager, type AdminListing } from "./listing-manager";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminListingsPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = createSupabaseAdminClient();
  const productsResult = await supabase
    ?.from("products")
    .select("id, name")
    .order("name");

  let statusAvailable = true;
  const statusResult = await supabase
    ?.from("listings")
    .select(
      "id, product_id, title, price, city, source, url, condition, image_url, status, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(2000);
  let listingsData = (statusResult?.data ?? []) as Record<string, unknown>[];
  let listingsError = statusResult?.error ?? null;

  if (listingsError) {
    statusAvailable = false;
    const fallbackResult = await supabase
      ?.from("listings")
      .select(
        "id, product_id, title, price, city, source, url, condition, image_url, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(2000);
    listingsData = (fallbackResult?.data ?? []) as Record<string, unknown>[];
    listingsError = fallbackResult?.error ?? null;
  }

  if (listingsError) {
    console.error("Admin listings query failed:", listingsError);
  }

  const products = (productsResult?.data ?? []).map((product) => ({
    id: Number(product.id),
    name: String(product.name),
  }));
  const productNames = new Map(
    products.map((product) => [product.id, product.name]),
  );
  const value = (key: string) => {
    const raw = params[key];
    return Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  };
  const query = value("q").toLocaleLowerCase("tr-TR");
  const minPrice = Number(value("min"));
  const maxPrice = Number(value("max"));

  let listings: AdminListing[] = listingsData.map((listing) => ({
    id: Number(listing.id),
    productId: Number(listing.product_id),
    productName:
      productNames.get(Number(listing.product_id)) ?? "Bilinmeyen ürün",
    title: String(listing.title),
    price: Number(listing.price),
    city: String(listing.city),
    source: String(listing.source),
    condition: String(listing.condition),
    url: String(listing.url),
    imageUrl: listing.image_url ? String(listing.image_url) : null,
    status:
      "status" in listing && listing.status
        ? String(listing.status)
        : "published",
    createdAt: String(listing.created_at),
  }));

  listings = listings.filter((listing) => {
    if (
      query &&
      !`${listing.title} ${listing.productName}`
        .toLocaleLowerCase("tr-TR")
        .includes(query)
    )
      return false;
    if (value("product") && String(listing.productId) !== value("product"))
      return false;
    if (value("city") && listing.city !== value("city")) return false;
    if (value("source") && listing.source !== value("source")) return false;
    if (value("condition") && listing.condition !== value("condition"))
      return false;
    if (value("status") && listing.status !== value("status")) return false;
    if (Number.isFinite(minPrice) && minPrice > 0 && listing.price < minPrice)
      return false;
    if (Number.isFinite(maxPrice) && maxPrice > 0 && listing.price > maxPrice)
      return false;
    return true;
  });

  const sort = value("sort") || "newest";
  listings.sort((a, b) => {
    if (sort === "oldest")
      return +new Date(a.createdAt) - +new Date(b.createdAt);
    if (sort === "price-asc") return a.price - b.price;
    if (sort === "price-desc") return b.price - a.price;
    return +new Date(b.createdAt) - +new Date(a.createdAt);
  });

  const allRows = listingsData;
  const options = (key: string) =>
    [...new Set(allRows.map((row) => String(row[key] ?? "")).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "tr"));

  return (
    <>
      <AdminPageHeader
        eyebrow="İçerik yönetimi"
        title="İlanlar"
        description="İlanları filtreleyin, düzenleyin, yayın durumlarını yönetin veya toplu olarak silin."
      />

      {!statusAvailable && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          Moderasyon kolonu henüz kurulu değil. `supabase/listing-status.sql`
          çalıştırılana kadar tüm ilanlar yayında kabul edilir.
        </div>
      )}

      <form className="mb-5 grid gap-3 rounded-2xl border border-black/7 bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
        <input
          name="q"
          defaultValue={value("q")}
          placeholder="Başlık veya ürün ara"
          className="field px-3 py-2.5"
        />
        <Select name="product" value={value("product")} label="Tüm ürünler">
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </Select>
        <Select name="city" value={value("city")} label="Tüm şehirler">
          {options("city").map((option) => (
            <option key={option}>{option}</option>
          ))}
        </Select>
        <Select name="source" value={value("source")} label="Tüm kaynaklar">
          {options("source").map((option) => (
            <option key={option}>{option}</option>
          ))}
        </Select>
        <Select name="condition" value={value("condition")} label="Tüm durumlar">
          {LISTING_CONDITIONS.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </Select>
        {statusAvailable && (
          <Select name="status" value={value("status")} label="Tüm yayın durumları">
            <option value="published">Yayında</option>
            <option value="pending">Beklemede</option>
            <option value="rejected">Reddedildi</option>
          </Select>
        )}
        <input
          name="min"
          type="number"
          min="0"
          defaultValue={value("min")}
          placeholder="Minimum fiyat"
          className="field px-3 py-2.5"
        />
        <input
          name="max"
          type="number"
          min="0"
          defaultValue={value("max")}
          placeholder="Maksimum fiyat"
          className="field px-3 py-2.5"
        />
        <Select name="sort" value={sort} label="Sıralama">
          <option value="newest">En yeni</option>
          <option value="oldest">En eski</option>
          <option value="price-asc">Ucuzdan pahalıya</option>
          <option value="price-desc">Pahalıdan ucuza</option>
        </Select>
        <button className="orange-button px-4 py-2.5">Filtrele</button>
      </form>

      {listings.length ? (
        <ListingManager
          listings={listings}
          products={products}
          statusAvailable={statusAvailable}
        />
      ) : (
        <AdminEmpty>Filtrelere uygun ilan bulunamadı.</AdminEmpty>
      )}
    </>
  );
}

function Select({
  name,
  value,
  label,
  children,
}: {
  name: string;
  value: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <select name={name} defaultValue={value} className="field px-3 py-2.5">
      <option value="">{label}</option>
      {children}
    </select>
  );
}
