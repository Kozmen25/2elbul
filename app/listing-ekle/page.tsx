import type { ProductOption } from "@/lib/listings";
import { createSupabaseClient } from "@/lib/supabase";
import { AddListingForm } from "./add-listing-form";

export const dynamic = "force-dynamic";

export default async function AddListingPage() {
  const supabase = createSupabaseClient();
  let products: ProductOption[] = [];
  let loadError = "";

  if (!supabase) {
    loadError =
      "Supabase bağlantısı yapılandırılmamış. Ortam değişkenlerini kontrol edin.";
  } else {
    const { data, error } = await supabase
      .from("products")
      .select("id, name")
      .order("name");

    if (error) {
      console.error("Supabase products query failed:", error);
      loadError = "Ürün listesi yüklenemedi. Lütfen tekrar deneyin.";
    } else {
      products = (data ?? []).map((product) => ({
        id: String(product.id),
        name: String(product.name),
      }));
    }
  }

  return <AddListingForm products={products} loadError={loadError} />;
}
