import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@/lib/supabase");
});

async function loadSeoRoutes() {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  vi.doMock("@/lib/supabase", () => ({
    createSupabaseClient: () => null,
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
});
