import { AdminEmpty, AdminPageHeader } from "@/components/admin-ui";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { SourceManager, type AdminSource } from "./source-manager";

export default async function AdminSourcesPage() {
  const supabase = createSupabaseAdminClient();
  const integrationResult = await supabase
    ?.from("sources")
    .select(
      "id, name, slug, base_url, type, is_active, bot_listing_status, bot_import_mode, integration_type, api_url, scrape_url, cron_enabled, cron_schedule, product_limit, fetch_limit, last_success, last_run_at, total_imported, created_at",
    )
    .order("name");
  let sourceData = (integrationResult?.data ?? []) as Record<string, unknown>[];
  let sourceError = integrationResult?.error ?? null;
  let publishModeAvailable = true;
  let integrationSettingsAvailable = true;

  if (sourceError) {
    integrationSettingsAvailable = false;
    const publishModeResult = await supabase
      ?.from("sources")
      .select(
        "id, name, slug, base_url, type, is_active, bot_listing_status, last_run_at, total_imported, created_at",
      )
      .order("name");
    sourceData = (publishModeResult?.data ?? []) as Record<string, unknown>[];
    sourceError = publishModeResult?.error ?? null;

    if (sourceError) {
      publishModeAvailable = false;
      const legacyResult = await supabase
        ?.from("sources")
        .select(
          "id, name, slug, base_url, type, is_active, last_run_at, total_imported, created_at",
        )
        .order("name");
      sourceData = (legacyResult?.data ?? []) as Record<string, unknown>[];
      sourceError = legacyResult?.error ?? null;
    }
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
    integrationType:
      source.integration_type === "api" || source.integration_type === "scrape"
        ? source.integration_type
        : ["easycep", "getmobil"].includes(String(source.slug))
          ? "scrape"
          : "manual",
    isActive: Boolean(source.is_active),
    botListingStatus:
      source.bot_import_mode === "published" ||
      source.bot_listing_status === "published"
        ? "published"
        : "pending",
    apiUrl: source.api_url ? String(source.api_url) : null,
    scrapeUrl: source.scrape_url ? String(source.scrape_url) : null,
    cronEnabled: Boolean(source.cron_enabled),
    cronSchedule: source.cron_schedule
      ? String(source.cron_schedule)
      : "0 */6 * * *",
    productLimit: Number(source.fetch_limit ?? source.product_limit ?? 100),
    lastSuccess: source.last_success ? String(source.last_success) : null,
    lastRunAt: source.last_run_at ? String(source.last_run_at) : null,
    totalImported: Number(source.total_imported),
    createdAt: String(source.created_at),
  }));

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-hidden">
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
      {!integrationSettingsAvailable && !sourceError && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          Gerçek kaynak entegrasyon alanları henüz kurulu değil.
          `supabase/source-integration-settings.sql` dosyasını çalıştırın.
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
          integrationSettingsAvailable={integrationSettingsAvailable}
        />
      )}
    </div>
  );
}
