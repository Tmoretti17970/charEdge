// ═══════════════════════════════════════════════════════════════════
// charEdge — Prediction Market Deduplicator
//
// Identifies and merges duplicate markets across platforms using
// semantic similarity via TF-IDF scoring and entity extraction.
// ═══════════════════════════════════════════════════════════════════

const STOPWORDS = new Set([
  'will',
  'the',
  'a',
  'an',
  'by',
  'in',
  'at',
  'to',
  'of',
  'be',
  'is',
  'on',
  'for',
  'before',
  'after',
  'above',
  'below',
  'and',
  'or',
  'not',
  'this',
  'that',
  'what',
  'how',
  'when',
  'end',
  'hit',
  'reach',
  'close',
]);

// Similarity threshold — markets above this are considered duplicates
const SIMILARITY_THRESHOLD = 0.55;

/**
 * Deduplicate markets across platforms.
 * Returns { markets, duplicatesRemoved }.
 *
 * Markets with >SIMILARITY_THRESHOLD word overlap are considered duplicates.
 * The market with the highest volume24h wins; others are stored in sourceVariants[].
 */
export function deduplicateMarkets(markets) {
  if (!markets?.length) return { markets: [], duplicatesRemoved: 0 };

  // Build normalized token sets for each market
  const tokenized = markets.map((m) => ({
    market: m,
    tokens: tokenize(m.question),
    entities: extractEntities(m.question),
  }));

  const groups = []; // Each group is a cluster of similar markets
  const assigned = new Set();

  for (let i = 0; i < tokenized.length; i++) {
    if (assigned.has(i)) continue;

    const group = [i];
    assigned.add(i);

    for (let j = i + 1; j < tokenized.length; j++) {
      if (assigned.has(j)) continue;

      const similarity = computeSimilarity(tokenized[i], tokenized[j]);
      if (similarity >= SIMILARITY_THRESHOLD) {
        group.push(j);
        assigned.add(j);
      }
    }

    groups.push(group);
  }

  // For each group, pick the winner (highest volume) and attach variants
  const dedupedMarkets = [];
  let duplicatesRemoved = 0;

  for (const group of groups) {
    const groupMarkets = group.map((idx) => tokenized[idx].market);
    groupMarkets.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));

    const winner = { ...groupMarkets[0] };
    if (groupMarkets.length > 1) {
      winner.sourceVariants = groupMarkets.slice(1);
      duplicatesRemoved += groupMarkets.length - 1;
    }

    dedupedMarkets.push(winner);
  }

  return { markets: dedupedMarkets, duplicatesRemoved };
}

// ─── Token + similarity helpers ────────────────────────────────────

function tokenize(text) {
  if (!text) return new Set();
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

function extractEntities(text) {
  if (!text) return { numbers: [], dates: [], tickers: [] };
  const numbers = (text.match(/\$?[\d,]+\.?\d*/g) || []).map((n) => n.replace(/[$,]/g, ''));
  const dates =
    text.match(
      /(?:january|february|march|april|may|june|july|august|september|october|november|december|q[1-4])\s*\d{0,4}/gi,
    ) || [];
  const tickers = text.match(/\b[A-Z]{2,5}\b/g) || [];
  return { numbers, dates: dates.map((d) => d.toLowerCase()), tickers };
}

function computeSimilarity(a, b) {
  // Jaccard similarity on tokens
  const tokenSim = jaccardSimilarity(a.tokens, b.tokens);

  // Entity overlap bonus
  const entitySim = entityOverlap(a.entities, b.entities);

  // Weighted blend: tokens 70%, entities 30%
  return tokenSim * 0.7 + entitySim * 0.3;
}

function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function entityOverlap(a, b) {
  let score = 0;
  let count = 0;

  // Number overlap
  if (a.numbers.length && b.numbers.length) {
    const numOverlap = a.numbers.filter((n) => b.numbers.includes(n)).length;
    score += numOverlap / Math.max(a.numbers.length, b.numbers.length);
    count++;
  }

  // Date overlap
  if (a.dates.length && b.dates.length) {
    const dateOverlap = a.dates.filter((d) => b.dates.includes(d)).length;
    score += dateOverlap / Math.max(a.dates.length, b.dates.length);
    count++;
  }

  // Ticker overlap
  if (a.tickers.length && b.tickers.length) {
    const tickerOverlap = a.tickers.filter((t) => b.tickers.includes(t)).length;
    score += tickerOverlap / Math.max(a.tickers.length, b.tickers.length);
    count++;
  }

  return count > 0 ? score / count : 0;
}
