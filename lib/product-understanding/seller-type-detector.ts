/**
 * Seller type detector.
 * Determines whether a seller is "Profesyonel" (professional/retail)
 * or "Bireysel" (individual/private) based on source and name patterns.
 */

const PROFESSIONAL_SOURCES = new Set([
  "EasyCep",
  "Getmobil",
  "Vatan",
  "MediaMarkt",
  "Teknosa",
  "Hepsiburada",
  "Trendyol",
  "Amazon",
  "Pazarama",
  "CepNakit",
  "ITopya",
  "Akakce",
]);

const PROFESSIONAL_NAME_PATTERNS = [
  /\b(?:ticaret|teknoloji|telekom|iletişim|electronic|shop|store)\b/i,
  /\b(?:bilgisayar|cep\s*telefon|market|mağaza|magaza)\b/i,
  /\b(?:grup|group|limited|ltd|şti|şirket|firma|firması)\b/i,
  /\b(?:resmi|yetkili|authorized|distribütör|distributor|bayi)\b/i,
  /\b(?:online|internet|e[-\s]?ticaret)\b/i,
];

const INDIVIDUAL_NAME_PATTERNS = [
  /^[A-ZÇŞĞÜÖİ][a-zçşğüöı]+\s+[A-ZÇŞĞÜÖİ][a-zçşğüöı]+$/, // "Ahmet Yılmaz"
  /\b(?:satılık|elden|şahsi|kişisel)\b/i,
];

export function detectSellerType(
  source?: string,
  seller?: string,
): { value: "Bireysel" | "Profesyonel" | null; confidence: number } {
  // Source-based detection (highest confidence)
  if (source && PROFESSIONAL_SOURCES.has(source)) {
    return { value: "Profesyonel", confidence: 90 };
  }

  if (!seller) {
    return { value: null, confidence: 0 };
  }

  // Seller name-based detection
  for (const pattern of PROFESSIONAL_NAME_PATTERNS) {
    if (pattern.test(seller)) {
      return { value: "Profesyonel", confidence: 80 };
    }
  }

  for (const pattern of INDIVIDUAL_NAME_PATTERNS) {
    if (pattern.test(seller)) {
      return { value: "Bireysel", confidence: 70 };
    }
  }

  // Default: unknown
  return { value: null, confidence: 0 };
}
