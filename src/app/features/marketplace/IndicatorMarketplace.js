// ═══════════════════════════════════════════════════════════════════
// charEdge — Community Indicator Marketplace (Sprint 19)
// Local marketplace for sharing and discovering custom indicators.
// Stores community indicators in localStorage as a concept.
// ═══════════════════════════════════════════════════════════════════

const MARKET_KEY = 'charEdge-indicator-market';

let _marketplace = [];
try {
  const raw = localStorage.getItem(MARKET_KEY);
  if (raw) _marketplace = JSON.parse(raw);
} catch (_) { /* storage may be blocked */ }

const CATEGORIES = ['trend', 'momentum', 'volatility', 'volume', 'oscillator', 'custom'];

/**
 * Publish a custom indicator to the marketplace.
 */
export function publishIndicator({
  name, description, category, author = 'You',
  code, params = {}, version = '1.0.0',
}) {
  const indicator = {
    id: `ci_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    description,
    category: CATEGORIES.includes(category) ? category : 'custom',
    author,
    code, // Pine-like script or JS function string
    params,
    version,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    downloads: 0,
    rating: 0,
    ratingCount: 0,
    reviews: [],
    tags: [name.toLowerCase(), category],
  };

  _marketplace = [indicator, ..._marketplace];
  try { localStorage.setItem(MARKET_KEY, JSON.stringify(_marketplace)); } catch (_) { /* storage may be blocked */ }
  return indicator;
}

/**
 * Search marketplace.
 */
export function searchMarketplace(query = '', filter = {}) {
  let results = [..._marketplace];
  if (query) {
    const q = query.toLowerCase();
    results = results.filter(i =>
      i.name.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q) ||
      i.tags.some(t => t.includes(q))
    );
  }
  if (filter.category) results = results.filter(i => i.category === filter.category);
  if (filter.author) results = results.filter(i => i.author === filter.author);
  if (filter.sortBy === 'popular') results.sort((a, b) => b.downloads - a.downloads);
  if (filter.sortBy === 'rating') results.sort((a, b) => b.rating - a.rating);
  if (filter.sortBy === 'newest') results.sort((a, b) => b.createdAt - a.createdAt);
  return results;
}

/**
 * Download/install an indicator.
 */
export function installIndicator(indicatorId) {
  const indicator = _marketplace.find(i => i.id === indicatorId);
  if (indicator) {
    indicator.downloads++;
    try { localStorage.setItem(MARKET_KEY, JSON.stringify(_marketplace)); } catch (_) { /* storage may be blocked */ }
    return { ...indicator, installed: true, installedAt: Date.now() };
  }
  return null;
}

/**
 * Rate an indicator.
 */
export function rateIndicator(indicatorId, rating, review = '') {
  const indicator = _marketplace.find(i => i.id === indicatorId);
  if (indicator) {
    indicator.ratingCount++;
    indicator.rating = ((indicator.rating * (indicator.ratingCount - 1)) + rating) / indicator.ratingCount;
    if (review) {
      indicator.reviews.push({ text: review, rating, date: Date.now() });
    }
    try { localStorage.setItem(MARKET_KEY, JSON.stringify(_marketplace)); } catch (_) { /* storage may be blocked */ }
  }
  return indicator;
}

/**
 * Get featured/curated indicators.
 */
export function getFeaturedIndicators() {
  return [
    { id: 'featured_squeeze', name: 'TTM Squeeze Pro', category: 'momentum', desc: 'Bollinger/Keltner squeeze detection with momentum bars', builtin: true },
    { id: 'featured_sr', name: 'Auto S/R Zones', category: 'trend', desc: 'Automatic support/resistance zone detection', builtin: true },
    { id: 'featured_hma', name: 'Hull MA Cloud', category: 'trend', desc: 'Hull Moving Average with cloud fills', builtin: true },
    { id: 'featured_vwma', name: 'VWMA Ribbon', category: 'volume', desc: 'Volume-weighted MA ribbon (8 periods)', builtin: true },
    { id: 'featured_divergence', name: 'RSI Divergence Scanner', category: 'momentum', desc: 'Auto-detect bullish/bearish RSI divergences', builtin: true },
  ];
}

export function getCategories() { return CATEGORIES; }
export function getMarketplaceStats() {
  return {
    total: _marketplace.length,
    authors: [...new Set(_marketplace.map(i => i.author))].length,
    totalDownloads: _marketplace.reduce((s, i) => s + i.downloads, 0),
  };
}
