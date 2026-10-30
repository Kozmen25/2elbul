import { describe, expect, it } from "vitest";
import { listingOutboundPath } from "@/lib/listing-links";
import { manualStatusFields } from "@/lib/listing-status";
import { isFollowableUrl, parseListingId } from "./outbound";

describe("outbound links", () => {
  it("routes every listing link through /git", () => {
    expect(listingOutboundPath(42)).toBe("/git/42");
    expect(listingOutboundPath("7")).toBe("/git/7");
  });

  it("parses only numeric listing ids", () => {
    expect(parseListingId("123")).toBe(123);
    expect(parseListingId("12a")).toBeNull();
    expect(parseListingId("../admin")).toBeNull();
  });

  it("follows only http(s) source pages", () => {
    expect(isFollowableUrl("https://www.easycep.com/x")).toBe(true);
    expect(isFollowableUrl("javascript:alert(1)")).toBe(false);
    expect(isFollowableUrl("")).toBe(false);
  });
});

describe("manualStatusFields", () => {
  it("clears the automatic reason when an admin republishes", () => {
    expect(manualStatusFields("published")).toEqual({
      status: "published",
      inactive_reason: null,
      availability_gone_count: 0,
      availability_gone_since: null,
    });
  });

  it("keeps the record when the listing stays off the site", () => {
    expect(manualStatusFields("inactive")).toEqual({ status: "inactive" });
  });
});
