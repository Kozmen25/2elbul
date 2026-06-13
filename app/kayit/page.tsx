import { redirect } from "next/navigation";
import { signUp } from "@/app/auth/actions";
import { AuthForm } from "@/components/auth-form";
import { BrandLogo } from "@/components/brand-logo";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function SignupPage() {
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
            <h1 className="text-3xl font-black tracking-[-0.04em]">Kayıt ol</h1>
            <p className="mt-2 text-sm text-black/50">
              Ücretsiz hesabını oluştur ve ilan eklemeye başla.
            </p>
          </div>
          <AuthForm mode="signup" action={signUp} />
        </div>
      </div>
    </section>
  );
}
