// ═══════════════════════════════════════════════════════════════════
// charEdge — EquityPaginator
//
// Paginated history fetching for equities (stocks, ETFs).
// Called by HistoryPaginator when isCrypto(sym) is false.
// Uses the existing provider chain: Polygon → FMP → Yahoo.
// Alpha Vantage removed (Task 1B.2) — 25 req/day, no unique data.
// Returns { data: [...bars], hasMore: boolean }.
// ═══════════════════════════════════════════════════════════════════

import { validateCandleArray } from '../engine/infra/DataValidator';
import { logger } from '@/observability/logger';

// Timeframe → lookback window for one page (in days)
const PAGE_LOOKBACK = {
    '1m': 1,     // 1-minute bars: 1 day per page
    '5m': 5,     // 5-minute bars: 5 days per page
    '15m': 15,   // 15-minute bars: 15 days per page
    '30m': 30,   // 30-minute bars: 30 days per page
    '1h': 60,    // 1-hour bars: 60 days per page
    '4h': 90,    // 4-hour bars: 90 days per page
    '1D': 365,   // Daily bars: 1 year per page
    '1w': 365 * 3, // Weekly bars: 3 years per page
};

// Absolute lookback limit (how far back we'll ever go)
const MAX_LOOKBACK_DAYS = 365 * 10; // 10 years

/**
 * Fetch a page of older equity bars ending before `endTimeMs`.
 * Tries providers in priority order and returns the first successful result.
 *
 * @param {string} sym - Ticker symbol (e.g., 'AAPL')
 * @param {string} tfId - charEdge timeframe ID
 * @param {number} endTimeMs - Fetch bars before this timestamp (ms)
 * @param {number} pageSize - Target number of bars (used for hasMore check)
 * @returns {{ data: Array, hasMore: boolean }}
 */
export async function fetchEquityPage(sym, tfId, endTimeMs, pageSize = 500) {
    const lookbackDays = PAGE_LOOKBACK[tfId] || 365;
    const toDate = new Date(endTimeMs);
    const fromDate = new Date(endTimeMs - lookbackDays * 86_400_000);

    // Absolute limit — don't try to fetch before 2000
    const absoluteMin = new Date('2000-01-01').getTime();
    if (endTimeMs < absoluteMin) {
        return { data: [], hasMore: false };
    }

    // Check how far back we've gone
    const daysSinceNow = (Date.now() - endTimeMs) / 86_400_000;
    if (daysSinceNow > MAX_LOOKBACK_DAYS) {
        return { data: [], hasMore: false };
    }

    const toStr = toDate.toISOString().slice(0, 10);
    const fromStr = fromDate.toISOString().slice(0, 10);

    // ── Try providers in order ──────────────────────────────────────

    // 1. Polygon.io (best for equities, has date-range queries)
    try {
        const bars = await _fetchPolygonPage(sym, tfId, fromStr, toStr);
        if (bars && bars.length > 0) {
            const validated = validateCandleArray(bars);
            return { data: validated, hasMore: validated.length >= Math.min(pageSize / 2, 50) };
        }
    } catch (e) { logger.data.warn('[EquityPaginator] Polygon page failed', e?.message); }

    // 2. FMP (has from/to params natively)
    try {
        const bars = await _fetchFMPPage(sym, tfId, fromStr, toStr);
        if (bars && bars.length > 0) {
            const validated = validateCandleArray(bars);
            return { data: validated, hasMore: validated.length >= Math.min(pageSize / 2, 50) };
        }
    } catch (e) { logger.data.warn('[EquityPaginator] FMP page failed', e?.message); }

    // Alpha Vantage step removed (Task 1B.2) — 25 req/day, no unique data

    // All providers failed for this page
    return { data: [], hasMore: false };
}

// ─── Provider-specific page fetchers ────────────────────────────

const POLYGON_PROXY = '/api/proxy/polygon';

async function _fetchPolygonPage(sym, tfId, fromStr, toStr) {
    const { POLYGON_TF_MAP } = await import('./PolygonProvider.js');
    const tf = POLYGON_TF_MAP[tfId];
    if (!tf) return null;

    const url = `${POLYGON_PROXY}/v2/aggs/ticker/${encodeURIComponent(sym)}/range/${tf.multiplier}/${tf.timespan}/${fromStr}/${toStr}?adjusted=true&sort=asc&limit=${tf.limit}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) return null;
        const json = await res.json();
        if (!json.results?.length) return null;
        return json.results.map(bar => ({
            time: new Date(bar.t).toISOString(),
            open: bar.o, high: bar.h, low: bar.l, close: bar.c,
            volume: bar.v || 0,
        }));
    } catch { clearTimeout(timeout); return null; }
}

async function _fetchFMPPage(sym, tfId, fromStr, toStr) {
    const { fmpAdapter } = await import('../adapters/FMPAdapter.js');
    if (!fmpAdapter) return null;

    const FMP_TF_MAP = {
        '1m': '1min', '5m': '5min', '15m': '15min', '30m': '30min',
        '1h': '1hour', '4h': '4hour', '1D': '1d', '1w': '1d',
    };
    const interval = FMP_TF_MAP[tfId] || '1d';
    const bars = await fmpAdapter.fetchOHLCV(sym, interval, { from: fromStr, to: toStr });
    return bars?.length > 0 ? bars : null;
}

const AV_PROXY = '/api/proxy/alphavantage';

async function _fetchAlphaVantagePage(sym, tfId, endTimeMs) {
    // Alpha Vantage doesn't support from/to natively — we fetch full output
    // and filter to bars before endTimeMs
    const { AV_FUNCTIONS } = await import('./AlphaVantageProvider.js');
    const cfg = AV_FUNCTIONS[tfId];
    if (!cfg) return null;

    let url = `${AV_PROXY}/query?function=${cfg.fn}&symbol=${encodeURIComponent(sym)}&outputsize=full`;
    if (cfg.interval) url += `&interval=${cfg.interval}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) return null;
        const json = await res.json();
        const seriesKey = Object.keys(json).find(k => k.startsWith('Time Series'));
        if (!seriesKey || !json[seriesKey]) return null;

        const series = json[seriesKey];
        return Object.entries(series)
            .map(([dateStr, bar]) => {
                const t = new Date(dateStr.includes(':') ? dateStr : dateStr + 'T00:00:00').getTime();
                return {
                    time: new Date(t).toISOString(),
                    open: parseFloat(bar['1. open']),
                    high: parseFloat(bar['2. high']),
                    low: parseFloat(bar['3. low']),
                    close: parseFloat(bar['4. close']),
                    volume: parseInt(bar['5. volume'] || bar['6. volume'] || '0', 10),
                };
            })
            .filter(b => new Date(b.time).getTime() < endTimeMs)
            .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    } catch { clearTimeout(timeout); return null; }
}
