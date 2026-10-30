import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { regroupProducts } from "./group-repository";

type Row = {
  id: number;
  product_id: number;
  title: string;
  price: number;
  source: string;
  city: string | null;
  condition: string | null;
  duplicate_group_id: string | null;
};

type Update = { groupId: string | null; ids: number[] };

/** Minimal stand-in for the query builder: records UPDATEs, serves the rows for SELECTs. */
function fakeAdmin(rows: Row[]) {
  const updates: Update[] = [];
  const admin = {
    from() {
      let operation: "select" | "update" = "select";
      let payload: { duplicate_group_id: string | null } | null = null;
      let ids: number[] = [];
      let range: [number, number] = [0, Number.MAX_SAFE_INTEGER];
      const builder: Record<string, unknown> = {
        select: () => builder,
        update: (value: { duplicate_group_id: string | null }) => {
          operation = "update";
          payload = value;
          return builder;
        },
        in: (column: string, values: unknown[]) => {
          if (column === "id") ids = values as number[];
          return builder;
        },
        order: () => builder,
        range: (from: number, to: number) => {
          range = [from, to];
          return builder;
        },
        then: (resolve: (value: unknown) => unknown) => {
          if (operation === "update") {
            updates.push({ groupId: payload?.duplicate_group_id ?? null, ids });
            return resolve({ error: null });
          }
          return resolve({ data: rows.slice(range[0], range[1] + 1), error: null });
        },
      };
      return builder;
    },
  };
  return { admin: admin as unknown as SupabaseClient<Database>, updates };
}

function row(id: number, title: string, price: number, source: string, group: string | null = null, productId = 1): Row {
  return { id, product_id: productId, title, price, source, city: "İstanbul", condition: "İkinci El", duplicate_group_id: group };
}

describe("regroupProducts", () => {
  it("writes one group id for the copies and nothing for the others", async () => {
    const { admin, updates } = fakeAdmin([
      row(1, "iPhone 13 128GB Mavi", 25000, "Sahibinden"),
      row(2, "iPhone 13 128 GB mavi", 25100, "Letgo"),
      row(3, "iPhone 13 256GB", 30000, "EasyCep"),
    ]);

    const result = await regroupProducts(admin, [1], () => "new-group");

    expect(updates).toEqual([{ groupId: "new-group", ids: [1, 2] }]);
    expect(result).toEqual({ products: 1, listings: 3, groups: 1, groupedListings: 2, changed: 2 });
  });

  it("writes nothing when the stored groups are already right", async () => {
    const { admin, updates } = fakeAdmin([
      row(1, "iPhone 13 128GB", 25000, "Sahibinden", "g"),
      row(2, "iPhone 13 128GB", 25000, "Letgo", "g"),
      row(3, "iPhone 13 256GB", 30000, "EasyCep"),
    ]);

    const result = await regroupProducts(admin, [1]);

    expect(updates).toEqual([]);
    expect(result).toMatchObject({ groups: 1, groupedListings: 2, changed: 0 });
  });

  it("clears the group of a listing that no longer matches", async () => {
    const { admin, updates } = fakeAdmin([
      row(1, "iPhone 13 128GB", 25000, "Sahibinden", "g"),
      row(2, "iPhone 13 256GB", 25000, "Letgo", "g"),
    ]);

    const result = await regroupProducts(admin, [1]);

    expect(updates).toEqual([{ groupId: null, ids: [1, 2] }]);
    expect(result).toMatchObject({ groups: 0, groupedListings: 0, changed: 2 });
  });

  it("keeps products apart: identical listings of different products never group", async () => {
    const { admin, updates } = fakeAdmin([
      row(1, "iPhone 13 128GB", 25000, "Sahibinden", null, 1),
      row(2, "iPhone 13 128GB", 25000, "Letgo", null, 2),
    ]);

    await regroupProducts(admin, [1, 2]);

    expect(updates).toEqual([]);
  });

  it("does nothing for an empty product list", async () => {
    const { admin, updates } = fakeAdmin([]);
    expect(await regroupProducts(admin, [])).toEqual({ products: 0, listings: 0, groups: 0, groupedListings: 0, changed: 0 });
    expect(updates).toEqual([]);
  });
});
