import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/action-button";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { AdminPageHeader } from "@/components/admin-ui";
import { ADMIN_EMAILS } from "@/lib/admin";
import { formatDateTR } from "@/lib/formatters";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  banUser,
  deleteUser,
  makeAdmin,
  removeAdmin,
  resetUserPassword,
  unbanUser,
  verifyUser,
} from "../actions";

type AuditRow = {
  id: number;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const userResult = await supabase?.auth.admin.getUserById(id);
  const target = userResult?.data?.user;

  if (userResult?.error) {
    console.error("Admin user detail query failed:", userResult.error);
  }
  if (!userResult?.data || !target) {
    notFound();
  }

  const [adminRoleResult, auditResult, adminsResult] = await Promise.all([
    supabase
      ?.from("admin_roles")
      .select("user_id")
      .eq("user_id", id)
      .maybeSingle<{ user_id: string }>(),
    supabase
      ?.from("admin_audit_logs")
      .select("id, action, metadata, created_at")
      .eq("target_user_id", id)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      ?.from("admin_roles")
      .select("user_id")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const adminIds = new Set((adminsResult?.data ?? []).map((row) => String(row.user_id)));
  const email = target.email ?? "";
  const isAdmin = Boolean(adminRoleResult?.data) || ADMIN_EMAILS.includes(email);
  const verified = Boolean(target.email_confirmed_at);
  const banned = target.banned_until != null;

  const audits: AuditRow[] = [];
  for (const row of auditResult?.data ?? []) {
    audits.push({
      id: Number(row.id),
      action: String(row.action),
      metadata:
        row.metadata && typeof row.metadata === "object"
          ? (row.metadata as Record<string, unknown>)
          : null,
      created_at: String(row.created_at),
    });
  }

  return (
    <>
      <Link
        href="/admin/users"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-bold text-black/50 transition hover:text-[#d95700]"
      >
        <ArrowLeft size={16} /> Kullanıcılar
      </Link>

      <AdminPageHeader
        eyebrow={isAdmin ? "Admin kullanıcı" : "Kullanıcı"}
        title={username(target) || email || "Adsız kullanıcı"}
        description={email || "E-posta adresi yok"}
        action={
          isAdmin && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#fff1e7] px-3 py-2 text-sm font-black text-[#d95700]">
              <ShieldCheck size={16} /> Admin
            </span>
          )
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-5">
          <section className="rounded-2xl border border-black/8 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.035)]">
            <h2 className="text-lg font-black">Hesap</h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <Field label="Kullanıcı kimliği">
                <span className="break-all font-mono text-xs text-black/60">
                  {target.id}
                </span>
              </Field>
              <Field label="E-posta">{email || "—"}</Field>
              <Field label="Kayıt tarihi">{formatDate(target.created_at)}</Field>
              <Field label="Son giriş">
                {target.last_sign_in_at
                  ? formatDate(target.last_sign_in_at)
                  : "Henüz giriş yapmadı"}
              </Field>
              <Field label="Telefon">
                {target.phone ? "+" + target.phone : "—"}
              </Field>
            </dl>
            <div className="mt-5 flex flex-wrap gap-1.5">
              <Badge tone={verified ? "green" : "amber"}>
                {verified ? "E-posta doğrulanmış" : "E-posta doğrulanmamış"}
              </Badge>
              <Badge tone={banned ? "red" : "green"}>
                {banned ? "Engelli" : "Aktif"}
              </Badge>
              {isAdmin && <Badge tone="custom">Admin</Badge>}
            </div>
          </section>

          <section className="rounded-2xl border border-black/8 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.035)]">
            <h2 className="text-lg font-black">Denetim kaydı</h2>
            {audits.length ? (
              <div className="mt-4 w-full max-w-full min-w-0 overflow-x-auto [-webkit-overflow-scrolling:touch]">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="bg-[#fafaf8] text-xs uppercase tracking-wide text-black/45">
                    <tr>
                      <th className="px-3 py-2.5">İşlem</th>
                      <th className="px-3 py-2.5">Tarih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audits.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-t border-black/7 align-top"
                      >
                        <td className="px-3 py-3">
                          <span className="font-black">
                            {auditLabel(entry.action)}
                          </span>
                          <p className="mt-0.5 font-mono text-[11px] text-black/35">
                            {entry.action}
                          </p>
                          {entry.metadata && Object.keys(entry.metadata).length ? (
                            <p className="mt-1 text-xs text-black/50">
                              {describeMetadata(entry.metadata)}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-black/55">
                          {formatDate(entry.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 rounded-xl bg-[#fafaf8] p-4 text-sm text-black/45">
                Bu kullanıcı için henüz yönetim işlemi kaydedilmedi.
              </p>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-black/8 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.035)]">
            <h2 className="text-lg font-black">İşlemler</h2>
            <div className="mt-4 grid gap-2">
              {!verified && (
                <ActionButton
                  label="E-postayı doğrula"
                  pendingLabel="Doğrulanıyor..."
                  run={() => verifyUser(id)}
                />
              )}
              <ActionButton
                label="Şifre sıfırlama bağlantısı gönder"
                pendingLabel="Gönderiliyor..."
                run={() => resetUserPassword(id)}
                tone="ghost"
              />
              {isAdmin ? (
                <ConfirmDialog
                  title="Admin yetkisini kaldır"
                  description="Bu kullanıcının admin yetkisi kaldırılacak. Evren (ortam) izniyle admin olan kullanıcılar buradan çıkarılamaz."
                  confirmLabel="Yetkiyi kaldır"
                  pendingLabel="Kaldırılıyor..."
                  danger
                  run={() => removeAdmin(id)}
                />
              ) : (
                <ActionButton
                  label="Admin yap"
                  pendingLabel="Ekleniyor..."
                  run={() => makeAdmin(id)}
                />
              )}
              {banned ? (
                <ConfirmDialog
                  title="Engeli kaldır"
                  description="Bu kullanıcı yeniden giriş yapıp siteyi kullanabilecek."
                  confirmLabel="Engeli kaldır"
                  pendingLabel="Kaldırılıyor..."
                  danger
                  run={() => unbanUser(id)}
                />
              ) : (
                <ConfirmDialog
                  title="Kullanıcıyı engelle"
                  description="Bu kullanıcı giriş yapamayacak. İşlem geri alınabilir."
                  confirmLabel="Engelle"
                  pendingLabel="Engelleniyor..."
                  danger
                  run={() => banUser(id)}
                />
              )}
              <div className="pt-2">
                <ConfirmDialog
                  title="Kullanıcıyı sil"
                  description="Bu hesap kalıcı olarak silinecek. Bu işlem geri alınamaz."
                  confirmLabel="Kalıcı olarak sil"
                  pendingLabel="Siliniyor..."
                  danger
                  run={() => deleteUser(id)}
                />
              </div>
            </div>
          </section>

          <p className="rounded-2xl border border-dashed border-black/15 bg-white p-4 text-xs leading-5 text-black/45">
            Şifreler, doğrulama bağlantıları ve oturum değerleri bu panelden
            asla okunamaz veya gösterilemez; bunlar yalnızca ilgili kullanıcıya
            e-posta yoluyla iletilir.
          </p>
        </aside>
      </div>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-black uppercase tracking-wide text-black/40">
        {label}
      </dt>
      <dd className="mt-1 font-bold text-black/80">{children}</dd>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "green" | "amber" | "red" | "custom";
}) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    custom: "bg-[#fff1e7] text-[#d95700]",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${tones[tone]}`}>
      {children}
    </span>
  );
}

function username(user: { user_metadata?: Record<string, unknown> | null }) {
  const value = user.user_metadata?.username;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatDate(value: string | null | undefined) {
  return formatDateTR(value, { dateStyle: "medium", timeStyle: "short" });
}

function auditLabel(action: string): string {
  const map: Record<string, string> = {
    USER_VERIFIED: "E-posta doğrulandı",
    RESET_EMAIL_SENT: "Şifre sıfırlama e-postası gönderildi",
    USER_BANNED: "Kullanıcı engellendi",
    USER_UNBANNED: "Engel kaldırıldı",
    ADMIN_ROLE_GRANTED: "Admin yetkisi verildi",
    ADMIN_ROLE_REVOKED: "Admin yetkisi kaldırıldı",
    USER_DELETED: "Kullanıcı silindi",
  };
  return map[action] ?? "Yönetim işlemi";
}

function describeMetadata(metadata: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(metadata)) {
    if (key === "source" && value === "admin") parts.push("Panel üzerinden");
  }
  return parts.join(" · ");
}
