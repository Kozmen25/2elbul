import {
  Boxes,
  CalendarDays,
  Heart,
  PackageSearch,
  Users,
} from "lucide-react";
import { AdminPageHeader, AdminStatCard } from "@/components/admin-ui";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export default async function AdminOverviewPage() {
  const supabase = createSupabaseAdminClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [
    listings,
    inactiveListings,
    products,
    favorites,
    todayListings,
    weekListings,
    users,
  ] = supabase
    ? await Promise.all([
        supabase.from("listings").select("id", { count: "exact", head: true }),
        supabase
          .from("listings")
          .select("id", { count: "exact", head: true })
          .eq("status", "inactive"),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("favorites").select("id", { count: "exact", head: true }),
        supabase
          .from("listings")
          .select("id", { count: "exact", head: true })
          .gte("created_at", today.toISOString()),
        supabase
          .from("listings")
          .select("id", { count: "exact", head: true })
          .gte("created_at", sevenDaysAgo.toISOString()),
        supabase.auth.admin.listUsers({ page: 1, perPage: 1 }),
      ])
    : [null, null, null, null, null, null, null];

  if (!supabase) {
    console.error("Admin dashboard: service role client is not configured.");
  }

  const userCount =
    users && !users.error ? users.data.total ?? users.data.users.length : 0;

  return (
    <>
      <AdminPageHeader
        eyebrow="2ElBul Admin"
        title="Genel Bakış"
        description="Platformun ilan, ürün, kullanıcı ve etkileşim sayılarını tek ekrandan takip edin."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <AdminStatCard
          label="Toplam ilan"
          value={listings?.count ?? 0}
          icon={PackageSearch}
        />
        <AdminStatCard
          label="Pasif ilan"
          value={inactiveListings?.count ?? 0}
          icon={PackageSearch}
        />
        <AdminStatCard
          label="Toplam ürün"
          value={products?.count ?? 0}
          icon={Boxes}
        />
        <AdminStatCard
          label="Toplam kullanıcı"
          value={userCount}
          icon={Users}
          note={users?.error ? "Auth verisi alınamadı" : undefined}
        />
        <AdminStatCard
          label="Toplam favori"
          value={favorites?.count ?? 0}
          icon={Heart}
        />
        <AdminStatCard
          label="Bugün eklenen ilan"
          value={todayListings?.count ?? 0}
          icon={CalendarDays}
        />
        <AdminStatCard
          label="Son 7 gün eklenen ilan"
          value={weekListings?.count ?? 0}
          icon={CalendarDays}
        />
      </div>
    </>
  );
}
