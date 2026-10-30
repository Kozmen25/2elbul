import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { formatCurrencyTRY, formatNumberTR } from "@/lib/formatters";
import {
  PRICE_LIST_PATH,
  buildLandingHeading,
  buildPriceListDescription,
  buildPriceListTitle,
  formatSeoPeriod,
} from "@/lib/seo/landing-content";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { getPriceListSections, type PriceListSection } from "@/lib/seo/price-list";
import { getAbsoluteUrl } from "@/lib/site-url";

// ISR: public data, no per-visitor content. Must stay a literal (static analysis);
// keep equal to CACHE_SECONDS.publicPage in lib/cache-policy.ts.
export const revalidate = 300;

/** Models listed in the ItemList structured data (the page itself shows all). */
const JSON_LD_MODEL_LIMIT = 100;

function summarize(sections: PriceListSection[]) {
  return {
    modelCount: sections.reduce((total, section) => total + section.models.length, 0),
    listingCount: sections.reduce((total, section) => total + section.listingCount, 0),
    categoryNames: sections.map((section) => section.name),
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const sections = await getPriceListSections();
  const summary = summarize(sections);
  return buildPageMetadata({
    title: buildPriceListTitle(new Date()),
    description: buildPriceListDescription(summary),
    path: PRICE_LIST_PATH,
    noIndex: summary.modelCount === 0,
    followLinks: true,
  });
}

function sectionAnchor(section: PriceListSection) {
  return `fiyat-${section.slug ?? "diger"}`;
}

export default async function PriceListPage() {
  const sections = await getPriceListSections();
  const { modelCount, listingCount } = summarize(sections);
  const period = formatSeoPeriod(new Date());

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "İkinci El Fiyat Listesi",
    url: getAbsoluteUrl(PRICE_LIST_PATH),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: modelCount,
      itemListElement: sections
        .flatMap((section) => section.models)
        .slice(0, JSON_LD_MODEL_LIMIT)
        .map((model, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: `${model.name} ikinci el fiyatları`,
          url: getAbsoluteUrl(`/product/${model.slug}`),
        })),
    },
  };

  return (
    <main className="min-w-0 bg-[#fafaf8] py-8 sm:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <div className="container-shell min-w-0">
        <Breadcrumbs items={[{ label: "Ana Sayfa", href: "/" }, { label: "İkinci El Fiyat Listesi" }]} />

        <header className="mb-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#3B66E0]">{period}</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] sm:text-4xl">
            İkinci El Fiyat Listesi
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-black/60">
            {modelCount > 0
              ? `${formatNumberTR(modelCount)} modelin güncel ikinci el fiyatları, ${formatNumberTR(listingCount)} ilandan derlendi. Her satırda en düşük fiyat ve piyasa ortalaması var; aynı ilan birden fazla sitede yayındaysa bir kez sayılır. Ayrıntılı analiz için modele tıklayın.`
              : "Şu an listelenecek ilan yok. İlanlar geldikçe modellerin en düşük ve ortalama fiyatları burada listelenir."}
          </p>
        </header>

        {sections.length > 1 ? (
          <nav aria-label="Kategoriler" className="mb-6 flex flex-wrap gap-2">
            {sections.map((section) => (
              <a
                key={sectionAnchor(section)}
                href={`#${sectionAnchor(section)}`}
                className="rounded-full border border-black/15 bg-white px-3 py-1.5 text-xs font-black text-black/60 transition hover:border-[#3B66E0]/35 hover:text-[#2A4FBF]"
              >
                {section.name} · {formatNumberTR(section.models.length)}
              </a>
            ))}
          </nav>
        ) : null}

        <div className="grid gap-6">
          {sections.map((section) => (
            <PriceListSectionCard key={sectionAnchor(section)} section={section} />
          ))}
        </div>
      </div>
    </main>
  );
}

function PriceListSectionCard({ section }: { section: PriceListSection }) {
  return (
    <section
      id={sectionAnchor(section)}
      className="min-w-0 scroll-mt-24 rounded-sm border border-black/20 border-t-[3px] border-t-[#161616] bg-white p-5 sm:p-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl font-black tracking-[-0.035em]">
          {buildLandingHeading("category", section.name)}
        </h2>
        {section.slug ? (
          <Link
            href={`/category/${section.slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-black text-[#3B66E0] hover:underline"
          >
            Tüm {section.name} ilanları <ArrowUpRight size={16} />
          </Link>
        ) : null}
      </div>

      <div className="mt-4 hidden grid-cols-[minmax(0,1fr)_8rem_8rem] gap-3 border-b border-black/10 pb-2 text-[11px] font-black uppercase tracking-[0.06em] text-black/40 sm:grid">
        <span>Model</span>
        <span className="text-right">En düşük</span>
        <span className="text-right">Ortalama</span>
      </div>
      <ul className="divide-y divide-black/10">
        {section.models.map((model) => (
          <li key={model.id}>
            <Link
              href={`/product/${model.slug}`}
              className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_8rem_8rem]"
            >
              <span className="min-w-0">
                <span className="block break-words text-sm font-black group-hover:text-[#3B66E0]">
                  {model.name}
                </span>
                <span className="text-xs text-black/45">
                  {formatNumberTR(model.listingCount)} ilan
                </span>
              </span>
              <span className="text-right">
                <span className="block text-sm font-black text-[#3B66E0]">
                  {formatCurrencyTRY(model.minPrice)}
                </span>
                <span className="text-xs text-black/45 sm:hidden">
                  ort. {formatCurrencyTRY(model.averagePrice)}
                </span>
              </span>
              <span className="hidden text-right text-sm font-semibold text-black/65 sm:block">
                {formatCurrencyTRY(model.averagePrice)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
