import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
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
 * Only a session that was minted by the password-recovery email link may set a
 * new password here. A normal (already logged in) user reaching this page is
 * bounced back to login — this is not the password-change screen for an
 * authenticated account, which Aşama 2 does via /hesabim.
 */
export default async function NewPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };

  if (!isRecoverySession(data.user)) {
    redirect("/giris?error=verification_failed");
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
              Sıfırlama bağlantısına ulaştın. En az 6 karakterlik yeni bir şifre
              seç.
            </p>
          </div>
          <NewPasswordForm />
        </div>
      </div>
    </section>
  );
}
