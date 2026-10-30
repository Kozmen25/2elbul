import { describe, expect, it } from "vitest";
import type { BotAdapterListing } from "./types";
import { deduplicateByUrl } from "./deduplicate";

const listing = (url: string, title = "iPhone 13") => ({ url, title }) as BotAdapterListing;

describe("deduplicateByUrl", () => {
  it("drops exact duplicate urls", () => {
    expect(deduplicateByUrl([listing("https://x.com/ilan/1"), listing("https://x.com/ilan/1")])).toHaveLength(1);
  });

  it("treats tracking parameters, fragments and host case as the same page", () => {
    const result = deduplicateByUrl([
      listing("https://www.x.com/ilan/1?id=5"),
      listing("https://WWW.x.com/ilan/1?id=5&utm_source=mail&fbclid=a#foto"),
    ]);
    expect(result).toHaveLength(1);
  });

  it("keeps pages that differ in a meaningful parameter or path", () => {
    const result = deduplicateByUrl([
      listing("https://x.com/ilan/1?id=5"),
      listing("https://x.com/ilan/1?id=6"),
      listing("https://x.com/ilan/2?id=5"),
    ]);
    expect(result).toHaveLength(3);
  });

  it("leaves urls it cannot parse alone", () => {
    expect(deduplicateByUrl([listing("not a url"), listing("not a url"), listing("other")])).toHaveLength(2);
  });

  it("keeps the stored url untouched", () => {
    const url = "https://x.com/ilan/1?utm_source=mail";
    expect(deduplicateByUrl([listing(url)])[0].url).toBe(url);
  });
});
