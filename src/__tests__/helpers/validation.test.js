// ═══════════════════════════════════════════════════════════════════
// Input Validation — Unit Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { validateBars, validateProps, validateIndicators } from '../../charting_library/core/validateBars.js';
import { ChartError, ERROR_CODES } from '../../charting_library/core/ChartError.js';

// ═══════════════════════════════════════════════════════════════════
// validateBars
// ═══════════════════════════════════════════════════════════════════

describe('validateBars', () => {
  const validBar = (time = 1000) => ({
    open: 100, high: 110, low: 90, close: 105, time, volume: 1000,
  });

  it('accepts valid OHLCV bars', () => {
    const bars = [validBar(1000), validBar(2000), validBar(3000)];
    const result = validateBars(bars);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts empty array', () => {
    const result = validateBars([]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects non-array input', () => {
    const result = validateBars('not an array');
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe(ERROR_CODES.INVALID_BAR_DATA);
  });

  it('detects missing required field (close)', () => {
    const bars = [{ open: 100, high: 110, low: 90, time: 1000 }];
    const result = validateBars(bars);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e =>
      e.code === ERROR_CODES.INVALID_BAR_DATA && e.context.field === 'close'
    )).toBe(true);
  });

  it('detects NaN in high field', () => {
    const bars = [{ open: 100, high: NaN, low: 90, close: 105, time: 1000 }];
    const result = validateBars(bars);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e =>
      e.code === ERROR_CODES.INVALID_BAR_DATA && e.context.field === 'high'
    )).toBe(true);
  });

  it('detects non-numeric values', () => {
    const bars = [{ open: 'abc', high: 110, low: 90, close: 105, time: 1000 }];
    const result = validateBars(bars);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.context.field === 'open')).toBe(true);
  });

  it('detects unordered timestamps', () => {
    const bars = [validBar(2000), validBar(1000)]; // reversed
    const result = validateBars(bars);
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe(ERROR_CODES.UNORDERED_TIME);
  });

  it('accepts bars without volume (volume is optional)', () => {
    const bars = [
      { open: 100, high: 110, low: 90, close: 105, time: 1000 },
      { open: 105, high: 115, low: 95, close: 110, time: 2000 },
    ];
    const result = validateBars(bars);
    expect(result.valid).toBe(true);
  });

  it('rejects invalid volume when present', () => {
    const bars = [{ open: 100, high: 110, low: 90, close: 105, time: 1000, volume: 'lots' }];
    const result = validateBars(bars);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.context.field === 'volume')).toBe(true);
  });

  it('detects non-object bar entries', () => {
    const bars = [null, validBar(2000)];
    const result = validateBars(bars);
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe(ERROR_CODES.INVALID_BAR_DATA);
  });
});

// ═══════════════════════════════════════════════════════════════════
// validateProps
// ═══════════════════════════════════════════════════════════════════

describe('validateProps', () => {
  it('accepts known props', () => {
    const result = validateProps({ chartType: 'candle', showVolume: true });
    expect(result.valid).toBe(true);
  });

  it('warns on unknown prop key', () => {
    const result = validateProps({ unknownProp: 'value' });
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe(ERROR_CODES.INVALID_PROP);
    expect(result.errors[0].context.key).toBe('unknownProp');
  });

  it('rejects non-object input', () => {
    const result = validateProps(42);
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe(ERROR_CODES.INVALID_PROP);
  });

  it('rejects array input', () => {
    const result = validateProps([1, 2, 3]);
    expect(result.valid).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// validateIndicators
// ═══════════════════════════════════════════════════════════════════

describe('validateIndicators', () => {
  it('accepts valid indicators', () => {
    const result = validateIndicators([
      { name: 'EMA-20', values: [100, 101, 102], color: '#ff0000' },
      { name: 'SMA-50', values: [99, 100, 101] },
    ]);
    expect(result.valid).toBe(true);
  });

  it('rejects non-array input', () => {
    const result = validateIndicators('not an array');
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe(ERROR_CODES.INVALID_INDICATOR);
  });

  it('detects indicator missing name', () => {
    const result = validateIndicators([{ values: [1, 2, 3] }]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e =>
      e.code === ERROR_CODES.INVALID_INDICATOR
    )).toBe(true);
  });

  it('detects indicator missing values', () => {
    const result = validateIndicators([{ name: 'EMA-20' }]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e =>
      e.code === ERROR_CODES.INVALID_INDICATOR && e.message.includes('values')
    )).toBe(true);
  });

  it('detects non-object indicator entries', () => {
    const result = validateIndicators([null]);
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe(ERROR_CODES.INVALID_INDICATOR);
  });

  it('accepts empty array', () => {
    const result = validateIndicators([]);
    expect(result.valid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// ChartError
// ═══════════════════════════════════════════════════════════════════

describe('ChartError', () => {
  it('creates error with correct code and context', () => {
    const err = new ChartError(ERROR_CODES.INVALID_BAR_DATA, 'test', { index: 5 });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ChartError');
    expect(err.code).toBe(ERROR_CODES.INVALID_BAR_DATA);
    expect(err.context.index).toBe(5);
  });

  it('includes fix hint in message', () => {
    const err = new ChartError(ERROR_CODES.UNORDERED_TIME, 'out of order');
    expect(err.message).toContain('Fix:');
    expect(err.message).toContain('Sort bars');
  });

  it('exports all error codes', () => {
    expect(ERROR_CODES.INVALID_BAR_DATA).toBe('INVALID_BAR_DATA');
    expect(ERROR_CODES.UNORDERED_TIME).toBe('UNORDERED_TIME');
    expect(ERROR_CODES.INVALID_PROP).toBe('INVALID_PROP');
    expect(ERROR_CODES.INVALID_INDICATOR).toBe('INVALID_INDICATOR');
  });
});
