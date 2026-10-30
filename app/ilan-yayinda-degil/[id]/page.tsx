import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, CircleSlash } from "lucide-react";
import { formatCurrencyTRY } from "@/lib/formatters";
import { listingOutboundPath } from "@/lib/listing-links";
import { parseListingId, resolveListingOutbound } from "@/lib/listing-availability/outbound";

// Shown by /git/[id] when a listing can no longer be opened at its source.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "İlan yayında değil | 2ElBul",
  robots: { index: false, follow: false },
};

type ListingGonePageProps = {
  params: Promise<{ id: string }>;
};

const REASON_TEXT: Record<string, string> = {
  sold_out: "Satıcının sayfasında ürün artık satışta görünmüyor; büyük olasılıkla satıldı.",
  source_removed: "İlan, yayınlandığı sitede kaldırılmış.",
  not_seen_in_scan: "İlan, yayınlandığı sitede artık bulunmuyor.",
};

const DEFAULT_REASON_TEXT = "Bu ilan artık yayında değil; satılmış ya da kaldırılmış olabilir.";

export default async function ListingGonePage({ params }: ListingGonePageProps) {
  const { id } = await params;
  const listingId = parseListingId(id);
  const outbound = listingId === null ? null : await resolveListingOutbound(listingId);
  // Back online since the click (e.g. a scan saw it again): offer the way out.
  const liveUrl = outbound?.kind === "live" ? outbound.url : null;
  const gone = outbound?.kind === "gone" ? outbound : null;
  const reasonText = (gone?.reason && REASON_TEXT[gone.reason]) || DEFAULT_REASON_TEXT;

  return (
    <section className="min-h-[calc(100vh-145px)] bg-[#f4f5f7] py-10 sm:py-16">
      <div className="container-shell">
        <div className="mx-auto max-w-xl rounded-3xl border border-black/10 bg-white p-6 shadow-[0_24px_70px_rgba(11,21,48,0.06)] sm:p-10">
          <span className="grid size-12 place-items-center rounded-2xl bg-[#FFF1E8] text-[#B4520F]">
            <CircleSlash size={22} aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-2xl font-black tracking-[-0.03em] sm:text-3xl">
            Bu ilan artık yayında değil
          </h1>
          <p className="mt-3 text-sm leading-6 text-black/65">{reasonText}</p>
          {gone?.title ? (
            <p className="mt-4 rounded-xl border border-black/10 bg-[#fafaf8] px-4 py-3 text-sm">
              <span className="block font-bold">{gone.title}</span>
              {gone.source ? <span className="text-black/60">{gone.source}</span> : null}
            </p>
          ) : null}

          {gone?.alternatives.length ? (
            <div className="mt-7">
              <h2 className="text-base font-black">
                {gone.product ? `${gone.product.name} için yayındaki ilanlar` : "Yayındaki benzer ilanlar"}
              </h2>
              <ul className="mt-3 grid gap-2">
                {gone.alternatives.map((alternative) => (
                  <li key={alternative.id}>
                    <a
                      href={listingOutboundPath(alternative.id)}
                      rel="nofollow"
                      className="flex items-center justify-between gap-3 rounded-xl border border-black/10 px-4 py-3 transition hover:border-[#3B66E0]/40"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold">{alternative.title}</span>
                        <span className="text-xs text-black/60">
                          {alternative.source} · {alternative.city}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-sm font-black text-[#2A4FBF]">
                        {formatCurrencyTRY(alternative.price)}
                        <ArrowUpRight size={15} aria-hidden="true" />
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-7 flex flex-wrap gap-3">
            {liveUrl ? (
              <a href={liveUrl} rel="noopener noreferrer nofollow" className="orange-button px-5 py-3">
                İlan tekrar yayında, ilana git
              </a>
            ) : null}
            {gone?.product?.slug ? (
              <Link href={`/product/${gone.product.slug}`} className="orange-button px-5 py-3">
                Fiyat analizine git
              </Link>
            ) : null}
            <Link
              href="/search"
              className="rounded-xl border border-black/15 px-5 py-3 text-sm font-bold transition hover:border-[#3B66E0]/40"
            >
              Aramaya dön
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
