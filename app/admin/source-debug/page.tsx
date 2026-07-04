import { AdminPageHeader } from "@/components/admin-ui";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { SourceDebugClient } from "./source-debug-client";

type SourceRow = {
  id: unknown;
  name: unknown;
  slug: unknown;
  is_active?: unknown;
  integration_type?: unknown;
  cron_enabled?: unknown;
  last_run_at?: unknown;
  last_success?: unknown;
  total_imported?: unknown;
};

type BotRunRow = {
  source_id?: unknown;
  status?: unknown;
  found_count?: unknown;
  imported_count?: unknown;
  updated_count?: unknown;
  skipped_count?: unknown;
  error_count?: unknown;
  error_message?: unknown;
  created_at?: unknown;
};

export default async function SourceDebugPage() {
  const supabase = createSupabaseAdminClient();
  const sourcesResult = await supabase
    ?.from("sources")
    .select("id, name, slug, is_active, integration_type, cron_enabled, last_run_at, last_success, total_imported")
    .order("name", { ascending: true });

  const sources = (sourcesResult?.data ?? []) as SourceRow[];
  const sourceIds = sources.map((source) => Number(source.id)).filter(Boolean);
  const runsResult = sourceIds.length
    ? await supabase
        ?.from("bot_runs")
        .select("source_id, status, found_count, imported_count, updated_count, skipped_count, error_count, error_message, created_at")
        .in("source_id", sourceIds)
        .order("created_at", { ascending: false })
        .limit(300)
    : null;
  const runs = (runsResult?.data ?? []) as BotRunRow[];

  const rows = sources.map((source) => {
    const id = Number(source.id);
    const latest = runs.find((run) => Number(run.source_id) === id);
    return {
      id,
      name: String(source.name ?? "Kaynak"),
      slug: String(source.slug ?? ""),
      isActive: Boolean(source.is_active ?? true),
      integrationType: String(source.integration_type ?? "scrape"),
      cronEnabled: Boolean(source.cron_enabled),
      lastRunAt: source.last_run_at ? String(source.last_run_at) : null,
      lastSuccess: source.last_success ? String(source.last_success) : null,
      totalImported: Number(source.total_imported ?? 0),
      latestStatus: latest?.status ? String(latest.status) : null,
      latestFound: Number(latest?.found_count ?? 0),
      latestImported: Number(latest?.imported_count ?? 0),
      latestUpdated: Number(latest?.updated_count ?? 0),
      latestSkipped: Number(latest?.skipped_count ?? 0),
      latestErrors: Number(latest?.error_count ?? 0),
      latestErrorMessage: latest?.error_message ? String(latest.error_message) : null,
    };
  });

  return (
    <>
      <AdminPageHeader
        eyebrow="Source Engine"
        title="Kaynak Debug Merkezi"
        description="Adapter → parse → normalize → matcher → insert pipeline sonucunu tek ekrandan test edin."
      />
      <SourceDebugClient sources={rows} />
    </>
  );
}
