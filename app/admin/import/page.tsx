import { DatabaseZap } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-ui";
import { AdminImportForm } from "./import-form";

export const dynamic = "force-dynamic";

export default async function AdminImportPage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Veri yönetimi"
        title="Toplu ilan içe aktar"
        description="JSON, CSV veya Excel verilerini doğrulayın, ilk 10 kaydı önizleyin ve ortak ilan formatıyla sisteme aktarın."
        action={
          <span className="grid size-12 place-items-center rounded-2xl bg-[#fff1e7] text-[#ff6b00]">
            <DatabaseZap size={24} />
          </span>
        }
      />
      <AdminImportForm />
    </>
  );
}
