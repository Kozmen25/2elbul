import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@/lib/supabase");
  vi.doUnmock("@/lib/brand-intelligence");
  vi.doUnmock("@/lib/category-intelligence");
});

type TableRows = Record<string, unknown[]>;

/** Minimal chainable stand-in for the Supabase query builder used by the sitemap. */
function fakeSupabase(tables: TableRows) {
  return {
    from(table: string) {
      const result = { data: tables[table] ?? [], error: null };
      const builder = {
        select: () => builder,
        in: () => builder,
        order: () => builder,
        limit: () => builder,
        then: (resolve: (value: typeof result) => unknown) => resolve(result),
      };
      return builder;
    },
  };
}

type BrandCatalogStub = {
  slug: string;
  name: string;
  productCount: number;
  latestProductAt: string | null;
};

type CategoryCatalogStub = { slug: string; listingCount: number; latestListingAt: string | null };

async function loadSeoRoutes(
  brandCatalog: BrandCatalogStub[] = [],
  options: { tables?: TableRows; categories?: CategoryCatalogStub[] } = {},
) {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  vi.doMock("@/lib/supabase", () => ({
    createSupabaseClient: () => (options.tables ? fakeSupabase(options.tables) : null),
  }));
  if (options.categories) {
    const categories = options.categories;
    vi.doMock("@/lib/category-intelligence", () => ({
      getCategoryCatalog: async () => categories,
    }));
  }
  vi.doMock("@/lib/brand-intelligence", () => ({
    getBrandCatalog: async () => brandCatalog,
  }));
  vi.resetModules();

  const [{ default: robots }, { default: sitemap }] = await Promise.all([
    import("./robots"),
    import("./sitemap"),
  ]);

  return { robots, sitemap };
}

describe("SEO routes", () => {
  it("emits robots rules and sitemap location on the production domain", async () => {
    const { robots } = await loadSeoRoutes();
    const output = robots();

    expect(output.sitemap).toBe("https://2elbul.com/sitemap.xml");
    expect(output.rules).toMatchObject({
      userAgent: "*",
      allow: "/",
    });
    expect(output.rules).toEqual(
      expect.objectContaining({
        disallow: expect.arrayContaining([
          "/admin",
          "/api",
          "/hesabim",
          "/favoriler",
          "/listing-ekle",
          "/giris",
        ]),
      }),
    );
  });

  it("emits sitemap base routes on the production domain", async () => {
    const { sitemap } = await loadSeoRoutes();
    const output = await sitemap();

    expect(output.map((entry) => entry.url)).toEqual(
      expect.arrayContaining([
        "https://2elbul.com",
        "https://2elbul.com/search",
        "https://2elbul.com/market",
        "https://2elbul.com/categories",
        "https://2elbul.com/ikinci-el-fiyatlari",
        "https://2elbul.com/iletisim",
      ]),
    );
    expect(output.map((entry) => entry.url)).not.toContain("https://2elbul.com/ilan-ekle");
  });

  it("includes brand routes in the sitemap when brand catalog is available", async () => {
    const { sitemap } = await loadSeoRoutes([
      {
        slug: "apple",
        name: "Apple",
        productCount: 12,
        latestProductAt: "2026-07-05T10:00:00.000Z",
      },
      {
        slug: "msi",
        name: "MSI",
        productCount: 4,
        latestProductAt: "2026-07-03T09:00:00.000Z",
      },
    ]);
    const output = await sitemap();

    expect(output.map((entry) => entry.url)).toEqual(
      expect.arrayContaining([
        "https://2elbul.com/brand/apple",
        "https://2elbul.com/brand/msi",
      ]),
    );
  });

  it("leaves categories without listings out of the sitemap", async () => {
    const { sitemap } = await loadSeoRoutes([], {
      categories: [
        { slug: "telefon", listingCount: 12, latestListingAt: null },
        { slug: "emlak", listingCount: 0, latestListingAt: null },
      ],
    });
    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls).toContain("https://2elbul.com/category/telefon");
    expect(urls).not.toContain("https://2elbul.com/category/emlak");
  });

  it("lists only brands that have a model with live listings", async () => {
    const { sitemap } = await loadSeoRoutes(
      [
        { slug: "apple", name: "Apple", productCount: 2, latestProductAt: null },
        { slug: "msi", name: "MSI", productCount: 1, latestProductAt: null },
      ],
      {
        categories: [],
        tables: {
          listings: [{ product_id: 1, title: "iPhone 15 128GB", source: "EasyCep", url: "https://example.com/1" }],
          products: [{ id: 1, name: "iPhone 15", slug: "iphone-15", created_at: null }],
        },
      },
    );
    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls).toContain("https://2elbul.com/product/iphone-15");
    expect(urls).toContain("https://2elbul.com/brand/apple");
    expect(urls).not.toContain("https://2elbul.com/brand/msi");
  });
});
