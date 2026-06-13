import { redirect } from "next/navigation";
import { login } from "@/app/auth/actions";
import { AuthForm } from "@/components/auth-form";
import { BrandLogo } from "@/components/brand-logo";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
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
            <h1 className="text-3xl font-black tracking-[-0.04em]">Giriş yap</h1>
            <p className="mt-2 text-sm text-black/50">
              İlanlarını yönetmek için hesabına giriş yap.
            </p>
          </div>
          <AuthForm
            mode="login"
            action={login}
            next={params.next ?? "/"}
            initialError={
              params.error === "verification_failed"
                ? "E-posta doğrulaması tamamlanamadı."
                : ""
            }
          />
        </div>
      </div>
    </section>
  );
}
