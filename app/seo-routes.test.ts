import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@/lib/supabase");
  vi.doUnmock("@/lib/brand-intelligence");
});

type BrandCatalogStub = {
  slug: string;
  name: string;
  productCount: number;
  latestProductAt: string | null;
};

async function loadSeoRoutes(brandCatalog: BrandCatalogStub[] = []) {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  vi.doMock("@/lib/supabase", () => ({
    createSupabaseClient: () => null,
  }));
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
        disallow: expect.arrayContaining(["/admin", "/api", "/hesabim", "/favoriler"]),
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
        "https://2elbul.com/ilan-ekle",
      ]),
    );
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
});
