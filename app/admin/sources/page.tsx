import { AdminEmpty, AdminPageHeader } from "@/components/admin-ui";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { SourceManager, type AdminSource } from "./source-manager";

export default async function AdminSourcesPage() {
  const supabase = createSupabaseAdminClient();
  const statusResult = await supabase
    ?.from("sources")
    .select(
      "id, name, slug, base_url, type, is_active, bot_listing_status, last_run_at, total_imported, created_at",
    )
    .order("name");
  let sourceData = (statusResult?.data ?? []) as Record<string, unknown>[];
  let sourceError = statusResult?.error ?? null;
  let publishModeAvailable = true;

  if (sourceError) {
    publishModeAvailable = false;
    const fallbackResult = await supabase
      ?.from("sources")
      .select(
        "id, name, slug, base_url, type, is_active, last_run_at, total_imported, created_at",
      )
      .order("name");
    sourceData = (fallbackResult?.data ?? []) as Record<string, unknown>[];
    sourceError = fallbackResult?.error ?? null;
  }

  if (sourceError) {
    console.error("Admin sources query failed:", sourceError);
  }

  const sources: AdminSource[] = sourceData.map((source) => ({
    id: Number(source.id),
    name: String(source.name),
    slug: String(source.slug),
    baseUrl: source.base_url ? String(source.base_url) : null,
    type: String(source.type),
    isActive: Boolean(source.is_active),
    botListingStatus:
      source.bot_listing_status === "published" ? "published" : "pending",
    lastRunAt: source.last_run_at ? String(source.last_run_at) : null,
    totalImported: Number(source.total_imported),
    createdAt: String(source.created_at),
  }));

  return (
    <>
      <AdminPageHeader
        eyebrow="Bot altyapısı"
        title="Kaynaklar"
        description="İlanların alınacağı pazar yerlerini ve yenilenmiş cihaz kaynaklarını yönetin."
      />

      {!publishModeAvailable && !sourceError && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          Bot yayın modu kolonu henüz kurulu değil.
          `supabase/source-bot-publish-mode.sql` dosyasını çalıştırın.
        </div>
      )}

      {!supabase || sourceError ? (
        <AdminEmpty>
          Kaynak tablosu okunamadı. Önce `supabase/sources-and-bots.sql`
          migration dosyasını çalıştırın ve service-role bağlantısını kontrol
          edin.
        </AdminEmpty>
      ) : (
        <SourceManager
          sources={sources}
          publishModeAvailable={publishModeAvailable}
        />
      )}
    </>
  );
}
