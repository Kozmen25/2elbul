import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Breadcrumbs } from "./breadcrumbs";

function extractJsonLd(html: string) {
  const match = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/);
  return JSON.parse(match![1]);
}

describe("Breadcrumbs", () => {
  it("emits absolute URLs in BreadcrumbList structured data", () => {
    const html = renderToStaticMarkup(
      <Breadcrumbs
        items={[
          { label: "Ana Sayfa", href: "/" },
          { label: "Telefon", href: "/category/telefon" },
          { label: "iPhone 14" },
        ]}
      />,
    );
    const jsonLd = extractJsonLd(html);

    expect(jsonLd["@type"]).toBe("BreadcrumbList");
    expect(jsonLd.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: "https://2elbul.com/" },
      { "@type": "ListItem", position: 2, name: "Telefon", item: "https://2elbul.com/category/telefon" },
      // The current page closes the trail without a URL, as Google allows.
      { "@type": "ListItem", position: 3, name: "iPhone 14" },
    ]);
  });
});
