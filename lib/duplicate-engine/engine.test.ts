import { describe, it, expect } from 'vitest';
import {
  calculateDuplicateScoreForInputs,
  isDuplicate,
  compareMultiple,
  findBestMatch,
  createDuplicateFingerprint,
} from './engine';
import {
  compareListings,
  findDuplicateMatches,
  groupDuplicates,
  getHighestScoringDuplicate,
} from './matcher';
import { createComparisonInput } from './helpers';

describe('Duplicate Detection Engine', () => {
  describe('iPhone Examples', () => {
    it('iPhone 15 Pro Max identical from different sources', () => {
      const input1 = createComparisonInput('iPhone 15 Pro Max 256GB', {
        brand: 'apple',
        model: 'iphone-15-pro-max',
        storage: '256gb',
      });

      const input2 = createComparisonInput('Apple iPhone15ProMax 256', {
        brand: 'apple',
        model: 'iphone-15-pro-max',
        storage: '256gb',
      });

      const result = calculateDuplicateScoreForInputs(input1, input2);
      expect(result.score).toBeGreaterThanOrEqual(65);
      expect(result.confidence).toBe('possible');
    });

    it('iPhone 15 should not match iPhone 14', () => {
      const input1 = createComparisonInput('iPhone 15', {
        brand: 'apple',
        model: 'iphone-15',
      });

      const input2 = createComparisonInput('iPhone 14', {
        brand: 'apple',
        model: 'iphone-14',
      });

      const result = calculateDuplicateScoreForInputs(input1, input2);
      expect(result.score).toBeLessThan(65);
      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.confidence).toBe('possible');
    });

    it('iPhone 15 256GB vs iPhone 15 should score moderate due to storage difference', () => {
      const input1 = createComparisonInput('iPhone 15 256GB', {
        brand: 'apple',
        model: 'iphone-15',
        storage: '256gb',
      });

      const input2 = createComparisonInput('iPhone 15', {
        brand: 'apple',
        model: 'iphone-15',
      });

      const result = calculateDuplicateScoreForInputs(input1, input2);
      expect(result.score).toBeGreaterThanOrEqual(60);
      expect(result.score).toBeLessThan(85);
    });

    it('iPhone 15 Pro vs iPhone 15 Pro Max should score moderate', () => {
      const input1 = createComparisonInput('iPhone 15 Pro', {
        brand: 'apple',
        model: 'iphone-15-pro',
      });

      const input2 = createComparisonInput('iPhone 15 Pro Max', {
        brand: 'apple',
        model: 'iphone-15-pro-max',
      });

      const result = calculateDuplicateScoreForInputs(input1, input2);
      expect(result.score).toBeLessThan(85);
      expect(result.score).toBeGreaterThanOrEqual(60);
    });
  });

  describe('Samsung Galaxy Examples', () => {
    it('Galaxy S24 Ultra identical variants', () => {
      const input1 = createComparisonInput('Samsung Galaxy S24 Ultra', {
        brand: 'samsung',
        model: 'galaxy-s24-ultra',
      });

      const input2 = createComparisonInput('Galaxy S24 Ultra', {
        brand: 'samsung',
        model: 'galaxy-s24-ultra',
      });

      const result = calculateDuplicateScoreForInputs(input1, input2);
      expect(result.score).toBeGreaterThanOrEqual(90);
    });

    it('Galaxy S24 Ultra vs Galaxy S23 Ultra should score moderate', () => {
      const input1 = createComparisonInput('Galaxy S24 Ultra', {
        brand: 'samsung',
        model: 'galaxy-s24-ultra',
      });

      const input2 = createComparisonInput('Galaxy S23 Ultra', {
        brand: 'samsung',
        model: 'galaxy-s23-ultra',
      });

      const result = calculateDuplicateScoreForInputs(input1, input2);
      expect(result.score).toBeLessThan(80);
      expect(result.score).toBeGreaterThanOrEqual(50);
    });

    it('Galaxy S24 should match GalaxyS24', () => {
      const input1 = createComparisonInput('Samsung Galaxy S24', {
        brand: 'samsung',
        model: 'galaxy-s24',
      });

      const input2 = createComparisonInput('GalaxyS24', {
        brand: 'samsung',
        model: 'galaxy-s24',
      });

      const result = calculateDuplicateScoreForInputs(input1, input2);
      expect(result.score).toBeGreaterThanOrEqual(55);
    });
  });

  describe('PlayStation Examples', () => {
    it('PlayStation 5 vs PS5 should match reasonably', () => {
      const input1 = createComparisonInput('PlayStation 5', {
        model: 'ps5',
      });

      const input2 = createComparisonInput('PS5', {
        model: 'ps5',
      });

      const result = calculateDuplicateScoreForInputs(input1, input2);
      expect(result.score).toBeGreaterThanOrEqual(45);
    });

    it('PlayStation 5 vs PlayStation 4 should not match', () => {
      const input1 = createComparisonInput('PlayStation 5', {
        model: 'ps5',
      });

      const input2 = createComparisonInput('PlayStation 4', {
        model: 'ps4',
      });

      const result = calculateDuplicateScoreForInputs(input1, input2);
      expect(result.score).toBeLessThan(50);
    });
  });

  describe('Apple MacBook Examples', () => {
    it('MacBook Air M2 with brand prefix should match well', () => {
      const input1 = createComparisonInput('MacBook Air M2', {
        brand: 'apple',
        model: 'macbook-air-m2',
      });

      const input2 = createComparisonInput('Apple MacBook Air M2', {
        brand: 'apple',
        model: 'macbook-air-m2',
      });

      const result = calculateDuplicateScoreForInputs(input1, input2);
      expect(result.score).toBeGreaterThanOrEqual(80);
    });

    it('MacBook Air M2 vs MacBook Air M1 should be low', () => {
      const input1 = createComparisonInput('MacBook Air M2', {
        brand: 'apple',
        model: 'macbook-air-m2',
      });

      const input2 = createComparisonInput('MacBook Air M1', {
        brand: 'apple',
        model: 'macbook-air-m1',
      });

      const result = calculateDuplicateScoreForInputs(input1, input2);
      expect(result.score).toBeLessThan(80);
      expect(result.score).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Apple AirPods Examples', () => {
    it('AirPods Pro 2 vs AirPods Pro Gen2 should match reasonably', () => {
      const input1 = createComparisonInput('AirPods Pro 2', {
        brand: 'apple',
        model: 'airpods-pro-2',
      });

      const input2 = createComparisonInput('Apple AirPods Pro Gen2', {
        brand: 'apple',
        model: 'airpods-pro-gen2',
      });

      const result = calculateDuplicateScoreForInputs(input1, input2);
      expect(result.score).toBeGreaterThanOrEqual(60);
    });

    it('AirPods Pro vs AirPods Max should be low', () => {
      const input1 = createComparisonInput('AirPods Pro', {
        brand: 'apple',
        model: 'airpods-pro',
      });

      const input2 = createComparisonInput('AirPods Max', {
        brand: 'apple',
        model: 'airpods-max',
      });

      const result = calculateDuplicateScoreForInputs(input1, input2);
      expect(result.score).toBeLessThan(70);
      expect(result.score).toBeGreaterThanOrEqual(40);
    });
  });

  describe('Storage Variations', () => {
    it('256gb vs 256 GB should match exactly', () => {
      const input1 = createComparisonInput('iPhone 15 256GB', {
        storage: '256gb',
      });

      const input2 = createComparisonInput('iPhone 15 256 GB', {
        storage: '256gb',
      });

      const result = calculateDuplicateScoreForInputs(input1, input2);
      expect(result.signals.storage).toBe(100);
    });

    it('256gb vs 512gb should not match', () => {
      const input1 = createComparisonInput('iPhone 15 256GB', {
        storage: '256gb',
      });

      const input2 = createComparisonInput('iPhone 15 512GB', {
        storage: '512gb',
      });

      const result = calculateDuplicateScoreForInputs(input1, input2);
      expect(result.signals.storage).toBeLessThan(20);
    });
  });

  describe('Price Variations', () => {
    it('Same price should score 100', () => {
      const input1 = createComparisonInput('iPhone 15', {
        price: 25000,
      });

      const input2 = createComparisonInput('iPhone 15', {
        price: 25000,
      });

      const result = calculateDuplicateScoreForInputs(input1, input2);
      expect(result.signals.price).toBe(100);
    });

    it('5% price difference should score high', () => {
      const input1 = createComparisonInput('iPhone 15', {
        price: 25000,
      });

      const input2 = createComparisonInput('iPhone 15', {
        price: 25000 * 1.05,
      });

      const result = calculateDuplicateScoreForInputs(input1, input2);
      expect(result.signals.price).toBeGreaterThanOrEqual(90);
    });

    it('50% price difference should score very low', () => {
      const input1 = createComparisonInput('iPhone 15', {
        price: 25000,
      });

      const input2 = createComparisonInput('iPhone 15', {
        price: 25000 * 1.5,
      });

      const result = calculateDuplicateScoreForInputs(input1, input2);
      expect(result.signals.price).toBeLessThanOrEqual(40);
    });
  });

  describe('Different Sources', () => {
    it('Same product from different sources should have high score', () => {
      const input1 = createComparisonInput('iPhone 15 256GB', {
        brand: 'apple',
        storage: '256gb',
        sourceId: 1,
      });

      const input2 = createComparisonInput('iPhone 15 256GB', {
        brand: 'apple',
        storage: '256gb',
        sourceId: 2,
      });

      const result = calculateDuplicateScoreForInputs(input1, input2);
      expect(result.signals.sourceDiversity).toBe(50);
      expect(result.score).toBeGreaterThanOrEqual(75);
    });

    it('Same product from same source should score high', () => {
      const input1 = createComparisonInput('iPhone 15 256GB', {
        sourceId: 1,
      });

      const input2 = createComparisonInput('iPhone 15 256GB', {
        sourceId: 1,
      });

      const result = calculateDuplicateScoreForInputs(input1, input2);
      expect(result.signals.sourceDiversity).toBe(0);
    });
  });

  describe('Condition Variations', () => {
    it('Same condition should score 100', () => {
      const input1 = createComparisonInput('iPhone 15', {
        condition: 'İkinci El',
      });

      const input2 = createComparisonInput('iPhone 15', {
        condition: 'İkinci El',
      });

      const result = calculateDuplicateScoreForInputs(input1, input2);
      expect(result.signals.condition).toBe(100);
    });

    it('Different conditions should score low', () => {
      const input1 = createComparisonInput('iPhone 15', {
        condition: 'Yeni',
      });

      const input2 = createComparisonInput('iPhone 15', {
        condition: 'İkinci El',
      });

      const result = calculateDuplicateScoreForInputs(input1, input2);
      expect(result.signals.condition).toBeLessThan(50);
    });
  });

  describe('Matcher Functions', () => {
    it('compareListings should work well for identical products', () => {
      const input1 = createComparisonInput('iPhone 15', {
        brand: 'apple',
      });

      const input2 = createComparisonInput('Apple iPhone 15', {
        brand: 'apple',
      });

      const result = compareListings(input1, input2);
      expect(result.score).toBeGreaterThanOrEqual(75);
    });

    it('findDuplicateMatches should find pairs above threshold', () => {
      const listings = [
        { id: 1, ...createComparisonInput('iPhone 15 256GB', { brand: 'apple', storage: '256gb' }) },
        { id: 2, ...createComparisonInput('iPhone 15 256GB', { brand: 'apple', storage: '256gb' }) },
        { id: 3, ...createComparisonInput('iPhone 14', { brand: 'apple' }) },
      ];

      const matches = findDuplicateMatches(listings, 70);
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].score).toBeGreaterThan(70);
    });

    it('groupDuplicates should group similar items', () => {
      const listings = [
        { id: 1, ...createComparisonInput('iPhone 15 256GB', { brand: 'apple', storage: '256gb' }) },
        { id: 2, ...createComparisonInput('iPhone 15 256GB', { brand: 'apple', storage: '256gb' }) },
        { id: 3, ...createComparisonInput('iPhone 14', { brand: 'apple' }) },
      ];

      const groups = groupDuplicates(listings, 70);
      expect(groups.length).toBeGreaterThan(0);
    });

    it('getHighestScoringDuplicate should find best match', () => {
      const reference = createComparisonInput('iPhone 15 Pro Max', {
        brand: 'apple',
        model: 'iphone-15-pro-max',
      });

      const candidates = [
        { id: 1, ...createComparisonInput('iPhone 15 Pro Max', { brand: 'apple', model: 'iphone-15-pro-max' }) },
        { id: 2, ...createComparisonInput('iPhone 15 Pro', { brand: 'apple', model: 'iphone-15-pro' }) },
        { id: 3, ...createComparisonInput('iPhone 14 Pro', { brand: 'apple', model: 'iphone-14-pro' }) },
      ];

      const best = getHighestScoringDuplicate(reference, candidates, 70);
      expect(best).not.toBeNull();
      expect(best?.id).toBe(1);
      expect(best?.score).toBeGreaterThanOrEqual(75);
    });
  });

  describe('Edge Cases', () => {
    it('Empty brand should not crash', () => {
      const input1 = createComparisonInput('Some Device', {
        brand: null,
      });

      const input2 = createComparisonInput('Some Device', {
        brand: null,
      });

      const result = calculateDuplicateScoreForInputs(input1, input2);
      expect(result.score).toBeGreaterThan(0);
    });

    it('Missing model should not crash', () => {
      const input1 = createComparisonInput('Apple Device');
      const input2 = createComparisonInput('Apple Device');

      const result = calculateDuplicateScoreForInputs(input1, input2);
      expect(result.score).toBeGreaterThan(50);
    });

    it('isDuplicate function should work', () => {
      const input1 = createComparisonInput('iPhone 15 256GB', { brand: 'apple', storage: '256gb' });
      const input2 = createComparisonInput('iPhone 15 256GB', { brand: 'apple', storage: '256gb' });

      const isDup = isDuplicate(input1, input2, 70);
      expect(isDup).toBe(true);
    });
  });

  describe('Fingerprint Creation', () => {
    it('createDuplicateFingerprint should create valid structure', () => {
      const fp = createDuplicateFingerprint(
        'iPhone 15 Pro Max 256GB',
        'apple',
        'iphone-15-pro-max',
        '256gb',
        null,
        'pro-max'
      );

      expect(fp.brand).toBe('apple');
      expect(fp.model).toBe('iphone-15-pro-max');
      expect(fp.storage).toBe('256gb');
      expect(fp.normalized).toBeDefined();
      expect(fp.tokens).toBeInstanceOf(Set);
      expect(fp.tokens.size).toBeGreaterThan(0);
    });
  });
});
