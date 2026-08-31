import { Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { AdminEmpty, AdminPageHeader } from "@/components/admin-ui";
import { ADMIN_EMAILS } from "@/lib/admin";
import { formatDateTR } from "@/lib/formatters";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { UsersFilter } from "./users-filter";

type SearchParams = { q?: string; filter?: string };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q = "", filter = "all" } = await searchParams;
  const supabase = createSupabaseAdminClient();

  const usersResult = await supabase?.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const favoritesResult = await supabase?.from("favorites").select("user_id");
  const adminRolesResult = await supabase
    ?.from("admin_roles")
    .select("user_id");

  if (usersResult?.error)
    console.error("Admin auth users query failed:", usersResult.error);
  if (favoritesResult?.error)
    console.error("Admin user favorites query failed:", favoritesResult.error);
  if (adminRolesResult?.error)
    console.error("Admin roles query failed:", adminRolesResult.error);

  const favoriteCounts = new Map<string, number>();
  for (const favorite of favoritesResult?.data ?? []) {
    const id = String(favorite.user_id);
    favoriteCounts.set(id, (favoriteCounts.get(id) ?? 0) + 1);
  }

  const adminIds = new Set((adminRolesResult?.data ?? []).map((row) => String(row.user_id)));

  const allUsers = usersResult?.data.users ?? [];
  const query = q.trim().toLocaleLowerCase("en-US");

  const isAdminUser = (user: (typeof allUsers)[number]) =>
    adminIds.has(user.id) || ADMIN_EMAILS.includes(user.email ?? "");

  const visible = allUsers.filter((user) => {
    if (query) {
      const email = (user.email ?? "").toLocaleLowerCase("en-US");
      const username = String(
        user.user_metadata?.username ?? ""
      ).toLocaleLowerCase("en-US");
      const id = user.id.toLocaleLowerCase("en-US");
      if (
        !email.includes(query) &&
        !username.includes(query) &&
        !id.includes(query)
      ) {
        return false;
      }
    }
    if (filter === "verified") return Boolean(user.email_confirmed_at);
    if (filter === "unverified") return !user.email_confirmed_at;
    if (filter === "active") return user.banned_until == null;
    if (filter === "banned") return user.banned_until != null;
    if (filter === "admin") return isAdminUser(user);
    if (filter === "normal") return !isAdminUser(user);
    return true;
  });

  return (
    <>
      <AdminPageHeader
        eyebrow="Supabase Auth"
        title="Kullanıcılar"
        description="Kayıtlı kullanıcıları arayın, filtreleyin ve yönetin. Detay, doğrulama, engelleme ve admin yönetimi detay sayfasında."
      />
      {usersResult?.error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Auth kullanıcıları alınamadı: {usersResult.error.message}
        </div>
      )}

      <UsersFilter
        total={allUsers.length}
        visible={visible.length}
        q={q}
        filter={filter}
      />

      {visible.length ? (
        <div className="mt-4 w-full max-w-full min-w-0 overflow-x-auto rounded-2xl border border-black/8 bg-white [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-[#fafaf8] text-xs uppercase tracking-wide text-black/45">
              <tr>
                <th className="px-4 py-3">Kullanıcı</th>
                <th className="px-4 py-3">Durum</th>
                <th className="px-4 py-3">Kayıt tarihi</th>
                <th className="px-4 py-3">Son giriş</th>
                <th className="px-4 py-3">Favori</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((user) => {
                const isAdmin =
                  adminIds.has(user.id) ||
                  ADMIN_EMAILS.includes(user.email ?? "");
                const verified = Boolean(user.email_confirmed_at);
                const banned = user.banned_until != null;
                return (
                  <tr
                    key={user.id}
                    className="group border-t border-black/7 transition hover:bg-[#fffaf6]"
                  >
                    <td className="px-4 py-4">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="inline-flex items-center gap-2 font-black hover:text-[#d95700]"
                      >
                        {user.email ?? "E-posta yok"}
                        {isAdmin && (
                          <span className="grid size-5 place-items-center rounded-md bg-[#fff1e7] text-[#d95700]">
                            <ShieldCheck size={13} />
                          </span>
                        )}
                      </Link>
                      <p className="mt-0.5 font-mono text-[11px] text-black/35">
                        {user.id}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={verified ? "green" : "amber"}>
                          {verified ? "Doğrulanmış" : "Doğrulanmamış"}
                        </Badge>
                        {banned && <Badge tone="red">Engelli</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-black/60">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-4 py-4 text-black/60">
                      {user.last_sign_in_at
                        ? formatDate(user.last_sign_in_at)
                        : "Henüz giriş yapmadı"}
                    </td>
                    <td className="px-4 py-4 font-black">
                      {favoriteCounts.get(user.id) ?? 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4">
          <AdminEmpty>
            {allUsers.length ? (
              <span className="inline-flex items-center gap-2">
                <Search size={16} /> Bu filtreye uyan kullanıcı bulunamadı.
              </span>
            ) : (
              "Kullanıcı verisi bulunamadı."
            )}
          </AdminEmpty>
        </div>
      )}
    </>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "green" | "amber" | "red";
}) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${tones[tone]}`}>
      {children}
    </span>
  );
}

function formatDate(value: string) {
  return formatDateTR(value, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
