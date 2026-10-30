import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase-config";

/**
 * A throwaway Supabase client for sending password-reset e-mails on behalf of
 * someone else (the admin "reset password" action).
 *
 * It uses the implicit flow on purpose. The PKCE flow ties the e-mail link to a
 * verifier stored by the client that *requested* the e-mail — here that would
 * be the admin's server request, so the user opening the link could never
 * complete it. Implicit links carry the session in the URL fragment instead
 * and are handled by /auth/recovery.
 */
export function createRecoveryEmailClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config) return null;

  return createClient(config.url, config.anonKey, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
