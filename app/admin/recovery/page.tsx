import { HeartPulse } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-ui";
import { RecoveryClient } from "./recovery-client";

export const dynamic = "force-dynamic";

export default function RecoveryPage() {
  return (
    <div>
      <AdminPageHeader
        eyebrow="Kurtarma"
        title="Kurtarma Yönetimi"
        description="Devre kesiciler, ölü kuyruk ve iyileşme metriklerini görüntüleyin ve yönetin."
      />
      <RecoveryClient />
    </div>
  );
}
