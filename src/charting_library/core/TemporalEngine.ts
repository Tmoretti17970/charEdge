// ═══════════════════════════════════════════════════════════════════
// charEdge — TemporalEngine
//
// Central UTC-to-Display conversion engine.
// Decouples absolute time (UTC) from displayed time (user's chosen
// IANA timezone). Uses native Intl.DateTimeFormat — zero added bytes.
//
// Design:
//   - Singleton (matches datafeedService pattern)
//   - 15-minute cache buckets for O(1) offset lookups
//   - DST transitions happen at hour boundaries → 15-min is safe
//   - LRU cache capped at 2048 entries
// ═══════════════════════════════════════════════════════════════════

/** Date parts returned by getParts(). */
export interface DateParts {
  year: number;
  month: number;   // 1-based (Jan = 1)
  day: number;
  hour: number;
  minute: number;
  second: number;
}

// 15-minute bucket size for offset cache (in ms)
const BUCKET_MS = 900_000;
const MAX_CACHE_SIZE = 2048;

class TemporalEngine {
  /** Active IANA timezone string (e.g. "America/New_York"). */
  activeTimezone: string = 'UTC';

  /** Memoized offset cache: key = `${iana}|${bucketedMs}` → offset in ms. */
  private _offsetCache: Map<string, number> = new Map();

  /** Reusable Intl.DateTimeFormat instances per IANA zone. */
  private _formatterCache: Map<string, Intl.DateTimeFormat> = new Map();

  // ─── Core API ─────────────────────────────────────────────────

  /**
   * Get UTC offset in milliseconds for a given UTC timestamp + IANA zone.
   * Positive = east of UTC (e.g. +5:30 for Asia/Kolkata).
   * Uses 15-minute bucketing for cache performance.
   */
  getOffset(utcMs: number, iana?: string): number {
    const zone = iana || this.activeTimezone;
    if (zone === 'UTC') return 0;

    const bucket = utcMs - (utcMs % BUCKET_MS);
    const key = `${zone}|${bucket}`;

    const cached = this._offsetCache.get(key);
    if (cached !== undefined) return cached;

    // Compute via Intl.DateTimeFormat
    const offset = this._computeOffset(utcMs, zone);

    // LRU eviction: clear half when full
    if (this._offsetCache.size >= MAX_CACHE_SIZE) {
      const entries = [...this._offsetCache.keys()];
      for (let i = 0; i < MAX_CACHE_SIZE / 2; i++) {
        this._offsetCache.delete(entries[i]!);
      }
    }

    this._offsetCache.set(key, offset);
    return offset;
  }

  /**
   * Convert UTC ms → display ms (shifted by timezone offset).
   * The returned value is NOT a real UTC timestamp — it's a
   * "display timestamp" for rendering purposes only.
   */
  utcToDisplay(utcMs: number, iana?: string): number {
    return utcMs + this.getOffset(utcMs, iana);
  }

  /**
   * Get the UTC timestamp of 00:00:00 in the given timezone for a UTC timestamp.
   * Critical for daily candle boundary detection (VWAP reset, day dividers).
   */
  dayStartUTC(utcMs: number, iana?: string): number {
    const parts = this.getParts(utcMs, iana);
    // Construct midnight in the target timezone, then subtract offset to get UTC
    const midnightLocal = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0);
    const offset = this.getOffset(utcMs, iana);
    return midnightLocal - offset;
  }

  /**
   * Get date parts (year, month, day, hour, minute, second) in the given timezone.
   * Uses a single Intl.DateTimeFormat.formatToParts() call — no Date() construction.
   */
  getParts(utcMs: number, iana?: string): DateParts {
    const zone = iana || this.activeTimezone;

    if (zone === 'UTC') {
      // Fast path: direct extraction from UTC timestamp
      const d = new Date(utcMs);
      return {
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
        day: d.getUTCDate(),
        hour: d.getUTCHours(),
        minute: d.getUTCMinutes(),
        second: d.getUTCSeconds(),
      };
    }

    const fmt = this._getFormatter(zone);
    const parts = fmt.formatToParts(new Date(utcMs));

    const result: DateParts = { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0 };
    for (const p of parts) {
      switch (p.type) {
        case 'year': result.year = parseInt(p.value, 10); break;
        case 'month': result.month = parseInt(p.value, 10); break;
        case 'day': result.day = parseInt(p.value, 10); break;
        case 'hour': result.hour = parseInt(p.value, 10); break;
        case 'minute': result.minute = parseInt(p.value, 10); break;
        case 'second': result.second = parseInt(p.value, 10); break;
      }
    }

    return result;
  }

  /**
   * Set the active timezone. Invalidates the offset cache.
   */
  setTimezone(iana: string): void {
    if (iana === this.activeTimezone) return;
    this.activeTimezone = iana;
    // Don't clear cache — entries for other zones are still valid.
    // Only the per-zone entries matter and they're keyed by zone.
  }

  /**
   * Clear all caches. Call on app teardown or for testing.
   */
  clearCaches(): void {
    this._offsetCache.clear();
    this._formatterCache.clear();
  }

  // ─── Internal Helpers ─────────────────────────────────────────

  /**
   * Compute raw UTC offset in ms using Intl.DateTimeFormat.
   * Algorithm: format the UTC timestamp in the target zone to get local parts,
   * reconstruct a UTC-equivalent Date, and diff against the original.
   */
  private _computeOffset(utcMs: number, zone: string): number {
    const parts = this.getParts(utcMs, zone);

    // Reconstruct as if it were UTC
    const localAsUTC = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );

    // Offset = localAsUTC - utcMs (rounded to nearest minute to avoid ms drift)
    const rawOffset = localAsUTC - utcMs;
    return Math.round(rawOffset / 60_000) * 60_000;
  }

  /**
   * Get or create a cached Intl.DateTimeFormat for the given IANA zone.
   */
  private _getFormatter(zone: string): Intl.DateTimeFormat {
    let fmt = this._formatterCache.get(zone);
    if (!fmt) {
      fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      this._formatterCache.set(zone, fmt);
    }
    return fmt;
  }
}

/** Singleton instance. */
export const temporalEngine = new TemporalEngine();
export { TemporalEngine };
export default temporalEngine;
