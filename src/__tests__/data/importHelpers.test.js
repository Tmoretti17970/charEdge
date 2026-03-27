import { describe, it, expect } from 'vitest';
import { _uid, _parseNum, _parseDate } from '../../data/importExport/helpers.js';

describe('Import/Export Helpers', () => {
  // ─── _uid ───────────────────────────────────────────────────
  describe('_uid', () => {
    it('generates a string ID', () => {
      const id = _uid();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(5);
    });

    it('generates unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => _uid()));
      expect(ids.size).toBe(100);
    });
  });

  // ─── _parseNum ──────────────────────────────────────────────
  describe('_parseNum', () => {
    it('parses plain numbers', () => {
      expect(_parseNum('42')).toBe(42);
      expect(_parseNum('3.14')).toBeCloseTo(3.14);
    });

    it('strips dollar signs and commas', () => {
      expect(_parseNum('$1,234.56')).toBeCloseTo(1234.56);
      expect(_parseNum('$100')).toBe(100);
    });

    it('strips parentheses from accounting format', () => {
      // _parseNum strips parens but doesn't negate — parseFloat handles the value
      const result = _parseNum('(500)');
      expect(result).toBe(500); // parens stripped, parsed as 500
    });

    it('returns null for null/undefined/empty', () => {
      expect(_parseNum(null)).toBeNull();
      expect(_parseNum(undefined)).toBeNull();
      expect(_parseNum('')).toBeNull();
    });

    it('returns null for non-numeric strings', () => {
      expect(_parseNum('abc')).toBeNull();
      expect(_parseNum('N/A')).toBeNull();
    });

    it('handles negative numbers', () => {
      expect(_parseNum('-42.5')).toBeCloseTo(-42.5);
    });

    it('handles whitespace', () => {
      expect(_parseNum('  100  ')).toBe(100);
    });
  });

  // ─── _parseDate ─────────────────────────────────────────────
  describe('_parseDate', () => {
    it('parses ISO date strings', () => {
      const result = _parseDate('2025-01-15T10:30:00Z');
      expect(result).toBeDefined();
      expect(result).toContain('2025-01-15');
    });

    it('parses simple date strings', () => {
      const result = _parseDate('2025-01-15');
      expect(result).toBeDefined();
    });

    it('returns ISO format', () => {
      const result = _parseDate('2025-06-15');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('returns null for null/empty', () => {
      expect(_parseDate(null)).toBeNull();
      expect(_parseDate('')).toBeNull();
      expect(_parseDate(undefined)).toBeNull();
    });

    it('returns null for invalid dates', () => {
      expect(_parseDate('not a date')).toBeNull();
    });
  });
});
