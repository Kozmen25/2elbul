import { NextResponse, type NextRequest } from "next/server";
import { buildAuthEmail, parseHookSecret, verifyHookSignature, type HookPayload } from "@/lib/email/auth-hook";
import { sendEmail } from "@/lib/email/service";
import { renderEmail, type EmailKind, type EmailTemplateData } from "@/lib/email/templates";
import { getSiteUrl } from "@/lib/site-url";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Supabase Auth "Send Email" hook (see lib/email/auth-hook.ts). Supabase calls
 * this for every sign-up confirmation, password reset, magic link and invite
 * instead of mailing it itself; the message goes out through the SMTP settings
 * saved in the admin panel.
 *
 * Supabase reports any non-2xx answer to the user ("could not send e-mail"),
 * so an unconfigured or failing SMTP is visible instead of silently losing the
 * message. Details go to email_logs, never into the response.
 */
export async function POST(request: NextRequest) {
  const secret = parseHookSecret(process.env.SEND_EMAIL_HOOK_SECRET);
  if (!secret) {
    return hookError(503, "SEND_EMAIL_HOOK_SECRET tanımlı değil.");
  }

  const body = await request.text();
  const authentic = verifyHookSignature(secret, {
    id: request.headers.get("webhook-id"),
    timestamp: request.headers.get("webhook-timestamp"),
    signature: request.headers.get("webhook-signature"),
    body,
  });
  if (!authentic) return hookError(401, "İmza doğrulanamadı.");

  let payload: HookPayload;
  try {
    payload = JSON.parse(body) as HookPayload;
  } catch {
    return hookError(400, "Geçersiz JSON.");
  }

  const email = buildAuthEmail(payload, getSiteUrl());
  if (!email.ok) return hookError(400, email.reason);

  const admin = createSupabaseAdminClient();
  if (!admin) return hookError(500, "Veritabanı bağlantısı yapılandırılmamış.");

  let message;
  try {
    message = renderEmail(email.kind, email.data as EmailTemplateData[EmailKind] as never);
  } catch (error) {
    console.error("Auth e-mail render failed:", error instanceof Error ? error.message : error);
    return hookError(500, "E-posta hazırlanamadı.");
  }

  const result = await sendEmail(admin, {
    to: email.to,
    template: email.kind,
    message,
    source: "auth_hook",
    userId: email.userId,
  });

  if (!result.ok) {
    console.error(`Auth e-mail (${email.kind}) not sent: ${result.status}`);
    return hookError(500, "E-posta gönderilemedi.");
  }

  return NextResponse.json({});
}

function hookError(status: number, message: string) {
  return NextResponse.json({ error: { http_code: status, message } }, { status });
}
