import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  buildFaqPageJsonLd,
  buildLandingFaqItems,
  buildLandingIntro,
  buildLandingHeading,
  PRICE_LIST_PATH,
  type LandingPriceSnapshot,
} from "@/lib/seo/landing-content";

/**
 * The searchable text of a model page: a heading with the search phrase
 * ("iPhone 15 ikinci el fiyatları"), a summary written from live numbers and
 * the matching FAQ (also emitted as FAQPage structured data).
 */
export function PriceGuideSection({
  productName,
  productUrl,
  snapshot,
  now,
}: {
  productName: string;
  productUrl: string;
  snapshot: LandingPriceSnapshot;
  now: Date;
}) {
  const heading = buildLandingHeading("product", productName);
  const faqItems = buildLandingFaqItems("product", productName, snapshot);
  const faqJsonLd = buildFaqPageJsonLd(productUrl, faqItems);

  return (
    <section
      id="fiyat-rehberi"
      className="mt-8 scroll-mt-24 rounded-sm border border-black/20 border-t-[3px] border-t-[#161616] bg-white p-5 sm:p-8"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <h2 className="text-2xl font-black tracking-[-0.035em]">
        {heading}
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-black/60">
        {buildLandingIntro("product", productName, snapshot, now)}
      </p>

      <div className="mt-6 grid gap-3">
        {faqItems.map((item) => (
          <details
            key={item.question}
            className="group rounded-sm border border-black/15 bg-[#fafaf8] p-4"
          >
            <summary className="cursor-pointer list-none text-sm font-black marker:hidden">
              {item.question}
            </summary>
            <p className="mt-3 text-sm leading-7 text-black/60">{item.answer}</p>
          </details>
        ))}
      </div>

      <Link
        href={PRICE_LIST_PATH}
        className="mt-6 inline-flex items-center gap-2 text-sm font-black text-[#3B66E0] hover:underline"
      >
        Tüm ikinci el fiyat listesi <ArrowUpRight size={16} />
      </Link>
    </section>
  );
}
