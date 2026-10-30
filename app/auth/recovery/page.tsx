"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { startRecoverySession } from "@/app/auth/actions";
import { parseRecoveryHash } from "@/lib/auth/recovery-hash";

const FAILURE_PATH = "/sifre-sifirla?error=link_expired";

/**
 * Landing page for implicit-flow password-reset links (the ones an admin
 * triggers). The session arrives in the URL fragment, which only the browser
 * can see, so it is read here and handed to the server, which stores it in the
 * auth cookies and continues to the new-password page.
 */
export default function RecoveryLandingPage() {
  const router = useRouter();

  useEffect(() => {
    const parsed = parseRecoveryHash(window.location.hash);
    // Drop the tokens from the address bar / history right away.
    window.history.replaceState(null, "", window.location.pathname);

    if (!parsed.ok) {
      router.replace(FAILURE_PATH);
      return;
    }

    void startRecoverySession(parsed.accessToken, parsed.refreshToken).then((ok) => {
      router.replace(ok ? "/yeni-sifre" : FAILURE_PATH);
    });
  }, [router]);

  return (
    <section className="grid min-h-[60vh] place-items-center bg-[#fafaf8] px-4">
      <p className="text-sm font-semibold text-black/50">Şifre sıfırlama bağlantın doğrulanıyor...</p>
    </section>
  );
}
