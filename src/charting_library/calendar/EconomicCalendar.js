// ═══════════════════════════════════════════════════════════════════
// charEdge — Economic Calendar Service
//
// Phase 7 Task 7.1.9: Economic event markers on chart.
// Fetches economic calendar data and provides vertical line markers.
// ═══════════════════════════════════════════════════════════════════

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
 * Known high-impact economic events (hardcoded for offline use).
 * In production, these would come from an API.
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
    }

    /**
     * Set events manually (e.g. from API response).
     * @param {EconomicEvent[]} events
     */
    setEvents(events) {
        this.events = events.sort((a, b) => a.timestamp - b.timestamp);
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

        return this.events.filter(e =>
            e.timestamp >= startTime &&
            e.timestamp <= endTime &&
            this.enabledCountries.has(e.country) &&
            (impactLevels[e.impact] || 0) >= minLevel
        );
    }

    /**
     * Get vertical line marker data for chart rendering.
     * @param {number} startTime
     * @param {number} endTime
     * @returns {Array<{ x: number, color: string, opacity: number, label: string, event: EconomicEvent }>}
     */
    getMarkers(startTime, endTime) {
        return this.getEventsInRange(startTime, endTime).map(event => ({
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
    static get knownEvents() { return KNOWN_EVENTS; }
    static get impactColors() { return IMPACT_COLORS; }
}

export default EconomicCalendar;
