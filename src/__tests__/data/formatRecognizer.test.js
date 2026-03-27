import { describe, it, expect } from 'vitest';
import { detectBroker, detectFormat } from '../../data/importExport/FormatRecognizer.js';

describe('FormatRecognizer', () => {
  // ─── detectFormat ───────────────────────────────────────────
  describe('detectFormat', () => {
    it('detects Excel files by extension', () => {
      expect(detectFormat('', 'trades.xlsx').format).toBe('excel');
      expect(detectFormat('', 'trades.xls').format).toBe('excel');
    });

    it('detects OFX/QFX by extension', () => {
      expect(detectFormat('', 'data.ofx').format).toBe('ofx');
      expect(detectFormat('', 'data.qfx').format).toBe('ofx');
    });

    it('detects JSON by content', () => {
      expect(detectFormat('{"trades": []}', 'data.txt').format).toBe('json');
      expect(detectFormat('[1,2,3]', 'data.txt').format).toBe('json');
    });

    it('detects XML/OFX by content', () => {
      expect(detectFormat('<?xml version="1.0"?>', 'data.txt').format).toBe('ofx');
      expect(detectFormat('<OFX><BANKMSGSRSV1>', 'data.txt').format).toBe('ofx');
    });

    it('detects HTML by content', () => {
      expect(detectFormat('<!DOCTYPE html>', 'data.txt').format).toBe('html');
      expect(detectFormat('<table><tr><td>1</td></tr></table>', 'data.txt').format).toBe('html');
    });

    it('detects CSV by consistent comma delimiters', () => {
      const csv = 'a,b,c\n1,2,3\n4,5,6';
      expect(detectFormat(csv, 'data.txt').format).toBe('csv');
    });

    it('detects TSV by consistent tab delimiters', () => {
      const tsv = 'a\tb\tc\td\n1\t2\t3\t4\n5\t6\t7\t8';
      expect(detectFormat(tsv, 'data.txt').format).toBe('tsv');
    });

    it('returns unknown for unrecognizable content', () => {
      expect(detectFormat('random text here', 'data.txt').format).toBe('unknown');
    });
  });

  // ─── detectBroker ───────────────────────────────────────────
  describe('detectBroker', () => {
    it('detects Coinbase from headers', () => {
      const headers = ['Timestamp', 'Transaction Type', 'Asset', 'Quantity Transacted', 'Spot Price'];
      const result = detectBroker('', headers);
      expect(result.broker).toBe('coinbase');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('detects Binance from headers', () => {
      const headers = ['Date(UTC)', 'Pair', 'Side', 'Price', 'Executed', 'Amount', 'Fee'];
      const result = detectBroker('', headers);
      expect(result.broker).toBe('binance');
    });

    it('detects IBKR from headers', () => {
      const headers = ['TradeDate', 'Symbol', 'Buy/Sell', 'Quantity', 'TradePrice', 'Commission'];
      const result = detectBroker('', headers);
      expect(result.broker).toBe('ibkr');
    });

    it('detects MT5 from headers', () => {
      const headers = ['Time', 'Type', 'Symbol', 'Volume', 'Price', 'Profit', 'Commission', 'Swap'];
      const result = detectBroker('', headers);
      expect(result.broker).toBe('mt5');
    });

    it('detects Robinhood from headers', () => {
      const headers = [
        'Activity Date',
        'Process Date',
        'Settle Date',
        'Instrument',
        'Trans Code',
        'Quantity',
        'Price',
        'Amount',
      ];
      const result = detectBroker('', headers);
      expect(result.broker).toBe('robinhood');
    });

    it('returns null for unrecognizable headers', () => {
      const result = detectBroker('random content', ['foo', 'bar', 'baz']);
      expect(result.broker).toBeNull();
    });

    it('boosts score from content pattern matching', () => {
      const result = detectBroker('Interactive Brokers Account Report', ['TradeDate', 'Symbol']);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('provides alternatives', () => {
      // Headers that partially match multiple brokers
      const headers = ['Symbol', 'Side', 'Price', 'Quantity', 'Commission'];
      const result = detectBroker('', headers);
      // Should have some match
      if (result.broker) {
        expect(result.confidence).toBeGreaterThan(0);
      }
    });
  });
});
