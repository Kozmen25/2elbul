import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EMAIL_TEMPLATES, assertTemplateUsesTokenHash, buildAuthConfigPatch } from "./auth-config";

const load = (file: string) => readFileSync(path.join(process.cwd(), "supabase", "email-templates", file), "utf8");
const templates = EMAIL_TEMPLATES.map((template) => ({ template, html: load(template.file) }));

describe("email templates in the repo", () => {
  it("all link to the token_hash confirm route with the right type", () => {
    const expectedType: Record<string, string> = {
      confirmation: "signup",
      recovery: "recovery",
      magic_link: "magiclink",
      invite: "invite",
      email_change: "email_change",
    };
    for (const { template, html } of templates) {
      expect(() => assertTemplateUsesTokenHash(template, html)).not.toThrow();
      expect(html).toContain(`type=${expectedType[template.key]}`);
    }
  });
});

describe("assertTemplateUsesTokenHash", () => {
  const template = EMAIL_TEMPLATES[1];
  it("rejects the default PKCE confirmation URL", () => {
    expect(() => assertTemplateUsesTokenHash(template, '<a href="{{ .ConfirmationURL }}">x</a>')).toThrow();
  });
});

describe("buildAuthConfigPatch", () => {
  it("maps templates and subjects to Supabase config keys", () => {
    const patch = buildAuthConfigPatch(templates);
    expect(patch.mailer_templates_recovery_content).toBe(load("recovery.html"));
    expect(patch.mailer_subjects_recovery).toBe("2ElBul - Şifreni sıfırla");
    expect(patch.mailer_templates_magic_link_content).toBe(load("magic-link.html"));
    expect(patch.password_min_length).toBe(8);
    expect(patch.site_url).toBeUndefined();
  });

  it("adds site url and allow-list only when requested, using the origin", () => {
    const patch = buildAuthConfigPatch(templates, { siteUrl: "https://www.2elbul.com/some/path" });
    expect(patch.site_url).toBe("https://www.2elbul.com");
    expect(patch.uri_allow_list).toBe("https://www.2elbul.com/**");
  });

  it("allows extra origins in the redirect allow-list, without duplicates", () => {
    const patch = buildAuthConfigPatch(templates, {
      siteUrl: "http://localhost:3000",
      extraOrigins: ["http://localhost:3999/x", "http://localhost:3000"],
    });
    expect(patch.site_url).toBe("http://localhost:3000");
    expect(patch.uri_allow_list).toBe("http://localhost:3000/**,http://localhost:3999/**");
  });
});
