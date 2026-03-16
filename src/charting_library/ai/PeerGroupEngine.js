// ═══════════════════════════════════════════════════════════════════
// charEdge — Peer Group Engine (Sprint 21)
//
// Auto-detect similar assets based on:
//   1. Same asset class (primary match)
//   2. Name/sector keyword similarity
//   3. Price movement correlation (change proximity)
//
// Returns top 5 peers ranked by composite similarity score (0–1).
// ═══════════════════════════════════════════════════════════════════

// ─── Sector keywords ───────────────────────────────────────────

const SECTOR_KEYWORDS = {
  defi: ['swap', 'lend', 'borrow', 'yield', 'dex', 'aave', 'compound', 'uniswap', 'sushi', 'curve', 'maker'],
  layer1: ['ethereum', 'solana', 'avalanche', 'cardano', 'polkadot', 'cosmos', 'near', 'fantom', 'sui', 'aptos'],
  layer2: ['polygon', 'arbitrum', 'optimism', 'zksync', 'starknet', 'base', 'scroll', 'mantle'],
  meme: ['doge', 'shib', 'pepe', 'floki', 'bonk', 'wif', 'meme'],
  tech: ['apple', 'microsoft', 'google', 'nvidia', 'meta', 'amazon', 'tesla', 'netflix'],
  finance: ['jpmorgan', 'goldman', 'bank', 'visa', 'mastercard', 'paypal', 'square'],
  energy: ['exxon', 'chevron', 'shell', 'bp', 'oil', 'gas', 'solar', 'wind', 'energy'],
  etfs: ['spy', 'qqq', 'iwm', 'dia', 'voo', 'vti', 'xlf', 'xlk', 'xle'],
  futures: ['es', 'nq', 'ym', 'rty', 'cl', 'gc', 'si', 'ng', 'zb', 'zn'],
  stablecoin: ['usdt', 'usdc', 'dai', 'busd', 'tusd', 'frax'],
};

function detectSector(symbol, name) {
  const combined = `${symbol} ${name}`.toLowerCase();
  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    if (keywords.some((kw) => combined.includes(kw))) return sector;
  }
  return 'other';
}

// ─── Similarity scoring ────────────────────────────────────────

function computeSimilarity(target, candidate) {
  let score = 0;

  // Same asset class = strong signal (0.4)
  if (target.assetClass === candidate.assetClass) score += 0.4;

  // Same sector = strong signal (0.3)
  if (target.sector === candidate.sector && target.sector !== 'other') score += 0.3;

  // Price change proximity (0.2 max)
  const changeDiff = Math.abs((target.change ?? 0) - (candidate.change ?? 0));
  score += Math.max(0, 0.2 - changeDiff * 0.02);

  // Name keyword overlap (0.1 max)
  const targetWords = target.name?.toLowerCase().split(/\s+/) || [];
  const candidateWords = candidate.name?.toLowerCase().split(/\s+/) || [];
  const overlap = targetWords.filter((w) =>
    w.length > 2 && candidateWords.includes(w),
  ).length;
  score += Math.min(0.1, overlap * 0.05);

  return Math.min(1, score);
}

// ─── Public API ────────────────────────────────────────────────

/**
 * Find the top N most similar assets to the target symbol.
 * @param {string} targetSymbol - e.g. "BTCUSDT"
 * @param {Array} allItems - full watchlist items (with price, change, etc.)
 * @param {number} [limit=5] - max peers to return
 * @returns {Array<{ symbol, name, assetClass, similarity, change }>}
 */
export function detectPeers(targetSymbol, allItems, limit = 5) {
  const target = allItems.find((i) => i.symbol === targetSymbol);
  if (!target) return [];

  const targetEnriched = {
    ...target,
    sector: detectSector(target.symbol, target.name || ''),
  };

  const candidates = allItems
    .filter((item) => item.symbol !== targetSymbol)
    .map((item) => ({
      ...item,
      sector: detectSector(item.symbol, item.name || ''),
    }))
    .map((candidate) => ({
      symbol: candidate.symbol,
      name: candidate.name,
      assetClass: candidate.assetClass,
      change: candidate.change24h ?? candidate.change ?? 0,
      price: candidate.price ?? 0,
      similarity: computeSimilarity(targetEnriched, candidate),
    }))
    .filter((c) => c.similarity > 0.2) // Minimum threshold
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return candidates;
}

export default { detectPeers };
