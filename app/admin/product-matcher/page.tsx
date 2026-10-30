import { WandSparkles } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-ui";
import { ProductMatcherClient } from "./product-matcher-client";

export default function AdminProductMatcherPage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Ürün eşleştirme"
        title="Ürün Eşleştirici"
        description="İlan başlıklarının nasıl normalize edildiğini, hangi sinyallerin çıkarıldığını ve mevcut ürünlerden hangisine bağlanacağını dry-run olarak test edin."
        action={
          <span className="grid size-12 place-items-center rounded-2xl bg-[#E4ECFF] text-[#3B66E0]">
            <WandSparkles size={24} />
          </span>
        }
      />
      <ProductMatcherClient />
    </>
  );
}
