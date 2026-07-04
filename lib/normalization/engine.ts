export interface NormalizationOptions {
  lowercase?: boolean;
  trim?: boolean;
  removeEmoji?: boolean;
  removeHtmlEntities?: boolean;
  collapseWhitespace?: boolean;
  removePunctuation?: boolean;
  normalizeUnicode?: boolean;
  normalizeStorage?: boolean;
  normalizeSpacing?: boolean;
}

const DEFAULT_OPTIONS: NormalizationOptions = {
  lowercase: true,
  trim: true,
  removeEmoji: true,
  removeHtmlEntities: true,
  collapseWhitespace: true,
  removePunctuation: false,
  normalizeUnicode: true,
  normalizeStorage: true,
  normalizeSpacing: true,
};

const EMOJI_PATTERN = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff])/g;

const HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

const TURKISH_DIACRITICS: Record<string, string> = {
  'İ': 'i',
  'ı': 'i',
  'Ş': 's',
  'ş': 's',
  'Ğ': 'g',
  'ğ': 'g',
  'Ü': 'u',
  'ü': 'u',
  'Ö': 'o',
  'ö': 'o',
  'Ç': 'c',
  'ç': 'c',
};

const STORAGE_PATTERNS = [
  { pattern: /(\d+)\s*-?\s*gb/gi, suffix: 'gb' },
  { pattern: /(\d+)\s*-?\s*tb/gi, suffix: 'tb' },
  { pattern: /(\d+)\s*_\s*gb/gi, suffix: 'gb' },
  { pattern: /(\d+)\s*_\s*tb/gi, suffix: 'tb' },
];

const MODEL_VARIANTS: Record<string, string> = {
  'pro max': 'pro max',
  'promax': 'pro max',
  'pro-max': 'pro max',
  'pro_max': 'pro max',
  'galaxy ultra': 'ultra',
  'galaxyultra': 'ultra',
  'galaxy-ultra': 'ultra',
};

function removeEmoji(text: string): string {
  return text.replace(EMOJI_PATTERN, '');
}

function removeHtmlEntities(text: string): string {
  let result = text;
  Object.entries(HTML_ENTITIES).forEach(([entity, replacement]) => {
    result = result.replace(new RegExp(entity, 'g'), replacement);
  });
  return result;
}

function normalizeUnicode(text: string): string {
  let result = text;
  Object.entries(TURKISH_DIACRITICS).forEach(([from, to]) => {
    result = result.replace(new RegExp(from, 'g'), to);
  });
  return result;
}

function normalizeStorageSize(text: string): string {
  let result = text;
  STORAGE_PATTERNS.forEach(({ pattern, suffix }) => {
    result = result.replace(pattern, (match, number) => {
      return `${number}${suffix}`;
    });
  });
  return result;
}

function normalizeModelVariants(text: string): string {
  let result = text;
  result = result.replace(/\bapple\s+(?=iphone)\b/gi, "");
  result = result.replace(/\bgalaxy\s+(?=s\d|a\d|z\s*fold|z\s*flip)\b/gi, "samsung galaxy ");
  Object.entries(MODEL_VARIANTS).forEach(([pattern, replacement]) => {
    result = result.replace(
      new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
      replacement
    );
  });
  return result;
}

function normalizeSpacing(text: string): string {
  let result = text;
  result = result.replace(/\s+/g, ' ');
  result = result.replace(/\s+-\s+/g, '-');
  result = result.replace(/\s+_\s+/g, '_');
  return result;
}

function collapsWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ');
}

function trimText(text: string): string {
  return text.trim();
}

function lowercaseText(text: string): string {
  return text.toLocaleLowerCase('tr-TR');
}

export function normalizeProductTitle(
  input: string,
  options: Partial<NormalizationOptions> = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let result = input || '';

  if (!result) return '';

  if (opts.removeEmoji) result = removeEmoji(result);
  if (opts.removeHtmlEntities) result = removeHtmlEntities(result);
  if (opts.normalizeUnicode) result = normalizeUnicode(result);
  if (opts.normalizeStorage) result = normalizeStorageSize(result);
  if (opts.normalizeSpacing) {
    result = normalizeModelVariants(result);
    result = normalizeSpacing(result);
  }
  if (opts.collapseWhitespace) result = collapsWhitespace(result);
  if (opts.trim) result = trimText(result);
  if (opts.lowercase) result = lowercaseText(result);

  return result;
}

export function normalizeSearchText(input: string): string {
  return normalizeProductTitle(input, {
    lowercase: true,
    trim: true,
    removeEmoji: true,
    removeHtmlEntities: true,
    collapseWhitespace: true,
    normalizeUnicode: true,
    normalizeStorage: true,
    normalizeSpacing: true,
  });
}

export function normalizeCategoryText(input: string): string {
  return normalizeProductTitle(input, {
    lowercase: true,
    trim: true,
    removeEmoji: true,
    removeHtmlEntities: false,
    collapseWhitespace: true,
    normalizeUnicode: true,
    normalizeStorage: false,
    normalizeSpacing: true,
  });
}

export function normalizeListingTitle(input: string): string {
  return normalizeProductTitle(input);
}

export function normalizeQuery(input: string): string {
  return normalizeSearchText(input);
}

export function normalizeSlug(input: string): string {
  let result = normalizeProductTitle(input, {
    lowercase: true,
    trim: true,
    removeEmoji: true,
    removeHtmlEntities: true,
    collapseWhitespace: true,
    normalizeUnicode: true,
    normalizeStorage: false,
    normalizeSpacing: true,
  });

  result = result.replace(/[^\w\s-]/g, '');
  result = result.replace(/\s+/g, '-');
  result = result.replace(/-+/g, '-');
  result = result.replace(/^-+|-+$/g, '');

  return result;
}

export function normalizeKeyword(input: string): string {
  const normalized = normalizeSearchText(input);
  return normalized.split(/\s+/).filter(Boolean).join(' ');
}

export function extractStorageSize(input: string): string | null {
  const normalized = normalizeStorageSize(input.toLocaleLowerCase('tr-TR'));
  const match = normalized.match(/(\d+(?:gb|tb))/);
  return match ? match[1] : null;
}

export function extractBrand(input: string): string | null {
  const normalized = normalizeProductTitle(input);
  const brands = [
    'apple',
    'samsung',
    'google',
    'xiaomi',
    'realme',
    'oneplus',
    'oppo',
    'vivo',
    'motorola',
    'nokia',
    'sony',
    'lg',
    'asus',
    'razer',
    'blackberry',
    'htc',
    'honor',
    'nothing',
  ];

  for (const brand of brands) {
    if (normalized.includes(brand)) {
      return brand;
    }
  }

  const appleKeywords = ['iphone', 'ipad', 'macbook', 'airpods', 'apple watch'];
  for (const keyword of appleKeywords) {
    if (normalized.includes(keyword)) {
      return 'apple';
    }
  }

  return null;
}

export function getTokens(input: string): string[] {
  const normalized = normalizeSearchText(input);
  return normalized.split(/\s+/).filter(Boolean);
}

export function createSearchFingerprint(input: string): string {
  const tokens = getTokens(input);
  const uniqueTokens = Array.from(new Set(tokens));
  return uniqueTokens.sort().join('|');
}

export function isSimilarAfterNormalization(
  text1: string,
  text2: string,
  threshold: number = 0.8
): boolean {
  const norm1 = normalizeSearchText(text1);
  const norm2 = normalizeSearchText(text2);

  if (norm1 === norm2) return true;

  const tokens1 = new Set(getTokens(norm1));
  const tokens2 = new Set(getTokens(norm2));

  const intersection = new Set([...tokens1].filter((x) => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  if (union.size === 0) return false;

  const similarity = intersection.size / union.size;
  return similarity >= threshold;
}
