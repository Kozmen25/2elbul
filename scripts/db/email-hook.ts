// Manages the Supabase "Send Email" auth hook of a project.
//
//   npm run email:keys
//       prints a fresh EMAIL_SETTINGS_ENCRYPTION_KEY and SEND_EMAIL_HOOK_SECRET
//       (nothing is changed anywhere). Put both into .env.local and Vercel.
//
//   npm run email:hook -- status
//   npm run email:hook -- enable --url https://www.2elbul.com/api/auth/email-hook
//       points the project's auth e-mails at the app. Needs SEND_EMAIL_HOOK_SECRET
//       (same value as in Vercel) and the site already deployed with it — until
//       then every sign-up / password reset would fail.
//   npm run email:hook -- disable
//       back to Supabase's built-in sender.
//
// Uses SUPABASE_ACCESS_TOKEN and the project ref from NEXT_PUBLIC_SUPABASE_URL
// (or SUPABASE_PROJECT_REF), so the same command configures any project.

import { generateEncryptionKey } from "../../lib/email/crypto";
import { getAuthConfig, readManagementApiConfig, updateAuthConfig } from "./management-api";
import { DISABLE_PATCH, buildEnablePatch, generateHookSecret, validateHookUrl } from "./email-hook-config";

async function main() {
  const [command = "status", ...args] = process.argv.slice(2);

  if (command === "generate") {
    console.log("Aşağıdaki iki satırı .env.local ve Vercel ortam değişkenlerine ekleyin:\n");
    console.log(`EMAIL_SETTINGS_ENCRYPTION_KEY=${generateEncryptionKey()}`);
    console.log(`SEND_EMAIL_HOOK_SECRET=${generateHookSecret()}`);
    console.log("\nAnahtarları değiştirirseniz admin panelinden SMTP şifresini yeniden kaydetmeniz gerekir.");
    return;
  }

  const config = readManagementApiConfig();

  if (command === "status") {
    const auth = await getAuthConfig(config);
    console.log(`Project ${config.projectRef}`);
    console.log(`  hook_send_email_enabled: ${String(auth.hook_send_email_enabled)}`);
    console.log(`  hook_send_email_uri:     ${String(auth.hook_send_email_uri ?? "-")}`);
    return;
  }

  if (command === "enable") {
    const urlIndex = args.indexOf("--url");
    const checked = validateHookUrl(urlIndex >= 0 ? args[urlIndex + 1] : undefined);
    if (!checked.ok) throw new Error(checked.reason);
    await updateAuthConfig(config, buildEnablePatch(checked.url, process.env.SEND_EMAIL_HOOK_SECRET));
    console.log(`Project ${config.projectRef}: hook açıldı -> ${checked.url}`);
    return;
  }

  if (command === "disable") {
    await updateAuthConfig(config, { ...DISABLE_PATCH });
    console.log(`Project ${config.projectRef}: hook kapatıldı (Supabase yerleşik gönderime döndü).`);
    return;
  }

  throw new Error(`Bilinmeyen komut "${command}". generate | status | enable | disable`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
