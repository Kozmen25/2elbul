import { headers } from "next/headers";
import { isAdminEmail } from "@/lib/admin";
import { getSiteMaintenanceSettings } from "@/lib/site-settings";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function MaintenanceGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const maintenance = await getSiteMaintenanceSettings();
  if (!maintenance.enabled) return children;

  const headerStore = await headers();
  const pathname = headerStore.get("x-pathname") ?? "";
  if (pathname.startsWith("/admin")) return children;

  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  if (isAdminEmail(data.user?.email)) return children;

  return (
    <section className="grid min-h-[60vh] place-items-center bg-[#fafaf8] px-4 py-16">
      <div className="max-w-lg rounded-3xl border border-black/8 bg-white p-8 text-center shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
        <p className="text-sm font-black uppercase tracking-[0.15em] text-[#ff6b00]">
          Bakım modu
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.04em]">
          Kısa süreliğine kapalıyız
        </h1>
        <p className="mt-4 text-sm leading-7 text-black/55">
          {maintenance.message}
        </p>
      </div>
    </section>
  );
}
