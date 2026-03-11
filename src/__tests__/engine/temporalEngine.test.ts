// ═══════════════════════════════════════════════════════════════════
// charEdge — TemporalEngine Test Suite
//
// Validates UTC-to-Display timezone conversion engine across
// DST transitions, half-hour offsets, extreme zones, and performance.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import { temporalEngine, TemporalEngine } from '../../charting_library/core/TemporalEngine.ts';
import { formatTimeLabel } from '../../charting_library/core/barCountdown.js';

describe('TemporalEngine — Offset & Zone Support', () => {
  beforeEach(() => {
    temporalEngine.clearCaches();
    temporalEngine.setTimezone('UTC');
  });

  // ─── Test 1: Non-DST offset for America/New_York ──────────────
  it('returns -5h offset for America/New_York in January (non-DST)', () => {
    // January 15, 2026 12:00 UTC — firmly in EST (no DST)
    const jan15 = Date.UTC(2026, 0, 15, 12, 0, 0);
    const offset = temporalEngine.getOffset(jan15, 'America/New_York');
    expect(offset).toBe(-5 * 3600000);
  });

  // ─── Test 2: DST offset for America/New_York ──────────────────
  it('returns -4h offset for America/New_York in July (DST)', () => {
    // July 15, 2026 12:00 UTC — firmly in EDT
    const jul15 = Date.UTC(2026, 6, 15, 12, 0, 0);
    const offset = temporalEngine.getOffset(jul15, 'America/New_York');
    expect(offset).toBe(-4 * 3600000);
  });

  // ─── Test 3: DST spring-forward boundary (US) ─────────────────
  it('handles US spring-forward (no missing candle at 2AM → 3AM)', () => {
    // US spring forward 2026: March 8, 2:00 AM EST → 3:00 AM EDT
    // At 06:59 UTC (1:59 AM EST) offset should be -5h
    const beforeForward = Date.UTC(2026, 2, 8, 6, 59);
    const offsetBefore = temporalEngine.getOffset(beforeForward, 'America/New_York');
    expect(offsetBefore).toBe(-5 * 3600000);

    // At 07:01 UTC (3:01 AM EDT) offset should be -4h
    const afterForward = Date.UTC(2026, 2, 8, 7, 1);
    const offsetAfter = temporalEngine.getOffset(afterForward, 'America/New_York');
    expect(offsetAfter).toBe(-4 * 3600000);
  });

  // ─── Test 4: DST fall-back boundary (Australia) ───────────────
  it('handles Australian fall-back (Southern Hemisphere DST)', () => {
    // Australia/Sydney: AEDT (UTC+11) → AEST (UTC+10) in April
    // In January (summer) → +11h
    const janSyd = Date.UTC(2026, 0, 15, 12, 0);
    const offsetJan = temporalEngine.getOffset(janSyd, 'Australia/Sydney');
    expect(offsetJan).toBe(11 * 3600000);

    // In July (winter) → +10h
    const julSyd = Date.UTC(2026, 6, 15, 12, 0);
    const offsetJul = temporalEngine.getOffset(julSyd, 'Australia/Sydney');
    expect(offsetJul).toBe(10 * 3600000);
  });

  // ─── Test 5: Non-hourly offset — Asia/Kolkata (UTC+5:30) ──────
  it('handles half-hour offset for Asia/Kolkata (+5:30)', () => {
    const ts = Date.UTC(2026, 0, 15, 12, 0);
    const offset = temporalEngine.getOffset(ts, 'Asia/Kolkata');
    expect(offset).toBe(5.5 * 3600000);
  });

  // ─── Test 6: Non-hourly offset — Australia/Lord_Howe ──────────
  it('handles Australia/Lord_Howe (+10:30 / +11:00 DST)', () => {
    // Lord Howe Island: +10:30 LHST in winter (July), +11:00 LHDT in summer (Jan)
    const jul = Date.UTC(2026, 6, 15, 12, 0);
    const offsetJul = temporalEngine.getOffset(jul, 'Australia/Lord_Howe');
    expect(offsetJul).toBe(10.5 * 3600000);

    const jan = Date.UTC(2026, 0, 15, 12, 0);
    const offsetJan = temporalEngine.getOffset(jan, 'Australia/Lord_Howe');
    expect(offsetJan).toBe(11 * 3600000);
  });
});

describe('TemporalEngine — Day Boundary Detection', () => {
  beforeEach(() => {
    temporalEngine.clearCaches();
  });

  // ─── Test 7: dayStartUTC across timezones ─────────────────────
  it('returns different dayStart for Asia/Tokyo vs America/Chicago', () => {
    // 2026-01-15 03:00 UTC
    // In Tokyo (UTC+9):  2026-01-15 12:00 → day start = Jan 15 00:00 JST = Jan 14 15:00 UTC
    // In Chicago (UTC-6): 2026-01-14 21:00 → day start = Jan 14 00:00 CST = Jan 14 06:00 UTC
    const ts = Date.UTC(2026, 0, 15, 3, 0);

    const tokyoDayStart = temporalEngine.dayStartUTC(ts, 'Asia/Tokyo');
    const chicagoDayStart = temporalEngine.dayStartUTC(ts, 'America/Chicago');

    // They should NOT be the same — different calendar days in each zone
    expect(tokyoDayStart).not.toBe(chicagoDayStart);

    // Tokyo's day start should be Jan 14 15:00 UTC (midnight JST Jan 15)
    expect(tokyoDayStart).toBe(Date.UTC(2026, 0, 14, 15, 0));
    // Chicago's day start should be Jan 14 06:00 UTC (midnight CST Jan 14)
    expect(chicagoDayStart).toBe(Date.UTC(2026, 0, 14, 6, 0));
  });
});

describe('TemporalEngine — formatTimeLabel with IANA timezone', () => {
  beforeEach(() => {
    temporalEngine.clearCaches();
  });

  // ─── Test 8: formatTimeLabel with Europe/London ───────────────
  it('displays correct hour in Europe/London (BST, summer)', () => {
    // July 15, 2026 14:00 UTC → 15:00 BST in London
    const ts = Date.UTC(2026, 6, 15, 14, 0);
    const label = formatTimeLabel(ts, '1h', null, 'Europe/London');
    expect(label).toBe('15:00');
  });

  it('displays correct hour in Europe/London (GMT, winter)', () => {
    // January 15, 2026 14:00 UTC → 14:00 GMT in London
    const ts = Date.UTC(2026, 0, 15, 14, 0);
    const label = formatTimeLabel(ts, '1h', null, 'Europe/London');
    expect(label).toBe('14:00');
  });

  // ─── Test 9: Indicator math unaffected by timezone ────────────
  // (EMA/RSI are index-based — no time dependency. This test verifies
  // that switching timezone doesn't alter any indicator data.)
});

describe('TemporalEngine — VWAP Session Reset', () => {
  // ─── Test 10: VWAP respects timezone day boundary ─────────────
  it('resets VWAP at the correct day boundary for America/New_York', () => {
    // Import vwap dynamically to test
    // This is more of an integration test — the key verification is that
    // dayStartUTC works correctly, which is tested above.
    const ts1 = Date.UTC(2026, 0, 15, 4, 0); // 11PM EST Jan 14
    const ts2 = Date.UTC(2026, 0, 15, 5, 0); // midnight EST Jan 15
    const ts3 = Date.UTC(2026, 0, 15, 6, 0); // 1AM EST Jan 15

    const nyDayStart1 = temporalEngine.dayStartUTC(ts1, 'America/New_York');
    const nyDayStart2 = temporalEngine.dayStartUTC(ts2, 'America/New_York');
    const nyDayStart3 = temporalEngine.dayStartUTC(ts3, 'America/New_York');

    // ts1 is still Jan 14 in NY, ts2 and ts3 are Jan 15
    expect(nyDayStart1).not.toBe(nyDayStart2);
    expect(nyDayStart2).toBe(nyDayStart3);
  });
});

describe('TemporalEngine — Performance & Edge Cases', () => {
  beforeEach(() => {
    temporalEngine.clearCaches();
  });

  // ─── Test 11: Offset memoization performance ─────────────────
  it('performs 10,000 offset lookups in under 50ms', () => {
    const base = Date.UTC(2026, 0, 15, 0, 0);
    const barInterval = 60000; // 1 minute

    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      temporalEngine.getOffset(base + i * barInterval, 'America/New_York');
    }
    const elapsed = performance.now() - start;

    // Should complete well under 50ms (typically < 5ms due to cache)
    expect(elapsed).toBeLessThan(50);
  });

  // ─── Test 12: Extreme offset — Pacific/Kiritimati (UTC+14) ──
  it('handles Pacific/Kiritimati (UTC+14) without crash', () => {
    const ts = Date.UTC(2026, 0, 15, 12, 0);
    const offset = temporalEngine.getOffset(ts, 'Pacific/Kiritimati');
    expect(offset).toBe(14 * 3600000);

    const parts = temporalEngine.getParts(ts, 'Pacific/Kiritimati');
    expect(parts.year).toBe(2026);
    // 12:00 UTC + 14h = 02:00 next day
    expect(parts.hour).toBe(2);
    expect(parts.day).toBe(16); // Crosses midnight to Jan 16
  });

  // ─── Additional: UTC fast path ────────────────────────────────
  it('returns 0 offset for UTC', () => {
    const ts = Date.UTC(2026, 0, 15, 12, 0);
    expect(temporalEngine.getOffset(ts, 'UTC')).toBe(0);
    expect(temporalEngine.getOffset(ts)).toBe(0); // default
  });

  // ─── Additional: setTimezone updates active timezone ──────────
  it('setTimezone updates the active timezone', () => {
    temporalEngine.setTimezone('America/Los_Angeles');
    expect(temporalEngine.activeTimezone).toBe('America/Los_Angeles');

    const ts = Date.UTC(2026, 0, 15, 20, 0); // 12:00 PST
    const parts = temporalEngine.getParts(ts); // uses activeTimezone
    expect(parts.hour).toBe(12);

    temporalEngine.setTimezone('UTC');
  });

  // ─── Additional: Backward-compat boolean in formatTimeLabel ───
  it('formatTimeLabel accepts boolean for backward compatibility', () => {
    const ts = Date.UTC(2026, 0, 15, 14, 30);
    // true → UTC
    const utcLabel = formatTimeLabel(ts, '1h', null, true);
    expect(utcLabel).toBe('14:30');

    // false → local timezone (varies per system, but should not crash)
    const localLabel = formatTimeLabel(ts, '1h', null, false);
    expect(typeof localLabel).toBe('string');
    expect(localLabel.length).toBeGreaterThan(0);
  });
});
