import { describe, it, expect } from 'vitest';
import { exportCSV, exportJSON, TRADE_FIELDS } from '../../data/importExport/exportTrades.js';

describe('exportTrades', () => {
  const trades = [
    { id: '1', date: '2025-01-02', symbol: 'AAPL', side: 'buy', entry: 150, quantity: 10, pnl: 200, tags: ['tech'] },
    {
      id: '2',
      date: '2025-01-01',
      symbol: 'MSFT',
      side: 'sell',
      entry: 350,
      quantity: 5,
      pnl: -100,
      notes: 'Bad trade, regret',
    },
  ];

  // ─── TRADE_FIELDS ───────────────────────────────────────────
  describe('TRADE_FIELDS', () => {
    it('contains expected fields', () => {
      expect(TRADE_FIELDS).toContain('id');
      expect(TRADE_FIELDS).toContain('date');
      expect(TRADE_FIELDS).toContain('symbol');
      expect(TRADE_FIELDS).toContain('pnl');
    });
  });

  // ─── exportCSV ──────────────────────────────────────────────
  describe('exportCSV', () => {
    it('generates valid CSV with headers', () => {
      const csv = exportCSV(trades);
      const lines = csv.split('\n');
      expect(lines[0]).toBe(TRADE_FIELDS.join(','));
      expect(lines.length).toBe(3); // header + 2 data rows
    });

    it('sorts by date', () => {
      const csv = exportCSV(trades);
      const lines = csv.split('\n');
      // First data row should be 2025-01-01 (MSFT)
      expect(lines[1]).toContain('MSFT');
    });

    it('escapes commas in values', () => {
      const tradesWithComma = [{ ...trades[1], notes: 'Bad trade, regret' }];
      const csv = exportCSV(tradesWithComma);
      expect(csv).toContain('"Bad trade, regret"');
    });

    it('escapes quotes in values', () => {
      const tradesWithQuote = [{ ...trades[0], notes: 'He said "buy"' }];
      const csv = exportCSV(tradesWithQuote);
      expect(csv).toContain('""buy""');
    });

    it('handles array values (tags)', () => {
      const csv = exportCSV(trades);
      expect(csv).toContain('"tech"');
    });

    it('handles null values', () => {
      const csv = exportCSV([{ id: '1', date: '2025-01-01' }]);
      expect(csv).toBeDefined();
    });

    it('filters by date range', () => {
      const csv = exportCSV(trades, { dateFrom: '2025-01-02', dateTo: '2025-01-02' });
      const lines = csv.split('\n');
      expect(lines.length).toBe(2); // header + 1 matching row
    });

    it('uses custom fields', () => {
      const csv = exportCSV(trades, { fields: ['symbol', 'pnl'] });
      const lines = csv.split('\n');
      expect(lines[0]).toBe('symbol,pnl');
    });
  });

  // ─── exportJSON ─────────────────────────────────────────────
  describe('exportJSON', () => {
    it('generates valid JSON', () => {
      const json = exportJSON(trades);
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe('charEdge-v10');
      expect(parsed.tradeCount).toBe(2);
      expect(parsed.trades).toHaveLength(2);
      expect(parsed.exportedAt).toBeDefined();
    });

    it('sorts by date', () => {
      const json = exportJSON(trades);
      const parsed = JSON.parse(json);
      expect(parsed.trades[0].symbol).toBe('MSFT'); // 2025-01-01 comes first
    });

    it('filters by date range', () => {
      const json = exportJSON(trades, { dateFrom: '2025-01-02' });
      const parsed = JSON.parse(json);
      expect(parsed.tradeCount).toBe(1);
    });

    it('pretty prints by default', () => {
      const json = exportJSON(trades);
      expect(json).toContain('\n');
    });

    it('supports compact mode', () => {
      const json = exportJSON(trades, { pretty: false });
      expect(json.includes('\n')).toBe(false);
    });
  });
});
