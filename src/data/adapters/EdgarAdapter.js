import { logger } from '@/observability/logger';
// ═══════════════════════════════════════════════════════════════════
// charEdge v12 — SEC EDGAR Adapter
//
// Free fundamental financial data from the U.S. SEC.
// No API key required — just a User-Agent header.
// Rate limit: 10 req/sec (generous).
//
// Data available:
//   - Income statements, balance sheets, cash flow (XBRL)
//   - 10-K, 10-Q, 8-K filing data
//   - Insider transactions (Form 4)
//   - Company facts and financial ratios
//
// Usage:
//   import { edgarAdapter } from './EdgarAdapter.js';
//   const facts = await edgarAdapter.fetchCompanyFacts('AAPL');
//   const filings = await edgarAdapter.fetchFilings('AAPL');
// ═══════════════════════════════════════════════════════════════════

const EDGAR_BASE = 'https://data.sec.gov';
const EFTS_BASE = 'https://efts.sec.gov/LATEST';
const USER_AGENT = 'charEdge/1.0 (contact@charEdge.app)';

// Common CIK lookups (top traded symbols)
const CIK_CACHE = new Map();
const FACT_CACHE = new Map(); // symbol → { data, expiry }
const CACHE_TTL = 3600000; // 1 hour (filings don't change often)

// ─── CIK Resolution ────────────────────────────────────────────

/**
 * Resolve a ticker symbol to its SEC CIK number.
 * @param {string} symbol - e.g., 'AAPL'
 * @returns {Promise<string|null>} CIK padded to 10 digits
 */
async function resolveCIK(symbol) {
  const upper = (symbol || '').toUpperCase().trim();
  if (CIK_CACHE.has(upper)) return CIK_CACHE.get(upper);

  try {
    const resp = await fetch(`${EDGAR_BASE}/submissions/company-tickers.json`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!resp.ok) return null;

    const data = await resp.json();
    // Data is { "0": { cik_str, ticker, title }, "1": { ... }, ... }
    for (const entry of Object.values(data)) {
      const ticker = (entry.ticker || '').toUpperCase();
      const cik = String(entry.cik_str).padStart(10, '0');
      CIK_CACHE.set(ticker, cik);
    }

    return CIK_CACHE.get(upper) || null;
  } catch (err) {
    logger.data.warn('[EdgarAdapter] CIK resolution failed:', err.message);
    return null;
  }
}

// ─── EDGAR Adapter ─────────────────────────────────────────────

class _EdgarAdapter {
  constructor() {
    this._initPromise = null;
  }

  /**
   * Fetch comprehensive company facts (financial statements as XBRL).
   * Returns metrics like Revenue, EPS, Assets, Liabilities, etc.
   * @param {string} symbol
   * @returns {Promise<Object|null>}
   */
  async fetchCompanyFacts(symbol) {
    // Check cache
    const cached = FACT_CACHE.get(symbol);
    if (cached && Date.now() < cached.expiry) return cached.data;

    const cik = await resolveCIK(symbol);
    if (!cik) return null;

    try {
      const resp = await fetch(`${EDGAR_BASE}/api/xbrl/companyfacts/CIK${cik}.json`, {
        headers: { 'User-Agent': USER_AGENT },
      });
      if (!resp.ok) return null;

      const data = await resp.json();
      FACT_CACHE.set(symbol, { data, expiry: Date.now() + CACHE_TTL });
      return data;
    } catch (err) {
      logger.data.warn('[EdgarAdapter] Company facts error:', err.message);
      return null;
    }
  }

  /**
   * Extract key financial metrics from company facts.
   * @param {string} symbol
   * @returns {Promise<Object|null>} { revenue, netIncome, eps, totalAssets, etc. }
   */
  async fetchKeyMetrics(symbol) {
    const facts = await this.fetchCompanyFacts(symbol);
    if (!facts?.facts) return null;

    const usGaap = facts.facts['us-gaap'] || {};

    const extractLatest = (concept) => {
      const series = usGaap[concept];
      if (!series?.units) return null;
      // Get USD values (or shares)
      const units = series.units.USD || series.units.shares || series.units['USD/shares'];
      if (!units?.length) return null;
      // Get most recent 10-K or 10-Q filing
      const sorted = [...units]
        .filter(u => u.form === '10-K' || u.form === '10-Q')
        .sort((a, b) => new Date(b.end) - new Date(a.end));
      return sorted[0] || null;
    };

    return {
      symbol: symbol.toUpperCase(),
      entityName: facts.entityName || symbol,
      revenue: extractLatest('Revenues') || extractLatest('RevenueFromContractWithCustomerExcludingAssessedTax'),
      netIncome: extractLatest('NetIncomeLoss'),
      eps: extractLatest('EarningsPerShareBasic'),
      epsDiluted: extractLatest('EarningsPerShareDiluted'),
      totalAssets: extractLatest('Assets'),
      totalLiabilities: extractLatest('Liabilities'),
      stockholdersEquity: extractLatest('StockholdersEquity'),
      cashAndEquivalents: extractLatest('CashAndCashEquivalentsAtCarryingValue'),
      operatingIncome: extractLatest('OperatingIncomeLoss'),
      grossProfit: extractLatest('GrossProfit'),
      totalRevenue: extractLatest('RevenueFromContractWithCustomerExcludingAssessedTax'),
      sharesOutstanding: extractLatest('CommonStockSharesOutstanding'),
    };
  }

  /**
   * Fetch recent filings (10-K, 10-Q, 8-K, etc.)
   * @param {string} symbol
   * @param {string} [type] - Filing type filter, e.g., '10-K', '10-Q'
   * @param {number} [limit=10]
   * @returns {Promise<Array>}
   */
  async fetchFilings(symbol, type = null, limit = 10) {
    const cik = await resolveCIK(symbol);
    if (!cik) return [];

    try {
      const resp = await fetch(`${EDGAR_BASE}/submissions/CIK${cik}.json`, {
        headers: { 'User-Agent': USER_AGENT },
      });
      if (!resp.ok) return [];

      const data = await resp.json();
      const recent = data.filings?.recent;
      if (!recent) return [];

      const filings = [];
      const count = Math.min(recent.form?.length || 0, 100);

      for (let i = 0; i < count && filings.length < limit; i++) {
        const form = recent.form[i];
        if (type && form !== type) continue;

        filings.push({
          form,
          filingDate: recent.filingDate[i],
          reportDate: recent.reportDate?.[i] || null,
          accessionNumber: recent.accessionNumber[i],
          primaryDocument: recent.primaryDocument[i],
          description: recent.primaryDocDescription?.[i] || '',
          url: `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${recent.accessionNumber[i].replace(/-/g, '')}/${recent.primaryDocument[i]}`,
        });
      }

      return filings;
    } catch (err) {
      logger.data.warn('[EdgarAdapter] Filings fetch failed:', err.message);
      return [];
    }
  }

  /**
   * Fetch insider transactions (Form 4) for a company.
   * @param {string} symbol
   * @param {number} [limit=20]
   * @returns {Promise<Array>}
   */
  async fetchInsiderTransactions(symbol, limit = 20) {
    // Use EFTS full-text search for insider filings
    const cik = await resolveCIK(symbol);
    if (!cik) return [];

    try {
      const filings = await this.fetchFilings(symbol, '4', limit);
      return filings.map(f => ({
        ...f,
        type: 'insider_transaction',
      }));
    } catch (err) {
      logger.data.warn('[EdgarAdapter] Insider transactions error:', err.message);
      return [];
    }
  }

  /**
   * Fetch 13F holdings for an institutional investor.
   * Parses the latest 13F-HR filing to extract portfolio positions.
   * @param {string} fundCIK - CIK of the fund (e.g., '0001067983' for Berkshire)
   * @param {number} [limit=50] - Max holdings to return
   * @returns {Promise<Array<{ nameOfIssuer, titleOfClass, cusip, value, shares, type }>>}
   */
  async fetch13FHoldings(fundCIK, limit = 50) {
    const cik = String(fundCIK).padStart(10, '0');

    try {
      // 1. Get the fund's recent filings to find the latest 13F-HR
      const resp = await fetch(`${EDGAR_BASE}/submissions/CIK${cik}.json`, {
        headers: { 'User-Agent': USER_AGENT },
      });
      if (!resp.ok) return [];

      const data = await resp.json();
      const recent = data.filings?.recent;
      if (!recent) return [];

      // Find the most recent 13F-HR filing
      let accession = null;
      for (let i = 0; i < (recent.form?.length || 0); i++) {
        if (recent.form[i] === '13F-HR' || recent.form[i] === '13F-HR/A') {
          accession = recent.accessionNumber[i];
          break;
        }
      }
      if (!accession) return [];

      // 2. Fetch the 13F-HR filing index to find the information table XML
      const accClean = accession.replace(/-/g, '');
      const cikNum = parseInt(cik);
      const indexResp = await fetch(
        `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accClean}/index.json`,
        { headers: { 'User-Agent': USER_AGENT } }
      );
      if (!indexResp.ok) return [];

      const indexData = await indexResp.json();
      const items = indexData.directory?.item || [];
      const infoTable = items.find(item =>
        item.name?.toLowerCase().includes('infotable') ||
        item.name?.toLowerCase().includes('information_table')
      );

      if (!infoTable) {
        // Fallback: try the primary document
        const xmlDoc = items.find(item =>
          item.name?.endsWith('.xml') && !item.name?.includes('primary_doc')
        );
        if (!xmlDoc) return [];
      }

      // 3. Fetch the information table XML
      const tableUrl = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accClean}/${infoTable?.name || ''}`;
      const tableResp = await fetch(tableUrl, {
        headers: { 'User-Agent': USER_AGENT },
      });
      if (!tableResp.ok) return [];

      const xmlText = await tableResp.text();

      // 4. Parse the XML into holdings
      const holdings = [];
      // Match infoTable entries — handles both ns1: and non-namespaced XML
      const entryRegex = /<(?:ns1:|)infoTable>([\s\S]*?)<\/(?:ns1:|)infoTable>/gi;
      let match;

      while ((match = entryRegex.exec(xmlText)) !== null && holdings.length < limit) {
        const entry = match[1];
        const extract = (tag) => {
          const m = entry.match(new RegExp(`<(?:ns1:|)${tag}>([^<]*)<`, 'i'));
          return m ? m[1].trim() : '';
        };

        holdings.push({
          nameOfIssuer: extract('nameOfIssuer'),
          titleOfClass: extract('titleOfClass'),
          cusip: extract('cusip'),
          value: parseInt(extract('value')) * 1000 || 0, // 13F reports in thousands
          shares: parseInt(extract('sshPrnamt')) || 0,
          type: extract('sshPrnamtType') || 'SH',
        });
      }

      // Sort by value descending
      holdings.sort((a, b) => b.value - a.value);
      return holdings.slice(0, limit);
    } catch (err) {
      logger.data.warn('[EdgarAdapter] 13F holdings error:', err.message);
      return [];
    }
  }

  /**
   * Search for institutional investors by name.
   * @param {string} name - e.g., 'Berkshire', 'Citadel'
   * @param {number} [limit=10]
   * @returns {Promise<Array<{ name, cik }>>}
   */
  async searchInstitutions(name, limit = 10) {
    try {
      const resp = await fetch(
        `${EFTS_BASE}/search-index?q="${encodeURIComponent(name)}"&dateRange=custom&startdt=2020-01-01&forms=13F-HR`,
        { headers: { 'User-Agent': USER_AGENT } }
      );
      if (!resp.ok) return [];

      const data = await resp.json();
      const hits = data.hits?.hits || [];
      const seen = new Set();
      const results = [];

      for (const hit of hits) {
        const entity = hit._source?.display_names?.[0] || hit._source?.entity_name || '';
        const cik = String(hit._source?.entity_id || '').padStart(10, '0');
        if (!seen.has(cik) && entity) {
          seen.add(cik);
          results.push({ name: entity, cik });
          if (results.length >= limit) break;
        }
      }

      return results;
    } catch (err) {
      logger.data.warn('[EdgarAdapter] Institution search error:', err.message);
      return [];
    }
  }

  /**
   * Search for companies in EDGAR.
   * @param {string} query
   * @param {number} [limit=10]
   * @returns {Promise<Array<{ symbol, name, cik }>>}
   */
  async searchCompanies(query, limit = 10) {
    // This is throttled — we only search our local CIK cache
    // after the first resolution populates it
    if (CIK_CACHE.size === 0) {
      await resolveCIK('AAPL'); // Trigger cache population
    }

    const q = query.toUpperCase();
    const results = [];

    for (const [ticker, cik] of CIK_CACHE.entries()) {
      if (ticker.includes(q)) {
        results.push({ symbol: ticker, cik });
        if (results.length >= limit) break;
      }
    }

    return results;
  }

  /**
   * Check if a symbol has EDGAR data (US-listed equities only).
   * @param {string} symbol
   * @returns {boolean}
   */
  supports(symbol) {
    const upper = (symbol || '').toUpperCase();
    // US equity: 1-5 uppercase letters, no crypto pairs
    return /^[A-Z]{1,5}$/.test(upper);
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const edgarAdapter = new _EdgarAdapter();

export default edgarAdapter;
