import { AdminEmpty, AdminPageHeader } from "@/components/admin-ui";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { SourceManager, type AdminSource } from "./source-manager";

export default async function AdminSourcesPage() {
  const supabase = createSupabaseAdminClient();
  const result = await supabase
    ?.from("sources")
    .select(
      "id, name, slug, base_url, type, is_active, last_run_at, total_imported, created_at",
    )
    .order("name");

  if (result?.error) {
    console.error("Admin sources query failed:", result.error);
  }

  const sources: AdminSource[] = (result?.data ?? []).map((source) => ({
    id: Number(source.id),
    name: String(source.name),
    slug: String(source.slug),
    baseUrl: source.base_url ? String(source.base_url) : null,
    type: String(source.type),
    isActive: Boolean(source.is_active),
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

      {!supabase || result?.error ? (
        <AdminEmpty>
          Kaynak tablosu okunamadı. Önce `supabase/sources-and-bots.sql`
          migration dosyasını çalıştırın ve service-role bağlantısını kontrol
          edin.
        </AdminEmpty>
      ) : (
        <SourceManager sources={sources} />
      )}
    </>
  );
}
