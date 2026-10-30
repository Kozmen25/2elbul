import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { resolveCategoryIcon } from "@/lib/categories";
import {
  hubHref,
  previewSubcategories,
  type HubMainCategory,
  type HubTotals,
} from "@/lib/category-hub";

const count = (value: number) => value.toLocaleString("tr-TR");

const PANEL = "border border-black/20 border-t-[3px] border-t-[#161616] bg-white";

export function TotalsStrip({ totals }: { totals: HubTotals }) {
  const items = [
    { label: "Ana kategori", value: totals.mainCount },
    { label: "Alt kategori", value: totals.subcategoryCount },
    { label: "Takip edilen ürün", value: totals.productCount },
    { label: "Güncel ilan", value: totals.listingCount },
  ];
  return (
    <dl className="grid grid-cols-2 border border-black/20 bg-white sm:grid-cols-4">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={`px-4 py-3 ${index % 2 === 1 ? "border-l border-black/10" : ""} ${
            index > 0 ? "sm:border-l sm:border-black/10" : ""
          } ${index >= 2 ? "border-t border-black/10 sm:border-t-0" : ""}`}
        >
          <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-black/40">
            {item.label}
          </dt>
          <dd className="mt-1 text-2xl font-black tracking-[-0.04em]">{count(item.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Default view: one card per main category. */
export function CategoryOverview({ mains }: { mains: HubMainCategory[] }) {
  if (mains.length === 0) {
    return <EmptyPanel text="Kategoriler şu an yüklenemedi. Lütfen daha sonra tekrar deneyin." />;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {mains.map((main) => (
        <MainCategoryCard key={main.id} main={main} />
      ))}
    </div>
  );
}

function MainCategoryCard({ main }: { main: HubMainCategory }) {
  const Icon = resolveCategoryIcon(main.icon);
  const { visible, hiddenCount } = previewSubcategories(main);

  return (
    <article className={`flex min-w-0 flex-col ${PANEL}`}>
      <div className="flex-1 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center border border-[#3B66E0]/25 bg-[#EEF3FF] text-[#3B66E0]">
            <Icon size={21} />
          </span>
          <div className="min-w-0">
            <h2 className="break-words text-lg font-black leading-6">
              <Link href={hubHref(main.slug)} className="hover:text-[#2A4FBF]">
                {main.name}
              </Link>
            </h2>
            <p className="mt-0.5 text-xs font-bold text-black/40">
              {count(main.productCount)} ürün · {count(main.listingCount)} ilan
            </p>
          </div>
        </div>
        {main.shortDescription ? (
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-black/55">{main.shortDescription}</p>
        ) : null}
        {visible.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {visible.map((child) => (
              <li key={child.id}>
                <Link
                  href={hubHref(child.slug)}
                  className="block border border-black/15 bg-[#fafaf8] px-2 py-1 text-xs font-semibold text-black/60 transition hover:border-[#3B66E0]/50 hover:text-[#2A4FBF]"
                >
                  {child.name}
                </Link>
              </li>
            ))}
            {hiddenCount > 0 ? (
              <li className="px-1 py-1 text-xs font-bold text-black/35">+{hiddenCount}</li>
            ) : null}
          </ul>
        ) : null}
      </div>
      <Link
        href={hubHref(main.slug)}
        className="flex items-center justify-between border-t border-black/15 px-4 py-3 text-sm font-black text-[#2A4FBF] transition hover:bg-[#EEF3FF]"
      >
        Kategoriyi incele
        <ArrowUpRight size={15} />
      </Link>
    </article>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <p className="border border-dashed border-black/25 bg-white p-6 text-sm font-semibold text-black/50">
      {text}
    </p>
  );
}
