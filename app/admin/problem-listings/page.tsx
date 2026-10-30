import Link from "next/link";
import { AdminEmpty, AdminPageHeader } from "@/components/admin-ui";
import {
  LISTING_PROBLEM_KINDS,
  LISTING_PROBLEM_LABELS,
  loadProblemReport,
  type ListingProblemKind,
} from "@/lib/listing-problems";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { ProblemListingsTable } from "./problem-listings-table";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type SearchParams = { kind?: string; page?: string };

function isKind(value: string | undefined): value is ListingProblemKind {
  return (LISTING_PROBLEM_KINDS as readonly string[]).includes(value ?? "");
}

function href(kind: ListingProblemKind | "all", page = 1) {
  const params = new URLSearchParams();
  if (kind !== "all") params.set("kind", kind);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/admin/problem-listings${query ? `?${query}` : ""}`;
}

export default async function AdminProblemListingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { kind: rawKind, page: rawPage } = await searchParams;
  const kind: ListingProblemKind | "all" = isKind(rawKind) ? rawKind : "all";
  const supabase = createSupabaseAdminClient();

  const report = supabase
    ? await loadProblemReport(supabase).catch((error) => {
        console.error("Admin problem listings failed:", error);
        return null;
      })
    : null;

  if (!report) {
    return (
      <>
        <AdminPageHeader eyebrow="Veri kalitesi" title="Hatalı ilanlar" description="Düzeltilmesi gereken ilanlar." />
        <AdminEmpty>Hatalı ilanlar okunamadı. Service-role bağlantısını kontrol edin.</AdminEmpty>
      </>
    );
  }

  const filtered = kind === "all" ? report.listings : report.listings.filter((listing) => listing.problems.includes(kind));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(totalPages, Math.max(1, Number(rawPage) || 1));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs font-black transition ${
      active ? "border-[#3B66E0] bg-[#3B66E0] text-white" : "border-black/15 bg-white text-black/60 hover:border-[#3B66E0]/40"
    }`;

  return (
    <>
      <AdminPageHeader
        eyebrow="Veri kalitesi"
        title="Hatalı ilanlar"
        description="Fiyatı, bağlantısı ya da görseli eksik, piyasanın çok altında fiyatlı, kopya bağlantılı veya uzun süredir güncellenmeyen ilanlar. Seçip pasife alabilir ya da silebilirsiniz."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href={href("all")} className={chip(kind === "all")}>
          Tümü ({report.listings.length})
        </Link>
        {LISTING_PROBLEM_KINDS.map((item) => (
          <Link key={item} href={href(item)} className={chip(kind === item)} title={LISTING_PROBLEM_LABELS[item].description}>
            {LISTING_PROBLEM_LABELS[item].label} ({report.counts[item]})
          </Link>
        ))}
      </div>

      {report.partial ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
          Son {report.scanned.toLocaleString("tr-TR")} açık ilan tarandı; daha fazlası varsa sayılar kısmi olabilir.
        </p>
      ) : (
        <p className="mb-4 text-xs font-semibold text-black/45">{report.scanned.toLocaleString("tr-TR")} açık ilan tarandı.</p>
      )}

      <ProblemListingsTable key={`${kind}-${page}`} listings={visible} />

      {totalPages > 1 ? (
        <nav className="mt-5 flex items-center justify-between text-sm font-bold" aria-label="Sayfalar">
          {page > 1 ? (
            <Link href={href(kind, page - 1)} className="rounded-xl border border-black/10 bg-white px-4 py-2">
              ← Önceki
            </Link>
          ) : (
            <span />
          )}
          <span className="text-black/50">
            Sayfa {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={href(kind, page + 1)} className="rounded-xl border border-black/10 bg-white px-4 py-2">
              Sonraki →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}
