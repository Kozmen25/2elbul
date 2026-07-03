import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  ImageOff,
  Link2Off,
  PackageSearch,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { AdminEmpty, AdminPageHeader, AdminStatCard } from "@/components/admin-ui";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type ListingRow = {
  id: unknown;
  product_id?: unknown;
  title?: unknown;
  price?: unknown;
  source?: unknown;
  url?: unknown;
  image_url?: unknown;
  status?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

type ProductRow = {
  id: unknown;
  name?: unknown;
};

type SourceRow = {
  id: unknown;
  name?: unknown;
  slug?: unknown;
};

type BotRunRow = {
  source_id?: unknown;
  status?: unknown;
  started_at?: unknown;
  finished_at?: unknown;
  found_count?: unknown;
  imported_count?: unknown;
  updated_count?: unknown;
  inactive_count?: unknown;
  skipped_count?: unknown;
  error_count?: unknown;
  matched_product_count?: unknown;
  created_at?: unknown;
};

type ProblemRow = {
  reason: string;
  source: string;
  product: string;
  listingId: string;
  href: string;
};

export default async function AdminDataQualityPage() {
  const data = await loadDataQuality();

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-hidden">
      <AdminPageHeader
        eyebrow="Veri operasyonları"
        title="Veri Kalitesi"
        description="Kaynaklardan gelen kayıtların normalize, import, matcher, görsel ve hata kalitesini tek ekrandan izleyin."
      />

      {!data.available ? (
        <AdminEmpty>
          Veri kalitesi hesaplanamadı. Service-role bağlantısını ve temel tabloları
          kontrol edin.
        </AdminEmpty>
      ) : (
        <div className="grid gap-6">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AdminStatCard
              label="Overall Data Quality"
              value={`${data.scores.overall}/100`}
              icon={ShieldCheck}
              note="Fiyat, matcher, kaynak ve görsel skorlarının ortalaması"
            />
            <AdminStatCard
              label="Fiyat Kalitesi"
              value={`${data.scores.price}/100`}
              icon={Tag}
            />
            <AdminStatCard
              label="Matcher Kalitesi"
              value={`${data.scores.matcher}/100`}
              icon={PackageSearch}
            />
            <AdminStatCard
              label="Görsel Kalitesi"
              value={`${data.scores.image}/100`}
              icon={ImageOff}
            />
            <AdminStatCard
              label="Kaynak Kalitesi"
              value={`${data.scores.source}/100`}
              icon={BarChart3}
            />
            <AdminStatCard
              label="Son 24s yeni kayıt"
              value={data.last24.imported}
              icon={PackageSearch}
            />
            <AdminStatCard
              label="Son 24s güncellenen"
              value={data.last24.updated}
              icon={BarChart3}
            />
            <AdminStatCard
              label="Son 24s hata"
              value={data.last24.errors}
              icon={AlertTriangle}
            />
          </section>

          <section className="rounded-2xl border border-black/8 bg-white shadow-[0_12px_30px_rgba(0,0,0,0.035)]">
            <div className="border-b border-black/7 p-5">
              <h2 className="text-xl font-black tracking-[-0.03em]">
                Kaynak bazlı kalite
              </h2>
              <p className="mt-2 text-sm text-black/45">
                Metrikler bot_runs ve listings verilerinden hesaplanır. Yeni SQL
                gerekmez.
              </p>
            </div>
            <div className="w-full max-w-full overflow-x-auto [-webkit-overflow-scrolling:touch]">
              <table className="w-full min-w-[1280px] text-left text-sm">
                <thead className="bg-[#fafaf8] text-xs uppercase tracking-wide text-black/45">
                  <tr>
                    <th className="px-4 py-3">Kaynak</th>
                    <th className="px-4 py-3 text-center">Toplam çekilen</th>
                    <th className="px-4 py-3 text-center">Normalize</th>
                    <th className="px-4 py-3 text-center">Import</th>
                    <th className="px-4 py-3 text-center">Güncellenen</th>
                    <th className="px-4 py-3 text-center">Skip</th>
                    <th className="px-4 py-3 text-center">Hatalı</th>
                    <th className="px-4 py-3 text-center">Fiyat yok</th>
                    <th className="px-4 py-3 text-center">URL yok</th>
                    <th className="px-4 py-3 text-center">Resimsiz</th>
                    <th className="px-4 py-3 text-center">Matcher</th>
                    <th className="px-4 py-3 text-center">Ort. süre</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sourceMetrics.map((source) => (
                    <tr key={source.sourceName} className="border-t border-black/7">
                      <td className="px-4 py-4 font-black">{source.sourceName}</td>
                      <MetricCell value={source.totalFetched} />
                      <MetricCell value={source.normalized} />
                      <MetricCell value={source.imported} accent />
                      <MetricCell value={source.updated} />
                      <MetricCell value={source.skipped} />
                      <MetricCell value={source.errors} danger />
                      <MetricCell value={source.missingPrice} danger />
                      <MetricCell value={source.missingUrl} danger />
                      <MetricCell value={source.missingImage} />
                      <td className="px-4 py-4 text-center font-black">
                        %{source.matcherRate}
                      </td>
                      <td className="px-4 py-4 text-center font-black">
                        {formatDuration(source.averageDurationMs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-4">
            <QualityMiniCard label="Son 24s pasife alınan" value={data.last24.inactive} />
            <QualityMiniCard label="Fiyatı olmayan kayıt" value={data.globalMissingPrice} />
            <QualityMiniCard label="URL eksik kayıt" value={data.globalMissingUrl} />
            <QualityMiniCard label="Resimsiz kayıt" value={data.globalMissingImage} />
          </section>

          <section className="rounded-2xl border border-black/8 bg-white shadow-[0_12px_30px_rgba(0,0,0,0.035)]">
            <div className="border-b border-black/7 p-5">
              <h2 className="text-xl font-black tracking-[-0.03em]">
                İlk 20 problemli kayıt
              </h2>
              <p className="mt-2 text-sm text-black/45">
                Fiyat, URL, görsel, matcher ve duplicate şüpheleri burada listelenir.
              </p>
            </div>
            {data.problems.length ? (
              <div className="w-full max-w-full overflow-x-auto [-webkit-overflow-scrolling:touch]">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-[#fafaf8] text-xs uppercase tracking-wide text-black/45">
                    <tr>
                      <th className="px-4 py-3">Sebep</th>
                      <th className="px-4 py-3">Kaynak</th>
                      <th className="px-4 py-3">Ürün</th>
                      <th className="px-4 py-3">Listing ID</th>
                      <th className="px-4 py-3 text-right">Detay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.problems.map((problem, index) => (
                      <tr key={`${problem.listingId}-${problem.reason}-${index}`} className="border-t border-black/7">
                        <td className="px-4 py-4 font-bold text-red-700">{problem.reason}</td>
                        <td className="px-4 py-4 text-black/60">{problem.source}</td>
                        <td className="px-4 py-4 font-semibold">{problem.product}</td>
                        <td className="px-4 py-4 text-black/45">{problem.listingId}</td>
                        <td className="px-4 py-4 text-right">
                          <Link href={problem.href} className="font-black text-[#ff6b00]">
                            Detaya git
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8">
                <AdminEmpty>Problemli kayıt bulunamadı.</AdminEmpty>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

async function loadDataQuality() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { available: false as const };

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [listingsResult, productsResult, sourcesResult, runsResult] =
    await Promise.all([
      supabase
        .from("listings")
        .select("id, product_id, title, price, source, url, image_url, status, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(5000),
      supabase.from("products").select("id, name").limit(5000),
      supabase.from("sources").select("id, name, slug"),
      supabase
        .from("bot_runs")
        .select("source_id, status, started_at, finished_at, found_count, imported_count, updated_count, inactive_count, skipped_count, error_count, matched_product_count, created_at")
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);

  if (listingsResult.error) {
    console.error("Data quality listings query failed:", listingsResult.error);
    return { available: false as const };
  }

  const listings = (listingsResult.data ?? []) as ListingRow[];
  const products = (productsResult.data ?? []) as ProductRow[];
  const sources = (sourcesResult.data ?? []) as SourceRow[];
  const runs = (runsResult.data ?? []) as BotRunRow[];
  const productNames = new Map(
    products.map((product) => [String(product.id), String(product.name ?? "Bilinmeyen ürün")]),
  );
  const sourceNamesById = new Map(
    sources.map((source) => [String(source.id), String(source.name ?? source.slug ?? "Kaynak")]),
  );
  const sourceNames = [
    ...new Set([
      ...sources.map((source) => String(source.name ?? source.slug ?? "Kaynak")),
      ...listings.map((listing) => String(listing.source ?? "Bilinmeyen kaynak")),
    ]),
  ].sort((a, b) => a.localeCompare(b, "tr"));

  const duplicateUrls = findDuplicateUrls(listings);
  const problems = buildProblemRows(listings, productNames, duplicateUrls);
  const sourceMetrics = sourceNames.map((sourceName) =>
    buildSourceMetric({
      sourceName,
      listings: listings.filter((listing) => String(listing.source ?? "") === sourceName),
      runs: runs.filter((run) => sourceNamesById.get(String(run.source_id)) === sourceName),
    }),
  );

  const globalMissingPrice = listings.filter((listing) => !hasValidPrice(listing)).length;
  const globalMissingUrl = listings.filter((listing) => !String(listing.url ?? "").trim()).length;
  const globalMissingImage = listings.filter((listing) => !String(listing.image_url ?? "").trim()).length;
  const matchedListings = listings.filter((listing) => listing.product_id).length;
  const totalListings = listings.length || 1;
  const runs24 = runs.filter((run) => isWithin24h(run.created_at ?? run.started_at, dayAgo));
  const last24 = {
    imported: sum(runs24, "imported_count"),
    updated: sum(runs24, "updated_count"),
    inactive: sum(runs24, "inactive_count"),
    errors: sum(runs24, "error_count"),
  };
  const priceQuality = qualityScore(totalListings - globalMissingPrice, totalListings);
  const matcherQuality = qualityScore(matchedListings, totalListings);
  const imageQuality = qualityScore(totalListings - globalMissingImage, totalListings);
  const sourceQuality = sourceMetrics.length
    ? Math.round(
        sourceMetrics.reduce((total, source) => total + source.qualityScore, 0) /
          sourceMetrics.length,
      )
    : 0;
  const overall = Math.round(
    (priceQuality + matcherQuality + imageQuality + sourceQuality) / 4,
  );

  return {
    available: true as const,
    sourceMetrics,
    problems: problems.slice(0, 20),
    scores: {
      overall,
      price: priceQuality,
      matcher: matcherQuality,
      source: sourceQuality,
      image: imageQuality,
    },
    last24,
    globalMissingPrice,
    globalMissingUrl,
    globalMissingImage,
  };
}

function buildSourceMetric({
  sourceName,
  listings,
  runs,
}: {
  sourceName: string;
  listings: ListingRow[];
  runs: BotRunRow[];
}) {
  const totalFetched = sum(runs, "found_count");
  const imported = sum(runs, "imported_count");
  const updated = sum(runs, "updated_count");
  const skipped = sum(runs, "skipped_count");
  const errors = sum(runs, "error_count");
  const matched = sum(runs, "matched_product_count");
  const normalized = Math.max(0, totalFetched - skipped - errors);
  const missingPrice = listings.filter((listing) => !hasValidPrice(listing)).length;
  const missingUrl = listings.filter((listing) => !String(listing.url ?? "").trim()).length;
  const missingImage = listings.filter((listing) => !String(listing.image_url ?? "").trim()).length;
  const matcherRate = qualityScore(
    matched || listings.filter((listing) => listing.product_id).length,
    Math.max(imported + updated, listings.length, 1),
  );
  const durations = runs
    .map((run) => {
      if (!run.started_at || !run.finished_at) return null;
      return Math.max(
        0,
        new Date(String(run.finished_at)).getTime() -
          new Date(String(run.started_at)).getTime(),
      );
    })
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const averageDurationMs = durations.length
    ? Math.round(durations.reduce((total, value) => total + value, 0) / durations.length)
    : null;
  const qualityScoreValue = Math.round(
    (qualityScore(normalized, Math.max(totalFetched, 1)) +
      qualityScore(Math.max(0, listings.length - missingPrice), Math.max(listings.length, 1)) +
      qualityScore(Math.max(0, listings.length - missingUrl), Math.max(listings.length, 1)) +
      qualityScore(Math.max(0, listings.length - missingImage), Math.max(listings.length, 1))) /
      4,
  );

  return {
    sourceName,
    totalFetched,
    normalized,
    imported,
    updated,
    skipped,
    errors,
    missingPrice,
    missingUrl,
    missingImage,
    matcherRate,
    averageDurationMs,
    qualityScore: qualityScoreValue,
  };
}

function buildProblemRows(
  listings: ListingRow[],
  productNames: Map<string, string>,
  duplicateUrls: Set<string>,
): ProblemRow[] {
  const rows: ProblemRow[] = [];

  for (const listing of listings) {
    const listingId = String(listing.id ?? "-");
    const source = String(listing.source ?? "Bilinmeyen kaynak");
    const product = productNames.get(String(listing.product_id)) ?? String(listing.title ?? "Bilinmeyen ürün");
    const href = `/admin/listings?q=${encodeURIComponent(listingId)}`;
    const url = String(listing.url ?? "").trim();

    if (!hasValidPrice(listing)) rows.push({ reason: "fiyat yok", source, product, listingId, href });
    if (!url) rows.push({ reason: "url yok", source, product, listingId, href });
    if (!listing.product_id) rows.push({ reason: "matcher başarısız", source, product, listingId, href });
    if (!String(listing.image_url ?? "").trim()) rows.push({ reason: "image yok", source, product, listingId, href });
    if (url && duplicateUrls.has(url)) rows.push({ reason: "duplicate şüphesi", source, product, listingId, href });
    if (rows.length >= 30) break;
  }

  return rows;
}

function findDuplicateUrls(listings: ListingRow[]) {
  const counts = new Map<string, number>();
  for (const listing of listings) {
    const url = String(listing.url ?? "").trim();
    if (!url) continue;
    counts.set(url, (counts.get(url) ?? 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([url]) => url));
}

function hasValidPrice(listing: ListingRow) {
  const price = Number(listing.price);
  return Number.isFinite(price) && price > 0;
}

function qualityScore(good: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((good / total) * 100)));
}

function sum(rows: BotRunRow[], key: keyof BotRunRow) {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}

function isWithin24h(value: unknown, dayAgo: Date) {
  const time = new Date(String(value ?? "")).getTime();
  return Number.isFinite(time) && time >= dayAgo.getTime();
}

function MetricCell({
  value,
  accent = false,
  danger = false,
}: {
  value: number;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <td
      className={`px-4 py-4 text-center font-black ${
        danger ? "text-red-700" : accent ? "text-green-700" : ""
      }`}
    >
      {value.toLocaleString("tr-TR")}
    </td>
  );
}

function QualityMiniCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-black/8 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.035)]">
      <p className="text-sm font-bold text-black/45">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-[-0.04em]">
        {value.toLocaleString("tr-TR")}
      </p>
    </div>
  );
}

function formatDuration(value: number | null) {
  if (value === null) return "-";
  if (value < 1000) return `${Math.round(value)} ms`;
  if (value < 60_000) return `${(value / 1000).toFixed(1)} sn`;
  return `${Math.round(value / 60_000)} dk`;
}
