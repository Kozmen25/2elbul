import {
  ChartNoAxesCombined,
  Clock3,
  Store,
  Tag,
  TriangleAlert,
} from "lucide-react";
import type { MarketIntelligence } from "@/lib/market-intelligence";

export function MarketIntelligencePanel({
  marketIntelligence,
}: {
  marketIntelligence: MarketIntelligence;
}) {
  const confidence = getConfidencePresentation(marketIntelligence);
  const sampleSize = marketIntelligence.sampleSize;
  const hasEnoughData = sampleSize >= 3;
  const sourcesLabel = formatMarketIntelligenceSources(
    marketIntelligence.sourcesUsed,
  );

  return (
    <section className="mt-8 rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
      <PanelHeader
        icon={ChartNoAxesCombined}
        eyebrow="Market Intelligence"
        title="Piyasa Zekâsı"
      />

      <p className="mt-4 text-sm leading-6 text-black/55">
        {marketIntelligence.marketSummary.summary}
      </p>

      <div
        className={`mt-4 rounded-2xl border px-4 py-3 ${
          hasEnoughData
            ? "border-green-100 bg-green-50 text-green-800"
            : "border-amber-200 bg-amber-50 text-amber-800"
        }`}
      >
        <p className="text-xs font-black uppercase tracking-[0.08em]">
          {hasEnoughData ? "Analiz özeti" : "Yetersiz veri"}
        </p>
        <p className="mt-2 text-sm font-semibold leading-6">
          {hasEnoughData
            ? `Bu analiz ${sampleSize} ilan üzerinden oluşturuldu.`
            : `Bu ürün için henüz yeterli ilan verisi yok. Daha güvenilir analiz için daha fazla ilan gerekiyor.`}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
        <MarketMetric
          label="Piyasa ortalaması"
          value={formatMarketPrice(marketIntelligence.priceAnalysis.averagePrice)}
        />
        <MarketMetric
          label="En düşük fiyat"
          value={formatMarketPrice(marketIntelligence.priceAnalysis.minPrice)}
        />
        <MarketMetric
          label="En yüksek fiyat"
          value={formatMarketPrice(marketIntelligence.priceAnalysis.maxPrice)}
        />
        <MarketMetric
          label="Medyan fiyat"
          value={formatMarketPrice(marketIntelligence.priceAnalysis.medianPrice)}
        />
        <MarketMetric
          label="Aktif ilan sayısı"
          value={String(marketIntelligence.marketSummary.activeListingCount)}
        />
        <MarketMetric label="Örneklem büyüklüğü" value={String(sampleSize)} />
        <MarketMetric
          label="Güven seviyesi"
          value={confidence.label}
          toneClassName={confidence.toneClassName}
        />
        <MarketMetric
          label="Fırsat skoru"
          value={`${marketIntelligence.opportunity.score}/100`}
          toneClassName="border-[#ff6b00]/20 bg-[#fff7f1] text-[#d95700]"
        />
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
        <div className="rounded-2xl border border-black/8 bg-[#fafaf8] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.08em] text-black/35">
            Kullanılan kaynaklar
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-black/60">
            {sourcesLabel}
          </p>
          <div className="mt-4 grid gap-2 text-xs font-semibold text-black/45 sm:grid-cols-2">
            <span className="inline-flex items-center gap-2">
              <Store size={14} /> {marketIntelligence.marketSummary.sourceCount} kaynak grubu
            </span>
            <span className="inline-flex items-center gap-2">
              <Tag size={14} /> {marketIntelligence.marketSummary.duplicateDensity
                ? `%${Math.round(marketIntelligence.marketSummary.duplicateDensity * 100)} duplicate yoğunluğu`
                : "Duplicate yoğunluğu düşük"}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-black/8 bg-[#fafaf8] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.08em] text-black/35">
            Analiz güncelleme zamanı
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-black/60">
            Son güncelleme: {formatMarketIntelligenceTimestamp(marketIntelligence.analysisGeneratedAt)}
          </p>
          <p className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-black/45">
            <Clock3 size={14} /> {confidence.description}
          </p>
        </div>
      </div>

      {!hasEnoughData ? (
        <div className="mt-5 flex gap-3 rounded-2xl border border-dashed border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
          <TriangleAlert className="mt-0.5 shrink-0" size={17} />
          <span>Yetersiz veri: yorumun gücü sınırlı, daha fazla ilan geldikçe panel otomatik güçlenecek.</span>
        </div>
      ) : null}
    </section>
  );
}

export function formatMarketConfidenceLevel(
  level: MarketIntelligence["confidenceLevel"],
) {
  if (level === "very-high") return "Çok yüksek";
  if (level === "high") return "Yüksek";
  if (level === "medium") return "Orta";
  if (level === "low") return "Düşük";
  return "Çok düşük";
}

export function formatMarketIntelligenceSources(sources: string[]) {
  const cleaned = sources.map((source) => source.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned.join(", ") : "Henüz kaynak yok";
}

export function formatMarketIntelligenceTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function getConfidencePresentation(
  marketIntelligence: MarketIntelligence,
) {
  const insufficient = marketIntelligence.sampleSize < 3;
  return {
    label: insufficient
      ? "Yetersiz veri"
      : formatMarketConfidenceLevel(marketIntelligence.confidenceLevel),
    toneClassName: insufficient
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : marketIntelligence.confidenceLevel === "very-high"
        ? "border-green-200 bg-green-50 text-green-800"
        : marketIntelligence.confidenceLevel === "high"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : marketIntelligence.confidenceLevel === "medium"
            ? "border-sky-200 bg-sky-50 text-sky-800"
            : "border-red-200 bg-red-50 text-red-800",
    description: insufficient
      ? "Daha sağlıklı yorum için daha fazla ilan gerekiyor."
      : marketIntelligence.confidenceReasons[0] ??
        "Bu ürün için piyasa analizi üretildi.",
  };
}

function formatMarketPrice(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "—";

  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}

function MarketMetric({
  label,
  value,
  toneClassName = "border-black/8 bg-[#fafaf8] text-black/65",
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
      <p className="mt-2 break-words text-base font-black leading-6" title={value}>
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
  icon: typeof ChartNoAxesCombined;
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
