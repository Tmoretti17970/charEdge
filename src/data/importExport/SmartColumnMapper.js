// ═══════════════════════════════════════════════════════════════════
// charEdge — Smart Column Mapper (Phase 8 Sprint 8.6)
//
// AI-assisted column matching using TF-IDF similarity against
// a corpus of known broker column names. Learns from user
// corrections and stores mapping profiles.
// ═══════════════════════════════════════════════════════════════════

// ─── Known Column Corpus ────────────────────────────────────────

const CANONICAL_COLUMNS = {
  date:     ['date', 'time', 'datetime', 'exec time', 'trade date', 'open time', 'close time', 'activity date', 'created_at', 'updated_at', 'timestamp', 'execution time', 'fill date', 'settlement date'],
  symbol:   ['symbol', 'ticker', 'instrument', 'security', 'asset', 'underlying', 'stock', 'pair', 'market', 'security name'],
  side:     ['side', 'type', 'action', 'direction', 'buy/sell', 'trans code', 'order side', 'b/s', 'position effect', 'instruction'],
  quantity: ['quantity', 'qty', 'volume', 'lots', 'shares', 'contracts', 'amount', 'filled qty', 'size', 'units'],
  price:    ['price', 'avg price', 'fill price', 'execution price', 'entry', 'open price', 'close price', 'limit price'],
  pnl:     ['pnl', 'p&l', 'profit', 'profit/loss', 'net p&l', 'realized p&l', 'gain/loss', 'net liq', 'total'],
  fees:     ['commission', 'comm', 'fee', 'fees', 'reg fees', 'swap', 'spread cost', 'transaction fee'],
  notes:    ['notes', 'comment', 'description', 'memo', 'details', 'message', 'order id'],
};

// ─── TF-IDF Tokenizer ──────────────────────────────────────────

function _tokenize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

function _buildIDF(corpus) {
  const docCount = corpus.length;
  const df = {};

  for (const doc of corpus) {
    const seen = new Set(_tokenize(doc));
    for (const token of seen) {
      df[token] = (df[token] || 0) + 1;
    }
  }

  const idf = {};
  for (const [token, count] of Object.entries(df)) {
    idf[token] = Math.log((docCount + 1) / (count + 1)) + 1;
  }
  return idf;
}

function _tfidfVector(text, idf) {
  const tokens = _tokenize(text);
  const tf = {};
  for (const t of tokens) {
    tf[t] = (tf[t] || 0) + 1;
  }
  const vec = {};
  for (const [t, count] of Object.entries(tf)) {
    vec[t] = (count / tokens.length) * (idf[t] || 1);
  }
  return vec;
}

function _cosineSimilarity(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0, magA = 0, magB = 0;
  for (const k of keys) {
    const av = a[k] || 0;
    const bv = b[k] || 0;
    dot += av * bv;
    magA += av * av;
    magB += bv * bv;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ─── Mapper ─────────────────────────────────────────────────────

const _allCorpus = Object.values(CANONICAL_COLUMNS).flat();
const _idf = _buildIDF(_allCorpus);

/**
 * Match CSV column headers to canonical trade fields.
 *
 * @param {string[]} headers - Column headers from imported file
 * @returns {Array<{ header: string, field: string|null, confidence: number }>}
 */
export function matchColumns(headers) {
  const results = [];

  for (const header of headers) {
    const headerVec = _tfidfVector(header, _idf);
    let bestField = null;
    let bestScore = 0;

    for (const [field, synonyms] of Object.entries(CANONICAL_COLUMNS)) {
      for (const syn of synonyms) {
        const synVec = _tfidfVector(syn, _idf);
        const score = _cosineSimilarity(headerVec, synVec);
        if (score > bestScore) {
          bestScore = score;
          bestField = field;
        }
      }
    }

    // Exact match boost
    const headerLower = header.toLowerCase().trim();
    for (const [field, synonyms] of Object.entries(CANONICAL_COLUMNS)) {
      if (synonyms.includes(headerLower)) {
        bestField = field;
        bestScore = 1.0;
        break;
      }
    }

    results.push({
      header,
      field: bestScore >= 0.3 ? bestField : null,
      confidence: Math.round(bestScore * 100),
    });
  }

  return results;
}

// ─── Profile Storage ────────────────────────────────────────────

const PROFILE_KEY = 'charEdge_columnProfiles';

/**
 * Save a user-corrected column mapping profile.
 * @param {string} brokerName - Identifier for this mapping profile
 * @param {Record<string, string>} mapping - header → canonical field
 */
export function saveProfile(brokerName, mapping) {
  try {
    const profiles = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
    profiles[brokerName] = { mapping, updatedAt: Date.now() };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
  } catch { /* ignore storage errors */ }
}

/**
 * Load a saved column mapping profile.
 * @param {string} brokerName
 * @returns {Record<string, string> | null}
 */
export function loadProfile(brokerName) {
  try {
    const profiles = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
    return profiles[brokerName]?.mapping || null;
  } catch {
    return null;
  }
}

/**
 * List all saved column mapping profiles.
 * @returns {Array<{ name: string, updatedAt: number }>}
 */
export function listProfiles() {
  try {
    const profiles = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
    return Object.entries(profiles).map(([name, data]) => ({
      name,
      updatedAt: data.updatedAt,
    }));
  } catch {
    return [];
  }
}

export default { matchColumns, saveProfile, loadProfile, listProfiles };
