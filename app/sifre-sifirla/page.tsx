import type { Metadata } from "next";
import { TriangleAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ResetRequestForm } from "./reset-request-form";

export const metadata: Metadata = {
  title: "Şifremi unuttum | 2ElBul",
  robots: {
    index: false,
    follow: false,
  },
};

type ForgotPasswordPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  if (data.user) redirect("/");

  return (
    <section className="min-h-[calc(100vh-145px)] bg-[#fafaf8] py-12 sm:py-16">
      <div className="container-shell">
        <div className="mx-auto max-w-md">
          <div className="flex justify-center">
            <BrandLogo size="lg" />
          </div>
          <div className="mt-7 text-center">
            <h1 className="text-3xl font-black tracking-[-0.04em]">
              Şifremi unuttum
            </h1>
            <p className="mt-2 text-sm text-black/50">
              E-posta adresini gir, şifreni sıfırlama bağlantısını gönderelim.
            </p>
          </div>
          {params.error === "link_expired" && (
            <div className="mt-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <TriangleAlert size={18} className="mt-0.5 shrink-0" />
              <p className="font-semibold">
                Şifre sıfırlama bağlantısı geçersiz ya da süresi dolmuş. Aşağıdan yeni
                bir bağlantı isteyebilirsin.
              </p>
            </div>
          )}
          <ResetRequestForm />
        </div>
      </div>
    </section>
  );
}
