import { describe, expect, it } from "vitest";
import { collapseDuplicateListings, summarizeStoredDuplicateGroups } from "./collapse";
import { assignDuplicateGroups, diffGroupAssignment, type GroupableListing } from "./listing-grouping";
import { compareListingIdentity, type IdentityListing } from "./listing-identity";

function listing(id: string, title: string, price: number, source: string, extra: Partial<IdentityListing> = {}): GroupableListing {
  return { id, title, price, source, city: "İstanbul", condition: "İkinci El", ...extra };
}

const verdict = (a: IdentityListing, b: IdentityListing) => compareListingIdentity(a, b);

describe("compareListingIdentity: same item on two platforms", () => {
  it("matches the same listing worded differently", () => {
    expect(
      verdict(
        listing("a", "iPhone 13 128GB Mavi Temiz Kutulu", 25000, "Sahibinden"),
        listing("b", "İPHONE 13 128 GB mavi, ACİL!", 25200, "Letgo"),
      ),
    ).toEqual({ same: true });
  });

  it("matches identical titles at the same price", () => {
    expect(verdict(listing("a", "iPhone 13 128GB", 25000, "Sahibinden"), listing("b", "iPhone 13 128GB", 25000, "Letgo")).same).toBe(true);
  });

  it("allows one title to leave out the color", () => {
    expect(verdict(listing("a", "iPhone 13 128GB Mavi", 25000, "Sahibinden"), listing("b", "iPhone 13 128GB", 25000, "Letgo")).same).toBe(true);
  });
});

describe("compareListingIdentity: different items must never match", () => {
  const base = listing("a", "iPhone 13 128GB", 25000, "Sahibinden");

  it.each([
    ["different storage", listing("b", "iPhone 13 256GB", 25000, "Letgo"), "Depolama"],
    ["storage missing in one title", listing("b", "iPhone 13", 25000, "Letgo"), "Depolama"],
    ["different variant (Pro)", listing("b", "iPhone 13 Pro 128GB", 25000, "Letgo"), "varyant"],
    ["different variant (Mini)", listing("b", "iPhone 13 Mini 128GB", 25000, "Letgo"), "varyant"],
    ["different color", listing("b", "iPhone 13 128GB Mavi", 25000, "Letgo", {}), null],
    ["price too far apart", listing("b", "iPhone 13 128GB", 17500, "Letgo"), "Fiyat"],
    ["different condition", listing("b", "iPhone 13 128GB", 25000, "Letgo", { condition: "Sıfır" }), "durumu"],
    ["different city", listing("b", "iPhone 13 128GB", 25000, "Letgo", { city: "Ankara" }), "Şehir"],
    ["same source", listing("b", "iPhone 13 128GB", 25000, "Sahibinden"), "kaynak"],
  ])("%s", (name, other, reasonPart) => {
    const colored = name === "different color" ? listing("a", "iPhone 13 128GB Siyah", 25000, "Sahibinden") : base;
    const result = verdict(colored, other);
    expect(result.same).toBe(false);
    if (reasonPart && !result.same) expect(result.reason.toLowerCase()).toContain(reasonPart.toLowerCase());
  });

  it("does not match when the titles share too little", () => {
    const result = verdict(
      listing("a", "iPhone 13 128GB kılıf ekran koruyucu şarj kablosu hediyeli", 25000, "Sahibinden"),
      listing("b", "iPhone 13 128GB", 25000, "Letgo"),
    );
    expect(result.same).toBe(false);
  });

  it("treats Galaxy S23 and S23 Ultra as different", () => {
    expect(verdict(listing("a", "Samsung Galaxy S23 256GB", 30000, "Sahibinden"), listing("b", "Samsung Galaxy S23 Ultra 256GB", 30000, "Letgo")).same).toBe(false);
  });
});

describe("assignDuplicateGroups", () => {
  let counter = 0;
  const newId = () => `group-${(counter += 1)}`;

  it("groups cross-platform copies and leaves other listings alone", () => {
    counter = 0;
    const result = assignDuplicateGroups(
      [
        listing("a", "iPhone 13 128GB Mavi", 25000, "Sahibinden"),
        listing("b", "iPhone 13 128 GB mavi", 25100, "Letgo"),
        listing("c", "iPhone 13 256GB", 30000, "EasyCep"),
        listing("d", "iPhone 13 128GB mavi acil", 24900, "Getmobil"),
      ],
      newId,
    );
    expect(result.get("a")).toBe(result.get("b"));
    expect(result.get("a")).toBe(result.get("d"));
    expect(result.get("a")).not.toBeNull();
    expect(result.get("c")).toBeNull();
  });

  it("never puts two listings of one source in a group (complete linkage)", () => {
    counter = 0;
    const result = assignDuplicateGroups(
      [
        listing("a", "iPhone 13 128GB", 25000, "Sahibinden"),
        listing("b", "iPhone 13 128GB", 25100, "Sahibinden"),
        listing("c", "iPhone 13 128GB", 25050, "Letgo"),
      ],
      newId,
    );
    const groupOf = (id: string) => result.get(id);
    const members = ["a", "b", "c"].filter((id) => groupOf(id) === groupOf("c") && groupOf(id) !== null);
    const sources = members.map((id) => (id === "c" ? "Letgo" : "Sahibinden"));
    expect(new Set(sources).size).toBe(sources.length);
  });

  it("does not chain: A~B and B~C but A is not C", () => {
    counter = 0;
    // 25000 ~ 25700 (2.8%), 25700 ~ 26400 (2.7%), but 25000 vs 26400 is 5.6%.
    const result = assignDuplicateGroups(
      [
        listing("a", "iPhone 13 128GB", 25000, "Sahibinden"),
        listing("b", "iPhone 13 128GB", 25700, "Letgo"),
        listing("c", "iPhone 13 128GB", 26400, "EasyCep"),
      ],
      newId,
    );
    const grouped = [...result.values()].filter((value) => value !== null);
    expect(new Set(grouped).size).toBeLessThanOrEqual(1);
    expect(grouped.length).toBeLessThan(3);
  });

  it("keeps stored group ids stable and uses each id once", () => {
    counter = 0;
    const result = assignDuplicateGroups(
      [
        { ...listing("a", "iPhone 13 128GB", 25000, "Sahibinden"), duplicateGroupId: "keep-me" },
        { ...listing("b", "iPhone 13 128GB", 25100, "Letgo"), duplicateGroupId: "keep-me" },
      ],
      newId,
    );
    expect(result.get("a")).toBe("keep-me");
    expect(result.get("b")).toBe("keep-me");
  });

  it("is independent of the input order", () => {
    const items = [
      listing("a", "iPhone 13 128GB", 25000, "Sahibinden"),
      listing("b", "iPhone 13 128GB", 25100, "Letgo"),
      listing("c", "iPhone 13 128GB", 25050, "EasyCep"),
    ];
    const shape = (list: GroupableListing[]) => {
      counter = 0;
      const assignment = assignDuplicateGroups(list, newId);
      return list.map((l) => l.id).sort().map((id) => assignment.get(id)).map((g) => (g === null ? "-" : "g")).join("");
    };
    expect(shape(items)).toBe(shape([...items].reverse()));
  });
});

describe("diffGroupAssignment", () => {
  it("returns only the listings whose group changed, including ungrouping", () => {
    const listings: GroupableListing[] = [
      { ...listing("a", "x", 1, "S1"), duplicateGroupId: "g1" },
      { ...listing("b", "x", 1, "S2"), duplicateGroupId: "g1" },
      { ...listing("c", "x", 1, "S3"), duplicateGroupId: null },
      { ...listing("d", "x", 1, "S4"), duplicateGroupId: "old" },
    ];
    const assignment = new Map<string, string | null>([["a", "g1"], ["b", "g1"], ["c", "g2"], ["d", null]]);
    expect(diffGroupAssignment(listings, assignment)).toEqual([
      { id: "c", groupId: "g2" },
      { id: "d", groupId: null },
    ]);
  });
});

describe("collapseDuplicateListings", () => {
  const mk = (id: string, price: number, source: string, group: string | null, createdAt = "2026-10-01") => ({
    id, price, source, url: `https://${source}/${id}`, createdAt, duplicateGroupId: group,
  });

  it("keeps the cheapest listing of a group and lists the others as also-on", () => {
    const result = collapseDuplicateListings([
      mk("a", 25000, "Sahibinden", "g"),
      mk("b", 24500, "Letgo", "g"),
      mk("c", 31000, "EasyCep", null),
      mk("d", 25200, "Getmobil", "g"),
    ]);
    expect(result.map((l) => l.id)).toEqual(["b", "c"]);
    expect(result[0].alsoOn.map((o) => [o.source, o.price])).toEqual([["Sahibinden", 25000], ["Getmobil", 25200]]);
    expect(result[1].alsoOn).toEqual([]);
  });

  it("breaks price ties with the older listing", () => {
    const result = collapseDuplicateListings([
      mk("new", 25000, "Letgo", "g", "2026-10-02"),
      mk("old", 25000, "Sahibinden", "g", "2026-09-01"),
    ]);
    expect(result.map((l) => l.id)).toEqual(["old"]);
  });

  it("passes ungrouped listings through untouched and counts a group once", () => {
    const list = [mk("a", 1, "S1", null), mk("b", 2, "S2", "g"), mk("c", 3, "S3", "g")];
    expect(collapseDuplicateListings(list)).toHaveLength(2);
    expect(collapseDuplicateListings([])).toEqual([]);
  });
});

describe("summarizeStoredDuplicateGroups", () => {
  const mk = (id: string, title: string, price: number, group: string | null) => ({
    id, title, price, source: `S${id}`, url: `https://x/${id}`, createdAt: "2026-10-01", duplicateGroupId: group,
  });

  it("describes the stored groups for the confidence and opportunity scores", () => {
    const summary = summarizeStoredDuplicateGroups([
      mk("1", "iPhone 13 A", 100, "g1"),
      mk("2", "iPhone 13 B", 110, "g1"),
      mk("3", "iPhone 13 C", 120, "g1"),
      mk("4", "iPhone 13 D", 130, "g2"),
      mk("5", "iPhone 13 E", 135, "g2"),
      mk("6", "iPhone 13 F", 200, null),
    ]);
    expect(summary).toMatchObject({
      itemCount: 6,
      groupCount: 3, // two duplicate groups + one single listing
      matchedGroupCount: 2,
      duplicatePairCount: 3, // (3-1) + (2-1)
      duplicateItemCount: 5,
      maxGroupSize: 3,
    });
    expect(summary.topGroups[0]).toMatchObject({ canonicalTitle: "iPhone 13 A", duplicateCount: 2 });
  });

  it("reports no duplicates when nothing is grouped, and ignores one-member groups", () => {
    expect(summarizeStoredDuplicateGroups([mk("1", "a", 1, null), mk("2", "b", 2, "solo")])).toMatchObject({
      itemCount: 2,
      groupCount: 2,
      matchedGroupCount: 0,
      duplicateItemCount: 0,
      maxGroupSize: 0,
    });
    expect(summarizeStoredDuplicateGroups([])).toMatchObject({ itemCount: 0, groupCount: 0 });
  });
});
