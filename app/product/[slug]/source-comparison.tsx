import { ArrowUpRight, Store } from "lucide-react";
import { formatCurrencyTRY } from "@/lib/formatters";
import type { SourceComparisonRow } from "@/lib/source-comparison";
import { listingOutboundPath } from "@/lib/listing-links";

/** Every platform's best offer for the product, side by side. */
export function SourceComparison({ rows }: { rows: SourceComparisonRow[] }) {
  if (rows.length === 0) return null;

  return (
    <section className="mt-8 rounded-sm border border-black/20 border-t-[3px] border-t-[#161616] bg-white p-5 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-sm bg-[#E4ECFF] text-[#3B66E0]">
          <Store size={21} />
        </span>
        <h2 className="text-2xl font-black tracking-[-0.035em]">Platformlara göre fiyatlar</h2>
      </div>

      <ul className="mt-6 grid gap-3">
        {rows.map((row) => (
          <li
            key={row.source}
            className={`flex flex-wrap items-center gap-x-6 gap-y-3 rounded-sm border p-4 ${
              row.isBest ? "border-green-200 bg-green-50" : "border-black/15 bg-[#fafaf8]"
            }`}
          >
            <div className="min-w-0 flex-1 basis-40">
              <p className="flex flex-wrap items-center gap-2 font-black">
                {row.source}
                {row.isBest ? (
                  <span className="rounded-full border border-green-200 bg-white px-2.5 py-0.5 text-[11px] font-black text-green-700">
                    En ucuz
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-xs font-semibold text-black/45">
                {row.listingCount} ilan · ortalama {formatCurrencyTRY(row.averagePrice)}
              </p>
            </div>

            <div className="text-right">
              <p className="text-xl font-black tracking-[-0.03em] text-[#3B66E0]">{formatCurrencyTRY(row.lowestPrice)}</p>
              <p className={`text-xs font-bold ${row.isBest ? "text-green-700" : "text-black/45"}`}>
                {row.isBest ? "En düşük fiyat" : `%${row.aboveBestPercent.toLocaleString("tr-TR")} daha pahalı`}
              </p>
            </div>

            <a
              href={listingOutboundPath(row.cheapest.id)}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1.5 rounded-xl border border-black/15 bg-white px-4 py-2.5 text-sm font-bold transition hover:border-[#3B66E0]/40 hover:text-[#2A4FBF]"
              aria-label={`${row.source} üzerindeki en düşük fiyatlı ilana git`}
            >
              İlana git <ArrowUpRight size={15} />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
