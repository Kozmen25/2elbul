import { describe, it, expect } from 'vitest';
import {
  normalizeProductTitle,
  normalizeSearchText,
  normalizeCategoryText,
  normalizeListingTitle,
  normalizeQuery,
  normalizeSlug,
  normalizeKeyword,
  extractStorageSize,
  extractBrand,
  formatBrandDisplayName,
  getTokens,
  createSearchFingerprint,
  isSimilarAfterNormalization,
  extractProductSignals,
  generateProductKey,
} from './engine';

describe('Normalization Engine', () => {
  describe('normalizeProductTitle', () => {
    it('should handle empty input', () => {
      expect(normalizeProductTitle('')).toBe('');
    });

    it('should lowercase text', () => {
      expect(normalizeProductTitle('iPhone 15 Pro Max')).toBe('iphone 15 pro max');
    });

    it('should remove emoji', () => {
      expect(normalizeProductTitle('iPhone 📱 15 Pro')).toBe('iphone 15 pro');
    });

    it('should normalize Turkish diacritics', () => {
      expect(normalizeProductTitle('İstanbul Şarjlı')).toBe('istanbul sarjli');
    });

    it('should normalize storage sizes', () => {
      expect(normalizeProductTitle('256 GB')).toBe('256gb');
      expect(normalizeProductTitle('256GB')).toBe('256gb');
      expect(normalizeProductTitle('256-GB')).toBe('256gb');
      expect(normalizeProductTitle('512 TB')).toBe('512tb');
    });

    it('should normalize model variants', () => {
      expect(normalizeProductTitle('iPhone Pro Max')).toContain('pro max');
      expect(normalizeProductTitle('Galaxy Ultra')).toContain('ultra');
    });

    it('should collapse whitespace', () => {
      expect(normalizeProductTitle('iPhone   15    Pro')).toBe('iphone 15 pro');
    });

    it('should trim whitespace', () => {
      expect(normalizeProductTitle('  iPhone 15 Pro  ')).toBe('iphone 15 pro');
    });

    it('should remove HTML entities', () => {
      expect(normalizeProductTitle('iPhone&nbsp;15&amp;Pro')).toContain('iphone');
    });

    it('should preserve options override', () => {
      const result = normalizeProductTitle('IPHONE 15', { lowercase: false });
      expect(result).toBe('IPHONE 15');
    });

    it('should handle combined transformations', () => {
      const input = '  İphone 15   PRO-MAX 256GB  ';
      expect(normalizeProductTitle(input)).toBe('iphone 15 pro max 256gb');
    });
  });

  describe('normalizeSearchText', () => {
    it('should normalize search text with all options enabled', () => {
      expect(normalizeSearchText('  iPhone 15 Pro  ')).toBe('iphone 15 pro');
    });

    it('should handle emoji in search', () => {
      expect(normalizeSearchText('📱 iPhone')).toBe('iphone');
    });

    it('should normalize Turkish search terms', () => {
      expect(normalizeSearchText('Şarj Cihazı')).toBe('sarj cihazi');
    });

    it('should remove storage size suffixes', () => {
      expect(normalizeSearchText('256 GB iPhone')).toContain('256gb');
    });
  });

  describe('normalizeCategoryText', () => {
    it('should not remove HTML entities in categories', () => {
      const result = normalizeCategoryText('Cep&nbsp;Telefonu');
      expect(result).toContain('telefonu');
    });

    it('should not normalize storage in categories', () => {
      const result = normalizeCategoryText('256 GB Storage');
      expect(result).toContain('256');
    });

    it('should still normalize diacritics', () => {
      expect(normalizeCategoryText('Cep Telefonu')).toBe('cep telefonu');
    });
  });

  describe('normalizeListingTitle', () => {
    it('should apply default normalization to listings', () => {
      const result = normalizeListingTitle('  iPhone 15 Pro Max  ');
      expect(result).toBe('iphone 15 pro max');
    });
  });

  describe('normalizeQuery', () => {
    it('should be alias for normalizeSearchText', () => {
      const input = 'iPhone 15 Pro';
      expect(normalizeQuery(input)).toBe(normalizeSearchText(input));
    });
  });

  describe('normalizeSlug', () => {
    it('should create URL-safe slugs', () => {
      expect(normalizeSlug('iPhone 15 Pro Max')).toBe('iphone-15-pro-max');
    });

    it('should remove special characters', () => {
      expect(normalizeSlug('iPhone 15@#$ Pro')).toBe('iphone-15-pro');
    });

    it('should collapse multiple dashes', () => {
      expect(normalizeSlug('iPhone---15---Pro')).toBe('iphone-15-pro');
    });

    it('should trim dashes from start and end', () => {
      const result = normalizeSlug('  ---iPhone 15 Pro---  ');
      expect(result).toMatch(/^[a-z0-9].*[a-z0-9]$/);
    });

    it('should not normalize storage in slugs', () => {
      const result = normalizeSlug('256 GB iPhone');
      expect(result).toContain('256');
    });
  });

  describe('normalizeKeyword', () => {
    it('should return space-separated tokens', () => {
      expect(normalizeKeyword('iPhone 15 Pro')).toBe('iphone 15 pro');
    });

    it('should remove extra whitespace', () => {
      expect(normalizeKeyword('iPhone   15    Pro')).toBe('iphone 15 pro');
    });

    it('should filter empty tokens', () => {
      const result = normalizeKeyword('iPhone  \t 15  \n  Pro');
      expect(result).toBe('iphone 15 pro');
    });
  });

  describe('extractStorageSize', () => {
    it('should extract GB storage size', () => {
      expect(extractStorageSize('256 GB iPhone')).toBe('256gb');
    });

    it('should extract TB storage size', () => {
      expect(extractStorageSize('512 TB Storage')).toBe('512tb');
    });

    it('should handle various formats', () => {
      expect(extractStorageSize('256GB')).toBe('256gb');
      expect(extractStorageSize('256-GB')).toBe('256gb');
      expect(extractStorageSize('512 TB')).toBe('512tb');
    });

    it('should return null for non-storage text', () => {
      expect(extractStorageSize('iPhone 15')).toBeNull();
    });

    it('should extract first storage size', () => {
      const result = extractStorageSize('256 GB and 512 GB');
      expect(result).toBe('256gb');
    });
  });

  describe('extractBrand', () => {
    it('should extract Apple from explicit brand text', () => {
      expect(extractBrand('Apple iPhone 15')).toBe('apple');
    });

    it('should extract Apple from iPhone text', () => {
      expect(extractBrand('iPhone 15 Pro Max')).toBe('apple');
    });

    it('should extract Samsung from explicit brand text', () => {
      expect(extractBrand('Samsung Galaxy S24')).toBe('samsung');
    });

    it('should extract Samsung from Galaxy text', () => {
      expect(extractBrand('Galaxy S24 Ultra')).toBe('samsung');
    });

    it('should extract Xiaomi', () => {
      expect(extractBrand('Xiaomi Redmi Note 13')).toBe('xiaomi');
    });

    it('should extract Huawei', () => {
      expect(extractBrand('Huawei P60 Pro')).toBe('huawei');
    });

    it('should extract MSI', () => {
      expect(extractBrand('MSI Katana 15')).toBe('msi');
    });

    it('should extract Lenovo', () => {
      expect(extractBrand('Lenovo ThinkPad X1 Carbon')).toBe('lenovo');
    });

    it('should extract HP', () => {
      expect(extractBrand('HP Pavilion 15')).toBe('hp');
    });

    it('should extract Dell', () => {
      expect(extractBrand('Dell XPS 13')).toBe('dell');
    });

    it('should be case insensitive', () => {
      expect(extractBrand('SAMSUNG Galaxy')).toBe('samsung');
      expect(extractBrand('GoOgle Pixel')).toBe('google');
    });

    it('should return null for unknown brands', () => {
      expect(extractBrand('Unknown Brand Phone')).toBeNull();
    });

    it('should prioritize first brand match', () => {
      const result = extractBrand('Samsung Google');
      expect(result).toBe('samsung');
    });

    it('should handle brands in different positions', () => {
      expect(extractBrand('Pixel Google')).toBe('google');
      expect(extractBrand('Pro Samsung Galaxy')).toBe('samsung');
    });
  });

  describe('formatBrandDisplayName', () => {
    it('should format MSI in uppercase', () => {
      expect(formatBrandDisplayName('msi')).toBe('MSI');
    });
  });

  describe('getTokens', () => {
    it('should split text into tokens', () => {
      expect(getTokens('iPhone 15 Pro')).toEqual(['iphone', '15', 'pro']);
    });

    it('should filter empty tokens', () => {
      expect(getTokens('iPhone  \t 15  \n  Pro')).toEqual(['iphone', '15', 'pro']);
    });

    it('should normalize before tokenizing', () => {
      expect(getTokens('  İPhone 15 PRO  ')).toEqual(['iphone', '15', 'pro']);
    });

    it('should handle single token', () => {
      expect(getTokens('iPhone')).toEqual(['iphone']);
    });

    it('should return empty array for empty input', () => {
      expect(getTokens('')).toEqual([]);
    });
  });

  describe('createSearchFingerprint', () => {
    it('should create consistent fingerprints', () => {
      const fp1 = createSearchFingerprint('iPhone 15 Pro');
      const fp2 = createSearchFingerprint('iPhone 15 Pro');
      expect(fp1).toBe(fp2);
    });

    it('should create same fingerprint for different word order', () => {
      const fp1 = createSearchFingerprint('iPhone 15 Pro');
      const fp2 = createSearchFingerprint('Pro iPhone 15');
      expect(fp1).toBe(fp2);
    });

    it('should create different fingerprints for different content', () => {
      const fp1 = createSearchFingerprint('iPhone 15');
      const fp2 = createSearchFingerprint('Samsung Galaxy');
      expect(fp1).not.toBe(fp2);
    });

    it('should create fingerprint with normalized tokens', () => {
      const fp1 = createSearchFingerprint('  İPhone 15 PRO  ');
      const fp2 = createSearchFingerprint('iphone 15 pro');
      expect(fp1).toBe(fp2);
    });

    it('should use pipe separator', () => {
      const fp = createSearchFingerprint('iPhone 15 Pro');
      expect(fp).toContain('|');
    });
  });

  describe('isSimilarAfterNormalization', () => {
    it('should detect identical texts as similar', () => {
      expect(isSimilarAfterNormalization('iPhone 15', 'iPhone 15')).toBe(true);
    });

    it('should detect same text with different case as similar', () => {
      expect(isSimilarAfterNormalization('iPhone 15', 'IPHONE 15')).toBe(true);
    });

    it('should detect same text with different spacing as similar', () => {
      expect(isSimilarAfterNormalization('iPhone 15', 'iPhone  15')).toBe(true);
    });

    it('should detect texts with Turkish characters as similar', () => {
      expect(isSimilarAfterNormalization('İphone 15', 'iphone 15')).toBe(true);
    });

    it('should use threshold for similarity', () => {
      expect(isSimilarAfterNormalization('iPhone 15 Pro Max', 'iPhone 15', 0.5)).toBe(true);
      expect(isSimilarAfterNormalization('iPhone 15 Pro Max', 'Samsung Galaxy', 0.8)).toBe(false);
    });

    it('should detect dissimilar texts', () => {
      expect(isSimilarAfterNormalization('iPhone', 'Samsung', 0.8)).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(isSimilarAfterNormalization('', '')).toBe(true);
      expect(isSimilarAfterNormalization('iPhone', '')).toBe(false);
    });

    it('should default to 0.8 threshold', () => {
      const similar = isSimilarAfterNormalization('iPhone 15 Pro Max', 'iPhone 15 Pro');
      expect(typeof similar).toBe('boolean');
    });

    it('should calculate Jaccard similarity correctly', () => {
      const result1 = isSimilarAfterNormalization('iPhone 15 Pro', 'iPhone 15', 0.5);
      const result2 = isSimilarAfterNormalization('iPhone 15 Pro', 'Samsung Galaxy', 0.5);
      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });

    it('should handle single token texts', () => {
      expect(isSimilarAfterNormalization('iPhone', 'iPhone', 0.8)).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should handle real product titles', () => {
      const title = '  Apple iPhone 15 Pro Max 256GB &nbsp; 🔥  ';
      const normalized = normalizeProductTitle(title);
      expect(normalized).toBe('iphone 15 pro max 256gb');
    });

    it('should extract brand and storage from same text', () => {
      const text = 'Samsung Galaxy S24 256GB';
      expect(extractBrand(text)).toBe('samsung');
      expect(extractStorageSize(text)).toBe('256gb');
    });

    it('should create consistent fingerprint from different orderings', () => {
      const fp1 = createSearchFingerprint('Samsung 256GB Galaxy S24');
      const fp2 = createSearchFingerprint('S24 Galaxy Samsung 256GB');
      expect(fp1).toBe(fp2);
    });

    it('should slug and normalize consistently', () => {
      const title = '  İphone 15 Pro Max  ';
      const normalized = normalizeProductTitle(title);
      const slug = normalizeSlug(title);
      expect(slug).toBe('iphone-15-pro-max');
      expect(normalized).toBe('iphone 15 pro max');
    });


    it('should detect similar products after normalization', () => {
      const product1 = 'Apple iPhone 15 Pro Max 256GB';
      const product2 = 'APPLE IPHONE 15 PRO MAX 256GB';
      expect(isSimilarAfterNormalization(product1, product2)).toBe(true);
    });
  });

  // ================================================================
  // Extraction Regression Tests (Sprint P3 fixes)
  // ================================================================

  describe('extractProductSignals', () => {
    it('should return brand, model, storage, ram, color, category, normalizedKey', () => {
      const result = extractProductSignals('Samsung Galaxy S24 Ultra 256GB 12GB RAM Siyah');
      expect(result).toHaveProperty('brand');
      expect(result).toHaveProperty('model');
      expect(result).toHaveProperty('storage');
      expect(result).toHaveProperty('ram');
      expect(result).toHaveProperty('color');
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('normalizedKey');
    });
  });

  describe('Fix #1 — detectCategory tablet-before-phone ordering', () => {
    it('should classify Samsung Galaxy Tab as Tablet (not Telefon)', () => {
      const result = extractProductSignals('Samsung Galaxy Tab S9 256GB');
      expect(result.category).toBe('Tablet');
    });

    it('should classify iPad as Tablet', () => {
      const result = extractProductSignals('iPad 10. Nesil 64GB Wi-Fi');
      expect(result.category).toBe('Tablet');
    });

    it('should still classify Samsung Galaxy S24 as Telefon', () => {
      const result = extractProductSignals('Samsung Galaxy S24 Ultra 256GB');
      expect(result.category).toBe('Telefon');
    });
  });

  describe('Fix #2+#5 — Brand-aware detectModel fallback', () => {
    it('should strip brand prefix from Dell model fallback', () => {
      const result = extractProductSignals('Dell XPS 13 512GB');
      expect(result.model).toBe('xps-13');
    });

    it('should strip brand prefix from HP model fallback', () => {
      const result = extractProductSignals('HP Pavilion 15 256GB');
      expect(result.model).toBe('pavilion-15');
    });

    it('should strip brand prefix from Lenovo model fallback', () => {
      const result = extractProductSignals('Lenovo ThinkPad X1 512GB');
      expect(result.model).toBe('thinkpad-x1');
    });

    it('should strip brand prefix from ASUS model fallback', () => {
      const result = extractProductSignals('ASUS ROG Zephyrus 1TB');
      expect(result.model).toBe('rog-zephyrus');
    });

    it('should strip brand prefix from MSI model fallback', () => {
      const result = extractProductSignals('MSI GF63 Thin 512GB');
      expect(result.model).toBe('gf63-thin');
    });

    it('should strip brand prefix from Xiaomi model fallback', () => {
      const result = extractProductSignals('Xiaomi Redmi Note 12 8GB RAM 256GB');
      expect(result.model).toBe('redmi-note-12');
    });

    it('should strip brand prefix from Huawei model fallback', () => {
      const result = extractProductSignals('Huawei P60 Pro 256GB');
      expect(result.model).toBe('p60-pro');
    });

    it('should strip brand prefix from Google model fallback', () => {
      const result = extractProductSignals('Google Pixel 8 Pro 128GB');
      expect(result.model).toBe('pixel-8-pro');
    });

    it('should strip brand prefix from OnePlus model fallback', () => {
      const result = extractProductSignals('OnePlus 12 16GB RAM 512GB');
      expect(result.model).toBe('12');
    });

    it('should use first 4 tokens when brand is null', () => {
      const result = extractProductSignals('Xbox Series X 1TB');
      expect(result.model).toBe('xbox-series-x-1tb');
    });
  });

  describe('Fix #3 — normalizedKey leading/trailing hyphen trim', () => {
    it('should not have leading hyphens in normalizedKey', () => {
      const result = extractProductSignals('Samsung Galaxy S24 Ultra 256GB 12GB RAM');
      expect(result.normalizedKey).not.toMatch(/^-/);
    });

    it('should not have trailing hyphens in normalizedKey', () => {
      const result = extractProductSignals('Samsung Galaxy S24 Ultra 256GB 12GB RAM');
      expect(result.normalizedKey).not.toMatch(/-$/);
    });

    it('should produce clean hyphen-separated key', () => {
      const result = extractProductSignals('Samsung Galaxy S24 Ultra 256GB 12GB RAM');
      expect(result.normalizedKey).toBe('samsung-galaxy-s24-ultra-256gb');
    });
  });

  describe('Fix #4 — detectStorage two-phase (RAM-first) logic', () => {
    it('should pick storage after RAM (256GB not 128GB)', () => {
      const result = extractProductSignals('Samsung Galaxy A55 128GB 8GB RAM 256GB');
      expect(result.storage).toBe('256gb');
    });

    it('should pick the only storage when no RAM keyword', () => {
      const result = extractProductSignals('Samsung Galaxy S24 Ultra 256GB');
      expect(result.storage).toBe('256gb');
    });

    it('should pick storage before RAM when no storage after RAM', () => {
      const result = extractProductSignals('Samsung Galaxy S24 Ultra 256GB 12GB RAM');
      expect(result.storage).toBe('256gb');
    });

    it('should not confuse RAM count as storage', () => {
      const result = extractProductSignals('Samsung Galaxy S24 Ultra 256GB 12GB RAM');
      expect(result.ram).toBe('12gb');
      expect(result.storage).toBe('256gb');
    });
  });

  describe('Fix #6 — normalizeModelVariants + → plus conversion', () => {
    it('should convert S24+ to galaxy-s24-plus model', () => {
      const result = extractProductSignals('Samsung S24+ 256GB');
      expect(result.model).toBe('galaxy-s24-plus');
    });

    it('should convert + to plus in normalized title', () => {
      const normalized = normalizeProductTitle('Samsung S24+ 256GB');
      expect(normalized).toContain('plus');
    });

    it('should handle iPhone 15+ (existing behavior)', () => {
      const normalized = normalizeProductTitle('iPhone 15+');
      expect(normalized).toContain('plus');
    });
  });

  describe('Fix #7 — lowercaseText Turkish İ fix', () => {
    it('should convert Turkish İ to i', () => {
      const normalized = normalizeProductTitle('İPHONE 15 PRO MAX');
      expect(normalized).toBe('iphone 15 pro max');
    });

    it('should convert IPhone with Turkish İ correctly', () => {
      const normalized = normalizeProductTitle('İPhone 15 PRO MAX PİXEL ÇOK TEMİZ');
      expect(normalized).not.toContain('İ');
      expect(normalized).toContain('iphone 15 pro max');
    });

    it('should extract brand from title with Turkish İ', () => {
      const result = extractProductSignals('İPhone 15 PRO MAX 256GB');
      expect(result.brand).toBe('apple');
      expect(result.model).toBe('iphone-15-pro-max');
    });
  });

  describe('Fix #8 — iPad nesil regex capture', () => {
    it('should include nesil suffix for iPad 10. Nesil', () => {
      const result = extractProductSignals('iPad 10. Nesil 64GB Wi-Fi');
      expect(result.model).toBe('ipad-10-nesil');
    });

    it('should handle iPad Air without nesil', () => {
      const result = extractProductSignals('iPad Air 256GB');
      expect(result.model).toMatch(/^ipad/);
    });

    it('should handle iPad Pro without nesil', () => {
      const result = extractProductSignals('iPad Pro 128GB');
      expect(result.model).toBe('ipad-pro');
    });

    it('should handle bare iPad model', () => {
      const result = extractProductSignals('iPad 9 64GB');
      expect(result.model).toBe('ipad-9');
    });
  });

  describe('nomalizeProductTitle pipeline order', () => {
    it('should apply emoji removal', () => {
      const result = normalizeProductTitle('iPhone 📱 15');
      expect(result).toBe('iphone 15');
    });

    it('should apply HTML entity removal', () => {
      const result = normalizeProductTitle('iPhone &amp; Kılıf');
      expect(result).toBe('iphone & kilif');
    });

    it('should apply Turkish diacritics normalization', () => {
      const result = normalizeProductTitle('Şarj Cihazı');
      expect(result).toBe('sarj cihazi');
    });

    it('should apply storage normalization', () => {
      const result = normalizeProductTitle('256 GB');
      expect(result).toBe('256gb');
    });

    it('should apply + → plus conversion', () => {
      const result = normalizeProductTitle('S24+');
      expect(result).toBe('s24 plus');
    });
  });

  describe('Ram detection edge cases', () => {
    it('should detect ram in "XGB RAM" format', () => {
      const result = extractProductSignals('Samsung Galaxy S24 Ultra 256GB 12GB RAM');
      expect(result.ram).toBe('12gb');
    });

    it('should detect ram in "XGB Ram" format (mixed case)', () => {
      const result = extractProductSignals('Samsung Galaxy S24 Ultra 256GB 12GB Ram');
      expect(result.ram).toBe('12gb');
    });

    it('should return null when no RAM mention', () => {
      const result = extractProductSignals('Samsung Galaxy S24 Ultra 256GB');
      expect(result.ram).toBeNull();
    });

    it('should exclude ram from normalizedKey for Telefon category', () => {
      const result = extractProductSignals('Samsung Galaxy S24 Ultra 256GB 12GB RAM');
      expect(result.normalizedKey).not.toContain('12gb');
    });
  });

  describe('Cross-category lookalikes', () => {
    it('should classify PlayStation as Oyun Konsolu', () => {
      const result = extractProductSignals('PlayStation 5 825GB Dijital');
      expect(result.category).toBe('Oyun Konsolu');
    });

    it('should classify MacBook as Laptop', () => {
      const result = extractProductSignals('MacBook Air M1 256GB');
      expect(result.category).toBe('Laptop');
    });

    it('should classify RTX as Ekran Kartı', () => {
      const result = extractProductSignals('RTX 4090 24GB Ekran Kartı');
      expect(result.category).toBe('Ekran Kartı');
    });

    it('should detect nvidia brand from RTX', () => {
      const result = extractProductSignals('RTX 4090 24GB Ekran Kartı');
      expect(result.brand).toBe('nvidia');
    });
  });

  describe('Non-Latin / transliteration', () => {
    it('should handle Arabic text without crashing', () => {
      const result = extractProductSignals('ايفون 15 برو ماكس 256GB');
      expect(result.brand).toBeNull();
      expect(result.model).toBeTruthy();
    });

    it('should handle Cyrillic text without crashing', () => {
      const result = extractProductSignals('iPhone 15 Pro Max 256GB сірий');
      expect(result.brand).toBe('apple');
    });
  });

  describe('Empty / minimal input', () => {
    it('should handle empty string', () => {
      const result = extractProductSignals('');
      expect(result.brand).toBeNull();
      expect(result.normalizedKey).toBe('');
    });

    it('should handle single word with no brand', () => {
      const result = extractProductSignals('telefon');
      expect(result.brand).toBeNull();
      expect(result.model).toBeTruthy();
    });

    it('should handle brand-only input like "Apple iPhone"', () => {
      const result = extractProductSignals('Apple iPhone');
      expect(result.brand).toBe('apple');
      expect(result.model).toBe('iphone');
    });
  });

  describe('Noisy / spam titles', () => {
    it('should handle exclamation marks and spam text', () => {
      const result = extractProductSignals('ACİL!! SATILIK iPhone 15 Pro Max 256GB Sıfır Ayarlı!');
      expect(result.brand).toBe('apple');
      expect(result.model).toBe('iphone-15-pro-max');
      expect(result.category).toBe('Telefon');
    });

    it('should handle bare iPhone model numbers', () => {
      const result = extractProductSignals('16 pro max 256 gb siyah');
      expect(result.brand).toBe('apple');
      expect(result.model).toBe('iphone-16-pro-max');
    });

    it('should handle bare Samsung model numbers', () => {
      const result = extractProductSignals('s23 128 gb');
      expect(result.brand).toBe('samsung');
      expect(result.model).toBe('galaxy-s23');
    });
  });

  describe('Long / complex titles', () => {
    it('should correctly extract from long descriptive titles', () => {
      const result = extractProductSignals('2024 Model SIFIR AYARINDA Samsung Galaxy S24 Ultra 256GB 12GB RAM Orijinal Kutu Faturasıyla Beraber Sadece 2 Ay Kullanılmış');
      expect(result.brand).toBe('samsung');
      expect(result.model).toBe('galaxy-s24-ultra');
      expect(result.storage).toBe('256gb');
      expect(result.ram).toBe('12gb');
    });
  });

  describe('generateProductKey', () => {
    it('should produce same result as extractProductSignals().normalizedKey', () => {
      const title = 'Samsung Galaxy S24 Ultra 256GB 12GB RAM';
      expect(generateProductKey(title)).toBe(extractProductSignals(title).normalizedKey);
    });
  });
});
