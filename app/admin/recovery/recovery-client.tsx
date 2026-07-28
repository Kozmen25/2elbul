"use client";

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  HeartPulse,
  Loader2,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AdminStatCard, AdminEmpty } from "@/components/admin-ui";

/* ───── Types ───── */

interface BreakerState {
  slug: string;
  state: string;
  failureCount: number;
  tripCount: number;
  lastFailureAt: string | null;
  openedAt: string | null;
  lastTestedAt: string | null;
}

interface DLQEntry {
  id: string;
  source_slug: string;
  queue_type: string;
  status: string;
  error_category: string;
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  next_retry_at: string | null;
  created_at: string;
  payload: Record<string, unknown> | null;
  notes: string | null;
}

interface DLQStats {
  pending: number;
  retrying: number;
  resolved: number;
  dead: number;
  total: number;
}

interface MetricsSummary {
  cbTrip: number;
  cbReset: number;
  cbHalfOpen: number;
  dlqInsert: number;
  dlqRetry: number;
  dlqResolve: number;
  recoverySuccess: number;
  recoveryFailure: number;
  total: number;
}

/* ───── Helpers ───── */

function breakerStateColor(state: string) {
  switch (state) {
    case "closed": return "text-green-600 bg-green-50 border-green-200";
    case "open": return "text-red-600 bg-red-50 border-red-200";
    case "half_open": return "text-amber-600 bg-amber-50 border-amber-200";
    default: return "text-gray-600 bg-gray-50 border-gray-200";
  }
}

function errorCategoryBadge(category: string) {
  switch (category) {
    case "network": return "bg-red-100 text-red-700";
    case "timeout": return "bg-orange-100 text-orange-700";
    case "http_server": return "bg-amber-100 text-amber-700";
    case "http_client": return "bg-yellow-100 text-yellow-700";
    case "rate_limit": return "bg-purple-100 text-purple-700";
    case "auth": return "bg-rose-100 text-rose-700";
    case "schema": return "bg-blue-100 text-blue-700";
    case "parser": return "bg-cyan-100 text-cyan-700";
    default: return "bg-gray-100 text-gray-700";
  }
}

function dlqStatusBadge(status: string) {
  switch (status) {
    case "pending": return "bg-amber-100 text-amber-700 border-amber-300";
    case "retrying": return "bg-blue-100 text-blue-700 border-blue-300";
    case "resolved": return "bg-green-100 text-green-700 border-green-300";
    case "dead": return "bg-red-100 text-red-700 border-red-300";
    default: return "bg-gray-100 text-gray-700 border-gray-300";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "closed": return "Kapalı";
    case "open": return "Açık";
    case "half_open": return "Yarı Açık";
    case "pending": return "Bekliyor";
    case "retrying": return "Tekrar Deniyor";
    case "resolved": return "Çözüldü";
    case "dead": return "Ölü";
    default: return status;
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ───── Tabs ───── */

type Tab = "breakers" | "dlq" | "metrics";

/* ───── Client Component ───── */

export function RecoveryClient() {
  const [tab, setTab] = useState<Tab>("breakers");

  return (
    <div className="grid gap-6">
      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-2xl border border-black/7 bg-white p-1 shadow-[0_12px_30px_rgba(0,0,0,0.035)]">
        {[
          { key: "breakers" as Tab, label: "Devre Kesiciler", icon: ShieldAlert },
          { key: "dlq" as Tab, label: "Ölü Kuyruk", icon: Database },
          { key: "metrics" as Tab, label: "Metrikler", icon: Activity },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
              tab === key
                ? "bg-[#ff6b00] text-white shadow-sm"
                : "text-black/45 hover:bg-black/5 hover:text-black/70"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {tab === "breakers" && <CircuitBreakersTab />}
      {tab === "dlq" && <DeadLetterTab />}
      {tab === "metrics" && <MetricsTab />}
    </div>
  );
}

/* ───── Circuit Breakers Tab ───── */

function CircuitBreakersTab() {
  const [breakers, setBreakers] = useState<BreakerState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);

  const fetchBreakers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/recovery/circuit-breakers");
      const data = await res.json();
      if (data.ok) setBreakers(data.breakers);
      else setError(data.error ?? "Veri alınamadı.");
    } catch {
      setError("Devre kesici verileri alınamadı.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBreakers(); }, [fetchBreakers]);

  const handleReset = async (slug: string) => {
    setResetting(slug);
    try {
      await fetch("/api/admin/recovery/circuit-breakers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      await fetchBreakers();
    } finally {
      setResetting(null);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchBreakers} />;

  if (!breakers.length) {
    return <AdminEmpty>Devre kesici bulunamadı.</AdminEmpty>;
  }

  return (
    <div className="rounded-2xl border border-black/7 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.035)] sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-black tracking-[-0.03em]">
          <ShieldAlert size={20} className="text-[#ff6b00]" />
          Devre Kesici Durumları
        </h2>
        <button
          type="button"
          onClick={fetchBreakers}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-[#ff6b00] hover:bg-[#fff1e7]"
        >
          <RefreshCw size={14} />
          Yenile
        </button>
      </div>

      <div className="mt-4 grid gap-2">
        {breakers.map((b) => (
          <div
            key={b.slug}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/7 bg-[#fafafa] p-3 sm:flex-nowrap"
          >
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-bold ${breakerStateColor(b.state)}`}
              >
                {statusLabel(b.state)}
              </span>
              <div>
                <p className="text-sm font-bold">{b.slug}</p>
                <p className="text-xs text-black/45">
                  {b.failureCount} hata · {b.tripCount} açılma
                  {b.lastFailureAt && ` · son hata: ${formatDate(b.lastFailureAt)}`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleReset(b.slug)}
              disabled={resetting === b.slug}
              className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-[#ff6b00] transition hover:bg-[#fff1e7] disabled:opacity-40"
            >
              <RefreshCw size={14} className={resetting === b.slug ? "animate-spin" : ""} />
              Sıfırla
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───── Dead Letter Tab ───── */

function DeadLetterTab() {
  const [entries, setEntries] = useState<DLQEntry[]>([]);
  const [stats, setStats] = useState<DLQStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [actioning, setActioning] = useState<string | null>(null);

  const fetchDLQ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (filterStatus) params.set("status", filterStatus);
      const res = await fetch(`/api/admin/recovery/dead-letter?${params}`);
      const data = await res.json();
      if (data.ok) {
        setEntries(data.entries);
        setStats(data.stats);
      } else {
        setError(data.error ?? "Veri alınamadı.");
      }
    } catch {
      setError("DLQ verileri alınamadı.");
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { fetchDLQ(); }, [fetchDLQ]);

  const handleAction = async (action: string, id?: string) => {
    const key = id ?? action;
    setActioning(key);
    try {
      await fetch("/api/admin/recovery/dead-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id }),
      });
      await fetchDLQ();
    } finally {
      setActioning(null);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchDLQ} />;

  return (
    <div className="grid gap-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <AdminStatCard label="Bekleyen" value={stats.pending} icon={Clock} />
          <AdminStatCard label="Tekrar Deniyor" value={stats.retrying} icon={RefreshCw} />
          <AdminStatCard label="Çözüldü" value={stats.resolved} icon={CheckCircle2} />
          <AdminStatCard label="Ölü" value={stats.dead} icon={XCircle} />
          <AdminStatCard label="Toplam" value={stats.total} icon={Database} />
        </div>
      )}

      {/* Filter & Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-xl border border-black/15 px-3 py-2 text-sm font-bold"
        >
          <option value="">Tüm Durumlar</option>
          <option value="pending">Bekleyen</option>
          <option value="retrying">Tekrar Deniyor</option>
          <option value="resolved">Çözüldü</option>
          <option value="dead">Ölü</option>
        </select>

        <button
          type="button"
          onClick={() => handleAction("retry-all")}
          disabled={actioning === "retry-all"}
          className="flex items-center gap-1.5 rounded-xl bg-[#ff6b00] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#e86000] disabled:opacity-40"
        >
          <RefreshCw size={14} className={actioning === "retry-all" ? "animate-spin" : ""} />
          Tümünü Tekrar Dene
        </button>

        <button
          type="button"
          onClick={fetchDLQ}
          className="flex items-center gap-1.5 rounded-xl border border-black/15 px-3 py-2 text-xs font-bold text-black/45 hover:bg-black/5"
        >
          <RefreshCw size={14} />
          Yenile
        </button>
      </div>

      {/* Entries */}
      <div className="rounded-2xl border border-black/7 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.035)] sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-black tracking-[-0.03em]">
          <Database size={20} className="text-[#ff6b00]" />
          Ölü Kuyruk Girdileri
        </h2>

        {entries.length === 0 ? (
          <AdminEmpty>Ölü kuyruk girdisi bulunmuyor.</AdminEmpty>
        ) : (
          <div className="mt-4 grid gap-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl border border-black/7 bg-[#fafafa] p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-bold ${dlqStatusBadge(entry.status)}`}
                    >
                      {statusLabel(entry.status)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${errorCategoryBadge(entry.error_category)}`}
                    >
                      {entry.error_category}
                    </span>
                    <span className="text-xs font-bold text-black/45">
                      {entry.source_slug}
                    </span>
                  </div>

                  <div className="flex gap-1">
                    {entry.status === "pending" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAction("retry", entry.id)}
                          disabled={actioning === entry.id}
                          className="rounded-lg px-2 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 disabled:opacity-40"
                        >
                          {actioning === entry.id ? "..." : "Tekrar Dene"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAction("resolve", entry.id)}
                          disabled={actioning === entry.id}
                          className="rounded-lg px-2 py-1 text-xs font-bold text-green-600 hover:bg-green-50 disabled:opacity-40"
                        >
                          Çöz
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAction("mark-dead", entry.id)}
                          disabled={actioning === entry.id}
                          className="rounded-lg px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-40"
                        >
                          Ölü İşaretle
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <p className="mt-2 text-xs text-black/60 break-words line-clamp-2">
                  {entry.last_error ?? "Hata mesajı yok"}
                </p>

                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-black/40">
                  <span>{entry.queue_type}</span>
                  <span>Deneme: {entry.retry_count}/{entry.max_retries}</span>
                  <span>{formatDate(entry.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ───── Metrics Tab ───── */

function MetricsTab() {
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/recovery/metrics");
      const data = await res.json();
      if (data.ok) setSummary(data.summary);
      else setError(data.error ?? "Veri alınamadı.");
    } catch {
      setError("Metrik verileri alınamadı.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchMetrics} />;
  if (!summary) return <AdminEmpty>Metrik bulunamadı.</AdminEmpty>;

  const metricCards = [
    { label: "Devre Kesici Açılması", value: summary.cbTrip, icon: ShieldAlert },
    { label: "Devre Kesici Sıfırlanması", value: summary.cbReset, icon: RefreshCw },
    { label: "Yarı Açık Geçiş", value: summary.cbHalfOpen, icon: AlertTriangle },
    { label: "DLQ Ekleme", value: summary.dlqInsert, icon: Database },
    { label: "DLQ Tekrar Deneme", value: summary.dlqRetry, icon: RefreshCw },
    { label: "DLQ Çözüm", value: summary.dlqResolve, icon: CheckCircle2 },
    { label: "Başarılı İyileşme", value: summary.recoverySuccess, icon: HeartPulse },
    { label: "Başarısız İyileşme", value: summary.recoveryFailure, icon: AlertCircle },
  ];

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((m) => (
          <AdminStatCard key={m.label} label={m.label} value={m.value} icon={m.icon} />
        ))}
      </div>

      <div className="rounded-2xl border border-black/7 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.035)] sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-black tracking-[-0.03em]">
          <Activity size={20} className="text-[#ff6b00]" />
          İyileşme Metrikleri Özeti
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left text-xs font-bold text-black/45">
                <th className="pb-2 pr-4">Metrik</th>
                <th className="pb-2 text-right">Değer</th>
              </tr>
            </thead>
            <tbody>
              {metricCards.map((m) => (
                <tr key={m.label} className="border-b border-black/5">
                  <td className="flex items-center gap-2 py-2.5 pr-4 font-medium">
                    <m.icon size={14} className="shrink-0 text-black/35" />
                    {m.label}
                  </td>
                  <td className="py-2.5 text-right font-bold">{m.value}</td>
                </tr>
              ))}
              <tr className="border-b border-black/5">
                <td className="flex items-center gap-2 py-2.5 pr-4 font-bold">
                  Toplam
                </td>
                <td className="py-2.5 text-right font-bold text-[#ff6b00]">
                  {summary.total}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ───── Shared States ───── */

function LoadingState() {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-dashed border-black/15 bg-white p-12">
      <Loader2 size={24} className="animate-spin text-black/25" />
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-red-200 bg-red-50 p-8 text-center">
      <XCircle size={32} className="mx-auto text-red-400" />
      <p className="mt-3 text-sm font-bold text-red-600">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
      >
        Tekrar Dene
      </button>
    </div>
  );
}
