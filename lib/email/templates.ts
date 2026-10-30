// All e-mails the app sends, rendered to { subject, html, text }.
// Pure functions: every interpolated value is HTML-escaped and every link must
// be http(s), so user-controlled text (product names) cannot inject markup.

import { formatCurrencyTRY } from "@/lib/formatters";

export type RenderedEmail = { subject: string; html: string; text: string };

export type EmailTemplateData = {
  signup: { link: string };
  recovery: { link: string };
  magiclink: { link: string };
  invite: { link: string };
  reauthentication: { code: string };
  price_alert: { productName: string; targetPrice: number; currentPrice: number; productUrl: string; settingsUrl: string };
  price_drop: {
    productName: string;
    previousPrice: number;
    currentPrice: number;
    dropPercent: number;
    productUrl: string;
    settingsUrl: string;
  };
  new_listing: {
    productName: string;
    price: number;
    /** How far below the market average the listing is; null when unknown. */
    belowMarketPercent: number | null;
    productUrl: string;
    settingsUrl: string;
  };
  saved_search: { query: string; matchCount: number; searchUrl: string; settingsUrl: string };
  test: { to: string };
};

export type EmailKind = keyof EmailTemplateData;

const BRAND_COLOR = "#3B66E0";
const SITE_NAME = "2ElBul";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Returns the URL when it is http(s), otherwise throws — a bad link must never reach an e-mail. */
export function assertSafeUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("E-posta bağlantısı geçerli bir adres değil.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("E-posta bağlantısı yalnızca http(s) olabilir.");
  }
  return url.toString();
}

type Layout = {
  title: string;
  intro: string;
  button?: { label: string; url: string };
  code?: string;
  notes: string[];
  footerLink?: { label: string; url: string };
};

function layout({ title, intro, button, code, notes, footerLink }: Layout): { html: string; text: string } {
  const buttonHtml = button
    ? `<p style="margin:0 0 24px"><a href="${escapeHtml(assertSafeUrl(button.url))}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:12px">${escapeHtml(button.label)}</a></p>
  <p style="margin:0 0 24px;font-size:12px;line-height:1.5;color:#717171;word-break:break-all">Düğme çalışmazsa bu adresi tarayıcına yapıştır:<br>${escapeHtml(assertSafeUrl(button.url))}</p>`
    : "";
  const codeHtml = code
    ? `<p style="margin:0 0 24px;font-size:28px;font-weight:800;letter-spacing:6px;font-family:monospace">${escapeHtml(code)}</p>`
    : "";
  const notesHtml = notes
    .map((note) => `<p style="font-size:13px;line-height:1.6;color:#717171;margin:0 0 8px">${escapeHtml(note)}</p>`)
    .join("\n  ");
  const footerHtml = footerLink
    ? `<p style="font-size:12px;line-height:1.6;color:#717171;margin:16px 0 0"><a href="${escapeHtml(assertSafeUrl(footerLink.url))}" style="color:#717171">${escapeHtml(footerLink.label)}</a></p>`
    : "";

  const html = `<!doctype html>
<html lang="tr"><body style="margin:0;background:#f5f5f2">
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#161616;background:#ffffff">
  <p style="font-size:20px;font-weight:800;margin:0 0 16px">${SITE_NAME}</p>
  <h2 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h2>
  <p style="line-height:1.6;margin:0 0 20px">${escapeHtml(intro)}</p>
  ${buttonHtml}
  ${codeHtml}
  ${notesHtml}
  ${footerHtml}
</div>
</body></html>`;

  const text = [
    `${SITE_NAME} - ${title}`,
    "",
    intro,
    button ? `\n${button.label}: ${assertSafeUrl(button.url)}` : "",
    code ? `\nKod: ${code}` : "",
    "",
    ...notes,
    footerLink ? `\n${footerLink.label}: ${assertSafeUrl(footerLink.url)}` : "",
  ]
    .filter((line, index, all) => !(line === "" && all[index - 1] === ""))
    .join("\n")
    .trim();

  return { html, text };
}

const accountNotice = (what: string) => `Bunu sen yapmadıysan bu e-postayı yok sayabilirsin; ${what}`;

const RENDERERS: { [K in EmailKind]: (data: EmailTemplateData[K]) => RenderedEmail } = {
  signup: ({ link }) => ({
    subject: `${SITE_NAME} - E-posta adresini doğrula`,
    ...layout({
      title: "E-posta adresini doğrula",
      intro: `${SITE_NAME}'a hoş geldin. Kaydını tamamlamak için e-posta adresini doğrula.`,
      button: { label: "E-postamı doğrula", url: link },
      notes: [accountNotice("hesabın etkinleştirilmez.")],
    }),
  }),
  recovery: ({ link }) => ({
    subject: `${SITE_NAME} - Şifreni sıfırla`,
    ...layout({
      title: "Şifreni sıfırla",
      intro: "Şifreni sıfırlamak için bir talep aldık. Aşağıdaki düğmeyle yeni bir şifre belirleyebilirsin. Bağlantı tek kullanımlıktır ve kısa süre içinde geçerliliğini yitirir.",
      button: { label: "Yeni şifre belirle", url: link },
      notes: [accountNotice("şifren değişmez.")],
    }),
  }),
  magiclink: ({ link }) => ({
    subject: `${SITE_NAME} - Giriş bağlantın`,
    ...layout({
      title: "Giriş bağlantın",
      intro: `${SITE_NAME}'a şifresiz giriş yapmak için aşağıdaki düğmeyi kullan.`,
      button: { label: "Giriş yap", url: link },
      notes: [accountNotice("hesabına giriş yapılmaz.")],
    }),
  }),
  invite: ({ link }) => ({
    subject: `${SITE_NAME} - Davet edildin`,
    ...layout({
      title: "Davet edildin",
      intro: `${SITE_NAME}'a davet edildin. Hesabını etkinleştirmek için aşağıdaki düğmeyi kullan.`,
      button: { label: "Daveti kabul et", url: link },
      notes: ["Bu daveti beklemiyorsan bu e-postayı yok sayabilirsin."],
    }),
  }),
  reauthentication: ({ code }) => ({
    subject: `${SITE_NAME} - Doğrulama kodun`,
    ...layout({
      title: "Doğrulama kodun",
      intro: "Bu işlemi onaylamak için aşağıdaki kodu gir.",
      code,
      notes: ["Kodu kimseyle paylaşma. Bu işlemi sen başlatmadıysan e-postayı yok sayabilirsin."],
    }),
  }),
  price_alert: ({ productName, targetPrice, currentPrice, productUrl, settingsUrl }) => ({
    subject: `${SITE_NAME} - Fiyat alarmın tetiklendi: ${productName}`,
    ...layout({
      title: "Fiyat alarmın tetiklendi",
      intro: `${productName} için fiyat hedefine ulaştı. Hedefin ${formatCurrencyTRY(targetPrice)}, şu anki en düşük fiyat ${formatCurrencyTRY(currentPrice)}.`,
      button: { label: "Ürünü incele", url: productUrl },
      notes: ["Fiyatlar kaynak sitelerde her an değişebilir; satın almadan önce ilanı kontrol et."],
      footerLink: { label: "Bu e-postaları almak istemiyorsan Hesabım'dan kapatabilirsin.", url: settingsUrl },
    }),
  }),
  price_drop: ({ productName, previousPrice, currentPrice, dropPercent, productUrl, settingsUrl }) => ({
    subject: `${SITE_NAME} - Fiyat düştü: ${productName}`,
    ...layout({
      title: "Fiyat düştü",
      intro: `${productName} için en düşük fiyat ${formatCurrencyTRY(previousPrice)} seviyesinden ${formatCurrencyTRY(currentPrice)} seviyesine indi (%${dropPercent} düşüş).`,
      button: { label: "Ürünü incele", url: productUrl },
      notes: ["Fiyatlar kaynak sitelerde her an değişebilir; satın almadan önce ilanı kontrol et."],
      footerLink: { label: "Bu e-postaları almak istemiyorsan Hesabım'dan kapatabilirsin.", url: settingsUrl },
    }),
  }),
  new_listing: ({ productName, price, belowMarketPercent, productUrl, settingsUrl }) => ({
    subject: `${SITE_NAME} - Yeni ilan: ${productName}`,
    ...layout({
      title: "Takip ettiğin ürüne yeni ilan geldi",
      intro:
        belowMarketPercent !== null && belowMarketPercent > 0
          ? `${productName} için ${formatCurrencyTRY(price)} fiyatlı yeni bir ilan eklendi. Piyasa ortalamasının %${belowMarketPercent.toLocaleString("tr-TR")} altında.`
          : `${productName} için ${formatCurrencyTRY(price)} fiyatlı yeni bir ilan eklendi.`,
      button: { label: "İlanı incele", url: productUrl },
      notes: ["Fiyatlar kaynak sitelerde her an değişebilir; satın almadan önce ilanı kontrol et."],
      footerLink: { label: "Bu e-postaları almak istemiyorsan Hesabım'dan kapatabilirsin.", url: settingsUrl },
    }),
  }),
  saved_search: ({ query, matchCount, searchUrl, settingsUrl }) => ({
    subject: `${SITE_NAME} - "${query}" için yeni ilan`,
    ...layout({
      title: "Kayıtlı aramana yeni ilan geldi",
      intro:
        matchCount === 1
          ? `"${query}" aramanla eşleşen 1 yeni ilan bulundu.`
          : `"${query}" aramanla eşleşen ${matchCount} yeni ilan bulundu.`,
      button: { label: "Yeni ilanları gör", url: searchUrl },
      notes: ["Fiyatlar kaynak sitelerde her an değişebilir; satın almadan önce ilanı kontrol et."],
      footerLink: { label: "Bu e-postaları almak istemiyorsan Hesabım'dan kapatabilirsin.", url: settingsUrl },
    }),
  }),
  test: ({ to }) => ({
    subject: `${SITE_NAME} - SMTP test e-postası`,
    ...layout({
      title: "SMTP ayarların çalışıyor",
      intro: `Bu e-posta admin panelindeki "Test e-postası gönder" düğmesiyle ${to} adresine gönderildi. Bunu okuyabiliyorsan e-posta servisi doğru yapılandırılmış demektir.`,
      notes: ["Kayıt onayı, şifre sıfırlama ve fiyat alarmı e-postaları bu ayarlarla gönderilecek."],
    }),
  }),
};

export function renderEmail<K extends EmailKind>(kind: K, data: EmailTemplateData[K]): RenderedEmail {
  return RENDERERS[kind](data);
}
