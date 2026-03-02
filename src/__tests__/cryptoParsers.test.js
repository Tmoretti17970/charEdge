// ═══════════════════════════════════════════════════════════════════
// charEdge — H2.1 Crypto Broker Parsers & Import Dedup Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';

// Parsers
import { parseBinance } from '../data/importExport/parsers/binance.js';
import { parseCoinbase } from '../data/importExport/parsers/coinbase.js';
import { parseKraken } from '../data/importExport/parsers/kraken.js';
import { parseBybit } from '../data/importExport/parsers/bybit.js';
import { parseFidelity } from '../data/importExport/parsers/fidelity.js';

// Detection
import { detectBroker, BROKER_PARSERS, BROKER_LABELS } from '../data/importExport/brokerDetection.js';

// Dedup
import { tradeHash } from '../charting_library/datafeed/csv.js';

// ─── Binance Parser ──────────────────────────────────────────────

describe('parseBinance', () => {
  it('parses a standard Binance spot trade CSV row', () => {
    const rows = [{
      'Date(UTC)': '2025-06-15 10:30:00',
      'Pair': 'BTCUSDT',
      'Side': 'BUY',
      'Price': '65000.50',
      'Executed': '0.015',
      'Amount': '975.0075',
      'Fee': '0.975',
      'Fee Coin': 'USDT',
    }];
    const result = parseBinance(rows);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('BTCUSDT');
    expect(result[0].side).toBe('long');
    expect(result[0].entry).toBeCloseTo(65000.50);
    expect(result[0].quantity).toBeCloseTo(0.015);
    expect(result[0].fees).toBeCloseTo(0.975);
    expect(result[0].assetClass).toBe('crypto');
    expect(result[0].date).toBeTruthy();
  });

  it('handles SELL side', () => {
    const rows = [{
      'Date(UTC)': '2025-06-15 11:00:00',
      'Pair': 'ETHUSDT',
      'Side': 'SELL',
      'Price': '3500',
      'Executed': '1.5',
      'Amount': '5250',
      'Fee': '5.25',
      'Fee Coin': 'USDT',
    }];
    const result = parseBinance(rows);
    expect(result[0].side).toBe('short');
    expect(result[0].symbol).toBe('ETHUSDT');
  });

  it('skips rows with no pair', () => {
    const rows = [{ 'Date(UTC)': '2025-06-15', 'Pair': '', 'Side': 'BUY', 'Price': '100' }];
    expect(parseBinance(rows)).toHaveLength(0);
  });

  it('skips rows with no side', () => {
    const rows = [{ 'Date(UTC)': '2025-06-15', 'Pair': 'BTCUSDT', 'Side': '', 'Price': '100' }];
    expect(parseBinance(rows)).toHaveLength(0);
  });
});

// ─── Coinbase Parser ─────────────────────────────────────────────

describe('parseCoinbase', () => {
  it('parses a standard Coinbase transaction', () => {
    const rows = [{
      'Timestamp': '2025-06-15T10:30:00Z',
      'Transaction Type': 'Buy',
      'Asset': 'BTC',
      'Quantity Transacted': '0.5',
      'Spot Price at Transaction': '65000',
      'Fees and/or Spread': '15.00',
      'Total (inclusive of fees and/or spread)': '32515',
      'Price Currency': 'USD',
      'Notes': 'Bought Bitcoin',
    }];
    const result = parseCoinbase(rows);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('BTC');
    expect(result[0].side).toBe('long');
    expect(result[0].entry).toBeCloseTo(65000);
    expect(result[0].quantity).toBeCloseTo(0.5);
    expect(result[0].fees).toBeCloseTo(15);
    expect(result[0].assetClass).toBe('crypto');
  });

  it('handles Sell transaction', () => {
    const rows = [{
      'Timestamp': '2025-06-15T11:00:00Z',
      'Transaction Type': 'Sell',
      'Asset': 'ETH',
      'Quantity Transacted': '2',
      'Spot Price at Transaction': '3500',
      'Fees and/or Spread': '10',
      'Price Currency': 'USD',
    }];
    const result = parseCoinbase(rows);
    expect(result[0].side).toBe('short');
    expect(result[0].symbol).toBe('ETH');
  });

  it('skips non-trade types like "Receive" or "Send"', () => {
    const rows = [{
      'Timestamp': '2025-06-15',
      'Transaction Type': 'Receive',
      'Asset': 'BTC',
      'Quantity Transacted': '0.1',
    }];
    expect(parseCoinbase(rows)).toHaveLength(0);
  });
});

// ─── Kraken Parser ───────────────────────────────────────────────

describe('parseKraken', () => {
  it('parses a standard Kraken trades row', () => {
    const rows = [{
      'txid': 'ABCDEF-12345-GHIJKL',
      'ordertxid': 'ORDER-12345',
      'pair': 'XXBTZUSD',
      'time': '2025-06-15 10:30:00',
      'type': 'buy',
      'ordertype': 'limit',
      'price': '65000.00',
      'cost': '975.00',
      'fee': '1.50',
      'vol': '0.015',
    }];
    const result = parseKraken(rows);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('BTCUSD'); // XXBTZUSD normalized
    expect(result[0].side).toBe('long');
    expect(result[0].entry).toBeCloseTo(65000);
    expect(result[0].quantity).toBeCloseTo(0.015);
    expect(result[0].fees).toBeCloseTo(1.50);
    expect(result[0].assetClass).toBe('crypto');
  });

  it('normalizes Kraken pair: XETHZUSD → ETHUSD', () => {
    const rows = [{
      'txid': 'TX1',
      'pair': 'XETHZUSD',
      'time': '2025-06-15',
      'type': 'sell',
      'price': '3500',
      'vol': '2',
      'fee': '0.5',
    }];
    const result = parseKraken(rows);
    expect(result[0].symbol).toBe('ETHUSD');
    expect(result[0].side).toBe('short');
  });

  it('skips rows with non-trade type', () => {
    const rows = [{
      'txid': 'TX1',
      'pair': 'XXBTZUSD',
      'time': '2025-06-15',
      'type': 'deposit',
      'price': '65000',
      'vol': '1',
    }];
    expect(parseKraken(rows)).toHaveLength(0);
  });
});

// ─── Bybit Parser ────────────────────────────────────────────────

describe('parseBybit', () => {
  it('parses a standard Bybit spot trade row', () => {
    const rows = [{
      'Order Id': 'ORD-12345',
      'Symbol': 'BTCUSDT',
      'Side': 'Buy',
      'Fill Price': '65000',
      'Filled': '0.015',
      'Fee': '0.975',
      'Exec Time': '2025-06-15 10:30:00',
    }];
    const result = parseBybit(rows);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('BTCUSDT');
    expect(result[0].side).toBe('long');
    expect(result[0].entry).toBeCloseTo(65000);
    expect(result[0].quantity).toBeCloseTo(0.015);
    expect(result[0].fees).toBeCloseTo(0.975);
    expect(result[0].assetClass).toBe('crypto');
  });

  it('normalizes quarterly futures: BTCUSD0927 → BTCUSD', () => {
    const rows = [{
      'Order Id': 'ORD-1',
      'Symbol': 'BTCUSD0927',
      'Side': 'Buy',
      'Fill Price': '65000',
      'Filled': '100',
      'Exec Time': '2025-06-15',
    }];
    const result = parseBybit(rows);
    expect(result[0].symbol).toBe('BTCUSD');
  });

  it('handles derivatives with PnL', () => {
    const rows = [{
      'Symbol': 'ETHUSDT',
      'Side': 'Sell',
      'Fill Price': '3500',
      'Filled': '5',
      'Fee': '2.00',
      'Closed PnL': '150.50',
      'Exec Time': '2025-06-15',
    }];
    const result = parseBybit(rows);
    expect(result[0].pnl).toBeCloseTo(150.50);
    expect(result[0].side).toBe('short');
  });
});

// ─── Fidelity Parser ─────────────────────────────────────────────

describe('parseFidelity', () => {
  it('parses a standard Fidelity buy', () => {
    const rows = [{
      'Run Date': '06/15/2025',
      'Account': 'XXX-123456',
      'Action': 'YOU BOUGHT',
      'Symbol': 'AAPL',
      'Description': 'APPLE INC',
      'Type': 'Cash',
      'Quantity': '10',
      'Price ($)': '195.50',
      'Commission ($)': '0',
      'Fees ($)': '0.02',
      'Amount ($)': '-1955.02',
    }];
    const result = parseFidelity(rows);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('AAPL');
    expect(result[0].side).toBe('long');
    expect(result[0].entry).toBeCloseTo(195.50);
    expect(result[0].quantity).toBe(10);
    expect(result[0].fees).toBeCloseTo(0.02);
    expect(result[0].assetClass).toBe('stock');
  });

  it('parses a Fidelity sell', () => {
    const rows = [{
      'Run Date': '06/16/2025',
      'Action': 'YOU SOLD',
      'Symbol': 'MSFT',
      'Description': 'MICROSOFT',
      'Quantity': '5',
      'Price ($)': '430',
      'Commission ($)': '0',
      'Fees ($)': '0.01',
      'Amount ($)': '2149.99',
    }];
    const result = parseFidelity(rows);
    expect(result[0].side).toBe('short');
    expect(result[0].symbol).toBe('MSFT');
  });

  it('skips non-trade actions like DIVIDEND', () => {
    const rows = [{
      'Run Date': '06/15/2025',
      'Action': 'DIVIDEND RECEIVED',
      'Symbol': 'AAPL',
      'Quantity': '',
      'Amount ($)': '5.00',
    }];
    expect(parseFidelity(rows)).toHaveLength(0);
  });

  it('skips "PENDING ACTIVITY" symbol', () => {
    const rows = [{
      'Run Date': '06/15/2025',
      'Action': 'YOU BOUGHT',
      'Symbol': 'PENDING ACTIVITY',
      'Quantity': '10',
      'Price ($)': '100',
    }];
    expect(parseFidelity(rows)).toHaveLength(0);
  });
});

// ─── Broker Detection ────────────────────────────────────────────

describe('Broker Detection — H2.1', () => {
  it('detects Binance from headers', () => {
    expect(detectBroker(['Date(UTC)', 'Pair', 'Side', 'Price', 'Executed', 'Amount', 'Fee', 'Fee Coin'])).toBe('binance');
  });

  it('detects Coinbase from headers', () => {
    expect(detectBroker(['Timestamp', 'Transaction Type', 'Asset', 'Quantity Transacted', 'Spot Price at Transaction', 'Fees and/or Spread'])).toBe('coinbase');
  });

  it('detects Kraken from headers', () => {
    expect(detectBroker(['txid', 'ordertxid', 'pair', 'time', 'type', 'price', 'vol', 'fee'])).toBe('kraken');
  });

  it('detects Bybit from headers', () => {
    expect(detectBroker(['Order Id', 'Symbol', 'Side', 'Fill Price', 'Qty', 'Fee', 'Exec Time'])).toBe('bybit');
  });

  it('detects Fidelity from headers', () => {
    expect(detectBroker(['Run Date', 'Account', 'Action', 'Symbol', 'Description', 'Quantity', 'Price ($)', 'Amount ($)'])).toBe('fidelity');
  });

  it('all 5 new brokers have BROKER_PARSERS entries', () => {
    expect(typeof BROKER_PARSERS.binance).toBe('function');
    expect(typeof BROKER_PARSERS.coinbase).toBe('function');
    expect(typeof BROKER_PARSERS.kraken).toBe('function');
    expect(typeof BROKER_PARSERS.bybit).toBe('function');
    expect(typeof BROKER_PARSERS.fidelity).toBe('function');
  });

  it('all 5 new brokers have BROKER_LABELS entries', () => {
    expect(BROKER_LABELS.binance).toBe('Binance');
    expect(BROKER_LABELS.coinbase).toBe('Coinbase');
    expect(BROKER_LABELS.kraken).toBe('Kraken');
    expect(BROKER_LABELS.bybit).toBe('Bybit');
    expect(BROKER_LABELS.fidelity).toBe('Fidelity');
  });

  it('existing broker detection still works (regression)', () => {
    expect(detectBroker(['B/S', 'Instrument', 'AvgFillPrice', 'FilledQty'])).toBe('tradovate');
    expect(detectBroker(['Entry Price', 'Exit Price', 'Instrument', 'Quantity'])).toBe('ninjatrader');
    expect(detectBroker(['Trans Code', 'Instrument', 'ActivityDate'])).toBe('robinhood');
  });
});

// ─── Import Dedup via tradeHash ──────────────────────────────────

describe('Import Dedup — tradeHash integration', () => {
  it('produces consistent hashes for identical trades', () => {
    const t = { date: '2025-06-15T10:30:00.000Z', symbol: 'BTCUSDT', pnl: 250.50 };
    expect(tradeHash(t)).toBe(tradeHash(t));
  });

  it('produces different hashes for different symbols', () => {
    const t1 = { date: '2025-06-15T10:30:00.000Z', symbol: 'BTCUSDT', pnl: 250 };
    const t2 = { date: '2025-06-15T10:30:00.000Z', symbol: 'ETHUSDT', pnl: 250 };
    expect(tradeHash(t1)).not.toBe(tradeHash(t2));
  });

  it('produces different hashes for different dates', () => {
    const t1 = { date: '2025-06-15T10:30:00.000Z', symbol: 'BTCUSDT', pnl: 250 };
    const t2 = { date: '2025-06-16T10:30:00.000Z', symbol: 'BTCUSDT', pnl: 250 };
    expect(tradeHash(t1)).not.toBe(tradeHash(t2));
  });

  it('produces same hash regardless of extra fields', () => {
    const t1 = { date: '2025-06-15T10:30:00.000Z', symbol: 'BTCUSDT', pnl: 250, notes: 'first' };
    const t2 = { date: '2025-06-15T10:30:00.000Z', symbol: 'BTCUSDT', pnl: 250, notes: 'second' };
    expect(tradeHash(t1)).toBe(tradeHash(t2));
  });
});

// ─── Parser Count ────────────────────────────────────────────────

describe('Parser Count', () => {
  it('has 15 total broker parsers registered', () => {
    expect(Object.keys(BROKER_PARSERS)).toHaveLength(15);
  });

  it('has 15 total broker labels registered', () => {
    expect(Object.keys(BROKER_LABELS)).toHaveLength(15);
  });
});
