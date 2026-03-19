// ═══════════════════════════════════════════════════════════════════
// charEdge — Format Recognizer (Phase 8 Sprint 8.7)
//
// Auto-detects broker from file content using header patterns,
// date formats, and column name heuristics. Returns confidence
// score + detected broker ID for auto-routing to correct parser.
// ═══════════════════════════════════════════════════════════════════

// ─── Broker Signatures ──────────────────────────────────────────

const BROKER_SIGNATURES = {
  coinbase: {
    headers: ['Timestamp', 'Transaction Type', 'Asset', 'Quantity Transacted', 'Spot Price'],
    patterns: [/coinbase/i, /crypto.*currency/i],
    weight: 1.0,
  },
  binance: {
    headers: ['Date(UTC)', 'Pair', 'Side', 'Price', 'Executed', 'Amount', 'Fee'],
    patterns: [/binance/i, /USDT/],
    weight: 1.0,
  },
  kraken: {
    headers: ['txid', 'ordertxid', 'pair', 'time', 'type', 'ordertype', 'price', 'cost', 'fee', 'vol'],
    patterns: [/kraken/i, /^XXBT/, /^XETH/],
    weight: 1.0,
  },
  bybit: {
    headers: ['Symbol', 'Side', 'Order Type', 'Avg. Filled Price', 'Filled', 'Total', 'Fee Paid'],
    patterns: [/bybit/i],
    weight: 1.0,
  },
  robinhood: {
    headers: ['Activity Date', 'Process Date', 'Settle Date', 'Instrument', 'Trans Code', 'Quantity', 'Price', 'Amount'],
    patterns: [/robinhood/i, /Trans Code/i],
    weight: 1.0,
  },
  thinkorswim: {
    headers: ['Exec Time', 'Spread', 'Side', 'Qty', 'Pos Effect', 'Symbol', 'Exp', 'Strike'],
    patterns: [/thinkorswim/i, /tdameritrade/i, /Pos Effect/i],
    weight: 1.0,
  },
  ibkr: {
    headers: ['TradeDate', 'Symbol', 'Buy/Sell', 'Quantity', 'TradePrice', 'Commission', 'NetCash'],
    patterns: [/Interactive Brokers/i, /IBKR/i, /Flex/i],
    weight: 1.0,
  },
  mt5: {
    headers: ['Time', 'Type', 'Symbol', 'Volume', 'Price', 'Profit', 'Commission', 'Swap'],
    patterns: [/MetaTrader/i, /MT4|MT5/i, /\.pro\b/i, /\.raw\b/i],
    weight: 1.0,
  },
  tradovate: {
    headers: ['OrderId', 'AccountId', 'ContractName', 'Side', 'AvgFillPrice', 'Qty'],
    patterns: [/tradovate/i],
    weight: 1.0,
  },
  fidelity: {
    headers: ['Run Date', 'Account', 'Action', 'Symbol', 'Description', 'Type', 'Quantity', 'Price ($)', 'Amount ($)'],
    patterns: [/fidelity/i, /Run Date/i],
    weight: 1.0,
  },
  tradestation: {
    headers: ['OrderNumber', 'Symbol', 'Side', 'Qty Filled', 'Fill Price', 'Duration'],
    patterns: [/tradestation/i],
    weight: 1.0,
  },
  webull: {
    headers: ['Symbol', 'Side', 'Status', 'Filled', 'Total Qty', 'Avg Price', 'Placed Time'],
    patterns: [/webull/i],
    weight: 1.0,
  },
  ninjatrader: {
    headers: ['Account', 'Instrument', 'Market pos.', 'Quantity', 'Entry price', 'Exit price', 'Profit'],
    patterns: [/NinjaTrader/i, /Market pos\./i],
    weight: 1.0,
  },
};

// ─── Detection Logic ────────────────────────────────────────────

/**
 * Detect broker from file content.
 *
 * @param {string} content - Raw file text (first ~5KB is enough)
 * @param {string[]} headers - Parsed column headers
 * @returns {{ broker: string|null, confidence: number, alternatives: Array<{broker: string, score: number}> }}
 */
export function detectBroker(content, headers = []) {
  const scores = {};

  for (const [brokerId, sig] of Object.entries(BROKER_SIGNATURES)) {
    let score = 0;

    // Header matching — each matched header adds points
    const headerLower = headers.map((h) => h.toLowerCase().trim());
    const sigHeaderLower = sig.headers.map((h) => h.toLowerCase());
    let headerMatches = 0;

    for (const sh of sigHeaderLower) {
      if (headerLower.includes(sh)) headerMatches++;
      // Fuzzy: check if any header contains the signature header
      else if (headerLower.some((h) => h.includes(sh) || sh.includes(h))) headerMatches += 0.5;
    }

    score += (headerMatches / sig.headers.length) * 60 * sig.weight;

    // Pattern matching against full content
    for (const pattern of sig.patterns) {
      if (pattern.test(content)) score += 15;
    }

    scores[brokerId] = Math.min(100, score);
  }

  // Sort by score
  const sorted = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .filter(([, s]) => s > 10);

  if (sorted.length === 0) {
    return { broker: null, confidence: 0, alternatives: [] };
  }

  return {
    broker: sorted[0][0],
    confidence: Math.round(sorted[0][1]),
    alternatives: sorted.slice(1, 4).map(([broker, score]) => ({
      broker,
      score: Math.round(score),
    })),
  };
}

/**
 * Detect format type (CSV, HTML, JSON, OFX, Excel).
 *
 * @param {string} content - First few KB of file content
 * @param {string} fileName - Original file name
 * @returns {{ format: string, confidence: number }}
 */
export function detectFormat(content, fileName = '') {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const trimmed = content.trim();

  if (ext === 'xlsx' || ext === 'xls') return { format: 'excel', confidence: 100 };
  if (ext === 'ofx' || ext === 'qfx' || ext === 'qif') return { format: 'ofx', confidence: 100 };

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return { format: 'json', confidence: 95 };
  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<OFX')) return { format: 'ofx', confidence: 90 };
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<table')) return { format: 'html', confidence: 90 };

  // CSV detection: check for consistent delimiter
  const lines = trimmed.split('\n').slice(0, 5);
  const commaCount = lines.map((l) => (l.match(/,/g) || []).length);
  const tabCount = lines.map((l) => (l.match(/\t/g) || []).length);

  if (tabCount[0] > 2 && tabCount.every((c) => Math.abs(c - tabCount[0]) <= 1)) {
    return { format: 'tsv', confidence: 90 };
  }
  if (commaCount[0] > 1 && commaCount.every((c) => Math.abs(c - commaCount[0]) <= 1)) {
    return { format: 'csv', confidence: 85 };
  }

  return { format: 'unknown', confidence: 0 };
}

export default { detectBroker, detectFormat };
