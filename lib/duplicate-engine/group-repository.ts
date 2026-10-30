import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { toBigintIds } from "@/lib/supabase-ids";
import { assignDuplicateGroups, diffGroupAssignment, type GroupableListing } from "./listing-grouping";

// Writes duplicate groups (listings.duplicate_group_id) for whole products.
//
// Groups only ever exist inside one product, among published/active listings,
// so each product is recomputed on its own. Stored group ids are reused when
// the members stay the same (see assignDuplicateGroups), which keeps the ids
// stable between runs. Safe to run repeatedly; a run that changes nothing
// writes nothing.

type AdminClient = SupabaseClient<Database>;

const VISIBLE_STATUSES = ["published", "active"];
const LISTING_PAGE_SIZE = 1000;
/** Products loaded per query; keeps the IN list and the result page small. */
const PRODUCT_CHUNK_SIZE = 50;
/** Listing ids per UPDATE ... WHERE id IN (...). */
const UPDATE_BATCH_SIZE = 200;

export type RegroupResult = {
  products: number;
  listings: number;
  /** Duplicate groups that exist after the run. */
  groups: number;
  /** Listings that belong to a duplicate group after the run. */
  groupedListings: number;
  /** Rows written. */
  changed: number;
};

type ProductListingRow = {
  id: number;
  product_id: number;
  title: string;
  price: number;
  source: string;
  city: string | null;
  condition: string | null;
  duplicate_group_id: string | null;
};

export async function regroupProducts(
  admin: AdminClient,
  productIds: Array<number | string>,
  createGroupId?: () => string,
): Promise<RegroupResult> {
  const result: RegroupResult = { products: 0, listings: 0, groups: 0, groupedListings: 0, changed: 0 };
  const ids = [...new Set(toBigintIds(productIds))];

  for (let start = 0; start < ids.length; start += PRODUCT_CHUNK_SIZE) {
    const chunk = ids.slice(start, start + PRODUCT_CHUNK_SIZE);
    const rows = await loadListings(admin, chunk);

    const byProduct = new Map<number, ProductListingRow[]>();
    for (const row of rows) {
      const list = byProduct.get(row.product_id) ?? [];
      list.push(row);
      byProduct.set(row.product_id, list);
    }

    const writes = new Map<string | null, string[]>();
    for (const productRows of byProduct.values()) {
      const listings: GroupableListing[] = productRows.map((row) => ({
        id: String(row.id),
        title: row.title,
        price: Number(row.price),
        source: row.source,
        city: row.city,
        condition: row.condition,
        duplicateGroupId: row.duplicate_group_id,
      }));

      const assignment = assignDuplicateGroups(listings, createGroupId);
      for (const change of diffGroupAssignment(listings, assignment)) {
        const list = writes.get(change.groupId) ?? [];
        list.push(change.id);
        writes.set(change.groupId, list);
      }

      const groupIds = new Set([...assignment.values()].filter((id): id is string => id !== null));
      result.groups += groupIds.size;
      result.groupedListings += [...assignment.values()].filter((id) => id !== null).length;
    }

    result.products += chunk.length;
    result.listings += rows.length;
    result.changed += await applyWrites(admin, writes);
  }

  return result;
}

async function loadListings(admin: AdminClient, productIds: number[]): Promise<ProductListingRow[]> {
  const rows: ProductListingRow[] = [];
  for (let offset = 0; ; offset += LISTING_PAGE_SIZE) {
    const { data, error } = await admin
      .from("listings")
      .select("id, product_id, title, price, source, city, condition, duplicate_group_id")
      .in("product_id", productIds)
      .in("status", VISIBLE_STATUSES)
      .order("id", { ascending: true })
      .range(offset, offset + LISTING_PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as ProductListingRow[]));
    if ((data ?? []).length < LISTING_PAGE_SIZE) return rows;
  }
}

async function applyWrites(admin: AdminClient, writes: Map<string | null, string[]>): Promise<number> {
  let changed = 0;
  for (const [groupId, listingIds] of writes) {
    for (let start = 0; start < listingIds.length; start += UPDATE_BATCH_SIZE) {
      const batch = listingIds.slice(start, start + UPDATE_BATCH_SIZE);
      const { error } = await admin
        .from("listings")
        .update({ duplicate_group_id: groupId })
        .in("id", toBigintIds(batch));
      if (error) throw error;
      changed += batch.length;
    }
  }
  return changed;
}

/** Every product id, in id order, for the daily full pass. */
export async function regroupAllProducts(
  admin: AdminClient,
  pageSize = 200,
): Promise<RegroupResult> {
  const total: RegroupResult = { products: 0, listings: 0, groups: 0, groupedListings: 0, changed: 0 };
  let lastId = 0;
  for (;;) {
    const { data, error } = await admin
      .from("products")
      .select("id")
      .gt("id", lastId)
      .order("id", { ascending: true })
      .limit(pageSize);
    if (error) throw error;
    const ids = (data ?? []).map((row) => row.id);
    if (ids.length === 0) return total;

    const page = await regroupProducts(admin, ids);
    total.products += page.products;
    total.listings += page.listings;
    total.groups += page.groups;
    total.groupedListings += page.groupedListings;
    total.changed += page.changed;

    lastId = ids[ids.length - 1];
    if (ids.length < pageSize) return total;
  }
}
