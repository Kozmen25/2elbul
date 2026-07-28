import { Activity } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-ui";
import { MonitoringClient } from "./monitoring-client";
import { collectMonitoringSummary } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

export default async function MonitoringPage() {
  let summary;
  try {
    summary = await collectMonitoringSummary();
  } catch {
    summary = null;
  }

  return (
    <div>
      <AdminPageHeader
        eyebrow="İzleme"
        title="İzleme Merkezi"
        description="Kaynak, bot, içe aktarma ve kuyruk metriklerini görüntüleyin."
      />

      {summary ? (
        <MonitoringClient summary={summary} />
      ) : (
        <div className="rounded-2xl border border-dashed border-black/15 bg-white p-8 text-center text-sm text-black/45">
          İzleme verileri yüklenemedi. Supabase service role bağlantısını kontrol edin.
        </div>
      )}
    </div>
  );
}
