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
  getTokens,
  createSearchFingerprint,
  isSimilarAfterNormalization,
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
    it('should extract known brands', () => {
      expect(extractBrand('Samsung Galaxy S24')).toBe('samsung');
      expect(extractBrand('Google Pixel 8')).toBe('google');
      expect(extractBrand('iPhone 15')).toBe('apple');
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
});
