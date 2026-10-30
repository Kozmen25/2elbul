import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { login } from "@/app/auth/actions";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { safeNextPath } from "@/lib/auth/confirm";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "Giriş yap | 2ElBul",
  robots: {
    index: false,
    follow: false,
  },
};

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    error?: string;
    reset?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  if (data.user) redirect(safeNextPath(params.next));

  return (
    <AuthShell
      title="Giriş yap"
      description="Takip ettiğin fiyatlara ve ilanlarına kaldığın yerden devam et."
    >
      {params.reset === "success" && (
        <div
          role="status"
          className="mb-5 flex gap-3 rounded-xl border border-green-200 bg-green-50 p-3.5 text-sm text-green-800"
        >
          <CircleCheck size={18} className="mt-0.5 shrink-0" />
          <p className="font-semibold">Şifren güncellendi. Yeni şifrenle giriş yap.</p>
        </div>
      )}
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
    </AuthShell>
  );
}
