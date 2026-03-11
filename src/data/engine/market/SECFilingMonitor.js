import { logger } from '@/observability/logger';
// ═══════════════════════════════════════════════════════════════════
// charEdge v14 — SEC Filing Monitor
//
// Real-time SEC EDGAR filing alerts via RSS polling.
// Polls the SEC EFTS full-text search API every 10 minutes for
// new filings (8-K, 10-K, 10-Q, 13F) on watched symbols.
//
// Architecture:
//   - Maintains a watchlist of symbols
//   - Resolves CIK via EdgarAdapter
//   - Polls SEC EFTS search API for each watched entity
//   - Emits events via registered callbacks when new filings appear
//   - Deduplicates filings by accession number
//
// Usage:
//   import { secFilingMonitor } from './SECFilingMonitor.js';
//   secFilingMonitor.watch('AAPL');
//   secFilingMonitor.onFiling(filing => logger.data.info(filing));
// ═══════════════════════════════════════════════════════════════════

// ─── Configuration ─────────────────────────────────────────────

const POLL_INTERVAL_MS = 10 * 60 * 1000;  // 10 minutes
const _EFTS_BASE = 'https://efts.sec.gov/LATEST/search-index';
const EDGAR_SEARCH_BASE = 'https://efts.sec.gov/LATEST/search';
const MAX_FILINGS_PER_CHECK = 20;
const FILING_TYPES_WATCHED = ['8-K', '10-K', '10-Q', '13F-HR', '4', 'SC 13G', 'S-1'];
const USER_AGENT = 'charEdge/1.0 (github.com/charEdge)';

// ─── SEC Filing Monitor ────────────────────────────────────────

class _SECFilingMonitor {
  constructor() {
    this._watchlist = new Map();     // symbol → { cik, entityName, lastCheck }
    this._filingCache = new Map();   // accessionNumber → filing
    this._callbacks = new Set();     // Set<(filing) => void>
    this._annotationCallbacks = new Set(); // Callbacks for chart auto-annotation
    this._pollTimer = null;
    this._isPolling = false;
    this._recentFilings = [];        // Most recent filings across all symbols (max 100)
  }

  // ─── Public API ────────────────────────────────────────────

  /**
   * Start watching a symbol for new SEC filings.
   * Resolves CIK from EdgarAdapter if not already known.
   * @param {string} symbol - e.g., 'AAPL'
   * @returns {Promise<boolean>} true if successfully added
   */
  async watch(symbol) {
    const sym = (symbol || '').toUpperCase();
    if (!sym || this._watchlist.has(sym)) return false;

    try {
      const { resolveCIK } = await import('../../adapters/EdgarAdapter.js');
      const cik = await resolveCIK(sym);
      if (!cik) {
        logger.data.warn(`[SECFilingMonitor] Could not resolve CIK for ${sym}`);
        return false;
      }

      this._watchlist.set(sym, {
        cik,
        entityName: sym,
        lastCheck: Date.now(),
      });

      // Start polling if not already running
      this._ensurePolling();

      // Do an immediate check for this symbol
      await this._checkSymbol(sym);

      return true;
    } catch (err) {
      logger.data.warn(`[SECFilingMonitor] Failed to watch ${sym}:`, err.message);
      return false;
    }
  }

  /**
   * Stop watching a symbol.
   * @param {string} symbol
   */
  unwatch(symbol) {
    const sym = (symbol || '').toUpperCase();
    this._watchlist.delete(sym);

    // Stop polling if watchlist is empty
    if (this._watchlist.size === 0 && this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  /**
   * Get all currently watched symbols.
   * @returns {string[]}
   */
  getWatchlist() {
    return Array.from(this._watchlist.keys());
  }

  /**
   * Register a callback for new filing alerts.
   * Callback receives: { symbol, type, title, date, accessionNumber, url }
   * @param {Function} callback
   * @returns {Function} unsubscribe function
   */
  onFiling(callback) {
    this._callbacks.add(callback);
    return () => this._callbacks.delete(callback);
  }

  /**
   * Register a callback for chart auto-annotation.
   * When a filing fires for a symbol the user is viewing,
   * this creates an annotation event.
   * Callback receives: { symbol, type, text, timestamp, urgency, icon }
   * @param {Function} callback
   * @returns {Function} unsubscribe
   */
  onChartAnnotation(callback) {
    this._annotationCallbacks.add(callback);
    return () => this._annotationCallbacks.delete(callback);
  }

  /**
   * Get recent filings for a specific symbol (from cache).
   * @param {string} symbol
   * @param {number} [limit=20]
   * @returns {Array<Object>}
   */
  getRecentFilings(symbol, limit = 20) {
    const sym = symbol ? symbol.toUpperCase() : null;
    const filings = sym
      ? this._recentFilings.filter(f => f.symbol === sym)
      : this._recentFilings;
    return filings.slice(0, limit);
  }

  /**
   * Get all recent filings across all watched symbols.
   * @param {number} [limit=50]
   * @returns {Array<Object>}
   */
  getAllRecentFilings(limit = 50) {
    return this._recentFilings.slice(0, limit);
  }

  /**
   * Force an immediate poll of all watched symbols.
   * @returns {Promise<void>}
   */
  async refresh() {
    await this._pollAll();
  }

  /**
   * Dispose of all resources.
   */
  dispose() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    this._watchlist.clear();
    this._filingCache.clear();
    this._callbacks.clear();
    this._recentFilings = [];
  }

  // ─── Private ───────────────────────────────────────────────

  _ensurePolling() {
    if (this._pollTimer) return;
    this._pollTimer = setInterval(() => this._pollAll(), POLL_INTERVAL_MS);
  }

  async _pollAll() {
    if (this._isPolling) return;
    this._isPolling = true;

    try {
      const symbols = Array.from(this._watchlist.keys());
      for (const sym of symbols) {
        await this._checkSymbol(sym);
      }
    } catch (err) {
      logger.data.warn('[SECFilingMonitor] Poll error:', err.message);
    } finally {
      this._isPolling = false;
    }
  }

  async _checkSymbol(symbol) {
    const entry = this._watchlist.get(symbol);
    if (!entry) return;

    try {
      // Use the EFTS full-text search API
      const params = new URLSearchParams({
        q: `"${entry.cik}"`,
        dateRange: 'custom',
        startdt: new Date(entry.lastCheck - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        enddt: new Date().toISOString().split('T')[0],
        forms: FILING_TYPES_WATCHED.join(','),
      });

      const resp = await fetch(`${EDGAR_SEARCH_BASE}?${params}`, {
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
      });

      if (!resp.ok) {
        // Fallback: use the company filings endpoint
        await this._checkViaFilings(symbol, entry);
        return;
      }

      const data = await resp.json();
      const hits = data?.hits?.hits || [];

      for (const hit of hits.slice(0, MAX_FILINGS_PER_CHECK)) {
        const src = hit._source || {};
        const accession = src.file_num || src.accession_no || `${src.file_date}-${src.form_type}`;

        if (this._filingCache.has(accession)) continue;

        const filing = {
          symbol,
          type: src.form_type || 'Unknown',
          title: src.display_names?.[0] || src.entity_name || symbol,
          description: src.file_description || '',
          date: src.file_date || new Date().toISOString().split('T')[0],
          accessionNumber: accession,
          url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${entry.cik}&type=${src.form_type || ''}&dateb=&owner=include&count=10`,
          timestamp: Date.now(),
        };

        this._filingCache.set(accession, filing);
        this._recentFilings.unshift(filing);
        this._emit(filing);
      }

      // Trim recent filings to 100
      if (this._recentFilings.length > 100) {
        this._recentFilings = this._recentFilings.slice(0, 100);
      }

      entry.lastCheck = Date.now();
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_err) {
      // Fallback to direct EDGAR filings
      await this._checkViaFilings(symbol, entry);
    }
  }

  /**
   * Fallback: use EdgarAdapter.fetchFilings() directly.
   */
  async _checkViaFilings(symbol, entry) {
    try {
      const { edgarAdapter } = await import('../../adapters/EdgarAdapter.js');
      const filings = await edgarAdapter.fetchFilings(symbol, null, MAX_FILINGS_PER_CHECK);

      for (const f of filings) {
        const accession = f.accessionNumber || `${f.filedAt}-${f.form}`;
        if (this._filingCache.has(accession)) continue;

        const filing = {
          symbol,
          type: f.form || 'Unknown',
          title: f.primaryDocDescription || f.form || symbol,
          description: f.primaryDocDescription || '',
          date: f.filedAt?.split('T')[0] || new Date().toISOString().split('T')[0],
          accessionNumber: accession,
          url: f.filingUrl || `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${entry.cik}`,
          timestamp: Date.now(),
        };

        this._filingCache.set(accession, filing);
        this._recentFilings.unshift(filing);
        this._emit(filing);
      }

      if (this._recentFilings.length > 100) {
        this._recentFilings = this._recentFilings.slice(0, 100);
      }

      entry.lastCheck = Date.now();
    } catch (err) {
      logger.data.warn(`[SECFilingMonitor] Fallback check failed for ${symbol}:`, err.message);
    }
  }

  async _emit(filing) {
    // Enrich filing with parsed data if it's an 8-K
    try {
      const { filingParser } = await import('./FilingParser.js');
      if (filing.type === '8-K' || filing.type?.startsWith('8-K')) {
        const parsed = filingParser.parse8K(filing.description || filing.title);
        filing.items = parsed.items;
        filing.urgency = parsed.urgency;
        filing.summary = parsed.summary;
        filing.isEarnings = parsed.isEarnings;
        filing.isMaterial = parsed.isMaterial;
      } else if (filing.type === '4') {
        const parsed = filingParser.parseForm4(filing.description || filing.title);
        filing.insider = parsed.insider;
        filing.urgency = parsed.urgency;
        filing.isMaterialBuy = parsed.isMaterialBuy;
      } else {
        filing.urgency = 2;
      }
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      filing.urgency = filing.urgency || 2;
    }

    // Fire filing callbacks
    for (const cb of this._callbacks) {
      try { cb(filing); } catch (e) { logger.data.warn('Operation failed', e); }
    }

    // Fire chart annotation callbacks
    if (this._annotationCallbacks.size > 0) {
      const annotation = {
        symbol: filing.symbol,
        type: 'sec_filing',
        filingType: filing.type,
        text: `${filing.type}: ${filing.title}`,
        timestamp: filing.timestamp || Date.now(),
        urgency: filing.urgency || 2,
        icon: filing.items?.[0]?.icon || '📄',
        color: (filing.urgency || 0) >= 4 ? '#ef4444' : (filing.urgency || 0) >= 3 ? '#f59e0b' : '#6b7280',
      };
      for (const cb of this._annotationCallbacks) {
        try { cb(annotation); } catch (e) { logger.data.warn('Operation failed', e); }
      }
    }

    // Desktop notification for high-urgency filings
    if ((filing.urgency || 0) >= 4 && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(`${filing.symbol} — ${filing.type}`, {
          body: filing.summary || filing.title,
          icon: '/favicon.ico',
          tag: `sec-${filing.accessionNumber}`,
        });
      // eslint-disable-next-line unused-imports/no-unused-vars
      } catch (_) { /* silent */ }
    }
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const secFilingMonitor = new _SECFilingMonitor();
export default secFilingMonitor;
