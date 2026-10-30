import { Boxes, FolderTree, Layers, PackageSearch } from "lucide-react";
import { AdminPageHeader, AdminStatCard } from "@/components/admin-ui";
import { loadAdminCategories } from "@/lib/category-admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { CategoriesManager } from "./categories-manager";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const admin = createSupabaseAdminClient();
  const categories = admin ? await loadAdminCategories(admin) : null;

  if (!categories) {
    return (
      <>
        <AdminPageHeader
          eyebrow="Katalog"
          title="Kategoriler"
          description="Ana kategori, alt kategori ve ürün yapısını yönetin."
        />
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          Supabase bağlantısı yapılandırılmamış.
        </div>
      </>
    );
  }

  const mainCount = categories.filter((c) => c.parentId === null && !c.isFallback).length;
  const subCount = categories.filter((c) => c.parentId !== null).length;
  const productCount = categories.reduce((sum, c) => sum + c.productCount, 0);
  const fallbackCount = categories.find((c) => c.isFallback)?.productCount ?? 0;

  return (
    <>
      <AdminPageHeader
        eyebrow="Katalog"
        title="Kategoriler"
        description="Ana kategori → alt kategori → ürün yapısını yönetin. Ürünler anahtar kelime kurallarına göre kategorilere otomatik yerleşir."
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AdminStatCard label="Ana kategori" value={mainCount} icon={FolderTree} />
        <AdminStatCard label="Alt kategori" value={subCount} icon={Layers} />
        <AdminStatCard label="Toplam ürün" value={productCount} icon={Boxes} />
        <AdminStatCard label="Diğer'deki ürün" value={fallbackCount} icon={PackageSearch} note="Kategoriye yerleşmemiş" />
      </div>
      <CategoriesManager categories={categories} />
    </>
  );
}
