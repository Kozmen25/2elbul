import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  Boxes,
  Clock3,
  DatabaseZap,
  PackageSearch,
  Search,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { AdminPageHeader, AdminStatCard } from "@/components/admin-ui";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type CountResult = {
  count: number | null;
  error: unknown;
};

type BotRunRow = {
  status?: unknown;
  run_type?: unknown;
  started_at?: unknown;
  finished_at?: unknown;
  error_message?: unknown;
  found_count?: unknown;
  imported_count?: unknown;
  error_count?: unknown;
  created_at?: unknown;
};

export default async function AdminOverviewPage() {
  const summary = await loadOperationsSummary();

  return (
    <>
      <AdminPageHeader
        eyebrow="Operasyon merkezi"
        title="2ElBul Operations Center"
        description="Platformun veri, bot, kaynak, kullanıcı ve piyasa zekası operasyonlarını tek ekrandan takip edin."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Toplam ürün"
          value={summary.productCount}
          icon={Boxes}
        />
        <AdminStatCard
          label="Aktif ilan"
          value={summary.activeListingCount}
          icon={PackageSearch}
        />
        <AdminStatCard
          label="Bugün eklenen ilan"
          value={summary.todayListingCount}
          icon={Clock3}
        />
        <AdminStatCard
          label="Son 24 saat arama"
          value={summary.searchDemand24h}
          icon={Search}
          note={summary.searchDemandNote}
        />
        <AdminStatCard
          label="Son bot çalışması"
          value={summary.lastBotRunLabel}
          icon={Bot}
          note={summary.lastBotRunNote}
        />
        <AdminStatCard
          label="Son hata"
          value={summary.lastErrorLabel}
          icon={AlertTriangle}
          note={summary.lastErrorMessage}
        />
        <AdminStatCard
          label="Kaynak sağlığı"
          value={summary.sourceHealthLabel}
          icon={ShieldCheck}
          note={summary.sourceHealthNote}
        />
        <AdminStatCard
          label="Piyasa sinyali"
          value={summary.marketSignalLabel}
          icon={Sparkles}
          note={summary.marketSignalNote}
        />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)]">
        <div className="rounded-2xl border border-black/8 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.035)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ff6b00]">
                Hızlı aksiyonlar
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.035em]">
                Operasyon kısayolları
              </h2>
              <p className="mt-2 text-sm leading-6 text-black/50">
                En sık kullanılan admin araçlarına tek ekrandan geçin.
              </p>
            </div>
            <span className="grid size-11 place-items-center rounded-2xl bg-[#fff1e7] text-[#ff6b00]">
              <Activity size={22} />
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <QuickAction href="/admin/bot-center#manual-tasks" title="Bot Merkezi'ne git" description="Manuel bot görevlerini çalıştır." icon={Bot} />
            <QuickAction href="/admin/bot-center#source-health" title="Kaynak Sağlığına git" description="Adapter sağlığını ve son hataları izle." icon={ShieldCheck} />
            <QuickAction href="/admin/product-matcher" title="Ürün Eşleştiriciye git" description="Başlıkların ürün eşleşmesini test et." icon={Sparkles} />
            <QuickAction href="/admin/data-cleanup" title="Veri Temizliğine git" description="Demo/test kayıt adaylarını kontrol et." icon={DatabaseZap} />
            <QuickAction href="/market" title="Piyasa Merkezini görüntüle" description="Public piyasa sinyallerini incele." icon={BarChart3} />
          </div>
        </div>

        <div className="rounded-2xl border border-black/8 bg-[#111] p-5 text-white shadow-[0_12px_30px_rgba(0,0,0,0.035)]">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ff8a33]">
            Operasyon durumu
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.035em]">
            Bugünün özeti
          </h2>
          <div className="mt-5 grid gap-3">
            <SignalRow label="Bot durumu" value={summary.lastBotRunLabel} />
            <SignalRow label="Kaynak özeti" value={summary.sourceHealthLabel} />
            <SignalRow label="Arama talebi" value={`${summary.searchDemand24h} / 24s`} />
            <SignalRow label="Aktif veri" value={`${summary.activeListingCount} ilan`} />
          </div>
          <p className="mt-5 rounded-2xl bg-white/8 p-4 text-sm leading-6 text-white/65">
            {summary.operationsMessage}
          </p>
        </div>
      </section>
    </>
  );
}

async function loadOperationsSummary() {
  const supabase = createSupabaseAdminClient();
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  if (!supabase) {
    return emptyOperationsSummary("Service role yapılandırılmadı.");
  }

  const [
    products,
    activeListings,
    todayListings,
    searchDemands,
    sources,
    botRuns,
  ] = await Promise.all([
    countSafe(supabase.from("products").select("id", { count: "exact", head: true })),
    countActiveListings(supabase),
    countSafe(
      supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .gte("created_at", today.toISOString()),
    ),
    countSafe(
      supabase
        .from("search_demands")
        .select("id", { count: "exact", head: true })
        .gte("requested_at", dayAgo.toISOString()),
    ),
    supabase.from("sources").select("id, is_active"),
    supabase
      .from("bot_runs")
      .select("status, run_type, started_at, finished_at, error_message, found_count, imported_count, error_count, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const botRows = botRuns.error ? [] : ((botRuns.data ?? []) as BotRunRow[]);
  const lastBotRun = botRows[0];
  const lastError = botRows.find(
    (run) => ["failed", "error"].includes(String(run.status)) || run.error_message,
  );
  const sourceRows = sources.error ? [] : (sources.data ?? []);
  const activeSources = sourceRows.filter((source) => Boolean(source.is_active)).length;
  const failedRuns24h = botRows.filter((run) => {
    const createdAt = new Date(String(run.created_at ?? run.started_at ?? "")).getTime();
    return (
      Number.isFinite(createdAt) &&
      createdAt >= dayAgo.getTime() &&
      ["failed", "error"].includes(String(run.status))
    );
  }).length;
  const marketSignalLabel =
    searchDemands.count && searchDemands.count > 0 ? "Aktif" : "Sakin";

  return {
    productCount: products.count ?? 0,
    activeListingCount: activeListings.count ?? 0,
    todayListingCount: todayListings.count ?? 0,
    searchDemand24h: searchDemands.count ?? 0,
    searchDemandNote: searchDemands.error ? "Arama verisi alınamadı" : "Son 24 saat",
    lastBotRunLabel: lastBotRun ? statusLabel(String(lastBotRun.status)) : "Yok",
    lastBotRunNote: lastBotRun?.started_at ? formatDate(String(lastBotRun.started_at)) : "Henüz çalışma yok",
    lastErrorLabel: lastError ? "Var" : "Yok",
    lastErrorMessage: lastError?.error_message ? String(lastError.error_message).slice(0, 80) : "Son hata kaydı yok",
    sourceHealthLabel: `${activeSources}/${sourceRows.length || 0} aktif`,
    sourceHealthNote: failedRuns24h ? `${failedRuns24h} hata / 24s` : "Son 24 saatte kritik hata yok",
    marketSignalLabel,
    marketSignalNote:
      marketSignalLabel === "Aktif"
        ? "Arama sinyali üretiyor"
        : "Talep sinyali düşük",
    operationsMessage:
      failedRuns24h > 0
        ? "Kaynak veya bot tarafında son 24 saatte hata var. Bot Merkezi ve Kaynak Sağlığı bölümlerini kontrol et."
        : "Temel operasyon sinyalleri sakin görünüyor. Yeni kaynak eklemeden önce Bot Merkezi ve Veri Temizliği düzenli kontrol edilmeli.",
  };
}

async function countActiveListings(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
): Promise<CountResult> {
  let result = await countSafe(
    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .in("status", ["published", "active"]),
  );

  if (result.error) {
    result = await countSafe(
      supabase.from("listings").select("id", { count: "exact", head: true }),
    );
  }

  return result;
}

async function countSafe(query: PromiseLike<{ count: number | null; error: unknown }>): Promise<CountResult> {
  const result = await query;
  return { count: result.count ?? 0, error: result.error };
}

function emptyOperationsSummary(message: string) {
  return {
    productCount: 0,
    activeListingCount: 0,
    todayListingCount: 0,
    searchDemand24h: 0,
    searchDemandNote: message,
    lastBotRunLabel: "Yok",
    lastBotRunNote: message,
    lastErrorLabel: "Yok",
    lastErrorMessage: message,
    sourceHealthLabel: "0/0 aktif",
    sourceHealthNote: message,
    marketSignalLabel: "Bilinmiyor",
    marketSignalNote: message,
    operationsMessage: message,
  };
}

function QuickAction({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-black/8 bg-[#fafaf8] p-4 transition hover:-translate-y-0.5 hover:border-[#ff6b00]/35 hover:bg-white"
    >
      <span className="grid size-10 place-items-center rounded-xl bg-white text-[#ff6b00] group-hover:bg-[#fff1e7]">
        <Icon size={20} />
      </span>
      <h3 className="mt-3 text-sm font-black">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-black/45">{description}</p>
    </Link>
  );
}

function SignalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/8 px-4 py-3">
      <span className="text-sm font-semibold text-white/55">{label}</span>
      <span className="text-sm font-black">{value}</span>
    </div>
  );
}

function statusLabel(status: string) {
  if (status === "success" || status === "completed") return "Başarılı";
  if (status === "failed" || status === "error") return "Hata";
  if (status === "running") return "Çalışıyor";
  return status || "Bilinmiyor";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
