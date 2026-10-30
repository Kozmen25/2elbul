import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signUp } from "@/app/auth/actions";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "Kayıt ol | 2ElBul",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SignupPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  if (data.user) redirect("/");

  return (
    <AuthShell
      title="Hesap oluştur"
      description="Ücretsiz hesabınla fiyat alarmı kur, ürünleri takip et."
    >
      <AuthForm mode="signup" action={signUp} />
    </AuthShell>
  );
}
