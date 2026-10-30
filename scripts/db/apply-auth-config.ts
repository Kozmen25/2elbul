// Applies the repo's Supabase Auth setup to a project:
//   * password_min_length matching lib/auth/password-policy.ts   (always)
//   * site_url + redirect allow-list           (with --site-url <url>, plus any
//     number of extra allowed origins via --allow <origin>)
//   * e-mail templates that link to /auth/confirm?token_hash=… (with --templates)
//     These links also work when opened on another device, unlike Supabase's
//     default PKCE links. Supabase only accepts custom templates on projects
//     with a custom SMTP provider (or a paid plan); on the free default
//     provider the API answers 400 and nothing is changed.
//
// Usage:
//   npm run db:auth-config
//   npm run db:auth-config -- --site-url https://www.2elbul.com
//   npm run db:auth-config -- --site-url http://localhost:3000 --allow http://localhost:3999
//   npm run db:auth-config -- --templates
//
// Uses SUPABASE_ACCESS_TOKEN and the project ref from NEXT_PUBLIC_SUPABASE_URL
// (or SUPABASE_PROJECT_REF), so the same command configures any project.

import { readFileSync } from "node:fs";
import path from "node:path";
import { readManagementApiConfig, updateAuthConfig } from "./management-api";
import { EMAIL_TEMPLATES, buildAuthConfigPatch } from "./auth-config";

const TEMPLATES_DIR = path.join(process.cwd(), "supabase", "email-templates");

async function main() {
  const args = process.argv.slice(2);
  const siteUrlIndex = args.indexOf("--site-url");
  const siteUrl = siteUrlIndex >= 0 ? args[siteUrlIndex + 1] : undefined;
  const extraOrigins = args.flatMap((arg, index) => (arg === "--allow" ? [args[index + 1]] : []));

  const templates = args.includes("--templates")
    ? EMAIL_TEMPLATES.map((template) => ({
        template,
        html: readFileSync(path.join(TEMPLATES_DIR, template.file), "utf8"),
      }))
    : [];
  const patch = buildAuthConfigPatch(templates, { siteUrl, extraOrigins });

  const config = readManagementApiConfig();
  await updateAuthConfig(config, patch);
  console.log(`Project ${config.projectRef}: updated ${Object.keys(patch).join(", ")}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
