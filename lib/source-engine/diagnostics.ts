import type { SourceRunResult } from "@/lib/bots/source-runner";

export type SourceDiagnosticStatus = "healthy" | "warning" | "failed" | "blocked" | "unsupported" | "empty";

export type SourceDiagnostic = {
  status: SourceDiagnosticStatus;
  title: string;
  action: string;
};

export function diagnoseSourceRun(result: SourceRunResult): SourceDiagnostic {
  const message = (result.errorMessage ?? "").toLowerCase();

  if (!result.ok && /desteklenen|hazır değil|hazir degil/.test(message)) {
    return {
      status: "unsupported",
      title: "Adapter hazır değil",
      action: "Bu kaynak için adapter ekleyin veya kaynağı manuel/API modunda bırakın.",
    };
  }

  if (/403|forbidden|access denied|captcha|bot koruma|cloudflare/.test(message)) {
    return {
      status: "blocked",
      title: "Kaynak erişimi engelliyor",
      action: "Header/oturum/proxy stratejisini inceleyin; mümkünse resmi API/feed için görüşün.",
    };
  }

  if (/column .* does not exist|schema|pgrst204|42703|relation .* does not exist/.test(message)) {
    return {
      status: "failed",
      title: "Veritabanı şema uyumsuzluğu",
      action: "Supabase migration'ları production'da çalıştırın ve source/listings kolonlarını kontrol edin.",
    };
  }

  if (!result.found) {
    return {
      status: result.ok ? "empty" : "warning",
      title: "Ürün bulunamadı",
      action: "Kategori URL'si, selector/parser veya kaynak HTML yapısı değişmiş olabilir.",
    };
  }

  if (result.errorCount > 0 || !result.ok) {
    return {
      status: "warning",
      title: "Kısmi hata var",
      action: "Hata mesajını ve parse/insert adımlarını inceleyin.",
    };
  }

  return {
    status: "healthy",
    title: "Sağlıklı akış",
    action: "Kaynak veri buluyor ve pipeline başarıyla tamamlanıyor.",
  };
}
