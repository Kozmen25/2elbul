import { DatabaseZap } from "lucide-react";
import { redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AdminImportForm } from "./import-form";

export const dynamic = "force-dynamic";

export default async function AdminImportPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase?.auth.getUser()) ?? {
    data: { user: null },
  };

  if (!data.user) {
    redirect("/giris?next=/admin/import");
  }

  if (!isAdminEmail(data.user.email)) {
    redirect("/");
  }

  return (
    <section className="min-h-[calc(100vh-145px)] bg-[#fafaf8] py-10 sm:py-14">
      <div className="container-shell">
        <div className="mb-8 max-w-3xl">
          <span className="grid size-12 place-items-center rounded-2xl bg-[#fff1e7] text-[#ff6b00]">
            <DatabaseZap size={24} />
          </span>
          <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
            Toplu ilan içe aktar
          </h1>
          <p className="mt-3 leading-7 text-black/50">
            Farklı kaynaklardan gelen ilanları ortak JSON formatıyla ürün ve
            ilan tablolarına aktarın.
          </p>
        </div>

        <AdminImportForm />
      </div>
    </section>
  );
}
