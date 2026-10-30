import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
});

async function load() {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  vi.resetModules();
  return import("./metadata");
}

describe("buildPageMetadata", () => {
  it("emits canonical, Open Graph url and the share image", async () => {
    const { buildPageMetadata } = await load();
    const metadata = buildPageMetadata({
      title: "İletişim | 2ElBul",
      description: "desc",
      path: "/iletisim",
    });

    expect(metadata.alternates?.canonical).toBe("https://2elbul.com/iletisim");
    expect(metadata.openGraph?.url).toBe("https://2elbul.com/iletisim");
    expect(metadata.openGraph?.images).toHaveLength(1);
    expect(metadata.twitter?.images).toEqual(["/og-image.png"]);
    expect(metadata.robots).toBeUndefined();
  });

  it("marks noIndex pages", async () => {
    const { buildPageMetadata } = await load();
    const metadata = buildPageMetadata({
      title: "t",
      description: "d",
      path: "/x",
      noIndex: true,
    });
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
