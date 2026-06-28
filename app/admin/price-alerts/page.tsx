import { BellRing } from "lucide-react";
import { AdminEmpty, AdminPageHeader } from "@/components/admin-ui";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type AdminPriceAlert = {
  id: string;
  userId: string;
  productName: string;
  listingTitle: string | null;
  targetPrice: number;
  currentPrice: number | null;
  status: string;
  createdAt: string;
  triggeredAt: string | null;
};

const formatPrice = (price: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(price);

export default async function AdminPriceAlertsPage() {
  const supabase = createSupabaseAdminClient();
  const result = supabase
    ? await supabase
        .from("price_alerts")
        .select(
          "id, user_id, target_price, current_price, status, created_at, triggered_at, products(name), listings(title)",
        )
        .order("created_at", { ascending: false })
        .limit(200)
    : null;

  if (result?.error) {
    console.error("Admin price alerts query failed:", result.error);
  }

  const alerts: AdminPriceAlert[] = (result?.data ?? []).map((alert) => ({
    id: String(alert.id),
    userId: String(alert.user_id),
    productName: String(
      (alert.products as { name?: string } | null)?.name ?? "Ürün",
    ),
    listingTitle: alert.listings
      ? String((alert.listings as { title?: string }).title ?? "")
      : null,
    targetPrice: Number(alert.target_price),
    currentPrice:
      alert.current_price === null || alert.current_price === undefined
        ? null
        : Number(alert.current_price),
    status: String(alert.status ?? "active"),
    createdAt: String(alert.created_at),
    triggeredAt: alert.triggered_at ? String(alert.triggered_at) : null,
  }));

  const total = alerts.length;
  const active = alerts.filter((alert) => alert.status === "active").length;
  const triggered = alerts.filter((alert) => alert.status === "triggered").length;
  const cancelled = alerts.filter((alert) => alert.status === "cancelled").length;

  return (
    <>
      <AdminPageHeader
        eyebrow="Kullanıcı takipleri"
        title="Fiyat Alarmları"
        description="Kullanıcıların hedef fiyat alarmlarını, tetiklenen kayıtları ve iptal edilen takipleri izleyin."
        action={
          <span className="grid size-12 place-items-center rounded-2xl bg-[#fff1e7] text-[#ff6b00]">
            <BellRing size={24} />
          </span>
        }
      />

      {!supabase || result?.error ? (
        <AdminEmpty>
          Fiyat alarmı tablosu okunamadı. Önce `supabase/price-alerts.sql`
          dosyasını çalıştırın.
        </AdminEmpty>
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Toplam alarm" value={total} />
            <StatCard label="Aktif alarm" value={active} tone="green" />
            <StatCard label="Tetiklenen alarm" value={triggered} tone="orange" />
            <StatCard label="İptal edilen alarm" value={cancelled} />
          </div>

          {alerts.length ? (
            <div className="w-full max-w-full min-w-0 overflow-x-auto rounded-2xl border border-black/8 bg-white [-webkit-overflow-scrolling:touch]">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="bg-[#fafaf8] text-xs uppercase tracking-wide text-black/45">
                  <tr>
                    <th className="px-4 py-3">Ürün / ilan</th>
                    <th className="px-4 py-3">Hedef fiyat</th>
                    <th className="px-4 py-3">Mevcut fiyat</th>
                    <th className="px-4 py-3">Durum</th>
                    <th className="px-4 py-3">Kullanıcı</th>
                    <th className="px-4 py-3">Oluşturma</th>
                    <th className="px-4 py-3">Tetiklenme</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert) => (
                    <tr key={alert.id} className="border-t border-black/7 align-top">
                      <td className="px-4 py-4">
                        <p className="font-black">{alert.productName}</p>
                        {alert.listingTitle ? (
                          <p className="mt-1 max-w-72 truncate text-xs text-black/45">
                            {alert.listingTitle}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 font-black text-[#ff6b00]">
                        {formatPrice(alert.targetPrice)}
                      </td>
                      <td className="px-4 py-4">
                        {alert.currentPrice ? formatPrice(alert.currentPrice) : "Henüz yok"}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={alert.status} />
                      </td>
                      <td className="max-w-52 truncate px-4 py-4 text-xs text-black/45">
                        {alert.userId}
                      </td>
                      <td className="px-4 py-4 text-black/55">
                        {formatDate(alert.createdAt)}
                      </td>
                      <td className="px-4 py-4 text-black/55">
                        {alert.triggeredAt ? formatDate(alert.triggeredAt) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <AdminEmpty>Henüz fiyat alarmı oluşturulmadı.</AdminEmpty>
          )}
        </>
      )}
    </>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "green" | "orange";
}) {
  const color =
    tone === "green"
      ? "text-green-700"
      : tone === "orange"
        ? "text-[#ff6b00]"
        : "text-black";

  return (
    <div className="rounded-2xl border border-black/7 bg-white p-4 shadow-[0_12px_30px_rgba(0,0,0,0.035)]">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-black/40">
        {label}
      </p>
      <p className={`mt-2 text-3xl font-black ${color}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "active"
      ? "bg-green-100 text-green-700"
      : status === "triggered"
        ? "bg-[#fff1e7] text-[#ff6b00]"
        : status === "paused"
          ? "bg-amber-100 text-amber-700"
          : "bg-black/7 text-black/45";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${className}`}>
      {statusLabel(status)}
    </span>
  );
}

function statusLabel(status: string) {
  if (status === "active") return "Aktif";
  if (status === "triggered") return "Tetiklendi";
  if (status === "paused") return "Duraklatıldı";
  if (status === "cancelled") return "İptal edildi";
  return status;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
