// ═══════════════════════════════════════════════════════════════════
// charEdge — Import Dedup UI Integration Tests
// Validates that importFile() dedup works end-to-end via the options API.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the public importFile API with mock File objects
import { importFile } from '../../data/importExport/importFile.js';
import { tradeHash } from '../../charting_library/datafeed/csv.js';

// Helper: create a mock File from CSV text
function mockCSV(text, name = 'test.csv') {
  const blob = new Blob([text], { type: 'text/csv' });
  blob.name = name;
  blob.text = () => Promise.resolve(text);
  return blob;
}

function mockJSON(obj, name = 'test.json') {
  const text = JSON.stringify(obj);
  const blob = new Blob([text], { type: 'application/json' });
  blob.name = name;
  blob.text = () => Promise.resolve(text);
  return blob;
}

// Simple tradovate-style CSV for testing
const TRADOVATE_CSV = `B/S,Instrument,Qty,AvgFillPrice,FilledQty,PnL,Date
Buy,ESH5,1,5000,1,250.00,2025-06-15 10:30:00
Sell,NQH5,2,18000,2,-150.00,2025-06-15 11:00:00
Buy,ESH5,1,5100,1,100.00,2025-06-15 12:00:00`;

// ─── Dedup with existingTrades ─────────────────────────────────

describe('importFile — dedup via existingTrades', () => {
  it('skips duplicates when existingTrades are provided', async () => {
    // First import — no existing trades
    const file1 = mockCSV(TRADOVATE_CSV);
    const r1 = await importFile(file1);
    expect(r1.ok).toBe(true);
    expect(r1.trades.length).toBeGreaterThan(0);
    expect(r1.duplicates).toBe(0);

    // Second import — same file, but now pass first import's trades as existing
    const file2 = mockCSV(TRADOVATE_CSV);
    const r2 = await importFile(file2, { existingTrades: r1.trades });
    expect(r2.ok).toBe(true);
    expect(r2.duplicates).toBeGreaterThan(0);
    expect(r2.trades.length).toBeLessThan(r1.trades.length);
  });

  it('returns all trades when no existingTrades (import-all mode)', async () => {
    const file = mockCSV(TRADOVATE_CSV);
    const r = await importFile(file);
    expect(r.ok).toBe(true);
    expect(r.duplicates).toBe(0);
    expect(r.trades.length).toBeGreaterThan(0);
  });

  it('returns duplicates:0 when existingTrades is empty array', async () => {
    const file = mockCSV(TRADOVATE_CSV);
    const r = await importFile(file, { existingTrades: [] });
    expect(r.ok).toBe(true);
    expect(r.duplicates).toBe(0);
  });

  it('detects intra-file duplicates in CSV', async () => {
    const csv = `B/S,Instrument,Qty,AvgFillPrice,FilledQty,PnL,Date
Buy,ESH5,1,5000,1,250.00,2025-06-15 10:30:00
Buy,ESH5,1,5000,1,250.00,2025-06-15 10:30:00`;
    const file = mockCSV(csv);
    // Pass some existing trades so hash set is active
    const existing = [{ date: '2020-01-01T00:00:00.000Z', symbol: 'ZZZ', pnl: 0 }];
    const r = await importFile(file, { existingTrades: existing });
    expect(r.ok).toBe(true);
    // One of the two identical rows should be deduped
    expect(r.duplicates).toBe(1);
  });
});

// ─── Backwards compatibility ───────────────────────────────────

describe('importFile — backwards compatibility', () => {
  it('accepts string as second arg (forceBroker)', async () => {
    const csv = `B/S,Instrument,Qty,AvgFillPrice,FilledQty,PnL,Date
Buy,ESH5,1,5000,1,250.00,2025-06-15 10:30:00`;
    const file = mockCSV(csv);
    const r = await importFile(file, 'tradovate');
    expect(r.ok).toBe(true);
    expect(r.broker).toBe('tradovate');
  });

  it('works with no second arg', async () => {
    const file = mockCSV(TRADOVATE_CSV);
    const r = await importFile(file);
    expect(r.ok).toBe(true);
  });
});

// ─── JSON dedup ────────────────────────────────────────────────

describe('importFile — JSON dedup', () => {
  it('deduplicates JSON imports against existingTrades', async () => {
    const trades = [
      { date: '2025-06-15T10:30:00.000Z', symbol: 'BTCUSDT', pnl: 250.50, side: 'long', quantity: 1 },
      { date: '2025-06-16T11:00:00.000Z', symbol: 'ETHUSDT', pnl: -100, side: 'short', quantity: 2 },
    ];
    const file1 = mockJSON({ trades }, 'trades.json');
    const r1 = await importFile(file1);
    expect(r1.ok).toBe(true);
    expect(r1.trades.length).toBe(2);
    expect(r1.duplicates).toBe(0);

    // Re-import the same JSON with existing trades
    const file2 = mockJSON({ trades }, 'trades.json');
    const r2 = await importFile(file2, { existingTrades: r1.trades });
    expect(r2.ok).toBe(true);
    expect(r2.duplicates).toBe(2);
    expect(r2.trades.length).toBe(0);
  });
});

// ─── Dedup result shape ────────────────────────────────────────

describe('importFile — result shape', () => {
  it('always includes duplicates field in result', async () => {
    const file = mockCSV(TRADOVATE_CSV);
    const r = await importFile(file);
    expect(r).toHaveProperty('duplicates');
    expect(typeof r.duplicates).toBe('number');
  });

  it('includes count and brokerLabel', async () => {
    const file = mockCSV(TRADOVATE_CSV);
    const r = await importFile(file);
    expect(r).toHaveProperty('count');
    expect(r).toHaveProperty('brokerLabel');
    expect(typeof r.count).toBe('number');
    expect(typeof r.brokerLabel).toBe('string');
  });
});
