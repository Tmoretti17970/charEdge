import { describe, it, expect } from 'vitest';
import {
  CRYPTO_IDS,
  isCrypto,
  FUTURES_ROOTS,
  FOREX_PAIRS,
  getAssetClass,
  isFutures,
  isForex,
  toYahooSymbol,
} from '../../constants.js';

describe('Asset Constants', () => {
  // ─── CRYPTO_IDS ─────────────────────────────────────────────
  describe('CRYPTO_IDS', () => {
    it('contains major crypto IDs', () => {
      expect(CRYPTO_IDS.BTC).toBe('bitcoin');
      expect(CRYPTO_IDS.ETH).toBe('ethereum');
      expect(CRYPTO_IDS.SOL).toBe('solana');
    });

    it('has at least 40 entries', () => {
      expect(Object.keys(CRYPTO_IDS).length).toBeGreaterThanOrEqual(40);
    });
  });

  // ─── isCrypto ───────────────────────────────────────────────
  describe('isCrypto', () => {
    it('recognizes raw crypto symbols', () => {
      expect(isCrypto('BTC')).toBe(true);
      expect(isCrypto('ETH')).toBe(true);
      expect(isCrypto('SOL')).toBe(true);
    });

    it('recognizes USDT-suffixed pairs', () => {
      expect(isCrypto('BTCUSDT')).toBe(true);
      expect(isCrypto('ETHUSDT')).toBe(true);
    });

    it('recognizes USDC-suffixed pairs', () => {
      expect(isCrypto('BTCUSDC')).toBe(true);
    });

    it('returns false for non-crypto', () => {
      expect(isCrypto('AAPL')).toBe(false);
      expect(isCrypto('ES')).toBe(false);
      expect(isCrypto('EURUSD')).toBe(false);
    });

    it('handles null/undefined', () => {
      expect(isCrypto(null)).toBe(false);
      expect(isCrypto(undefined)).toBe(false);
      expect(isCrypto('')).toBe(false);
    });

    it('is case insensitive', () => {
      expect(isCrypto('btc')).toBe(true);
      expect(isCrypto('Btc')).toBe(true);
    });
  });

  // ─── FUTURES_ROOTS ──────────────────────────────────────────
  describe('FUTURES_ROOTS', () => {
    it('contains major futures contracts', () => {
      expect(FUTURES_ROOTS.has('ES')).toBe(true);
      expect(FUTURES_ROOTS.has('NQ')).toBe(true);
      expect(FUTURES_ROOTS.has('CL')).toBe(true);
      expect(FUTURES_ROOTS.has('GC')).toBe(true);
    });
  });

  // ─── isFutures ──────────────────────────────────────────────
  describe('isFutures', () => {
    it('recognizes raw futures roots', () => {
      expect(isFutures('ES')).toBe(true);
      expect(isFutures('NQ')).toBe(true);
    });

    it('recognizes Yahoo-style futures (=F)', () => {
      expect(isFutures('ES=F')).toBe(true);
      expect(isFutures('GC=F')).toBe(true);
    });

    it('recognizes contract codes', () => {
      expect(isFutures('ESH25')).toBe(true);
      expect(isFutures('CLZ24')).toBe(true);
    });

    it('returns false for non-futures', () => {
      expect(isFutures('AAPL')).toBe(false);
      expect(isFutures('BTC')).toBe(false);
    });

    it('handles null/empty', () => {
      expect(isFutures(null)).toBe(false);
      expect(isFutures('')).toBe(false);
    });
  });

  // ─── FOREX_PAIRS ────────────────────────────────────────────
  describe('FOREX_PAIRS', () => {
    it('contains major forex pairs', () => {
      expect(FOREX_PAIRS.has('EURUSD')).toBe(true);
      expect(FOREX_PAIRS.has('USDJPY')).toBe(true);
    });
  });

  // ─── isForex ────────────────────────────────────────────────
  describe('isForex', () => {
    it('recognizes forex pairs', () => {
      expect(isForex('EURUSD')).toBe(true);
      expect(isForex('GBPUSD')).toBe(true);
    });

    it('recognizes Yahoo-style forex (=X)', () => {
      expect(isForex('EURUSD=X')).toBe(true);
    });

    it('returns false for non-forex', () => {
      expect(isForex('AAPL')).toBe(false);
      expect(isForex('BTC')).toBe(false);
    });
  });

  // ─── getAssetClass ──────────────────────────────────────────
  describe('getAssetClass', () => {
    it('classifies crypto', () => {
      expect(getAssetClass('BTC')).toBe('crypto');
      expect(getAssetClass('BTCUSDT')).toBe('crypto');
    });

    it('classifies futures', () => {
      expect(getAssetClass('ES')).toBe('futures');
      expect(getAssetClass('NQ')).toBe('futures');
    });

    it('classifies forex', () => {
      expect(getAssetClass('EURUSD')).toBe('forex');
    });

    it('defaults to stock', () => {
      expect(getAssetClass('AAPL')).toBe('stock');
      expect(getAssetClass('MSFT')).toBe('stock');
    });
  });

  // ─── toYahooSymbol ──────────────────────────────────────────
  describe('toYahooSymbol', () => {
    it('converts futures to Yahoo format', () => {
      expect(toYahooSymbol('ES')).toBe('ES=F');
      expect(toYahooSymbol('GC')).toBe('GC=F');
    });

    it('converts forex to Yahoo format', () => {
      expect(toYahooSymbol('EURUSD')).toBe('EURUSD=X');
    });

    it('leaves stocks unchanged', () => {
      expect(toYahooSymbol('AAPL')).toBe('AAPL');
    });

    it('does not double-convert', () => {
      expect(toYahooSymbol('ES=F')).toBe('ES=F');
      expect(toYahooSymbol('EURUSD=X')).toBe('EURUSD=X');
    });
  });
});
