import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { PASSWORD_HINT } from "@/lib/auth/password-policy";
import { isRecoverySession } from "@/lib/auth/recovery";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NewPasswordForm } from "./new-password-form";

export const metadata: Metadata = {
  title: "Yeni şifre belirle | 2ElBul",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Only a session created by a password-reset e-mail link within the last few
 * minutes may set a new password here (lib/auth/recovery.ts). A logged-in user
 * changes their password from /hesabim instead, where the current password is
 * required.
 */
export default async function NewPasswordPage() {
  const supabase = await createSupabaseServerClient();

  if (!supabase || !(await isRecoverySession(supabase))) {
    redirect("/sifre-sifirla?error=link_expired");
  }

  return (
    <section className="min-h-[calc(100vh-145px)] bg-[#fafaf8] py-12 sm:py-16">
      <div className="container-shell">
        <div className="mx-auto max-w-md">
          <div className="flex justify-center">
            <BrandLogo size="lg" />
          </div>
          <div className="mt-7 text-center">
            <h1 className="text-3xl font-black tracking-[-0.04em]">
              Yeni şifreni belirle
            </h1>
            <p className="mt-2 text-sm text-black/50">
              Sıfırlama bağlantısına ulaştın. Yeni bir şifre seç ({PASSWORD_HINT.toLowerCase()}).
            </p>
          </div>
          <NewPasswordForm />
        </div>
      </div>
    </section>
  );
}
