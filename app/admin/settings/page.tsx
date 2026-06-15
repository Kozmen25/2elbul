import { AdminPageHeader } from "@/components/admin-ui";
import { ADMIN_EMAILS } from "@/lib/admin";

export default function AdminSettingsPage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Yapılandırma"
        title="Ayarlar"
        description="Site kimliği ve operasyon ayarları için hazırlanan yönetim arayüzü."
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-black/7 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-black">Site bilgileri</h2>
          <div className="mt-5 grid gap-4">
            <label className="text-sm font-bold">
              Site adı
              <input className="field mt-2 px-3 py-3" defaultValue="2ElBul" />
            </label>
            <label className="text-sm font-bold">
              Site açıklaması
              <textarea
                className="field mt-2 min-h-28 resize-y px-3 py-3"
                defaultValue="İkinci elin fiyat rehberi."
              />
            </label>
            <button
              type="button"
              disabled
              className="orange-button py-3 opacity-50"
            >
              Yakında kaydedilebilir
            </button>
          </div>
        </section>

        <div className="grid gap-5">
          <section className="rounded-2xl border border-black/7 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-black">Bakım modu</h2>
            <p className="mt-2 text-sm leading-6 text-black/50">
              Planlı bakım sırasında ziyaretçilere bilgilendirme ekranı
              göstermek için hazırlanmıştır. Şimdilik yalnızca UI taslağıdır.
            </p>
            <label className="mt-5 flex items-center justify-between rounded-xl bg-[#fafaf8] p-4">
              <span className="font-bold">Bakım modunu etkinleştir</span>
              <input type="checkbox" disabled className="size-5 accent-[#ff6b00]" />
            </label>
          </section>
          <section className="rounded-2xl border border-black/7 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-black">Admin e-posta listesi</h2>
            <p className="mt-2 text-sm leading-6 text-black/50">
              Bu liste server tarafındaki `lib/admin.ts` dosyasından yönetilir.
              Değişiklik sonrası yeniden deploy gerekir.
            </p>
            <div className="mt-4 grid gap-2">
              {ADMIN_EMAILS.map((email) => (
                <div
                  key={email}
                  className="rounded-xl border border-black/8 px-4 py-3 text-sm font-bold"
                >
                  {email}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
