import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  Minus,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import {
  formatOpportunityFreshness,
  formatOpportunityLevel,
} from "@/lib/opportunity-engine";
import {
  formatMarketConfidenceLevel,
} from "@/app/product/[slug]/market-intelligence-panel";
import { formatCurrencyTRY } from "@/lib/formatters";
import {
  buildCompareDecision,
  getComparePageData,
  type CompareCandidateSummary,
  type CompareReason,
} from "@/lib/compare-engine";
import { ListingImage } from "@/components/listing-image";

type ComparePageProps = {
  searchParams: Promise<{ a?: string; b?: string }>;
};

export const dynamic = "force-dynamic";

function readListingId(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

export async function generateMetadata({
  searchParams,
}: ComparePageProps): Promise<Metadata> {
  const { a, b } = await searchParams;
  const listingIdA = readListingId(a);
  const listingIdB = readListingId(b);

  if (!listingIdA || !listingIdB || listingIdA === listingIdB) {
    return {
      title: "İlan karşılaştır | 2ElBul",
      description:
        "İki ikinci el ilanı yan yana karşılaştır ve hangisini alman gerektiğine AI karar desteğiyle ulaş.",
      robots: { index: false, follow: false },
    };
  }

  const data = await getComparePageData(listingIdA, listingIdB);
  if (!data) {
    return {
      title: "İlan karşılaştır | 2ElBul",
      description:
        "İki ikinci el ilanı yan yana karşılaştır ve hangisini alman gerektiğine AI karar desteğiyle ulaş.",
      robots: { index: false, follow: false },
    };
  }

  const title = `${data.candidateA.productName} mi ${data.candidateB.productName} mi? | 2ElBul`;
  const description = `${data.candidateA.productName} ve ${data.candidateB.productName} ikinci el ilanları için AI karşılaştırması: fiyat, opportunity, risk, confidence ve duplicate sinyalleri.`;

  return {
    title,
    description,
    alternates: {
      canonical: data.canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: data.canonicalUrl,
      siteName: "2ElBul",
      locale: "tr_TR",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const { a, b } = await searchParams;
  const listingIdA = readListingId(a);
  const listingIdB = readListingId(b);

  const missingSelection = !listingIdA || !listingIdB;
  const sameSelection = Boolean(listingIdA && listingIdB && listingIdA === listingIdB);

  if (missingSelection || sameSelection) {
    return <CompareEmptyState sameSelection={sameSelection} />;
  }

  const data = await getComparePageData(listingIdA, listingIdB);
  if (!data) {
    return <CompareNotFound listingIdA={listingIdA!} listingIdB={listingIdB!} />;
  }

  const { candidateA, candidateB, decision, jsonLd, canonicalUrl } = data;

  return (
    <main className="min-w-0 bg-[#fafaf8] py-10 sm:py-14">
      {jsonLd.map((document, index) => (
        <script
          key={`${document["@type"]}-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(document).replace(/</g, "\\u003c"),
          }}
        />
      ))}

      <div className="container-shell min-w-0">
        <nav
          aria-label="breadcrumb"
          className="flex flex-wrap items-center gap-2 text-xs font-bold text-black/45"
        >
          <Link href="/" className="transition hover:text-[#d95700]">
            Ana Sayfa
          </Link>
          <ChevronRight size={12} />
          <span>İlan Karşılaştır</span>
        </nav>

        <DecisionCard
          candidateA={candidateA}
          candidateB={candidateB}
          decision={decision}
          canonicalUrl={canonicalUrl}
        />

        <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-stretch">
          <CandidateCard candidate={candidateA} highlight={decision.recommendedKey === "a"} />
          <VsDivider />
          <CandidateCard candidate={candidateB} highlight={decision.recommendedKey === "b"} />
        </section>

        <ComparisonTable
          candidateA={candidateA}
          candidateB={candidateB}
          decision={decision}
        />

        <BestDealSection
          candidateA={candidateA}
          candidateB={candidateB}
          decision={decision}
        />
      </div>
    </main>
  );
}

function DecisionCard({
  candidateA,
  candidateB,
  decision,
  canonicalUrl,
}: {
  candidateA: CompareCandidateSummary;
  candidateB: CompareCandidateSummary;
  decision: ReturnType<typeof buildCompareDecision>;
  canonicalUrl: string;
}) {
  const recommended = decision.recommendedKey === "a" ? candidateA : candidateB;
  const isTied = decision.tied;
  const isInsufficient = decision.insufficientData;

  return (
    <section className="mt-4 rounded-3xl border border-[#ff6b00]/18 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8 lg:p-10">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-[#fff1e7] text-[#ff6b00]">
          <Sparkles size={22} />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#ff6b00]">
            AI Kararı
          </p>
          <h1 className="mt-1 break-words text-3xl font-black tracking-[-0.035em] sm:text-4xl">
            Hangisini almalısın?
          </h1>
        </div>
      </div>

      <div
        className={`mt-6 rounded-3xl border p-5 sm:p-6 ${
          isInsufficient
            ? "border-amber-200 bg-amber-50"
            : isTied
              ? "border-slate-200 bg-slate-50"
              : "border-[#ff6b00]/20 bg-[#fff7f1]"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-black/45">
              {isInsufficient ? "Durum" : isTied ? "Sonuç" : "Önerilen ilan"}
            </p>
            <p className="mt-2 break-words text-2xl font-black tracking-[-0.04em] text-[#d95700] sm:text-3xl">
              {decision.recommendedLabel}
            </p>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-black/60">
              {decision.headline}
            </p>
          </div>
          {!isInsufficient && !isTied ? (
            <Link
              href={recommended.url}
              target="_blank"
              rel="noopener noreferrer"
              className="orange-button shrink-0 justify-center px-5 py-3"
            >
              Önerilen ilanı incele
              <ArrowUpRight size={17} />
            </Link>
          ) : null}
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {decision.reasons.map((reason, index) => (
            <ReasonRow
              key={`${reason.label}-${index}`}
              reason={reason}
              candidateA={candidateA}
              candidateB={candidateB}
            />
          ))}
        </div>
      </div>

      <p className="mt-4 text-xs font-semibold leading-6 text-black/40">
        Bu karar, mevcut Product Intelligence, Market Intelligence, Opportunity Engine,
        Confidence ve Duplicate Engine çıktılarından üretilir. Karar notu ilanlar
        güncellendikçe otomatik değişir. Kanonik URL: {canonicalUrl}
      </p>
    </section>
  );
}

function ReasonRow({
  reason,
  candidateA,
  candidateB,
}: {
  reason: CompareReason;
  candidateA: CompareCandidateSummary;
  candidateB: CompareCandidateSummary;
}) {
  const isNeutral = reason.winnerKey === null;
  const Icon = isNeutral ? Minus : CheckCircle2;

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold leading-6 ${
        isNeutral
          ? "border-slate-200 bg-white text-black/55"
          : "border-green-100 bg-green-50 text-green-900"
      }`}
    >
      <Icon
        size={18}
        className={isNeutral ? "mt-0.5 shrink-0 text-black/30" : "mt-0.5 shrink-0 text-green-600"}
      />
      <span className="min-w-0">
        {reason.label}
        {!isNeutral ? (
          <span className="ml-1 text-xs font-black text-green-700">
            ({reason.winnerKey === "a" ? candidateA.productName : candidateB.productName})
          </span>
        ) : null}
      </span>
    </div>
  );
}

function CandidateCard({
  candidate,
  highlight,
}: {
  candidate: CompareCandidateSummary;
  highlight: boolean;
}) {
  return (
    <article
      className={`flex flex-col rounded-3xl border bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-6 ${
        highlight ? "border-[#ff6b00]/40 ring-1 ring-[#ff6b00]/30" : "border-black/8"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full border border-black/10 bg-[#fafaf8] px-3 py-1 text-xs font-black text-black/55">
          {candidate.key === "a" ? "İlan A" : "İlan B"}
        </span>
        {highlight ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#ff6b00]/30 bg-[#fff7f1] px-3 py-1 text-xs font-black text-[#d95700]">
            <BadgeCheck size={14} /> Önerilen
          </span>
        ) : null}
      </div>

      <Link href={candidate.productUrl} className="mt-4 block">
        <ListingImage
          imageUrl={candidate.imageUrl}
          productName={candidate.productName}
          alt={candidate.title}
        />
      </Link>

      <p className="mt-4 text-xs font-bold text-[#ff6b00]">{candidate.productName}</p>
      <h2 className="mt-2 break-words text-lg font-black leading-6">{candidate.title}</h2>

      <p className="mt-4 text-3xl font-black tracking-[-0.04em] text-[#ff6b00]">
        {formatPrice(candidate.price)}
      </p>
      <p className="mt-1 text-xs font-semibold text-black/45">{candidate.condition}</p>

      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-black/7 pt-4 text-xs font-semibold text-black/50">
        <span>{candidate.source}</span>
        <span className="text-right">{candidate.city}</span>
      </div>

      <Link
        href={candidate.url}
        target="_blank"
        rel="noopener noreferrer"
        className="orange-button mt-5 w-full justify-center py-3"
      >
        Bu ilanı incele
        <ArrowUpRight size={17} />
      </Link>
    </article>
  );
}

function VsDivider() {
  return (
    <div className="hidden items-center justify-center lg:flex">
      <span className="grid size-12 place-items-center rounded-full border border-black/10 bg-white text-sm font-black text-black/50 shadow-sm">
        VS
      </span>
    </div>
  );
}

function ComparisonTable({
  candidateA,
  candidateB,
  decision,
}: {
  candidateA: CompareCandidateSummary;
  candidateB: CompareCandidateSummary;
  decision: ReturnType<typeof buildCompareDecision>;
}) {
  const rows: Array<{
    label: string;
    valueA: string;
    valueB: string;
    winnerKey: CompareReason["winnerKey"];
  }> = [
    {
      label: "Fiyat",
      valueA: formatPrice(candidateA.price),
      valueB: formatPrice(candidateB.price),
      winnerKey: lowerPriceWinner(candidateA, candidateB),
    },
    {
      label: "Risk",
      valueA: formatOpportunityLevel(candidateA.riskLevel),
      valueB: formatOpportunityLevel(candidateB.riskLevel),
      winnerKey: riskWinner(candidateA, candidateB),
    },
    {
      label: "Confidence",
      valueA: `${candidateA.confidenceScore}/100 · ${formatMarketConfidenceLevel(candidateA.confidenceLevel)}`,
      valueB: `${candidateB.confidenceScore}/100 · ${formatMarketConfidenceLevel(candidateB.confidenceLevel)}`,
      winnerKey: confidenceWinner(candidateA, candidateB),
    },
    {
      label: "Opportunity",
      valueA: `${candidateA.opportunityScore}/100`,
      valueB: `${candidateB.opportunityScore}/100`,
      winnerKey: opportunityWinner(candidateA, candidateB),
    },
    {
      label: "Kaynak",
      valueA: `${candidateA.sourceCount} kaynak`,
      valueB: `${candidateB.sourceCount} kaynak`,
      winnerKey: sourceWinner(candidateA, candidateB),
    },
    {
      label: "Duplicate",
      valueA: `%${Math.round(candidateA.duplicateDensity * 100)}`,
      valueB: `%${Math.round(candidateB.duplicateDensity * 100)}`,
      winnerKey: duplicateWinner(candidateA, candidateB),
    },
    {
      label: "Fiyat avantajı",
      valueA: formatAdvantageCell(candidateA.priceAdvantagePercent),
      valueB: formatAdvantageCell(candidateB.priceAdvantagePercent),
      winnerKey: advantageWinner(candidateA, candidateB),
    },
    {
      label: "Trend",
      valueA: formatTrend(candidateA.trendDirection, candidateA.trendChangePercent),
      valueB: formatTrend(candidateB.trendDirection, candidateB.trendChangePercent),
      winnerKey: null,
    },
    {
      label: "Data Freshness",
      valueA: formatOpportunityFreshness(candidateA.dataFreshness),
      valueB: formatOpportunityFreshness(candidateB.dataFreshness),
      winnerKey: freshnessWinner(candidateA, candidateB),
    },
    {
      label: "Recommendation",
      valueA: candidateA.recommendation.label,
      valueB: candidateB.recommendation.label,
      winnerKey: recommendationWinner(candidateA, candidateB),
    },
  ];

  return (
    <section className="mt-6 rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#fff1e7] text-[#ff6b00]">
          <BadgeCheck size={21} />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#ff6b00]">
            Karşılaştırma tablosu
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.035em]">Sinyal Sinyal</h2>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs font-black uppercase tracking-[0.06em] text-black/45">
              <th className="w-1/3 border-b border-black/8 px-4 py-3">Sinyal</th>
              <th className="w-1/3 border-b border-black/8 px-4 py-3">{candidateA.productName}</th>
              <th className="w-1/3 border-b border-black/8 px-4 py-3">{candidateB.productName}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="align-top">
                <td className="border-b border-black/5 px-4 py-3 font-bold text-black/55">
                  {row.label}
                </td>
                <td className="border-b border-black/5 px-4 py-3">
                  <ComparisonCell value={row.valueA} isWinner={row.winnerKey === "a"} />
                </td>
                <td className="border-b border-black/5 px-4 py-3">
                  <ComparisonCell value={row.valueB} isWinner={row.winnerKey === "b"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs font-semibold leading-6 text-black/40">
        {decision.insufficientData
          ? "Örneklem yetersiz olduğu için tablo yalnızca bilgi amaçlıdır."
          : "Yeşil hücreler ilgili satırda öne çıkan ilanı gösterir."}
      </p>
    </section>
  );
}

function ComparisonCell({ value, isWinner }: { value: string; isWinner: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black ${
        isWinner
          ? "border border-green-200 bg-green-50 text-green-800"
          : "border border-black/8 bg-[#fafaf8] text-black/60"
      }`}
    >
      {value}
    </span>
  );
}

function BestDealSection({
  candidateA,
  candidateB,
  decision,
}: {
  candidateA: CompareCandidateSummary;
  candidateB: CompareCandidateSummary;
  decision: ReturnType<typeof buildCompareDecision>;
}) {
  if (decision.insufficientData || decision.tied || !decision.recommendedKey) {
    return null;
  }
  const best = decision.recommendedKey === "a" ? candidateA : candidateB;

  return (
    <section className="mt-6 rounded-3xl border border-[#ff6b00]/25 bg-[#fff7f1] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.05)] sm:p-8 lg:p-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#d95700]/75">
            En iyi ilan
          </p>
          <h2 className="mt-2 break-words text-3xl font-black tracking-[-0.035em] sm:text-4xl">
            {best.productName}
          </h2>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-black/60">
            {best.title} · {formatPrice(best.price)} · {best.source} · {best.city}
          </p>
          <p className="mt-3 text-sm font-semibold text-black/55">
            Fırsat skoru {best.opportunityScore}/100 · Risk{" "}
            {formatOpportunityLevel(best.riskLevel)} · Confidence {best.confidenceScore}/100
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-3">
          <Link
            href={best.url}
            target="_blank"
            rel="noopener noreferrer"
            className="orange-button justify-center px-6 py-4 text-base"
          >
            Bu ilanı incele
            <ArrowUpRight size={18} />
          </Link>
          <Link
            href={best.productUrl}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-black text-black/70 transition hover:border-[#ff6b00]/35 hover:text-[#d95700]"
          >
            Ürün analizine git
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function CompareEmptyState({ sameSelection }: { sameSelection: boolean }) {
  return (
    <main className="min-w-0 bg-[#fafaf8] py-10 sm:py-14">
      <div className="container-shell min-w-0">
        <nav
          aria-label="breadcrumb"
          className="flex flex-wrap items-center gap-2 text-xs font-bold text-black/45"
        >
          <Link href="/" className="transition hover:text-[#d95700]">
            Ana Sayfa
          </Link>
          <ChevronRight size={12} />
          <span>İlan Karşılaştır</span>
        </nav>

        <section className="mt-4 rounded-3xl border border-black/8 bg-white p-6 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-10">
          <span className="grid size-12 place-items-center rounded-2xl bg-[#fff1e7] text-[#ff6b00]">
            <Sparkles size={24} />
          </span>
          <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
            İki ilanı karşılaştır
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-black/55">
            URL&apos;e <code className="rounded bg-[#fafaf8] px-1.5 py-0.5 text-xs font-bold">?a=&lt;ilanId&gt;&amp;b=&lt;ilanId&gt;</code> ekleyerek
            iki ilanı yan yana getir ve AI karar desteğini gör.
          </p>
          {sameSelection ? (
            <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
              <TriangleAlert className="mt-0.5 shrink-0" size={17} />
              <span>Aynı ilan ID iki kez seçildi. Farklı iki ilan seçmelisin.</span>
            </div>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/search"
              className="orange-button justify-center px-5 py-3"
            >
              İlanları ara
              <ArrowUpRight size={17} />
            </Link>
            <Link
              href="/market"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-black text-black/70 transition hover:border-[#ff6b00]/35 hover:text-[#d95700]"
            >
              Piyasa merkezi
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function CompareNotFound({
  listingIdA,
  listingIdB,
}: {
  listingIdA: string;
  listingIdB: string;
}) {
  return (
    <main className="min-w-0 bg-[#fafaf8] py-10 sm:py-14">
      <div className="container-shell min-w-0">
        <nav
          aria-label="breadcrumb"
          className="flex flex-wrap items-center gap-2 text-xs font-bold text-black/45"
        >
          <Link href="/" className="transition hover:text-[#d95700]">
            Ana Sayfa
          </Link>
          <ChevronRight size={12} />
          <span>İlan Karşılaştır</span>
        </nav>

        <section className="mt-4 rounded-3xl border border-black/8 bg-white p-6 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-10">
          <span className="grid size-12 place-items-center rounded-2xl bg-amber-50 text-amber-600">
            <TriangleAlert size={24} />
          </span>
          <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
            İlanlar karşılaştırılamadı
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-black/55">
            Seçilen ilanlardan biri veya ikisi bulunamadı, yayından kalkmış veya
            ürün eşleşmesi kurulamamış olabilir.
          </p>
          <p className="mt-2 text-xs font-semibold text-black/40">
            İlan A: {listingIdA} · İlan B: {listingIdB}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/search" className="orange-button justify-center px-5 py-3">
              Yeni arama yap
              <ArrowUpRight size={17} />
            </Link>
            <Link
              href="/market"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-black text-black/70 transition hover:border-[#ff6b00]/35 hover:text-[#d95700]"
            >
              Piyasa merkezi
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function lowerPriceWinner(a: CompareCandidateSummary, b: CompareCandidateSummary) {
  if (a.price === b.price) return null;
  return a.price < b.price ? "a" : "b";
}

function riskWinner(a: CompareCandidateSummary, b: CompareCandidateSummary) {
  const rankA = riskRank(a.riskLevel);
  const rankB = riskRank(b.riskLevel);
  if (rankA === rankB) return null;
  return rankA < rankB ? "a" : "b";
}

function confidenceWinner(a: CompareCandidateSummary, b: CompareCandidateSummary) {
  if (a.confidenceScore === b.confidenceScore) return null;
  return a.confidenceScore > b.confidenceScore ? "a" : "b";
}

function opportunityWinner(a: CompareCandidateSummary, b: CompareCandidateSummary) {
  if (a.opportunityScore === b.opportunityScore) return null;
  return a.opportunityScore > b.opportunityScore ? "a" : "b";
}

function sourceWinner(a: CompareCandidateSummary, b: CompareCandidateSummary) {
  if (a.sourceCount === b.sourceCount) return null;
  return a.sourceCount > b.sourceCount ? "a" : "b";
}

function duplicateWinner(a: CompareCandidateSummary, b: CompareCandidateSummary) {
  if (a.duplicateDensity === b.duplicateDensity) return null;
  return a.duplicateDensity < b.duplicateDensity ? "a" : "b";
}

function advantageWinner(a: CompareCandidateSummary, b: CompareCandidateSummary) {
  const va = a.priceAdvantagePercent ?? null;
  const vb = b.priceAdvantagePercent ?? null;
  if (va === null && vb === null) return null;
  if (va === null) return "b";
  if (vb === null) return "a";
  if (va === vb) return null;
  return va > vb ? "a" : "b";
}

function freshnessWinner(a: CompareCandidateSummary, b: CompareCandidateSummary) {
  const rankA = freshnessRank(a.dataFreshness);
  const rankB = freshnessRank(b.dataFreshness);
  if (rankA === rankB) return null;
  return rankA < rankB ? "a" : "b";
}

function recommendationWinner(a: CompareCandidateSummary, b: CompareCandidateSummary) {
  const rankA = recommendationRank(a.recommendation.action);
  const rankB = recommendationRank(b.recommendation.action);
  if (rankA === rankB) return null;
  return rankA < rankB ? "a" : "b";
}

function riskRank(level: string) {
  if (level === "very-low") return 0;
  if (level === "low") return 1;
  if (level === "medium") return 2;
  if (level === "high") return 3;
  return 4;
}

function freshnessRank(freshness: string) {
  if (freshness === "fresh") return 0;
  if (freshness === "recent") return 1;
  if (freshness === "stale") return 2;
  return 3;
}

function recommendationRank(action: string) {
  if (action === "buy_now") return 0;
  if (action === "watch") return 1;
  if (action === "wait") return 2;
  if (action === "avoid") return 3;
  return 4;
}

function formatAdvantageCell(value: number | null) {
  if (value === null) return "—";
  return `%${Math.max(0, Math.round(value))}`;
}

function formatTrend(
  direction: "rising" | "falling" | "stable" | "unknown",
  changePercent: number | null,
) {
  if (direction === "unknown") return "—";
  const label =
    direction === "falling"
      ? "Düşüyor"
      : direction === "rising"
        ? "Yükseliyor"
        : "Stabil";
  return changePercent === null ? label : `${label} %${Math.abs(changePercent)}`;
}

function formatPrice(value: number) {
  return formatCurrencyTRY(value);
}
