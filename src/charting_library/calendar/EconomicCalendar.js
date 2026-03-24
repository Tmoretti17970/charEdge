// ═══════════════════════════════════════════════════════════════════
// charEdge — Economic Calendar Service
//
// Phase 7 Task 7.1.9: Economic event markers on chart.
// Fetches economic calendar data and provides vertical line markers.
//
// Phase 1 Enhancement: Live data from Finnhub economic calendar API
// with fallback to known events for offline use.
// ═══════════════════════════════════════════════════════════════════

import { logger } from '@/observability/logger';

/**
 * @typedef {Object} EconomicEvent
 * @property {number} timestamp - Unix timestamp (ms)
 * @property {string} title - Event name
 * @property {string} country - Country code (US, EU, etc.)
 * @property {'low'|'medium'|'high'} impact - Expected market impact
 * @property {string} [actual] - Actual value
 * @property {string} [forecast] - Forecast value
 * @property {string} [previous] - Previous value
 */

/**
 * Known high-impact economic events (fallback for offline use).
 * @type {Array<{ name: string, country: string, impact: string, recurrence: string }>}
 */
const KNOWN_EVENTS = [
  { name: 'FOMC Rate Decision', country: 'US', impact: 'high', recurrence: '6-week' },
  { name: 'Non-Farm Payrolls', country: 'US', impact: 'high', recurrence: 'monthly' },
  { name: 'CPI (YoY)', country: 'US', impact: 'high', recurrence: 'monthly' },
  { name: 'GDP (QoQ)', country: 'US', impact: 'high', recurrence: 'quarterly' },
  { name: 'ECB Rate Decision', country: 'EU', impact: 'high', recurrence: '6-week' },
  { name: 'BOJ Rate Decision', country: 'JP', impact: 'high', recurrence: 'monthly' },
  { name: 'Unemployment Rate', country: 'US', impact: 'medium', recurrence: 'monthly' },
  { name: 'Retail Sales', country: 'US', impact: 'medium', recurrence: 'monthly' },
  { name: 'ISM Manufacturing PMI', country: 'US', impact: 'medium', recurrence: 'monthly' },
  { name: 'Consumer Confidence', country: 'US', impact: 'medium', recurrence: 'monthly' },
];

/** Map Finnhub impact levels (1-3) to our scale */
const FINNHUB_IMPACT_MAP = { 1: 'low', 2: 'medium', 3: 'high' };

/** High-impact event keywords for auto-classification when Finnhub impact is missing */
const HIGH_IMPACT_KEYWORDS = [
  'interest rate',
  'rate decision',
  'fomc',
  'non-farm',
  'nonfarm',
  'payroll',
  'cpi',
  'gdp',
  'ecb',
  'boj',
  'boe',
  'rba',
  'employment change',
];
const MEDIUM_IMPACT_KEYWORDS = [
  'pmi',
  'retail sales',
  'unemployment',
  'confidence',
  'housing',
  'trade balance',
  'industrial production',
  'inflation',
];

/** Cache for fetched events */
const _cache = { events: /** @type {EconomicEvent[]} */ ([]), fetchedAt: 0, rangeKey: '' };

const IMPACT_COLORS = {
  high: 'var(--c-accent-red, #EF5350)',
  medium: 'var(--c-accent-amber, #FFC107)',
  low: 'var(--c-fg-muted, #555)',
};

const IMPACT_OPACITY = {
  high: 0.6,
  medium: 0.35,
  low: 0.2,
};

export class EconomicCalendar {
  constructor() {
    /** @type {EconomicEvent[]} */
    this.events = [];
    /** @type {Set<string>} */
    this.enabledCountries = new Set(['US']);
    this.minImpact = 'medium'; // 'low' | 'medium' | 'high'
    this._loading = false;
  }

  /**
   * Set events manually (e.g. from API response).
   * @param {EconomicEvent[]} events
   */
  setEvents(events) {
    this.events = events.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Fetch live economic calendar from Finnhub API.
   * Falls back to cached data or known events on failure.
   * @param {Date} [from] - Start date (default: 7 days ago)
   * @param {Date} [to] - End date (default: 30 days from now)
   * @returns {Promise<EconomicEvent[]>}
   */
  async fetchLive(from, to) {
    const now = new Date();
    const startDate = from || new Date(now.getTime() - 7 * 86_400_000);
    const endDate = to || new Date(now.getTime() + 30 * 86_400_000);
    const rangeKey = `${startDate.toISOString().slice(0, 10)}:${endDate.toISOString().slice(0, 10)}`;

    // Return cached if fresh (15min TTL)
    if (_cache.rangeKey === rangeKey && Date.now() - _cache.fetchedAt < 900_000) {
      this.events = _cache.events;
      return this.events;
    }

    if (this._loading) return this.events;
    this._loading = true;

    try {
      const fromStr = startDate.toISOString().slice(0, 10);
      const toStr = endDate.toISOString().slice(0, 10);

      // Dynamic import to avoid circular dependency
      const { finnhubAdapter } = await import('../../data/adapters/FinnhubAdapter.js');
      const raw = await finnhubAdapter.fetchEconomicCalendar(fromStr, toStr);

      if (raw?.economicCalendar?.length) {
        const events = raw.economicCalendar
          .map((e) => ({
            timestamp: new Date(e.time || e.date).getTime(),
            title: e.event || e.indicator || 'Unknown',
            country: e.country || 'US',
            impact: _classifyImpact(e),
            actual: e.actual != null ? String(e.actual) : undefined,
            forecast: e.estimate != null ? String(e.estimate) : undefined,
            previous: e.prev != null ? String(e.prev) : undefined,
            unit: e.unit,
          }))
          .filter((e) => !isNaN(e.timestamp));

        this.setEvents(events);
        _cache.events = this.events;
        _cache.fetchedAt = Date.now();
        _cache.rangeKey = rangeKey;
        logger.data.info(`[EconomicCalendar] Loaded ${events.length} events from Finnhub`);
      }
    } catch (err) {
      logger.data.warn('[EconomicCalendar] Finnhub fetch failed, using cached/known events:', err.message);
    } finally {
      this._loading = false;
    }

    return this.events;
  }

  /**
   * Filter events for a time range.
   * @param {number} startTime - Start timestamp (ms)
   * @param {number} endTime - End timestamp (ms)
   * @returns {EconomicEvent[]}
   */
  getEventsInRange(startTime, endTime) {
    const impactLevels = { low: 0, medium: 1, high: 2 };
    const minLevel = impactLevels[this.minImpact] || 1;

    return this.events.filter(
      (e) =>
        e.timestamp >= startTime &&
        e.timestamp <= endTime &&
        this.enabledCountries.has(e.country) &&
        (impactLevels[e.impact] || 0) >= minLevel,
    );
  }

  /**
   * Get vertical line marker data for chart rendering.
   * @param {number} startTime
   * @param {number} endTime
   * @returns {Array<{ x: number, color: string, opacity: number, label: string, event: EconomicEvent }>}
   */
  getMarkers(startTime, endTime) {
    return this.getEventsInRange(startTime, endTime).map((event) => ({
      x: event.timestamp,
      color: IMPACT_COLORS[event.impact] || IMPACT_COLORS.low,
      opacity: IMPACT_OPACITY[event.impact] || 0.2,
      label: `${event.country}: ${event.title}`,
      event,
    }));
  }

  /**
   * Toggle country filter.
   */
  toggleCountry(code) {
    if (this.enabledCountries.has(code)) {
      this.enabledCountries.delete(code);
    } else {
      this.enabledCountries.add(code);
    }
  }

  /**
   * Set minimum impact level filter.
   */
  setMinImpact(level) {
    this.minImpact = level;
  }

  /** Get list of known event types. */
  static get knownEvents() {
    return KNOWN_EVENTS;
  }
  static get impactColors() {
    return IMPACT_COLORS;
  }
}

/**
 * Classify impact from Finnhub event data.
 * Uses impact field if available, otherwise keyword matching.
 * @param {Object} event - Raw Finnhub event
 * @returns {'low'|'medium'|'high'}
 */
function _classifyImpact(event) {
  // Use Finnhub impact field if present (1=low, 2=medium, 3=high)
  if (event.impact) return FINNHUB_IMPACT_MAP[event.impact] || 'medium';

  // Keyword-based classification
  const title = (event.event || event.indicator || '').toLowerCase();
  if (HIGH_IMPACT_KEYWORDS.some((k) => title.includes(k))) return 'high';
  if (MEDIUM_IMPACT_KEYWORDS.some((k) => title.includes(k))) return 'medium';
  return 'low';
}

export default EconomicCalendar;
