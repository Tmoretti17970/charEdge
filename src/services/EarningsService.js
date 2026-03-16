// ═══════════════════════════════════════════════════════════════════
// charEdge — Earnings Calendar Service (Sprint 33)
//
// Mock service providing earnings data for stocks.
// Returns dates, analyst estimates, and beat/miss indicators.
// Designed for expansion with a real API later.
// ═══════════════════════════════════════════════════════════════════

const now = Date.now();
const DAY = 86400_000;

// Mock earnings data — expand as needed
const EARNINGS_DATA = {
  SPY: {
    symbol: 'SPY',
    nextDate: new Date(now + 14 * DAY).toISOString().split('T')[0],
    time: 'AMC', // AMC = After Market Close, BMO = Before Market Open
    epsEstimate: 5.12,
    revenueEstimate: 143_500_000_000,
    lastReported: {
      date: new Date(now - 90 * DAY).toISOString().split('T')[0],
      epsActual: 5.28,
      epsEstimate: 5.05,
      revenueActual: 141_200_000_000,
      revenueEstimate: 140_800_000_000,
      surprise: 4.6,
      beat: true,
    },
  },
  TSLA: {
    symbol: 'TSLA',
    nextDate: new Date(now + 5 * DAY).toISOString().split('T')[0],
    time: 'AMC',
    epsEstimate: 0.73,
    revenueEstimate: 25_200_000_000,
    lastReported: {
      date: new Date(now - 60 * DAY).toISOString().split('T')[0],
      epsActual: 0.71,
      epsEstimate: 0.68,
      revenueActual: 24_800_000_000,
      revenueEstimate: 24_500_000_000,
      surprise: 4.4,
      beat: true,
    },
  },
  NVDA: {
    symbol: 'NVDA',
    nextDate: new Date(now + 3 * DAY).toISOString().split('T')[0],
    time: 'BMO',
    epsEstimate: 0.89,
    revenueEstimate: 38_500_000_000,
    lastReported: {
      date: new Date(now - 45 * DAY).toISOString().split('T')[0],
      epsActual: 0.92,
      epsEstimate: 0.85,
      revenueActual: 37_800_000_000,
      revenueEstimate: 36_900_000_000,
      surprise: 8.2,
      beat: true,
    },
  },
  AAPL: {
    symbol: 'AAPL',
    nextDate: new Date(now + 21 * DAY).toISOString().split('T')[0],
    time: 'AMC',
    epsEstimate: 1.62,
    revenueEstimate: 94_300_000_000,
    lastReported: {
      date: new Date(now - 75 * DAY).toISOString().split('T')[0],
      epsActual: 1.58,
      epsEstimate: 1.55,
      revenueActual: 93_800_000_000,
      revenueEstimate: 92_500_000_000,
      surprise: 1.9,
      beat: true,
    },
  },
  MSFT: {
    symbol: 'MSFT',
    nextDate: new Date(now + 10 * DAY).toISOString().split('T')[0],
    time: 'AMC',
    epsEstimate: 3.22,
    revenueEstimate: 68_100_000_000,
    lastReported: {
      date: new Date(now - 80 * DAY).toISOString().split('T')[0],
      epsActual: 3.10,
      epsEstimate: 3.15,
      revenueActual: 67_400_000_000,
      revenueEstimate: 67_800_000_000,
      surprise: -1.6,
      beat: false,
    },
  },
};

/**
 * Fetch earnings data for a specific symbol.
 * @param {string} symbol
 * @returns {Promise<Object|null>}
 */
export async function fetchEarnings(symbol) {
  const sym = (symbol || '').toUpperCase();
  return EARNINGS_DATA[sym] || null;
}

/**
 * Get symbols with upcoming earnings from a list of symbols.
 * @param {string[]} symbols
 * @param {number} [withinDays=14] - Only return if earnings within N days
 * @returns {Promise<Object[]>} Sorted by date
 */
export async function getUpcomingEarnings(symbols, withinDays = 14) {
  const results = [];
  const cutoff = Date.now() + withinDays * DAY;

  for (const sym of symbols) {
    const data = EARNINGS_DATA[sym.toUpperCase()];
    if (data) {
      const earningsDate = new Date(data.nextDate).getTime();
      if (earningsDate <= cutoff) {
        const daysAway = Math.ceil((earningsDate - Date.now()) / DAY);
        results.push({ ...data, daysAway });
      }
    }
  }

  return results.sort((a, b) => a.daysAway - b.daysAway);
}

/**
 * Check if earnings are within N days for a symbol.
 * @param {string} symbol
 * @param {number} [days=7]
 * @returns {boolean}
 */
export function hasUpcomingEarnings(symbol, days = 7) {
  const data = EARNINGS_DATA[(symbol || '').toUpperCase()];
  if (!data) return false;
  const earningsDate = new Date(data.nextDate).getTime();
  const cutoff = Date.now() + days * DAY;
  return earningsDate <= cutoff;
}

/**
 * Format revenue in readable format.
 */
export function fmtRevenue(n) {
  if (!n) return '—';
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  return '$' + n.toLocaleString();
}
