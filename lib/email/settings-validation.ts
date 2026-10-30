// Validation of the SMTP settings form. Pure: no I/O, so every rule is unit-tested.

export type EmailSettingsInput = {
  enabled: boolean;
  host: string;
  port: string | number;
  /** true: implicit TLS (465). false: STARTTLS upgrade (587/25). */
  secure: boolean;
  username: string;
  /** Blank keeps the stored password. */
  password: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
};

export type ValidEmailSettings = {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  /** null = keep the stored password. */
  password: string | null;
  fromEmail: string;
  fromName: string;
  replyTo: string;
};

export type EmailSettingsErrors = Partial<Record<keyof EmailSettingsInput, string>>;

export type EmailSettingsValidation =
  | { ok: true; value: ValidEmailSettings }
  | { ok: false; errors: EmailSettingsErrors };

const HOST_PATTERN = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i;
const EMAIL_PATTERN = /^[^\s@<>"',;:]+@[^\s@<>"',;:]+\.[^\s@<>"',;:]{2,}$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const MAX_HOST_LENGTH = 253;
const MAX_FIELD_LENGTH = 200;

export function isValidEmailAddress(value: string): boolean {
  return value.length <= 254 && EMAIL_PATTERN.test(value);
}

export function validateEmailSettingsInput(
  input: EmailSettingsInput,
  context: { hasStoredPassword: boolean },
): EmailSettingsValidation {
  const errors: EmailSettingsErrors = {};

  const host = input.host.trim();
  const username = input.username.trim();
  const fromEmail = input.fromEmail.trim();
  const fromName = input.fromName.trim();
  const replyTo = input.replyTo.trim();
  const password = input.password;
  const port = typeof input.port === "number" ? input.port : Number(input.port.trim() === "" ? Number.NaN : input.port);

  for (const [field, value] of [
    ["host", host],
    ["username", username],
    ["fromEmail", fromEmail],
    ["fromName", fromName],
    ["replyTo", replyTo],
    ["password", password],
  ] as const) {
    if (CONTROL_CHARACTERS.test(value)) errors[field] = "Satır sonu ve kontrol karakterleri kullanılamaz.";
    else if (value.length > MAX_FIELD_LENGTH) errors[field] = "Değer çok uzun.";
  }

  if (!errors.host) {
    if (!host) {
      if (input.enabled) errors.host = "SMTP sunucusu zorunludur.";
    } else if (host.includes("://") || host.includes("/") || host.includes(":")) {
      errors.host = "Sunucu adını adres ön eki ve port olmadan yazın (ör. smtp.resend.com).";
    } else if (host.length > MAX_HOST_LENGTH || !HOST_PATTERN.test(host)) {
      errors.host = "Geçerli bir sunucu adı girin.";
    }
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    if (input.enabled || String(input.port).trim() !== "") errors.port = "Port 1 ile 65535 arasında bir sayı olmalı.";
  }

  if (!errors.fromEmail) {
    if (!fromEmail) {
      if (input.enabled) errors.fromEmail = "Gönderen e-posta adresi zorunludur.";
    } else if (!isValidEmailAddress(fromEmail)) {
      errors.fromEmail = "Geçerli bir e-posta adresi girin.";
    }
  }

  if (!errors.fromName && /[<>"]/.test(fromName)) {
    errors.fromName = "Gönderen adında < > \" karakterleri kullanılamaz.";
  }

  if (!errors.replyTo && replyTo && !isValidEmailAddress(replyTo)) {
    errors.replyTo = "Geçerli bir e-posta adresi girin.";
  }

  if (!errors.username && password && !username) {
    errors.username = "Şifre girdiyseniz kullanıcı adı da zorunludur.";
  }

  if (!errors.password && input.enabled && username && !password && !context.hasStoredPassword) {
    errors.password = "Kullanıcı adı girildiğinde şifre (ya da API anahtarı) zorunludur.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      enabled: input.enabled,
      host,
      port: Number.isInteger(port) ? port : 0,
      secure: input.secure,
      username,
      password: password === "" ? null : password,
      fromEmail,
      fromName,
      replyTo,
    },
  };
}

export type SmtpPreset = {
  id: string;
  label: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  /** What to paste into the password field. */
  passwordHint: string;
};

export const SMTP_PRESETS: SmtpPreset[] = [
  { id: "resend", label: "Resend", host: "smtp.resend.com", port: 465, secure: true, username: "resend", passwordHint: "Resend API anahtarı (re_...)" },
  { id: "brevo", label: "Brevo (Sendinblue)", host: "smtp-relay.brevo.com", port: 587, secure: false, username: "", passwordHint: "Brevo SMTP anahtarı" },
  { id: "sendgrid", label: "SendGrid", host: "smtp.sendgrid.net", port: 587, secure: false, username: "apikey", passwordHint: "SendGrid API anahtarı (SG...)" },
  { id: "mailgun", label: "Mailgun", host: "smtp.mailgun.org", port: 587, secure: false, username: "", passwordHint: "Mailgun SMTP şifresi" },
  { id: "gmail", label: "Gmail", host: "smtp.gmail.com", port: 465, secure: true, username: "", passwordHint: "Google \"uygulama şifresi\" (normal şifre çalışmaz)" },
  { id: "yandex", label: "Yandex", host: "smtp.yandex.com", port: 465, secure: true, username: "", passwordHint: "Yandex uygulama şifresi" },
  { id: "outlook", label: "Outlook / Microsoft 365", host: "smtp.office365.com", port: 587, secure: false, username: "", passwordHint: "Hesap şifresi ya da uygulama şifresi" },
];
