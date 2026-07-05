import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
});

async function loadMetadata() {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  vi.resetModules();

  const [{ metadata: homeMetadata }, { metadata: marketMetadata }] =
    await Promise.all([import("./page"), import("./market/page")]);

  return { homeMetadata, marketMetadata };
}

describe("SEO metadata", () => {
  it("keeps the home page canonical and OpenGraph url on the production domain", async () => {
    const { homeMetadata } = await loadMetadata();

    expect(homeMetadata.alternates?.canonical).toBe("https://2elbul.com/");
    expect(homeMetadata.openGraph?.url).toBe("https://2elbul.com/");
  });

  it("keeps the market page canonical and OpenGraph url on the production domain", async () => {
    const { marketMetadata } = await loadMetadata();

    expect(marketMetadata.alternates?.canonical).toBe("https://2elbul.com/market");
    expect(marketMetadata.openGraph?.url).toBe("https://2elbul.com/market");
  });
});
