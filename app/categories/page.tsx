import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CategoryShell } from "@/components/category-shell";
import { loadCategoryHub } from "@/lib/category-hub";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { getAbsoluteUrl } from "@/lib/site-url";
import { CategoryOverview, TotalsStrip } from "./category-panels";

// ISR: public data, no per-visitor content. Must stay a literal (static analysis);
// keep equal to CACHE_SECONDS.publicPage in lib/cache-policy.ts.
export const revalidate = 300;

export const metadata: Metadata = buildPageMetadata({
  title: "Kategoriler | 2ElBul",
  description:
    "Telefon, bilgisayar, konsol, TV ve daha fazlası: tüm ikinci el kategorilerini ve alt kategorilerini ürün ve ilan sayılarıyla gözden geçirin.",
  path: "/categories",
});

export default async function CategoriesPage() {
  const hub = await loadCategoryHub(null);
  const { mains, totals } = hub;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Kategoriler",
    url: getAbsoluteUrl("/categories"),
    mainEntity: {
      "@type": "ItemList",
      itemListElement: mains.map((main, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: main.name,
        url: getAbsoluteUrl(`/category/${main.slug}`),
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
        <Breadcrumbs items={[{ label: "Ana Sayfa", href: "/" }, { label: "Kategoriler" }]} />

        <header className="mb-5">
          <h1 className="text-3xl font-black tracking-[-0.05em] sm:text-4xl">Kategoriler</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-black/55">
            İkinci el piyasasını kategoriye göre keşfedin; bir kategoriyi seçince ürün, ilan ve
            piyasa analizine ulaşın.
          </p>
        </header>

        <div className="mb-5">
          <TotalsStrip totals={totals} />
        </div>

        <CategoryShell hub={hub}>
          <CategoryOverview mains={mains} />
        </CategoryShell>
      </div>
    </main>
  );
}
