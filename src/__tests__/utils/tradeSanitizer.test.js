// ═══════════════════════════════════════════════════════════════════
// charEdge — Trade Sanitizer Unit Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { sanitizeStrategy, getAssetIcon } from '@/trading/tradeSanitizer.js';

describe('sanitizeStrategy', () => {
    it('should return "—" for null/undefined/empty', () => {
        expect(sanitizeStrategy(null)).toBe('—');
        expect(sanitizeStrategy(undefined)).toBe('—');
        expect(sanitizeStrategy('')).toBe('—');
        expect(sanitizeStrategy('   ')).toBe('—');
    });

    it('should leave clean strategy strings unchanged', () => {
        expect(sanitizeStrategy('BTC LONG Mean Reversion')).toBe('BTC LONG Mean Reversion');
        expect(sanitizeStrategy('Breakout Momentum')).toBe('Breakout Momentum');
    });

    it('should clean SOLE.LOG patterns', () => {
        const result = sanitizeStrategy("SOLE.LOG('SUCCESS: order filled')");
        expect(result).toBe('⚙️ API Execution');
    });

    it('should clean DEBUG log patterns', () => {
        expect(sanitizeStrategy('DEBUG: processing order #1234')).toBe('⚙️ System Event');
    });

    it('should clean ERROR patterns', () => {
        expect(sanitizeStrategy('ERROR: connection timeout')).toBe('⚠️ Error Event');
    });

    it('should replace null/undefined/NaN strings', () => {
        expect(sanitizeStrategy('null')).toBe('—');
        expect(sanitizeStrategy('undefined')).toBe('—');
        expect(sanitizeStrategy('NaN')).toBe('—');
    });

    it('should replace underscores with spaces', () => {
        expect(sanitizeStrategy('mean_reversion_v2')).toBe('mean reversion v2');
    });
});

describe('getAssetIcon', () => {
    it('should return ₿ for crypto symbols', () => {
        expect(getAssetIcon('BTC')).toBe('₿');
        expect(getAssetIcon('ETH')).toBe('₿');
        expect(getAssetIcon('SOL')).toBe('₿');
    });

    it('should return $ for equity symbols', () => {
        expect(getAssetIcon('AAPL')).toBe('$');
        expect(getAssetIcon('TSLA')).toBe('$');
        expect(getAssetIcon('MSFT')).toBe('$');
    });

    it('should return 📦 for futures symbols', () => {
        expect(getAssetIcon('ES')).toBe('📦');
        expect(getAssetIcon('NQ')).toBe('📦');
        expect(getAssetIcon('MES')).toBe('📦');
        expect(getAssetIcon('MNQ')).toBe('📦');
    });

    it('should return 💱 for forex pairs', () => {
        expect(getAssetIcon('EUR/USD')).toBe('💱');
        expect(getAssetIcon('EURUSD')).toBe('💱');
    });

    it('should handle USDT/PERP suffixes on crypto', () => {
        expect(getAssetIcon('BTCUSDT')).toBe('₿');
        expect(getAssetIcon('ETHPERP')).toBe('₿');
    });

    it('should return default icon for null/undefined', () => {
        expect(getAssetIcon(null)).toBe('📊');
        expect(getAssetIcon(undefined)).toBe('📊');
    });
});
