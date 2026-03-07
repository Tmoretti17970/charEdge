// ═══════════════════════════════════════════════════════════════════
// charEdge — SecurityMaster Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityMaster } from '../../data/SecurityMaster.ts';

describe('SecurityMaster', () => {
  let sm;

  beforeEach(() => {
    sm = new SecurityMaster();
  });

  describe('normalize', () => {
    it('should normalize BTC variants to BTCUSDT', () => {
      expect(sm.normalize('BTC/USDT')).toBe('BTCUSDT');
      expect(sm.normalize('BTC-USDT')).toBe('BTCUSDT');
      expect(sm.normalize('btcusdt')).toBe('BTCUSDT');
      expect(sm.normalize('BTC-USD')).toBe('BTCUSDT');
      expect(sm.normalize('XBTUSD')).toBe('BTCUSDT');
    });

    it('should normalize ETH variants', () => {
      expect(sm.normalize('ETH/USDT')).toBe('ETHUSDT');
      expect(sm.normalize('eth-usd')).toBe('ETHUSDT');
      expect(sm.normalize('ETHUSD')).toBe('ETHUSDT');
    });

    it('should handle empty input', () => {
      expect(sm.normalize('')).toBe('');
    });

    it('should strip separators', () => {
      expect(sm.normalize('BTC / USDT')).toBe('BTCUSDT');
      expect(sm.normalize('BTC_USDT')).toBe('BTCUSDT');
      expect(sm.normalize('BTC.USDT')).toBe('BTCUSDT');
    });

    it('should be case-insensitive', () => {
      expect(sm.normalize('btcusdt')).toBe(sm.normalize('BTCUSDT'));
    });
  });

  describe('resolve', () => {
    it('should return full info for known crypto pair', () => {
      const info = sm.resolve('BTC/USDT');
      expect(info).not.toBeNull();
      expect(info.id).toBe('BTCUSDT');
      expect(info.baseAsset).toBe('BTC');
      expect(info.quoteAsset).toBe('USDT');
      expect(info.type).toBe('crypto');
      expect(info.displayName).toBe('Bitcoin');
    });

    it('should resolve forex pairs', () => {
      const info = sm.resolve('EUR/USD');
      expect(info).not.toBeNull();
      expect(info.type).toBe('forex');
      expect(info.baseAsset).toBe('EUR');
    });

    it('should resolve indices', () => {
      const info = sm.resolve('S&P500');
      expect(info).not.toBeNull();
      expect(info.type).toBe('index');
      expect(info.id).toBe('SPX');
    });

    it('should resolve commodities', () => {
      const info = sm.resolve('GOLD');
      expect(info).not.toBeNull();
      expect(info.type).toBe('commodity');
      expect(info.id).toBe('XAUUSD');
    });

    it('should return null for unknown symbol', () => {
      expect(sm.resolve('UNKNOWN_SYMBOL_XYZ')).toBeNull();
    });
  });

  describe('register', () => {
    it('should register custom instruments', () => {
      sm.register('TSLA', ['Tesla', 'TSLA.US'], {
        baseAsset: 'TSLA',
        quoteAsset: 'USD',
        type: 'equity',
        exchange: 'NASDAQ',
        displayName: 'Tesla Inc.',
      });

      const info = sm.resolve('Tesla');
      expect(info).not.toBeNull();
      expect(info.id).toBe('TSLA');
      expect(info.type).toBe('equity');
    });

    it('should allow aliases for registered instruments', () => {
      sm.register('CUSTOM', ['alias1', 'alias2'], {
        baseAsset: 'CUS',
        quoteAsset: 'USD',
        type: 'equity',
      });

      expect(sm.normalize('alias1')).toBe('CUSTOM');
      expect(sm.normalize('alias2')).toBe('CUSTOM');
    });
  });

  describe('getType', () => {
    it('should return type for known instruments', () => {
      expect(sm.getType('BTCUSDT')).toBe('crypto');
      expect(sm.getType('EUR/USD')).toBe('forex');
      expect(sm.getType('GOLD')).toBe('commodity');
    });

    it('should return null for unknown instruments', () => {
      expect(sm.getType('UNKNOWN')).toBeNull();
    });
  });

  describe('isKnown', () => {
    it('should return true for known instruments', () => {
      expect(sm.isKnown('BTC/USDT')).toBe(true);
      expect(sm.isKnown('ETHUSDT')).toBe(true);
    });

    it('should return false for unknown instruments', () => {
      expect(sm.isKnown('NONEXISTENT')).toBe(false);
    });
  });

  describe('getByType', () => {
    it('should return all crypto instruments', () => {
      const cryptos = sm.getByType('crypto');
      expect(cryptos.length).toBeGreaterThan(20);
      expect(cryptos.every(c => c.type === 'crypto')).toBe(true);
    });

    it('should return all forex instruments', () => {
      const forex = sm.getByType('forex');
      expect(forex.length).toBe(7);
    });
  });

  describe('count', () => {
    it('should return total registered instruments', () => {
      expect(sm.count).toBeGreaterThan(30);
    });
  });

  describe('getAllIds', () => {
    it('should return all canonical IDs', () => {
      const ids = sm.getAllIds();
      expect(ids).toContain('BTCUSDT');
      expect(ids).toContain('EURUSD');
      expect(ids).toContain('SPX');
      expect(ids).toContain('XAUUSD');
    });
  });

  describe('cross-exchange resolution', () => {
    it('should resolve Polygon-style to Binance-style', () => {
      const id = sm.normalize('MATIC/USDT');
      expect(id).toBe('MATICUSDT');
    });

    it('should resolve MATIC alias POL', () => {
      const info = sm.resolve('POL/USDT');
      expect(info).not.toBeNull();
      expect(info.id).toBe('MATICUSDT');
    });
  });
});
