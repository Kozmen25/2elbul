import { AdminPageHeader } from "@/components/admin-ui";
import { ADMIN_EMAILS } from "@/lib/admin";
import { getCategoryTree } from "@/lib/categories";
import {
  getHeaderCategorySettings,
  getSiteGeneralSettings,
  getSiteMaintenanceSettings,
} from "@/lib/site-settings";
import { isMissingSiteSettingsTable } from "@/lib/listing-status";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { HeaderCategoriesForm } from "./header-categories-form";
import { SettingsForm } from "./settings-form";

export default async function AdminSettingsPage() {
  const supabase = createSupabaseAdminClient();
  let settingsAvailable = Boolean(supabase);

  if (supabase) {
    const probe = await supabase.from("site_settings").select("key").limit(1);
    if (probe.error && isMissingSiteSettingsTable(probe.error)) {
      settingsAvailable = false;
    }
  }

  const [general, maintenance, headerSettings, categoryTree] = await Promise.all([
    getSiteGeneralSettings(),
    getSiteMaintenanceSettings(),
    getHeaderCategorySettings(),
    getCategoryTree(),
  ]);
  const headerOptions = categoryTree
    .filter((main) => !main.isFallback)
    .map((main) => ({
      slug: main.slug,
      name: main.name,
      children: main.children.map((child) => ({ slug: child.slug, name: child.name })),
    }));

  return (
    <>
      <AdminPageHeader
        eyebrow="Yapılandırma"
        title="Ayarlar"
        description="Site kimliği, bakım modu ve operasyon ayarlarını yönetin."
      />
      <SettingsForm
        general={general}
        maintenance={maintenance}
        settingsAvailable={settingsAvailable}
      />
      <HeaderCategoriesForm
        options={headerOptions}
        selectedSlugs={headerSettings.slugs}
        settingsAvailable={settingsAvailable}
      />
      <section className="mt-5 rounded-2xl border border-black/7 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-black">Admin e-posta listesi</h2>
        <p className="mt-2 text-sm leading-6 text-black/50">
          `ADMIN_EMAILS` ortam değişkeni virgülle ayrılmış adresler alır. Tanımlı
          değilse varsayılan liste kullanılır. Değişiklik sonrası yeniden deploy
          gerekir.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
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
    </>
  );
}
