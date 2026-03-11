import { logger } from '@/observability/logger';
// ═══════════════════════════════════════════════════════════════════
// charEdge v12 — FRED API Adapter
//
// Free macro economic data from the Federal Reserve Bank of St. Louis.
// 800,000+ time series including GDP, CPI, Fed Funds Rate, VIX, yields.
//
// Phase 2.1.1: All requests routed through /api/proxy/fred/ — the
// server-side proxy injects the API key, keeping it out of the
// client JS bundle.
//
// Key use cases:
//   - Macro context for trade journal entries
//   - Economic event markers on charts
//   - Dashboard sparklines for key indicators
//
// Usage:
//   import { fredAdapter } from './FredAdapter.js';
//   const cpi = await fredAdapter.fetchSeries('CPIAUCSL');
//   const macro = await fredAdapter.fetchMacroSnapshot();
// ═══════════════════════════════════════════════════════════════════

// Phase 2.1.1: Requests go through server proxy (API key injected server-side)
const PROXY_BASE = '/api/proxy/fred';

// ─── Key Economic Series ───────────────────────────────────────
// Series IDs for the most trader-relevant economic indicators

export const FRED_SERIES = {
  // Interest Rates & Yields
  FEDFUNDS: { id: 'FEDFUNDS', name: 'Federal Funds Rate', unit: '%', frequency: 'monthly', category: 'rates' },
  DGS10: { id: 'DGS10', name: '10-Year Treasury Yield', unit: '%', frequency: 'daily', category: 'rates' },
  DGS2: { id: 'DGS2', name: '2-Year Treasury Yield', unit: '%', frequency: 'daily', category: 'rates' },
  T10Y2Y: { id: 'T10Y2Y', name: '10Y-2Y Spread (Recession Indicator)', unit: '%', frequency: 'daily', category: 'rates' },
  T10YIE: { id: 'T10YIE', name: '10-Year Breakeven Inflation', unit: '%', frequency: 'daily', category: 'rates' },

  // Inflation
  CPIAUCSL: { id: 'CPIAUCSL', name: 'Consumer Price Index (CPI)', unit: 'index', frequency: 'monthly', category: 'inflation' },
  CPILFESL: { id: 'CPILFESL', name: 'Core CPI (excl. Food & Energy)', unit: 'index', frequency: 'monthly', category: 'inflation' },
  PCEPI: { id: 'PCEPI', name: 'PCE Price Index', unit: 'index', frequency: 'monthly', category: 'inflation' },

  // Employment
  UNRATE: { id: 'UNRATE', name: 'Unemployment Rate', unit: '%', frequency: 'monthly', category: 'employment' },
  PAYEMS: { id: 'PAYEMS', name: 'Nonfarm Payrolls', unit: 'thousands', frequency: 'monthly', category: 'employment' },
  ICSA: { id: 'ICSA', name: 'Initial Jobless Claims', unit: 'claims', frequency: 'weekly', category: 'employment' },

  // GDP & Growth
  GDP: { id: 'GDP', name: 'Gross Domestic Product', unit: 'billions USD', frequency: 'quarterly', category: 'growth' },
  GDPC1: { id: 'GDPC1', name: 'Real GDP', unit: 'billions 2017 USD', frequency: 'quarterly', category: 'growth' },

  // Market Indicators
  VIXCLS: { id: 'VIXCLS', name: 'CBOE Volatility Index (VIX)', unit: 'index', frequency: 'daily', category: 'market' },
  SP500: { id: 'SP500', name: 'S&P 500 Index', unit: 'index', frequency: 'daily', category: 'market' },
  BAMLH0A0HYM2: { id: 'BAMLH0A0HYM2', name: 'High Yield Spread', unit: '%', frequency: 'daily', category: 'market' },

  // Money Supply & Liquidity
  M2SL: { id: 'M2SL', name: 'M2 Money Supply', unit: 'billions USD', frequency: 'monthly', category: 'liquidity' },
  WALCL: { id: 'WALCL', name: 'Fed Balance Sheet', unit: 'millions USD', frequency: 'weekly', category: 'liquidity' },

  // Dollar & FX
  DTWEXBGS: { id: 'DTWEXBGS', name: 'Trade-Weighted Dollar Index', unit: 'index', frequency: 'daily', category: 'fx' },
};

// Quick-access list for dashboard
export const MACRO_DASHBOARD_SERIES = [
  'VIXCLS', 'DGS10', 'T10Y2Y', 'FEDFUNDS', 'CPIAUCSL', 'UNRATE', 'SP500', 'DTWEXBGS',
];

// ─── FRED Adapter Class ────────────────────────────────────────

class _FredAdapter {
  constructor() {
    this._cache = new Map(); // seriesId → { data, expiry }
    this._cacheTTL = 300000; // 5 min for daily series
    this._longCacheTTL = 3600000; // 1 hour for monthly/quarterly
  }

  // Phase 2.1.1: API key managed server-side — always "configured"
  get isConfigured() { return true; }

  // Legacy no-op — key is server-side now
  setApiKey(_key) { /* no-op: API key managed server-side */ }

  /**
   * Fetch observations for a FRED series.
   * @param {string} seriesId - e.g., 'CPIAUCSL', 'FEDFUNDS'
   * @param {Object} [opts]
   * @param {string} [opts.from] - Start date (YYYY-MM-DD)
   * @param {string} [opts.to] - End date (YYYY-MM-DD)
   * @param {number} [opts.limit] - Max observations
   * @param {string} [opts.sort] - 'asc' or 'desc'
   * @returns {Promise<Array<{ date, value }>>}
   */
  async fetchSeries(seriesId, opts = {}) {
    const cacheKey = `${seriesId}-${opts.from || ''}-${opts.to || ''}-${opts.limit || ''}`;
    const cached = this._cache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) return cached.data;

    const params = new URLSearchParams({
      series_id: seriesId,
      sort_order: opts.sort || 'desc',
    });
    if (opts.from) params.set('observation_start', opts.from);
    if (opts.to) params.set('observation_end', opts.to);
    if (opts.limit) params.set('limit', String(opts.limit));

    try {
      const url = `${PROXY_BASE}/series/observations?${params}`;
      const resp = await fetch(url);
      if (!resp.ok) return [];

      const json = await resp.json();
      const observations = (json.observations || [])
        .filter(o => o.value !== '.')
        .map(o => ({
          date: o.date,
          value: parseFloat(o.value),
          realtimeStart: o.realtime_start,
          realtimeEnd: o.realtime_end,
        }));

      // Determine cache TTL based on frequency
      const meta = FRED_SERIES[seriesId];
      const ttl = (meta?.frequency === 'daily' || meta?.frequency === 'weekly')
        ? this._cacheTTL : this._longCacheTTL;
      this._cache.set(cacheKey, { data: observations, expiry: Date.now() + ttl });

      return observations;
    } catch (err) {
      logger.data.warn(`[FredAdapter] fetchSeries(${seriesId}) failed:`, err.message);
      return [];
    }
  }

  /**
   * Fetch the latest value for a series.
   * @param {string} seriesId
   * @returns {Promise<{ date, value, name, unit }|null>}
   */
  async fetchLatest(seriesId) {
    const obs = await this.fetchSeries(seriesId, { limit: 1, sort: 'desc' });
    if (!obs.length) return null;

    const meta = FRED_SERIES[seriesId];
    return {
      ...obs[0],
      name: meta?.name || seriesId,
      unit: meta?.unit || '',
      category: meta?.category || 'other',
    };
  }

  /**
   * Fetch a snapshot of key macro indicators for the dashboard.
   * Returns the latest value for each series in MACRO_DASHBOARD_SERIES.
   * @returns {Promise<Object>} { VIXCLS: { date, value, name }, ... }
   */
  async fetchMacroSnapshot() {
    const results = {};
    // Fetch in parallel but with some batching to be polite
    const promises = MACRO_DASHBOARD_SERIES.map(async (id) => {
      const latest = await this.fetchLatest(id);
      if (latest) results[id] = latest;
    });

    await Promise.allSettled(promises);
    return results;
  }

  /**
   * Fetch historical data for chart overlay.
   * Returns data formatted for chart markers / background bands.
   * @param {string} seriesId
   * @param {number} [days=365] - How many days back
   * @returns {Promise<Array<{ time, value }>>}
   */
  async fetchChartOverlay(seriesId, days = 365) {
    const from = new Date();
    from.setDate(from.getDate() - days);
    const fromStr = from.toISOString().slice(0, 10);

    const data = await this.fetchSeries(seriesId, { from: fromStr, sort: 'asc' });
    return data.map(o => ({
      time: new Date(o.date).getTime(),
      value: o.value,
    }));
  }

  /**
   * Fetch series metadata.
   * @param {string} seriesId
   * @returns {Promise<Object|null>}
   */
  async fetchSeriesInfo(seriesId) {
    try {
      const params = new URLSearchParams({ series_id: seriesId });
      const resp = await fetch(`${PROXY_BASE}/series?${params}`);
      if (!resp.ok) return null;

      const json = await resp.json();
      return json.seriess?.[0] || null;
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      return null;
    }
  }

  /**
   * Get the list of all available pre-configured series.
   * @returns {Object}
   */
  getAvailableSeries() {
    return { ...FRED_SERIES };
  }

  /**
   * Get series grouped by category for UI display.
   * @returns {Object} { rates: [...], inflation: [...], ... }
   */
  getSeriesByCategory() {
    const categories = {};
    for (const [id, meta] of Object.entries(FRED_SERIES)) {
      if (!categories[meta.category]) categories[meta.category] = [];
      categories[meta.category].push({ id, ...meta });
    }
    return categories;
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const fredAdapter = new _FredAdapter();

export default fredAdapter;
