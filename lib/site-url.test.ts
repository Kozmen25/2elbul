import { afterEach, describe, expect, it, vi } from "vitest";
import { getAbsoluteUrl, getMetadataBase, getSiteUrl } from "./site-url";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("site-url", () => {
  it("falls back to the production domain when the env var is empty", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");

    expect(getSiteUrl()).toBe("https://2elbul.com");
    expect(getMetadataBase().toString()).toBe("https://2elbul.com/");
  });

  it("uses the configured site url when it is valid", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://preview.2elbul.com/");

    expect(getSiteUrl()).toBe("https://preview.2elbul.com");
    expect(getAbsoluteUrl("/search")).toBe("https://preview.2elbul.com/search");
  });

  it("falls back safely when the env var is invalid", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "not-a-valid-url");

    expect(getSiteUrl()).toBe("https://2elbul.com");
    expect(getAbsoluteUrl("product/iphone-13")).toBe(
      "https://2elbul.com/product/iphone-13",
    );
  });
});
