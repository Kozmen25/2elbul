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
  findExtremeIndex,
  type CompareCandidateSummary,
  type CompareReason,
} from "@/lib/compare-engine";
import { extractProductTypeFromAttributes } from "@/lib/market-intelligence/helpers";
import { ListingImage } from "@/components/listing-image";

type ComparePageProps = {
  searchParams: Promise<{ ids?: string; a?: string; b?: string }>;
};

export const dynamic = "force-dynamic";

/** Parse ?ids=id1,id2,id3,id4 or legacy ?a=id1&b=id2 into an ID array. */
function parseListingIds(params: {
  ids?: string;
  a?: string;
  b?: string;
}): string[] | null {
  if (params.ids) {
    const ids = params.ids.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length < 2 || ids.length > 4) return null;
    if (new Set(ids).size !== ids.length) return null;
    return ids;
  }
  if (params.a && params.b) {
    return [params.a.trim(), params.b.trim()];
  }
  return null;
}

/** Detect duplicate IDs in the URL for the error message. */
function hasDuplicateIds(params: {
  ids?: string;
  a?: string;
  b?: string;
}): boolean {
  if (params.ids) {
    const ids = params.ids.split(",").map((s) => s.trim()).filter(Boolean);
    return new Set(ids).size !== ids.length;
  }
  if (params.a && params.b && params.a.trim() === params.b.trim()) {
    return true;
  }
  return false;
}

/** Lightweight check: were listings found but with different product types? */
async function detectCrossTypeConflict(
  listingIds: string[],
): Promise<boolean> {
  const { createSupabaseClient } = await import("@/lib/supabase");
  const supabase = createSupabaseClient();
  if (!supabase) return false;

  const productTypes: string[] = [];
  for (const id of listingIds) {
    const { data: listing } = await supabase
      .from("listings")
      .select("product_id")
      .eq("id", id)
      .maybeSingle();
    if (!listing?.product_id) return false;

    const { data: product } = await supabase
      .from("products")
      .select("attributes")
      .eq("id", String(listing.product_id))
      .maybeSingle();
    if (!product?.attributes) continue;

    const pt = extractProductTypeFromAttributes(
      product.attributes as Record<string, unknown>,
    );
    if (pt) productTypes.push(pt);
  }

  return new Set(productTypes).size > 1;
}

export async function generateMetadata({
  searchParams,
}: ComparePageProps): Promise<Metadata> {
  const params = await searchParams;
  const listingIds = parseListingIds(params);

  if (!listingIds) {
    return {
      title: "İlan karşılaştır | 2ElBul",
      description:
        "İkinci el ilanları yan yana karşılaştır ve hangisini alman gerektiğine AI karar desteğiyle ulaş.",
      robots: { index: false, follow: false },
    };
  }

  const data = await getComparePageData(listingIds);
  if (!data) {
    return {
      title: "İlan karşılaştır | 2ElBul",
      description:
        "İkinci el ilanları yan yana karşılaştır ve hangisini alman gerektiğine AI karar desteğiyle ulaş.",
      robots: { index: false, follow: false },
    };
  }

  const productNames = data.candidates.map((c) => c.productName);
  const title =
    productNames.length === 2
      ? `${productNames[0]} vs ${productNames[1]} | 2ElBul`
      : `${productNames.join(", ")} karşılaştırma | 2ElBul`;
  const description = `${productNames.join(", ")} ikinci el ilanları için AI karşılaştırması: fiyat, opportunity, risk, confidence ve duplicate sinyalleri.`;

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
  const params = await searchParams;
  const listingIds = parseListingIds(params);
  const duplicates = hasDuplicateIds(params);

  if (!listingIds || duplicates) {
    return <CompareEmptyState sameSelection={duplicates} />;
  }

  const data = await getComparePageData(listingIds);
  if (!data) {
    const isCrossType = await detectCrossTypeConflict(listingIds);
    if (isCrossType) {
      return <CrossTypeError />;
    }
    return <CompareNotFound listingIds={listingIds} />;
  }

  const { candidates, decision, jsonLd, canonicalUrl } = data;

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
          candidates={candidates}
          decision={decision}
          canonicalUrl={canonicalUrl}
        />

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
          {candidates.map((candidate) => (
            <CandidateCard
              key={candidate.key}
              candidate={candidate}
              highlight={decision.recommendedKey === candidate.key}
            />
          ))}
        </section>

        <ComparisonTable candidates={candidates} decision={decision} />

        <BestDealSection candidates={candidates} decision={decision} />
      </div>
    </main>
  );
}

function DecisionCard({
  candidates,
  decision,
  canonicalUrl,
}: {
  candidates: CompareCandidateSummary[];
  decision: ReturnType<typeof buildCompareDecision>;
  canonicalUrl: string;
}) {
  const recommended =
    decision.recommendedKey !== null
      ? candidates[decision.recommendedKey]
      : null;
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
          {!isInsufficient && !isTied && recommended ? (
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
            />
          ))}
        </div>
      </div>

      <p className="mt-4 text-xs font-semibold leading-6 text-black/40">
        Bu karar, mevcut Product Intelligence, Market Intelligence, Opportunity
        Engine, Confidence ve Duplicate Engine çıktılarından üretilir. Karar
        notu ilanlar güncellendikçe otomatik değişir. Kanonik URL:{" "}
        {canonicalUrl}
      </p>
    </section>
  );
}

function ReasonRow({ reason }: { reason: CompareReason }) {
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
        className={
          isNeutral
            ? "mt-0.5 shrink-0 text-black/30"
            : "mt-0.5 shrink-0 text-green-600"
        }
      />
      <span className="min-w-0">{reason.label}</span>
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
        highlight
          ? "border-[#ff6b00]/40 ring-1 ring-[#ff6b00]/30"
          : "border-black/8"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full border border-black/10 bg-[#fafaf8] px-3 py-1 text-xs font-black text-black/55">
          İlan {candidate.key + 1}
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

      <p className="mt-4 text-xs font-bold text-[#ff6b00]">
        {candidate.productName}
      </p>
      <h2 className="mt-2 break-words text-lg font-black leading-6">
        {candidate.title}
      </h2>

      <p className="mt-4 text-3xl font-black tracking-[-0.04em] text-[#ff6b00]">
        {formatPrice(candidate.price)}
      </p>
      <p className="mt-1 text-xs font-semibold text-black/45">
        {candidate.condition}
      </p>

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

function ComparisonTable({
  candidates,
  decision,
}: {
  candidates: CompareCandidateSummary[];
  decision: ReturnType<typeof buildCompareDecision>;
}) {
  const rows: Array<{
    label: string;
    values: string[];
    winnerIndex: number | null;
  }> = [
    {
      label: "Fiyat",
      values: candidates.map((c) => formatPrice(c.price)),
      winnerIndex: lowerPriceWinner(candidates),
    },
    {
      label: "Risk",
      values: candidates.map((c) => formatOpportunityLevel(c.riskLevel)),
      winnerIndex: riskWinner(candidates),
    },
    {
      label: "Confidence",
      values: candidates.map(
        (c) =>
          `${c.confidenceScore}/100 · ${formatMarketConfidenceLevel(c.confidenceLevel)}`,
      ),
      winnerIndex: confidenceWinner(candidates),
    },
    {
      label: "Opportunity",
      values: candidates.map((c) => `${c.opportunityScore}/100`),
      winnerIndex: opportunityWinner(candidates),
    },
    {
      label: "Kaynak",
      values: candidates.map((c) => `${c.sourceCount} kaynak`),
      winnerIndex: sourceWinner(candidates),
    },
    {
      label: "Duplicate",
      values: candidates.map(
        (c) => `%${Math.round(c.duplicateDensity * 100)}`,
      ),
      winnerIndex: duplicateWinner(candidates),
    },
    {
      label: "Fiyat avantajı",
      values: candidates.map((c) => formatAdvantageCell(c.priceAdvantagePercent)),
      winnerIndex: advantageWinner(candidates),
    },
    {
      label: "Trend",
      values: candidates.map((c) =>
        formatTrend(c.trendDirection, c.trendChangePercent),
      ),
      winnerIndex: null,
    },
    {
      label: "Data Freshness",
      values: candidates.map((c) => formatOpportunityFreshness(c.dataFreshness)),
      winnerIndex: freshnessWinner(candidates),
    },
    {
      label: "Recommendation",
      values: candidates.map((c) => c.recommendation.label),
      winnerIndex: recommendationWinner(candidates),
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
          <h2 className="mt-1 text-2xl font-black tracking-[-0.035em]">
            Sinyal Sinyal
          </h2>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs font-black uppercase tracking-[0.06em] text-black/45">
              <th className="border-b border-black/8 px-4 py-3">Sinyal</th>
              {candidates.map((c) => (
                <th
                  key={c.key}
                  className="border-b border-black/8 px-4 py-3"
                >
                  {c.productName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="align-top">
                <td className="border-b border-black/5 px-4 py-3 font-bold text-black/55">
                  {row.label}
                </td>
                {candidates.map((c, i) => (
                  <td
                    key={c.key}
                    className="border-b border-black/5 px-4 py-3"
                  >
                    <ComparisonCell
                      value={row.values[i]}
                      isWinner={row.winnerIndex === i}
                    />
                  </td>
                ))}
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

function ComparisonCell({
  value,
  isWinner,
}: {
  value: string;
  isWinner: boolean;
}) {
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
  candidates,
  decision,
}: {
  candidates: CompareCandidateSummary[];
  decision: ReturnType<typeof buildCompareDecision>;
}) {
  if (decision.insufficientData || decision.tied || decision.recommendedKey === null) {
    return null;
  }
  const best = candidates[decision.recommendedKey];

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
            {best.title} · {formatPrice(best.price)} · {best.source} ·{" "}
            {best.city}
          </p>
          <p className="mt-3 text-sm font-semibold text-black/55">
            Fırsat skoru {best.opportunityScore}/100 · Risk{" "}
            {formatOpportunityLevel(best.riskLevel)} · Confidence{" "}
            {best.confidenceScore}/100
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
            İlanları karşılaştır
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-black/55">
            URL&apos;e{" "}
            <code className="rounded bg-[#fafaf8] px-1.5 py-0.5 text-xs font-bold">
              ?ids=ilanId1,ilanId2
            </code>{" "}
            ekleyerek 2-4 ilanı yan yana getir ve AI karar desteğini gör.
          </p>
          {sameSelection ? (
            <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
              <TriangleAlert className="mt-0.5 shrink-0" size={17} />
              <span>
                Aynı ilan ID tekrar ediyor. Farklı ilanlar seçmelisin.
              </span>
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

function CompareNotFound({ listingIds }: { listingIds: string[] }) {
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
            Seçilen ilanlardan biri veya birkaçı bulunamadı, yayından kalkmış
            veya ürün eşleşmesi kurulamamış olabilir.
          </p>
          <p className="mt-2 text-xs font-semibold text-black/40">
            İlan ID: {listingIds.join(", ")}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/search"
              className="orange-button justify-center px-5 py-3"
            >
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

function CrossTypeError() {
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
            Farklı ürün türleri karşılaştırılamaz
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-black/55">
            Seçilen ilanlar farklı ürün kategorilerine ait. Yalnızca aynı ürün
            türündeki ilanlar karşılaştırılabilir (örn. telefon ile telefon).
            Lütfen seçimini güncelle.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/search"
              className="orange-button justify-center px-5 py-3"
            >
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

/* ── Winner Helpers ─────────────────────────────────────────────── */

function lowerPriceWinner(
  candidates: CompareCandidateSummary[],
): number | null {
  return findExtremeIndex(
    candidates.map((c) => c.price),
    true,
  );
}

function riskWinner(candidates: CompareCandidateSummary[]): number | null {
  return findExtremeIndex(
    candidates.map((c) => riskRank(c.riskLevel)),
    true,
  );
}

function confidenceWinner(
  candidates: CompareCandidateSummary[],
): number | null {
  return findExtremeIndex(
    candidates.map((c) => c.confidenceScore),
    false,
  );
}

function opportunityWinner(
  candidates: CompareCandidateSummary[],
): number | null {
  return findExtremeIndex(
    candidates.map((c) => c.opportunityScore),
    false,
  );
}

function sourceWinner(candidates: CompareCandidateSummary[]): number | null {
  return findExtremeIndex(
    candidates.map((c) => c.sourceCount),
    false,
  );
}

function duplicateWinner(
  candidates: CompareCandidateSummary[],
): number | null {
  return findExtremeIndex(
    candidates.map((c) => c.duplicateDensity),
    true,
  );
}

function advantageWinner(
  candidates: CompareCandidateSummary[],
): number | null {
  const values = candidates.map((c) => c.priceAdvantagePercent ?? -Infinity);
  const winnerIndex = findExtremeIndex(values, false);
  if (
    winnerIndex === null ||
    candidates[winnerIndex].priceAdvantagePercent === null
  )
    return null;
  return winnerIndex;
}

function freshnessWinner(
  candidates: CompareCandidateSummary[],
): number | null {
  return findExtremeIndex(
    candidates.map((c) => freshnessRank(c.dataFreshness)),
    true,
  );
}

function recommendationWinner(
  candidates: CompareCandidateSummary[],
): number | null {
  return findExtremeIndex(
    candidates.map((c) => recommendationRank(c.recommendation.action)),
    true,
  );
}

/* ── Ranking Helpers ────────────────────────────────────────────── */

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

/* ── Formatting Helpers ─────────────────────────────────────────── */

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
  return changePercent === null
    ? label
    : `${label} %${Math.abs(changePercent)}`;
}

function formatPrice(value: number) {
  return formatCurrencyTRY(value);
}
