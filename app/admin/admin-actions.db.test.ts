// Runs the admin server actions against a REAL Supabase project (the one in
// .env.local) to prove create / edit / delete work end to end. Only the admin
// sign-in check is replaced. Skipped unless RUN_DB_TESTS=1 so the normal test
// run never touches a database:
//
//   RUN_DB_TESTS=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run app/admin/admin-actions.db.test.ts
//
// Everything it creates is named "ZZ Admin Test ..." and removed afterwards.

import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));
// The signed-in admin the actions see; the users test points it at a real temporary user.
const acting = vi.hoisted(() => ({ id: "00000000-0000-0000-0000-000000000000" }));
vi.mock("@/lib/admin", () => ({
  requireAdminUser: async () => ({ id: acting.id, email: "admin-test@example.com" }),
  isAdminEmail: () => false,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
  usePathname: () => "/admin",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/auth/audit", () => ({ logAdminAction: async () => undefined }));

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { loadProblemReport } from "@/lib/listing-problems";
import { loadMarketSignals } from "@/lib/market-signals";
import { loadSourceStats } from "@/lib/source-stats";
import { bulkListingAction, deleteListing, setListingStatus, updateListing } from "./listings/actions";
import { createProduct, deleteProduct, updateProduct } from "./products/actions";
import { createSource, deleteSource, toggleSource, updateSource } from "./sources/actions";
import AdminOverviewPage from "./page";
import AdminMarketSignalsPage from "./market-signals/page";
import AdminProblemListingsPage from "./problem-listings/page";
import AdminSourcesPage from "./sources/page";
import { banUser, deleteUser, makeAdmin, removeAdmin, unbanUser, verifyUser } from "./users/actions";

const enabled = process.env.RUN_DB_TESTS === "1";
const NAME = "ZZ Admin Test";
const form = (values: Record<string, string | number>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, String(value));
  return data;
};

describe.skipIf(!enabled)("admin actions against the database", { timeout: 60_000 }, () => {
  const admin = createSupabaseAdminClient()!;
  const productIds: number[] = [];
  const listingIds: number[] = [];
  const sourceIds: number[] = [];
  const userIds: string[] = [];

  afterAll(async () => {
    if (listingIds.length) await admin.from("listings").delete().in("id", listingIds);
    if (productIds.length) await admin.from("products").delete().in("id", productIds);
    if (sourceIds.length) await admin.from("sources").delete().in("id", sourceIds);
    for (const id of userIds) {
      await admin.from("admin_roles").delete().eq("user_id", id);
      await admin.auth.admin.deleteUser(id);
    }
  });

  async function productByName(name: string) {
    return (await admin.from("products").select("id, name, slug, category_id").eq("name", name).maybeSingle()).data;
  }

  it("products: create with an automatic category, reject a duplicate, rename, move category, refuse to delete one with listings, delete", async () => {
    const created = await createProduct(form({ name: `${NAME} iPhone 99 Pro`, slug: "", categoryId: "" }));
    expect(created).toMatchObject({ ok: true });
    const product = await productByName(`${NAME} iPhone 99 Pro`);
    expect(product).toBeTruthy();
    productIds.push(product!.id);
    expect(product!.slug).toBe("zz-admin-test-iphone-99-pro");
    expect(product!.category_id).toBeGreaterThan(0);

    const duplicate = await createProduct(form({ name: `${NAME} iPhone 99 Pro`, slug: "", categoryId: "" }));
    expect(duplicate.ok).toBe(false);
    expect((await createProduct(form({ name: "x", slug: "", categoryId: "" }))).ok).toBe(false);

    const otherCategory = (await admin.from("categories").select("id").neq("id", product!.category_id).eq("is_fallback", false).limit(1).single()).data!;
    const renamed = await updateProduct(form({ id: product!.id, name: `${NAME} iPhone 99`, slug: "zz-admin-test-iphone-99", categoryId: otherCategory.id }));
    expect(renamed).toMatchObject({ ok: true });
    const after = await productByName(`${NAME} iPhone 99`);
    expect(after).toMatchObject({ slug: "zz-admin-test-iphone-99", category_id: otherCategory.id });
    expect((await updateProduct(form({ id: product!.id, name: "", slug: "" }))).ok).toBe(false);

    const listing = await admin
      .from("listings")
      .insert({ product_id: product!.id, title: `${NAME} ilan`, price: 12345, city: "Konya", source: "ZZ-Admin-Test", url: "https://example.com/zz-admin/1", condition: "İkinci El", status: "published" })
      .select("id")
      .single();
    listingIds.push(listing.data!.id);
    const blocked = await deleteProduct(form({ id: product!.id }));
    expect(blocked.ok).toBe(false);
    expect(blocked.message).toContain("ilan");

    await admin.from("listings").delete().eq("id", listing.data!.id);
    listingIds.pop();
    expect(await deleteProduct(form({ id: product!.id }))).toMatchObject({ ok: true });
    expect(await productByName(`${NAME} iPhone 99`)).toBeNull();
    productIds.pop();
  });

  it("listings: validate, edit, change status, bulk deactivate, delete", async () => {
    const productId = (await admin.from("products").select("id").limit(1).single()).data!.id;
    const insert = async (title: string, url: string) => {
      const row = await admin
        .from("listings")
        .insert({ product_id: productId, title, price: 9999, city: "Konya", source: "ZZ-Admin-Test", url, condition: "İkinci El", status: "published" })
        .select("id")
        .single();
      listingIds.push(row.data!.id);
      return row.data!.id;
    };
    const a = await insert(`${NAME} A`, "https://example.com/zz-admin/a");
    const b = await insert(`${NAME} B`, "https://example.com/zz-admin/b");

    const valid = { id: a, product_id: productId, title: `${NAME} A edited`, price: 11111, city: "Ankara", source: "ZZ-Admin-Test", condition: "İyi", url: "https://example.com/zz-admin/a", image_url: "", status: "pending" };
    expect(await updateListing(form({ ...valid, price: 0 }))).toMatchObject({ ok: false });
    expect(await updateListing(form({ ...valid, title: "" }))).toMatchObject({ ok: false });
    expect(await updateListing(form(valid))).toMatchObject({ ok: true });
    expect((await admin.from("listings").select("title, price, city, condition, status").eq("id", a).single()).data).toEqual({
      title: `${NAME} A edited`, price: 11111, city: "Ankara", condition: "İyi", status: "pending",
    });

    expect(await setListingStatus(form({ id: a, status: "published" }))).toMatchObject({ ok: true });
    expect(await setListingStatus(form({ id: a, status: "nonsense" }))).toMatchObject({ ok: false });

    expect(await bulkListingAction([a, b], "deactivate")).toMatchObject({ ok: true, message: "2 ilan pasife alındı." });
    const statuses = (await admin.from("listings").select("status").in("id", [a, b])).data!.map((row) => row.status);
    expect(statuses).toEqual(["inactive", "inactive"]);
    expect(await bulkListingAction([], "delete")).toMatchObject({ ok: false });

    expect(await deleteListing(form({ id: a }))).toMatchObject({ ok: true });
    expect(await bulkListingAction([b], "delete")).toMatchObject({ ok: true });
    listingIds.length = 0;
    expect((await admin.from("listings").select("id").in("id", [a, b])).data).toEqual([]);
  });

  it("sources: create, reject bad input and duplicates, edit, switch off, delete", async () => {
    const input = {
      name: `${NAME} Kaynak`, slug: "zz-admin-test-kaynak", baseUrl: "https://example.com", type: "marketplace",
      integrationType: "manual" as const, botListingStatus: "pending" as const, apiUrl: "", scrapeUrl: "",
      cronEnabled: false, cronSchedule: "0 6 * * *", productLimit: 50,
    };
    expect(await createSource({ ...input, slug: "Bad Slug!" })).toMatchObject({ ok: false });
    expect(await createSource({ ...input, productLimit: 0 })).toMatchObject({ ok: false });
    expect(await createSource(input)).toMatchObject({ ok: true });
    const row = (await admin.from("sources").select("id, name, is_active").eq("slug", "zz-admin-test-kaynak").single()).data!;
    sourceIds.push(row.id);
    expect((await createSource(input)).ok).toBe(false);

    expect(await updateSource({ ...input, id: row.id, name: `${NAME} Kaynak 2`, productLimit: 75 })).toMatchObject({ ok: true });
    expect((await admin.from("sources").select("name, fetch_limit").eq("id", row.id).single()).data).toEqual({ name: `${NAME} Kaynak 2`, fetch_limit: 75 });

    expect(await toggleSource(row.id, false)).toMatchObject({ ok: true });
    expect((await admin.from("sources").select("is_active").eq("id", row.id).single()).data?.is_active).toBe(false);

    expect(await deleteSource(row.id)).toMatchObject({ ok: true });
    sourceIds.length = 0;
    expect((await admin.from("sources").select("id").eq("id", row.id)).data).toEqual([]);
  });

  it("users: verify, ban and unban, grant and revoke admin, protect the acting admin, delete", async () => {
    // A previous interrupted run may have left its test users behind.
    const existing = (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users.filter((user) => user.email?.startsWith("zz-admin-"));
    for (const user of existing) {
      await admin.from("admin_roles").delete().eq("user_id", user.id);
      await admin.auth.admin.deleteUser(user.id);
    }

    const make = async (email: string) => {
      // Confirmed on creation: an unconfirmed user would make the project send a real sign-up e-mail.
      const created = await admin.auth.admin.createUser({ email, password: "Zz-test-1234!", email_confirm: true });
      expect(created.error).toBeNull();
      userIds.push(created.data.user!.id);
      return created.data.user!.id;
    };
    const actor = await make("zz-admin-actor@example.com");
    const target = await make("zz-admin-target@example.com");
    acting.id = actor;

    expect(await verifyUser(target)).toMatchObject({ ok: true });
    expect((await admin.auth.admin.getUserById(target)).data.user!.email_confirmed_at).toBeTruthy();

    expect(await banUser(target)).toMatchObject({ ok: true });
    expect((await admin.auth.admin.getUserById(target)).data.user!.banned_until).toBeTruthy();
    expect(await unbanUser(target)).toMatchObject({ ok: true });
    expect((await admin.auth.admin.getUserById(target)).data.user!.banned_until).toBeFalsy();

    expect(await makeAdmin(target)).toMatchObject({ ok: true });
    expect((await admin.from("admin_roles").select("user_id").eq("user_id", target)).data).toHaveLength(1);
    expect(await removeAdmin(target)).toMatchObject({ ok: true });
    expect((await admin.from("admin_roles").select("user_id").eq("user_id", target)).data).toHaveLength(0);

    expect(await removeAdmin(actor)).toMatchObject({ ok: false });
    expect(await deleteUser(actor)).toMatchObject({ ok: false });
    expect(await verifyUser("")).toMatchObject({ ok: false });

    expect(await deleteUser(target)).toMatchObject({ ok: true });
    expect((await admin.auth.admin.getUserById(target)).data.user).toBeNull();
    userIds.splice(userIds.indexOf(target), 1);
  });

  it("admin views: source stats, problem listings and market signals load from real data", async () => {
    const stats = await loadSourceStats(admin);
    expect(stats.rows.length).toBeGreaterThan(0);
    expect(stats.rows.reduce((sum, row) => sum + row.totalListings, 0)).toBe(stats.scannedListings);

    const report = await loadProblemReport(admin);
    expect(report.scanned).toBeGreaterThan(0);
    expect(Object.keys(report.counts)).toHaveLength(6);

    const signals = await loadMarketSignals(admin);
    expect(signals.scannedListings).toBeGreaterThan(0);
    expect(Array.isArray(signals.opportunities)).toBe(true);
  });

  it("admin pages render with real data: dashboard, sources, problem listings, market signals", async () => {
    const html = async (node: Promise<React.ReactElement> | React.ReactElement) => renderToStaticMarkup(await node);

    const overview = await html(AdminOverviewPage());
    expect(overview).toContain("Kaynaklara göre ilanlar");
    expect(overview).toContain("Hatalı ilanları yönet");

    const sources = await html(AdminSourcesPage());
    expect(sources).toContain("Hangi kaynaktan kaç ilan geliyor");
    expect(sources).toContain("Sahibinden");

    const problems = await html(AdminProblemListingsPage({ searchParams: Promise.resolve({}) }));
    expect(problems).toContain("Hatalı ilanlar");
    expect(problems).toContain("Şüpheli ucuz (");
    const filtered = await html(AdminProblemListingsPage({ searchParams: Promise.resolve({ kind: "no_image", page: "99" }) }));
    expect(filtered).toContain("Görsel yok (");

    const signals = await html(AdminMarketSignalsPage());
    expect(signals).toContain("Piyasa sinyalleri");
    expect(signals).toContain("Fırsat ilanları");
    expect(signals).toContain("yayındaki ilan tarandı");
  });
});
