import { AdminEmpty, AdminPageHeader } from "@/components/admin-ui";
import { ADMIN_EMAILS } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { DeleteUserButton } from "./delete-user-button";

export default async function AdminUsersPage() {
  const supabase = createSupabaseAdminClient();
  const usersResult = await supabase?.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const favoritesResult = await supabase?.from("favorites").select("user_id");

  if (usersResult?.error)
    console.error("Admin auth users query failed:", usersResult.error);
  if (favoritesResult?.error)
    console.error("Admin user favorites query failed:", favoritesResult.error);

  const favoriteCounts = new Map<string, number>();
  for (const favorite of favoritesResult?.data ?? []) {
    const id = String(favorite.user_id);
    favoriteCounts.set(id, (favoriteCounts.get(id) ?? 0) + 1);
  }

  const users = usersResult?.data.users ?? [];

  return (
    <>
      <AdminPageHeader
        eyebrow="Supabase Auth"
        title="Kullanıcılar"
        description="Kayıtlı kullanıcıları, son giriş bilgilerini ve favori sayılarını görüntüleyin."
      />
      {usersResult?.error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Auth kullanıcıları alınamadı: {usersResult.error.message}
        </div>
      )}
      {users.length ? (
        <div className="overflow-x-auto rounded-2xl border border-black/8 bg-white">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-[#fafaf8] text-xs uppercase tracking-wide text-black/45">
              <tr>
                <th className="px-4 py-3">E-posta</th>
                <th className="px-4 py-3">Kayıt tarihi</th>
                <th className="px-4 py-3">Son giriş</th>
                <th className="px-4 py-3">Favori</th>
                <th className="px-4 py-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-black/7">
                  <td className="px-4 py-4">
                    <p className="font-black">{user.email ?? "E-posta yok"}</p>
                    {ADMIN_EMAILS.includes(user.email ?? "") && (
                      <span className="mt-1 inline-block rounded-full bg-[#fff1e7] px-2 py-0.5 text-[10px] font-black text-[#d95700]">
                        ADMIN
                      </span>
                    )}
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
                  <td className="px-4 py-4">
                    <div className="flex justify-end">
                      {!ADMIN_EMAILS.includes(user.email ?? "") ? (
                        <DeleteUserButton
                          userId={user.id}
                          email={user.email ?? user.id}
                        />
                      ) : (
                        <span className="text-xs text-black/35">Korumalı</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <AdminEmpty>Kullanıcı verisi bulunamadı.</AdminEmpty>
      )}
    </>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
