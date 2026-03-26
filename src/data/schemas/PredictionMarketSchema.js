/**
 * PredictionMarketSchema.js
 *
 * Canonical schema for normalized prediction market data.
 * All adapters (Kalshi, Polymarket, Metaculus, Manifold, Drift) normalize
 * their data to this shape before it enters the store.
 */

/**
 * @typedef {Object} PredictionOutcome
 * @property {string}  label              - Outcome label (e.g. "Yes", "No", "$90", "December 31")
 * @property {number}  probability        - Current probability 0-100
 * @property {number}  previousProbability - Previous probability for delta calc
 * @property {number}  volume             - Volume on this specific outcome
 * @property {number}  payoutMultiplier   - Payout multiplier (e.g. 1.05, 31.2)
 */

/**
 * @typedef {'binary'|'multi'|'scalar'} MarketType
 */

/**
 * @typedef {'open'|'closed'|'resolved'|'voided'} MarketStatus
 */

/**
 * @typedef {'economics'|'markets'|'crypto'|'politics'|'sports'|'tech'|'culture'|'climate'|'science'|'entertainment'|'geopolitics'|'health'|'legal'|'finance'|'other'} MarketCategory
 */

/**
 * @typedef {'kalshi'|'polymarket'|'metaculus'|'manifold'|'drift'} MarketSource
 */

/**
 * @typedef {Object} PredictionMarket
 * @property {string}            id                  - Unique ID prefixed by source (e.g. "kalshi-FED-RATE-CUT")
 * @property {MarketSource}      source              - Platform source
 * @property {string}            question             - Market question / title
 * @property {string}            [description]        - Longer description or resolution criteria
 * @property {MarketCategory}    category             - Primary category
 * @property {string}            [subcategory]        - Subcategory (e.g. "Fed", "S&P 500", "Bitcoin")
 * @property {PredictionOutcome[]} outcomes           - All outcomes with probabilities
 * @property {MarketType}        marketType           - binary, multi, or scalar
 * @property {MarketStatus}      status               - Current market status
 * @property {number}            volume24h            - 24-hour trading volume in USD
 * @property {number}            [totalVolume]        - All-time trading volume in USD
 * @property {number}            [openInterest]       - Current open interest in USD
 * @property {number}            [liquidity]          - Current liquidity/depth in USD
 * @property {number}            change24h            - 24h probability change (leading outcome)
 * @property {string}            [closeDate]          - ISO timestamp for market close/resolution
 * @property {string}            [createdDate]        - ISO timestamp for market creation
 * @property {string}            [resolutionSource]   - Who/what resolves this market
 * @property {string}            [resolvedOutcome]    - Winning outcome (if resolved)
 * @property {string[]}          relatedTickers       - Related asset tickers (NVDA, BTC, SPY...)
 * @property {string[]}          tags                 - Topic tags for filtering/grouping
 * @property {string}            [imageUrl]           - Event image URL
 * @property {string}            url                  - Link to market on source platform
 * @property {number}            [relatedMarketCount] - Number of related sub-markets in this event
 * @property {PredictionMarket[]} [sourceVariants]    - Same market from other platforms (for cross-platform comparison)
 */

// ─── Valid categories ───────────────────────────────────────────────
export const CATEGORIES = [
  'trending',
  'new',
  'politics',
  'sports',
  'crypto',
  'finance',
  'tech',
  'culture',
  'economy',
  'climate',
  'science',
  'entertainment',
  'geopolitics',
  'health',
  'legal',
  'other',
];

// ─── Valid sources ──────────────────────────────────────────────────
export const SOURCES = ['kalshi', 'polymarket', 'metaculus', 'manifold', 'drift', 'other'];

// ─── Valid market types ─────────────────────────────────────────────
export const MARKET_TYPES = ['binary', 'multi', 'scalar'];

// ─── Valid statuses ─────────────────────────────────────────────────
export const MARKET_STATUSES = ['open', 'closed', 'resolved', 'voided'];

// ─── Category display config ────────────────────────────────────────
export const CATEGORY_CONFIG = {
  trending: { label: 'Trending', color: '#f97316', icon: '🔥' },
  new: { label: 'New', color: '#22c55e', icon: '✨' },
  politics: { label: 'Politics', color: '#a855f7', icon: '🏛️' },
  sports: { label: 'Sports', color: '#06b6d4', icon: '⚽' },
  crypto: { label: 'Crypto', color: '#f59e0b', icon: '₿' },
  finance: { label: 'Finance', color: '#3b82f6', icon: '📈' },
  tech: { label: 'Tech', color: '#8b5cf6', icon: '💻' },
  culture: { label: 'Culture', color: '#ec4899', icon: '🎭' },
  economy: { label: 'Economy', color: '#5c9cf5', icon: '🏦' },
  climate: { label: 'Climate', color: '#10b981', icon: '🌍' },
  science: { label: 'Science', color: '#14b8a6', icon: '🔬' },
  entertainment: { label: 'Entertainment', color: '#f472b6', icon: '🎬' },
  geopolitics: { label: 'Geopolitics', color: '#ef4444', icon: '🌐' },
  health: { label: 'Health', color: '#22d3ee', icon: '🏥' },
  legal: { label: 'Legal', color: '#64748b', icon: '⚖️' },
  other: { label: 'Other', color: '#94a3b8', icon: '📌' },
};

// ─── Source display config ──────────────────────────────────────────
export const SOURCE_CONFIG = {
  kalshi: { label: 'Kalshi', badge: 'K', color: '#6366f1' },
  polymarket: { label: 'Polymarket', badge: 'P', color: '#3b82f6' },
  metaculus: { label: 'Metaculus', badge: 'M', color: '#10b981' },
  manifold: { label: 'Manifold', badge: 'F', color: '#f59e0b' },
  drift: { label: 'Drift', badge: 'D', color: '#8b5cf6' },
};

// ─── Time bucket classification ─────────────────────────────────────
export const TIME_BUCKETS = [
  { id: 'all', label: 'All', icon: '⊞' },
  { id: '5min', label: '5 Minutes', icon: '⏱️', maxMs: 5 * 60 * 1000 },
  { id: '15min', label: '15 Minutes', icon: '⏱️', maxMs: 15 * 60 * 1000 },
  { id: 'hourly', label: 'Hourly', icon: '🕐', maxMs: 60 * 60 * 1000 },
  { id: 'daily', label: 'Daily', icon: '📅', maxMs: 24 * 60 * 60 * 1000 },
  { id: 'weekly', label: 'Weekly', icon: '📆', maxMs: 7 * 24 * 60 * 60 * 1000 },
  { id: 'monthly', label: 'Monthly', icon: '📊', maxMs: 31 * 24 * 60 * 60 * 1000 },
  { id: 'yearly', label: 'Yearly', icon: '📈', maxMs: 365 * 24 * 60 * 60 * 1000 },
  { id: 'oneOff', label: 'One Off', icon: '🎯' },
  { id: 'custom', label: 'Custom', icon: '⚙️' },
];

// ─── Schema validation ──────────────────────────────────────────────

const REQUIRED_FIELDS = ['id', 'source', 'question', 'category', 'outcomes', 'marketType', 'url'];

/**
 * Validate a market object against the canonical schema.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 */
export function validateMarket(market) {
  const errors = [];

  for (const field of REQUIRED_FIELDS) {
    if (market[field] == null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (market.outcomes && !Array.isArray(market.outcomes)) {
    errors.push('outcomes must be an array');
  } else if (market.outcomes?.length === 0) {
    errors.push('outcomes must have at least one entry');
  }

  if (market.outcomes) {
    for (let i = 0; i < market.outcomes.length; i++) {
      const o = market.outcomes[i];
      if (!o.label) errors.push(`outcomes[${i}] missing label`);
      if (typeof o.probability !== 'number' || o.probability < 0 || o.probability > 100) {
        errors.push(`outcomes[${i}] probability must be 0-100, got ${o.probability}`);
      }
    }
  }

  if (market.source && !SOURCES.includes(market.source)) {
    errors.push(`Invalid source: ${market.source}`);
  }

  if (market.marketType && !MARKET_TYPES.includes(market.marketType)) {
    errors.push(`Invalid marketType: ${market.marketType}`);
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/**
 * Create a normalized market object with defaults.
 * Adapters use this to ensure consistent shape.
 */
export function createMarket(data) {
  return {
    id: data.id,
    source: data.source,
    question: data.question,
    description: data.description || '',
    category: data.category || 'other',
    subcategory: data.subcategory || null,
    outcomes: (data.outcomes || []).map((o) => ({
      label: o.label,
      probability: o.probability ?? 0,
      previousProbability: o.previousProbability ?? o.probability ?? 0,
      volume: o.volume ?? 0,
      payoutMultiplier: o.payoutMultiplier ?? 0,
    })),
    marketType: data.marketType || 'binary',
    status: data.status || 'open',
    volume24h: data.volume24h ?? 0,
    totalVolume: data.totalVolume ?? 0,
    openInterest: data.openInterest ?? 0,
    liquidity: data.liquidity ?? 0,
    change24h: data.change24h ?? 0,
    closeDate: data.closeDate || null,
    createdDate: data.createdDate || null,
    resolutionSource: data.resolutionSource || null,
    resolvedOutcome: data.resolvedOutcome || null,
    relatedTickers: data.relatedTickers || [],
    tags: data.tags || [],
    imageUrl: data.imageUrl || null,
    url: data.url,
    relatedMarketCount: data.relatedMarketCount ?? 0,
    sourceVariants: data.sourceVariants || [],
  };
}

/**
 * Get the leading outcome (highest probability) from a market.
 */
export function getLeadingOutcome(market) {
  if (!market.outcomes?.length) return null;
  return market.outcomes.reduce((best, o) => (o.probability > best.probability ? o : best));
}

/**
 * Get the 24h probability delta for the leading outcome.
 */
export function getLeadingDelta(market) {
  const lead = getLeadingOutcome(market);
  if (!lead) return 0;
  return lead.probability - lead.previousProbability;
}

/**
 * Determine if a market is binary (exactly 2 outcomes).
 */
export function isBinaryMarket(market) {
  return market.marketType === 'binary' || market.outcomes?.length === 2;
}

/**
 * Format volume for display (e.g. 1234567 → "$1.23M").
 */
export function formatVolume(value) {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

/**
 * Format a payout multiplier (e.g. 1.05 → "1.05x").
 */
export function formatMultiplier(mult) {
  if (!mult || mult <= 1) return null;
  return `${mult.toFixed(2)}x`;
}

/**
 * Compute time remaining until close date as human-readable string.
 */
export function timeToClose(closeDate) {
  if (!closeDate) return null;
  const ms = new Date(closeDate).getTime() - Date.now();
  if (ms <= 0) return 'Closed';
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return `${Math.floor(ms / 60_000)}m`;
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}
