import {
  Clock3,
  Store,
  Tag,
  TriangleAlert,
  Zap,
} from "lucide-react";
import type { MarketIntelligence } from "@/lib/market-intelligence";
import type { OpportunityAnalysis } from "@/lib/opportunity-engine";
import {
  formatOpportunityFreshness,
  formatOpportunityLevel,
} from "@/lib/opportunity-engine";
import {
  formatMarketConfidenceLevel,
  formatMarketIntelligenceSources,
  formatMarketIntelligenceTimestamp,
} from "./market-intelligence-panel";

export function OpportunityScorePanel({
  opportunityAnalysis,
  marketIntelligence,
}: {
  opportunityAnalysis: OpportunityAnalysis;
  marketIntelligence: MarketIntelligence;
}) {
  const hasInsufficientData =
    opportunityAnalysis.recommendation.action === "insufficient_data" ||
    opportunityAnalysis.sampleSize < 3;
  const sourceCount = marketIntelligence.marketSummary.sourceCount;
  const sourcesLabel = formatMarketIntelligenceSources(
    marketIntelligence.sourcesUsed,
  );

  return (
    <section className="mt-8 rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
      <PanelHeader
        icon={Zap}
        eyebrow="Karar desteği"
        title="Fırsat Skoru"
      />

      <p className="mt-4 text-sm leading-6 text-black/55">
        Bu skor, mevcut piyasa sinyallerini birleştirerek "şu an almak mantıklı mı?" sorusuna cevap verir.
      </p>

      {hasInsufficientData ? (
        <div className="mt-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
          <TriangleAlert className="mt-0.5 shrink-0" size={17} />
          <span>
            Yetersiz veri: güvenilir bir alım kararı için daha fazla ilan ve kaynak gerekiyor.
          </span>
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
        <section className="rounded-2xl border border-[#ff6b00]/20 bg-[#fff7f1] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#d95700]/70">
            Fırsat skoru
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <p className="text-5xl font-black tracking-[-0.07em] text-[#d95700]">
              {opportunityAnalysis.opportunityScore}
              <span className="text-xl text-black/35">/100</span>
            </p>
            <span className={`rounded-full border px-3 py-1.5 text-xs font-black ${getOpportunityToneClassName(opportunityAnalysis.opportunityLevel)}`}>
              {formatOpportunityLevel(opportunityAnalysis.opportunityLevel)}
            </span>
          </div>
          <p className="mt-4 text-sm font-semibold leading-6 text-black/60">
            {opportunityAnalysis.recommendation.description}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              label="Risk seviyesi"
              value={formatOpportunityLevel(opportunityAnalysis.riskLevel)}
              toneClassName={getRiskToneClassName(opportunityAnalysis.riskLevel)}
            />
            <MetricCard
              label="Karar önerisi"
              value={opportunityAnalysis.recommendation.label}
              toneClassName={getRecommendationToneClassName(
                opportunityAnalysis.recommendation.action,
              )}
            />
            <MetricCard
              label="Örneklem büyüklüğü"
              value={`${opportunityAnalysis.sampleSize}`}
            />
            <MetricCard
              label="Güven seviyesi"
              value={formatMarketConfidenceLevel(
                opportunityAnalysis.confidenceLevel,
              )}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-black/8 bg-[#fafaf8] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.08em] text-black/35">
            Analiz özeti
          </p>
          <p className="mt-3 text-sm font-semibold leading-6 text-black/60">
            Bu öneri {opportunityAnalysis.sampleSize} ilan ve {sourceCount} kaynak üzerinden hesaplandı.
          </p>

          <div className="mt-4 space-y-2 text-xs font-semibold text-black/45">
            <div className="flex items-start gap-2">
              <Store className="mt-0.5 shrink-0" size={14} />
              <span className="min-w-0 break-words">
                Kullanılan kaynaklar: {sourcesLabel}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Clock3 className="mt-0.5 shrink-0" size={14} />
              <span className="min-w-0 break-words">
                Skor üretim zamanı:{" "}
                {formatMarketIntelligenceTimestamp(
                  opportunityAnalysis.scoreGeneratedAt,
                )}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Tag className="mt-0.5 shrink-0" size={14} />
              <span className="min-w-0 break-words">
                Veri tazeliği:{" "}
                {formatOpportunityFreshness(opportunityAnalysis.dataFreshness)}
              </span>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-black/8 bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-black/35">
              Skor gerekçeleri
            </p>
            {opportunityAnalysis.reasons.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm font-semibold leading-6 text-black/60">
                {opportunityAnalysis.reasons.map((reason) => (
                  <li key={reason} className="rounded-2xl border border-black/8 bg-[#fafaf8] px-3 py-2">
                    {reason}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm font-semibold leading-6 text-black/60">
                {opportunityAnalysis.recommendation.description}
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <SignalList
          title="Pozitif sinyaller"
          items={opportunityAnalysis.positiveSignals}
          tone="positive"
        />
        <SignalList
          title="Uyarı sinyalleri"
          items={opportunityAnalysis.warningSignals}
          tone="warning"
        />
      </div>
    </section>
  );
}

function SignalList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "positive" | "warning";
}) {
  const isPositive = tone === "positive";
  const toneClasses = isPositive
    ? "border-green-100 bg-green-50 text-green-800"
    : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <section className={`rounded-2xl border p-4 ${toneClasses}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.08em]">
        {title}
      </p>
      {items.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <li
              key={item}
              className="rounded-full border border-black/8 bg-white px-3 py-1.5 text-xs font-semibold leading-5 text-black/60"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm font-semibold leading-6">
          {isPositive
            ? "Belirgin pozitif sinyal yok."
            : "Belirgin uyarı sinyali yok."}
        </p>
      )}
    </section>
  );
}

function MetricCard({
  label,
  value,
  toneClassName = "border-black/8 bg-white text-black/65",
}: {
  label: string;
  value: string;
  toneClassName?: string;
}) {
  return (
    <div className={`min-w-0 rounded-2xl border p-4 ${toneClassName}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-black/35">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-black leading-6" title={value}>
        {value}
      </p>
    </div>
  );
}

function PanelHeader({
  icon: Icon,
  eyebrow,
  title,
}: {
  icon: typeof Zap;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="flex items-end gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#fff1e7] text-[#ff6b00]">
        <Icon size={21} />
      </span>
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ff6b00]">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-2xl font-black tracking-[-0.035em]">
          {title}
        </h2>
      </div>
    </div>
  );
}

function getOpportunityToneClassName(
  level: OpportunityAnalysis["opportunityLevel"],
) {
  if (level === "very-high") return "border-green-200 bg-green-50 text-green-800";
  if (level === "high") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (level === "medium") return "border-sky-200 bg-sky-50 text-sky-800";
  if (level === "low") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-red-200 bg-red-50 text-red-800";
}

function getRiskToneClassName(level: OpportunityAnalysis["riskLevel"]) {
  if (level === "very-high") return "border-red-200 bg-red-50 text-red-800";
  if (level === "high") return "border-orange-200 bg-orange-50 text-orange-800";
  if (level === "medium") return "border-amber-200 bg-amber-50 text-amber-800";
  if (level === "low") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  return "border-green-200 bg-green-50 text-green-800";
}

function getRecommendationToneClassName(
  action: OpportunityAnalysis["recommendation"]["action"],
) {
  if (action === "buy_now") return "border-green-200 bg-green-50 text-green-800";
  if (action === "watch") return "border-sky-200 bg-sky-50 text-sky-800";
  if (action === "wait") return "border-amber-200 bg-amber-50 text-amber-800";
  if (action === "avoid") return "border-red-200 bg-red-50 text-red-800";
  return "border-slate-200 bg-slate-50 text-slate-800";
}
