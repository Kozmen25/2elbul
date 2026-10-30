// SMTP transport (nodemailer) and human-readable explanations of SMTP errors.

import nodemailer, { type Transporter } from "nodemailer";
import type { SmtpSettings } from "@/lib/email/settings";

const CONNECTION_TIMEOUT_MS = 10_000;
const SOCKET_TIMEOUT_MS = 20_000;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "host.docker.internal"]);

export function isLocalHost(host: string): boolean {
  return LOCAL_HOSTS.has(host.toLowerCase());
}

export function createSmtpTransport(settings: SmtpSettings): Transporter {
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    // Without implicit TLS the connection must be upgraded with STARTTLS —
    // credentials are never sent in clear text. Local dev mail catchers
    // (Mailpit, MailHog) speak plain SMTP and are exempt.
    requireTLS: !settings.secure && !isLocalHost(settings.host),
    auth: settings.username ? { user: settings.username, pass: settings.password } : undefined,
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    greetingTimeout: CONNECTION_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
    tls: { minVersion: "TLSv1.2" },
  });
}

type SmtpErrorLike = { code?: string; responseCode?: number; message?: string; command?: string };

export type SmtpErrorExplanation = {
  /** Plain-Turkish cause and what to check. */
  message: string;
  /** Short technical detail for the admin log. */
  detail: string;
};

const MAX_DETAIL_LENGTH = 300;

export function explainSmtpError(error: unknown): SmtpErrorExplanation {
  const e = (error ?? {}) as SmtpErrorLike;
  const raw = String(e.message ?? error ?? "");
  const detail = raw.replace(/\s+/g, " ").slice(0, MAX_DETAIL_LENGTH);
  const code = e.code ?? "";
  const response = e.responseCode ?? 0;

  const explain = (message: string): SmtpErrorExplanation => ({ message, detail });

  if (code === "EAUTH" || response === 535 || response === 534 || /invalid login|authentication (failed|unsuccessful)|auth.*failed/i.test(raw)) {
    return explain("Sunucu kullanıcı adı veya şifreyi reddetti. Bilgileri (Resend/SendGrid'de API anahtarını, Gmail'de uygulama şifresini) kontrol edin.");
  }
  if (code === "ENOTFOUND" || code === "EDNS") {
    return explain("Sunucu adı bulunamadı. SMTP sunucusunun yazılışını kontrol edin.");
  }
  if (code === "ECONNREFUSED") {
    return explain("Sunucuya bağlanılamadı (bağlantı reddedildi). Sunucu adını ve portu kontrol edin.");
  }
  if (code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT" || code === "ECONNECTION" || /timed? ?out|greeting never received/i.test(raw)) {
    return explain("Sunucu zamanında yanıt vermedi. Port yanlış olabilir ya da güvenlik duvarı bağlantıyı engelliyor.");
  }
  if (/wrong version number|ssl routines|ERR_SSL|unexpected response|EPROTO/i.test(raw) || code === "EPROTO") {
    return explain("TLS ayarı sunucuyla uyuşmuyor. 465 portunda \"TLS\" açık, 587 ve 25 portlarında kapalı olmalı.");
  }
  if (/self[- ]signed|certificate|CERT_/i.test(raw)) {
    return explain("Sunucunun sertifikası doğrulanamadı. Sunucu adının sertifikayla eşleştiğinden emin olun.");
  }
  if (/STARTTLS|must issue a STARTTLS|Must use TLS/i.test(raw)) {
    return explain("Sunucu şifreli bağlantı istiyor. \"TLS\" seçeneğini açıp 465 portunu deneyin.");
  }
  if (code === "EENVELOPE" || response === 550 || response === 553 || response === 554 || /sender|not verified|domain.*not|not allowed|from address/i.test(raw)) {
    return explain("Gönderen adresi sunucu tarafından reddedildi. Gönderen e-posta adresinin alan adını e-posta servisinizde doğrulamış olmanız gerekir.");
  }
  if (response === 421 || response === 450 || response === 451 || response === 452 || /rate limit|too many/i.test(raw)) {
    return explain("Sunucu şu an istek kabul etmiyor (hız ya da kota sınırı). Biraz bekleyip tekrar deneyin.");
  }
  return explain("E-posta gönderilemedi. Ayrıntı için teknik mesaja bakın.");
}

/** Connects and authenticates without sending anything. */
export async function verifySmtpConnection(settings: SmtpSettings): Promise<{ ok: true } | ({ ok: false } & SmtpErrorExplanation)> {
  const transport = createSmtpTransport(settings);
  try {
    await transport.verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, ...explainSmtpError(error) };
  } finally {
    transport.close();
  }
}
