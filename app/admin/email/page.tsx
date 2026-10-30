import { CheckCircle2, CircleAlert, KeyRound, Mail, MailCheck, Send } from "lucide-react";
import { AdminPageHeader, AdminStatCard } from "@/components/admin-ui";
import { requireAdminUser } from "@/lib/admin";
import { formatDateTR } from "@/lib/formatters";
import { parseHookSecret } from "@/lib/email/auth-hook";
import { loadEmailSettingsView } from "@/lib/email/settings";
import { getSiteUrl } from "@/lib/site-url";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { EmailSettingsForm } from "./email-settings-form";

export const dynamic = "force-dynamic";

const LOG_LIMIT = 50;

const TEMPLATE_LABELS: Record<string, string> = {
  signup: "Kayıt onayı",
  recovery: "Şifre sıfırlama",
  magiclink: "Giriş bağlantısı",
  invite: "Davet",
  reauthentication: "Doğrulama kodu",
  price_alert: "Fiyat alarmı",
  price_drop: "Fiyat düşüşü",
  test: "Test",
};

const SOURCE_LABELS: Record<string, string> = {
  auth_hook: "Supabase",
  app: "Uygulama",
  admin_test: "Admin testi",
};

export default async function AdminEmailPage() {
  const user = await requireAdminUser("/admin/email");
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return (
      <>
        <AdminPageHeader eyebrow="Sistem" title="E-posta" description="E-posta servisi ve SMTP ayarları." />
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          Service role bağlantısı yapılandırılmadığı için e-posta ayarları yüklenemedi.
        </p>
      </>
    );
  }

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [settings, logsResult, sentResult, failedResult] = await Promise.all([
    loadEmailSettingsView(supabase),
    supabase
      .from("email_logs")
      .select("id, created_at, to_email, template, status, error, source")
      .order("created_at", { ascending: false })
      .limit(LOG_LIMIT),
    supabase
      .from("email_logs")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("created_at", dayAgo),
    supabase
      .from("email_logs")
      .select("id", { count: "exact", head: true })
      .neq("status", "sent")
      .gte("created_at", dayAgo),
  ]);

  const logs = logsResult.data ?? [];
  const hookSecretConfigured = parseHookSecret(process.env.SEND_EMAIL_HOOK_SECRET) !== null;
  const hookUrl = `${getSiteUrl()}/api/auth/email-hook`;
  const configured = Boolean(settings.host && settings.port && settings.fromEmail);

  const serviceLabel = settings.enabled ? (configured ? "Açık" : "Eksik ayar") : "Kapalı";
  const testLabel =
    settings.lastTestOk === null ? "Denenmedi" : settings.lastTestOk ? "Başarılı" : "Başarısız";

  return (
    <>
      <AdminPageHeader
        eyebrow="Sistem"
        title="E-posta"
        description="SMTP bilgilerini girin; kayıt onayı, şifre sıfırlama ve fiyat alarmı e-postaları bu ayarlarla gönderilir."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="E-posta servisi" value={serviceLabel} icon={Mail} note={configured ? settings.host : "SMTP bilgisi girilmedi"} />
        <AdminStatCard
          label="Son deneme"
          value={testLabel}
          icon={settings.lastTestOk === false ? CircleAlert : MailCheck}
          note={settings.lastTestAt ? formatDateTR(settings.lastTestAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Henüz deneme yok"}
        />
        <AdminStatCard label="Son 24 saatte gönderilen" value={sentResult.count ?? 0} icon={Send} note="Başarılı gönderim" />
        <AdminStatCard label="Son 24 saatte başarısız" value={failedResult.count ?? 0} icon={CircleAlert} note="Hata ve atlanan" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <EmailSettingsForm settings={settings} adminEmail={user.email ?? ""} />

        <section className="rounded-2xl border border-black/7 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-black">Kurulum adımları</h2>
          <p className="mt-2 text-sm leading-6 text-black/50">
            Hesap e-postalarının (kayıt onayı, şifre sıfırlama) bu SMTP ayarıyla gitmesi için bir kerelik kurulum gerekir.
          </p>

          <ol className="mt-4 space-y-4 text-sm">
            <Step
              done={settings.encryptionKeyConfigured}
              title="1. Şifreleme anahtarı"
              body={
                <>
                  SMTP şifresi veritabanında şifreli saklanır. <code>npm run email:keys</code> komutunun çıktısındaki{" "}
                  <code>EMAIL_SETTINGS_ENCRYPTION_KEY</code> satırını Vercel ortam değişkenlerine ekleyin.
                </>
              }
            />
            <Step
              done={settings.enabled && configured && settings.lastTestOk === true}
              title="2. SMTP bilgilerini girin ve test edin"
              body={'Soldaki formu doldurun, kaydedin, sonra "Test e-postası gönder" ile denemeyi yapın.'}
            />
            <Step
              done={hookSecretConfigured}
              title="3. Hook gizli anahtarı"
              body={
                <>
                  Çıktıdaki <code>SEND_EMAIL_HOOK_SECRET</code> satırını da Vercel&apos;e ekleyip siteyi yeniden
                  yayınlayın. Bu adımdan önce 4. adımı yapmayın.
                </>
              }
            />
            <Step
              done={false}
              title="4. Supabase'e bağlayın"
              body={
                <>
                  Şu adres Supabase&apos;in &quot;Send Email&quot; hook adresi olmalı:
                  <span className="mt-2 block break-all rounded-lg bg-[#fafaf8] p-2 font-mono text-xs">{hookUrl}</span>
                  <span className="mt-2 block">
                    Komut: <code>npm run email:hook -- enable --url {hookUrl}</code>
                  </span>
                  <span className="mt-2 block text-black/45">
                    Geri almak için: <code>npm run email:hook -- disable</code> (Supabase yerleşik gönderime döner).
                  </span>
                </>
              }
            />
          </ol>
        </section>
      </div>

      <section className="mt-5 rounded-2xl border border-black/7 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-black">Gönderim kayıtları</h2>
        <p className="mt-1 text-sm text-black/50">Son {LOG_LIMIT} kayıt. E-posta içeriği ve bağlantılar kaydedilmez; 90 gün sonra silinir.</p>
        {logs.length === 0 ? (
          <p className="mt-4 rounded-xl bg-[#fafaf8] p-4 text-sm text-black/50">Henüz e-posta gönderilmedi.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-black/45">
                <tr>
                  <th className="px-3 py-2">Zaman</th>
                  <th className="px-3 py-2">Alıcı</th>
                  <th className="px-3 py-2">Tür</th>
                  <th className="px-3 py-2">Kaynak</th>
                  <th className="px-3 py-2">Durum</th>
                  <th className="px-3 py-2">Ayrıntı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-black/55">
                      {formatDateTR(log.created_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>
                    <td className="px-3 py-2 font-bold">{log.to_email}</td>
                    <td className="px-3 py-2">{TEMPLATE_LABELS[log.template] ?? log.template}</td>
                    <td className="px-3 py-2 text-black/55">{SOURCE_LABELS[log.source] ?? log.source}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="max-w-sm break-words px-3 py-2 text-xs text-black/50">{log.error ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Step({ done, title, body }: { done: boolean; title: string; body: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className={`mt-0.5 shrink-0 ${done ? "text-green-600" : "text-black/25"}`}>
        {done ? <CheckCircle2 size={18} /> : <KeyRound size={18} />}
      </span>
      <div className="min-w-0">
        <p className="font-black">{title}</p>
        <div className="mt-1 leading-6 text-black/55">{body}</div>
      </div>
    </li>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    sent: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    skipped: "bg-amber-100 text-amber-700",
  };
  const labels: Record<string, string> = { sent: "Gönderildi", failed: "Başarısız", skipped: "Atlandı" };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${styles[status] ?? "bg-black/7 text-black/55"}`}>
      {labels[status] ?? status}
    </span>
  );
}
