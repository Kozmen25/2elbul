import { Activity, CircleAlert, Gauge, KeyRound, Sparkles } from "lucide-react";
import { AdminPageHeader, AdminStatCard } from "@/components/admin-ui";
import { requireAdminUser } from "@/lib/admin";
import { countFallbackProducts, REVIEW_BATCH_SIZE } from "@/lib/ai/classification-review";
import { AI_FEATURES, RATE_WINDOW_MS } from "@/lib/ai/config";
import { loadAiSettingsView } from "@/lib/ai/settings";
import { formatDateTR } from "@/lib/formatters";
import { getAllCategories } from "@/lib/categories";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { AiPlayground } from "./ai-playground";
import { AiSettingsForm } from "./ai-settings-form";
import { FallbackReview } from "./fallback-review";

export const dynamic = "force-dynamic";

const LOG_LIMIT = 30;
/** Upper bound of rows read to total the last 24 hours (well above any sane daily limit). */
const USAGE_ROW_LIMIT = 5000;

const FEATURE_LABELS: Record<string, string> = {
  ...Object.fromEntries(AI_FEATURES.map((feature) => [feature.id, feature.label])),
  test: "Bağlantı testi",
};

export default async function AdminAiPage() {
  await requireAdminUser("/admin/ai");
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return (
      <>
        <AdminPageHeader eyebrow="Sistem" title="Yapay Zeka" description="Gemini entegrasyonu ve kullanım ayarları." />
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          Service role bağlantısı yapılandırılmadığı için AI ayarları yüklenemedi.
        </p>
      </>
    );
  }

  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const categories = await getAllCategories();
  const [settings, logsResult, usageResult, fallbackCount] = await Promise.all([
    loadAiSettingsView(supabase),
    supabase
      .from("ai_logs")
      .select("id, created_at, feature, model, ok, error, latency_ms, input_preview")
      .order("created_at", { ascending: false })
      .limit(LOG_LIMIT),
    supabase
      .from("ai_logs")
      .select("ok, prompt_tokens, output_tokens")
      .gte("created_at", since)
      .limit(USAGE_ROW_LIMIT),
    countFallbackProducts(supabase, categories),
  ]);

  const logs = logsResult.data ?? [];
  const usage = usageResult.data ?? [];
  const requests = usage.length;
  const failures = usage.filter((row) => !row.ok).length;
  const tokens = usage.reduce((sum, row) => sum + (row.prompt_tokens ?? 0) + (row.output_tokens ?? 0), 0);

  const serviceLabel = !settings.enabled ? "Kapalı" : settings.hasKey ? "Açık" : "Anahtar eksik";
  const testLabel = settings.lastTestOk === null ? "Denenmedi" : settings.lastTestOk ? "Başarılı" : "Başarısız";

  return (
    <>
      <AdminPageHeader
        eyebrow="Sistem"
        title="Yapay Zeka"
        description="Google Gemini ile ürün tanıma, kategori belirleme, arama ve eşleştirme. Anahtarı, modeli, özellikleri ve harcama sınırını buradan yönetin."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="AI servisi" value={serviceLabel} icon={Sparkles} note={settings.enabled ? settings.model : "Etkinleştirilmedi"} />
        <AdminStatCard
          label="Son bağlantı testi"
          value={testLabel}
          icon={settings.lastTestOk === false ? CircleAlert : KeyRound}
          note={
            settings.lastTestAt
              ? formatDateTR(settings.lastTestAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
              : "Henüz deneme yok"
          }
        />
        <AdminStatCard
          label="Son 24 saatte istek"
          value={`${requests.toLocaleString("tr-TR")} / ${settings.dailyRequestLimit.toLocaleString("tr-TR")}`}
          icon={Gauge}
          note={`${tokens.toLocaleString("tr-TR")} token kullanıldı`}
        />
        <AdminStatCard label="Son 24 saatte hata" value={failures} icon={Activity} note="Başarısız çağrılar" />
      </div>

      {settings.lastTestOk === false && settings.lastTestError && (
        <p className="mt-4 break-words rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          Son bağlantı testi başarısız oldu: {settings.lastTestError}
        </p>
      )}

      <div className="mt-5 grid gap-5">
        <AiSettingsForm settings={settings} />
        <AiPlayground />
        <FallbackReview fallbackCount={fallbackCount} batchSize={REVIEW_BATCH_SIZE} />
      </div>

      <section className="mt-5 rounded-2xl border border-black/7 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-black">Çağrı kayıtları</h2>
        <p className="mt-1 text-sm text-black/50">
          Son {LOG_LIMIT} çağrı. Yalnızca girdinin kısa bir önizlemesi saklanır; modelin yanıtı kaydedilmez.
        </p>
        {logs.length === 0 ? (
          <p className="mt-4 rounded-xl bg-[#fafaf8] p-4 text-sm text-black/50">Henüz AI çağrısı yapılmadı.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-black/45">
                <tr>
                  <th className="px-3 py-2">Zaman</th>
                  <th className="px-3 py-2">Özellik</th>
                  <th className="px-3 py-2">Girdi</th>
                  <th className="px-3 py-2">Süre</th>
                  <th className="px-3 py-2">Durum</th>
                  <th className="px-3 py-2">Ayrıntı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-black/55">
                      {formatDateTR(log.created_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>
                    <td className="px-3 py-2 font-bold">{FEATURE_LABELS[log.feature] ?? log.feature}</td>
                    <td className="max-w-xs truncate px-3 py-2 text-black/60" title={log.input_preview ?? ""}>
                      {log.input_preview}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-black/55">{log.latency_ms != null ? `${log.latency_ms} ms` : "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black ${log.ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {log.ok ? "Başarılı" : "Hata"}
                      </span>
                    </td>
                    <td className="max-w-sm break-words px-3 py-2 text-xs text-black/50">{log.error ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
