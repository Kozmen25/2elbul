import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { AdminEmpty, AdminPageHeader } from "@/components/admin-ui";
import { createProductSlug } from "@/lib/product-slug";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { ProductActions } from "./product-actions";

export default async function AdminProductsPage() {
  const supabase = createSupabaseAdminClient();
  const slugResult = await supabase
    ?.from("products")
    .select("id, name, slug, created_at")
    .order("name");
  let productsData = (slugResult?.data ?? []) as Record<string, unknown>[];
  let productsError = slugResult?.error ?? null;
  let slugAvailable = true;

  if (productsError) {
    slugAvailable = false;
    const fallbackResult = await supabase
      ?.from("products")
      .select("id, name, created_at")
      .order("name");
    productsData = (fallbackResult?.data ?? []) as Record<string, unknown>[];
    productsError = fallbackResult?.error ?? null;
  }

  const listingsResult = await supabase
    ?.from("listings")
    .select("product_id, price");
  if (productsError)
    console.error("Admin products query failed:", productsError);
  if (listingsResult?.error)
    console.error("Admin product stats query failed:", listingsResult.error);

  const stats = new Map<
    number,
    { count: number; total: number; min: number; max: number }
  >();
  for (const listing of listingsResult?.data ?? []) {
    const id = Number(listing.product_id);
    const price = Number(listing.price);
    const current = stats.get(id) ?? {
      count: 0,
      total: 0,
      min: price,
      max: price,
    };
    stats.set(id, {
      count: current.count + 1,
      total: current.total + price,
      min: Math.min(current.min, price),
      max: Math.max(current.max, price),
    });
  }

  const products = productsData.map((product) => {
    const productStats = stats.get(Number(product.id));
    return {
      id: Number(product.id),
      name: String(product.name),
      slug:
        "slug" in product && product.slug
          ? String(product.slug)
          : createProductSlug(String(product.name)),
      count: productStats?.count ?? 0,
      average: productStats
        ? Math.round(productStats.total / productStats.count)
        : 0,
      min: productStats?.min ?? 0,
      max: productStats?.max ?? 0,
    };
  });

  return (
    <>
      <AdminPageHeader
        eyebrow="Katalog"
        title="Ürünler"
        description="Ürün adlarını ve slug değerlerini yönetin, ürün bazlı fiyat istatistiklerini inceleyin."
      />
      {!slugAvailable && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          Slug kolonu bulunamadı. Düzenleme için önce
          `supabase/product-slugs.sql` dosyasını çalıştırın.
        </div>
      )}
      {products.length ? (
        <div className="w-full max-w-full min-w-0 overflow-x-auto rounded-2xl border border-black/8 bg-white [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-[#fafaf8] text-xs uppercase tracking-wide text-black/45">
              <tr>
                <th className="px-4 py-3">Ürün</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">İlan</th>
                <th className="px-4 py-3">Ortalama</th>
                <th className="px-4 py-3">En düşük</th>
                <th className="px-4 py-3">En yüksek</th>
                <th className="sticky right-0 z-10 bg-[#fafaf8] px-4 py-3 text-right shadow-[-12px_0_20px_rgba(0,0,0,0.04)]">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-t border-black/7">
                  <td className="px-4 py-4 font-black">{product.name}</td>
                  <td className="px-4 py-4 font-mono text-xs text-black/50">
                    {product.slug}
                  </td>
                  <td className="px-4 py-4">{product.count}</td>
                  <td className="px-4 py-4">{formatPrice(product.average)}</td>
                  <td className="px-4 py-4">{formatPrice(product.min)}</td>
                  <td className="px-4 py-4">{formatPrice(product.max)}</td>
                  <td className="sticky right-0 z-10 bg-white px-4 py-4 shadow-[-12px_0_20px_rgba(0,0,0,0.04)]">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/product/${product.slug}`}
                        target="_blank"
                        className="grid size-9 place-items-center rounded-lg border border-black/10"
                        aria-label="Ürün detayına git"
                      >
                        <ExternalLink size={16} />
                      </Link>
                      {slugAvailable && <ProductActions product={product} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <AdminEmpty>Henüz ürün bulunmuyor.</AdminEmpty>
      )}
    </>
  );
}

function formatPrice(value: number) {
  if (!value) return "—";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}
