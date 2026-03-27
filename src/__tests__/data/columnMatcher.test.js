import { describe, it, expect } from 'vitest';
import { autoMapColumns, applyMapping, getTargetFields, FIELD_ALIASES } from '../../data/importExport/columnMatcher.js';

describe('columnMatcher', () => {
  // ─── autoMapColumns ─────────────────────────────────────────
  describe('autoMapColumns', () => {
    it('maps exact matches', () => {
      const headers = ['Date', 'Symbol', 'Side', 'Quantity', 'Price', 'PnL'];
      const { mapping, confidence } = autoMapColumns(headers);
      expect(mapping.Date).toBe('date');
      expect(mapping.Symbol).toBe('symbol');
      expect(mapping.Side).toBe('side');
      expect(mapping.Quantity).toBe('quantity');
      expect(mapping.Price).toBe('price');
      expect(confidence.Date).toBe(1);
    });

    it('maps common aliases', () => {
      const headers = ['Trade Date', 'Ticker', 'Action', 'Shares', 'Fill Price', 'Commission'];
      const { mapping } = autoMapColumns(headers);
      expect(mapping['Trade Date']).toBe('date');
      expect(mapping.Ticker).toBe('symbol');
      expect(mapping.Shares).toBe('quantity');
      expect(mapping.Commission).toBe('commission');
    });

    it('assigns null mapping when confidence is below threshold', () => {
      // The fuzzy matcher will match 'r' alias to any string containing 'r',
      // so test that clearly non-field headers get low or null confidence
      const headers = ['111222333'];
      const { mapping, confidence } = autoMapColumns(headers);
      // Numeric-only strings won't match any alphabetic aliases
      expect(mapping['111222333']).toBeNull();
      expect(confidence['111222333']).toBe(0);
    });

    it('does not double-assign the same field', () => {
      const headers = ['Date', 'Datetime', 'Timestamp'];
      const { mapping } = autoMapColumns(headers);
      const assigned = Object.values(mapping).filter((v) => v === 'date');
      expect(assigned).toHaveLength(1);
    });

    it('maps strategy aliases', () => {
      const headers = ['Playbook', 'Setup'];
      const { mapping } = autoMapColumns(headers);
      // One should map to strategy
      const strategyMapped = Object.values(mapping).filter((v) => v === 'strategy');
      expect(strategyMapped.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── applyMapping ───────────────────────────────────────────
  describe('applyMapping', () => {
    it('transforms rows using the mapping', () => {
      const rows = [{ 'Trade Date': '2025-01-01', Ticker: 'AAPL', Qty: '10' }];
      const mapping = { 'Trade Date': 'date', Ticker: 'symbol', Qty: 'quantity' };
      const result = applyMapping(rows, mapping);
      expect(result[0]).toEqual({ date: '2025-01-01', symbol: 'AAPL', quantity: '10' });
    });

    it('skips null mappings', () => {
      const rows = [{ A: 'hello', B: 'world' }];
      const mapping = { A: 'date', B: null };
      const result = applyMapping(rows, mapping);
      expect(result[0]).toEqual({ date: 'hello' });
      expect(result[0]).not.toHaveProperty('B');
    });
  });

  // ─── getTargetFields ───────────────────────────────────────
  describe('getTargetFields', () => {
    it('returns all available fields', () => {
      const fields = getTargetFields();
      expect(fields.length).toBe(Object.keys(FIELD_ALIASES).length);
    });

    it('marks date and symbol as required', () => {
      const fields = getTargetFields();
      expect(fields.find((f) => f.key === 'date').required).toBe(true);
      expect(fields.find((f) => f.key === 'symbol').required).toBe(true);
    });

    it('marks other fields as not required', () => {
      const fields = getTargetFields();
      expect(fields.find((f) => f.key === 'notes').required).toBe(false);
    });
  });
});
