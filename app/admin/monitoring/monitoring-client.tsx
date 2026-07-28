"use client";

import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bot,
  CheckCircle2,
  Database,
  HeartPulse,
  Layers,
  ListChecks,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { AdminStatCard } from "@/components/admin-ui";
import type { MonitoringSummary } from "@/lib/monitoring";

function severityColor(severity: string) {
  switch (severity) {
    case "critical": return "text-red-600 bg-red-50 border-red-200";
    case "warning": return "text-amber-600 bg-amber-50 border-amber-200";
    case "info": return "text-blue-600 bg-blue-50 border-blue-200";
    default: return "text-gray-600 bg-gray-50 border-gray-200";
  }
}

function statusBadge(status: string) {
  switch (status) {
    case "healthy": return "bg-green-100 text-green-700 border-green-300";
    case "degraded": return "bg-amber-100 text-amber-700 border-amber-300";
    case "critical": return "bg-red-100 text-red-700 border-red-300";
    default: return "bg-gray-100 text-gray-700 border-gray-300";
  }
}

export function MonitoringClient({ summary }: { summary: MonitoringSummary }) {
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  return (
    <div className="grid gap-8">
      {/* Health Score */}
      <div className="rounded-2xl border border-black/7 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.035)] sm:p-6">
        <div className="flex items-center gap-3">
          <HeartPulse size={28} className="text-[#ff6b00]" />
          <div>
            <p className="text-sm font-bold text-black/45">Genel Sağlık Puanı</p>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-black tracking-[-0.04em]">
                {summary.overallHealth.overall}
              </span>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusBadge(summary.overallHealth.status)}`}
              >
                {summary.overallHealth.status === "healthy"
                  ? "Sağlıklı"
                  : summary.overallHealth.status === "degraded"
                    ? "Uyarı"
                    : "Kritik"}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {summary.overallHealth.components.map((c) => (
            <div
              key={c.name}
              className="rounded-xl border border-black/7 bg-[#fafafa] p-3"
            >
              <p className="text-xs font-bold text-black/45">{c.name.replace(/_/g, " ")}</p>
              <p className="mt-1 text-xl font-black">{c.score}</p>
              <p className={`text-xs font-medium ${c.status === "healthy" ? "text-green-600" : c.status === "degraded" ? "text-amber-600" : "text-red-600"}`}>
                {c.status === "healthy" ? "Sağlıklı" : c.status === "degraded" ? "Uyarı" : "Kritik"}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard
          label="Aktif Alarmlar"
          value={summary.activeAlertCount}
          icon={ShieldAlert}
          note={
            summary.criticalAlertCount > 0
              ? `${summary.criticalAlertCount} kritik, ${summary.warningAlertCount} uyarı`
              : summary.warningAlertCount > 0
                ? `${summary.warningAlertCount} uyarı`
                : "Aktif alarm yok"
          }
        />
        <AdminStatCard
          label="Sağlıklı Kaynaklar"
          value={`${summary.healthySourceCount}/${summary.totalSources}`}
          icon={CheckCircle2}
          note={
            summary.criticalSourceCount > 0
              ? `${summary.criticalSourceCount} kaynak kritik durumda`
              : summary.degradedSourceCount > 0
                ? `${summary.degradedSourceCount} kaynak uyarı durumunda`
                : "Tüm kaynaklar sağlıklı"
          }
        />
        <AdminStatCard
          label="Son 1s İçe Aktarma"
          value={summary.successfulImportsLastHour}
          icon={Database}
          note={
            summary.failedImportsLastHour > 0
              ? `${summary.failedImportsLastHour} başarısız`
              : "Başarısız içe aktarma yok"
          }
        />
        <AdminStatCard
          label="Kuyruk Derinliği"
          value={summary.totalQueueDepth}
          icon={Layers}
          note={
            summary.totalQueueDepth > 0
              ? `${summary.totalQueueDepth} iş bekliyor`
              : "Kuyruk boş"
          }
        />
      </div>

      {/* Alerts Section */}
      <div className="rounded-2xl border border-black/7 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.035)] sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-black tracking-[-0.03em]">
          <AlertTriangle size={20} className="text-[#ff6b00]" />
          Alarmlar
        </h2>

        {summary.activeAlertCount > 0 ? (
          <div className="mt-4 grid gap-2">
            {(showAllAlerts ? summary.alerts : summary.alerts.slice(0, 5)).map(
              (alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between rounded-xl border border-black/7 bg-[#fafafa] p-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full border p-1 ${severityColor(alert.severity)}`}
                    >
                      {alert.severity === "critical" ? (
                        <XCircle size={16} />
                      ) : (
                        <AlertTriangle size={16} />
                      )}
                    </span>
                    <div>
                      <p className="text-sm font-bold">{alert.title}</p>
                      <p className="text-xs text-black/45">
                        {alert.sourceName ?? "Bilinmeyen Kaynak"} —{" "}
                        {new Date(alert.triggeredAt).toLocaleString("tr-TR", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-bold ${
                      alert.severity === "critical"
                        ? "border-red-200 bg-red-50 text-red-600"
                        : "border-amber-200 bg-amber-50 text-amber-600"
                    }`}
                  >
                    {alert.severity === "critical" ? "KRİTİK" : "UYARI"}
                  </span>
                </div>
              ),
            )}
            {summary.alerts.length > 5 && !showAllAlerts && (
              <button
                type="button"
                onClick={() => setShowAllAlerts(true)}
                className="mt-2 rounded-xl border border-dashed border-black/15 py-2 text-sm font-bold text-[#ff6b00] hover:bg-[#fff1e7]"
              >
                Tümünü Göster ({summary.activeAlertCount})
              </button>
            )}
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-black/15 p-4 text-sm text-black/45">
            <CheckCircle2 size={16} className="text-green-500" />
            Aktif alarm bulunmuyor.
          </div>
        )}
      </div>

      {/* Health Details */}
      <div className="rounded-2xl border border-black/7 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.035)] sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-black tracking-[-0.03em]">
          <ListChecks size={20} className="text-[#ff6b00]" />
          Bileşen Detayları
        </h2>

        <div className="mt-4 grid gap-3">
          {summary.overallHealth.components.map((c) => (
            <div
              key={c.name}
              className="flex items-center justify-between rounded-xl border border-black/7 bg-[#fafafa] p-3"
            >
              <div className="flex items-center gap-3">
                {c.score >= 80 ? (
                  <CheckCircle2 size={18} className="text-green-500" />
                ) : c.score >= 50 ? (
                  <AlertTriangle size={18} className="text-amber-500" />
                ) : (
                  <XCircle size={18} className="text-red-500" />
                )}
                <div>
                  <p className="text-sm font-bold">
                    {c.name.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-black/45">{c.detail}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black">{c.score}</span>
                <span className="text-xs text-black/40">/ 100</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
