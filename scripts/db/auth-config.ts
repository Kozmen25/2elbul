// Pure helpers for scripts/db/apply-auth-config.ts (no I/O).

import { MIN_PASSWORD_LENGTH } from "../../lib/auth/password-policy";

export type EmailTemplate = {
  /** File name in supabase/email-templates. */
  file: string;
  subject: string;
  /** Supabase Auth config keys, e.g. `recovery` → mailer_templates_recovery_content. */
  key: "confirmation" | "recovery" | "magic_link" | "invite" | "email_change";
};

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  { file: "confirmation.html", key: "confirmation", subject: "2ElBul - E-posta adresini doğrula" },
  { file: "recovery.html", key: "recovery", subject: "2ElBul - Şifreni sıfırla" },
  { file: "magic-link.html", key: "magic_link", subject: "2ElBul - Giriş bağlantın" },
  { file: "invite.html", key: "invite", subject: "2ElBul - Davet edildin" },
  { file: "email-change.html", key: "email_change", subject: "2ElBul - E-posta değişikliğini onayla" },
];

/** Every template must link to our token_hash route, never Supabase's ConfirmationURL. */
export function assertTemplateUsesTokenHash(template: EmailTemplate, html: string): void {
  if (!html.includes("{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}")) {
    throw new Error(`${template.file} must link to {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}`);
  }
  if (html.includes("{{ .ConfirmationURL }}")) {
    throw new Error(`${template.file} must not use {{ .ConfirmationURL }} (PKCE flow)`);
  }
}

export function buildAuthConfigPatch(
  templates: Array<{ template: EmailTemplate; html: string }>,
  options: { siteUrl?: string; extraOrigins?: string[] } = {},
): Record<string, string | number> {
  const patch: Record<string, string | number> = { password_min_length: MIN_PASSWORD_LENGTH };
  for (const { template, html } of templates) {
    assertTemplateUsesTokenHash(template, html);
    patch[`mailer_subjects_${template.key}`] = template.subject;
    patch[`mailer_templates_${template.key}_content`] = html;
  }
  if (options.siteUrl) {
    const origin = new URL(options.siteUrl).origin;
    const allowed = [origin, ...(options.extraOrigins ?? []).map((value) => new URL(value).origin)];
    patch.site_url = origin;
    patch.uri_allow_list = [...new Set(allowed)].map((value) => `${value}/**`).join(",");
  }
  return patch;
}
