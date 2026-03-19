// ═══════════════════════════════════════════════════════════════════
// charEdge — Column Matcher (Phase 6 Sprint 6.3)
//
// Fuzzy matching for CSV column headers to charEdge trade fields.
// Used by the interactive column mapper when auto-detection fails.
// ═══════════════════════════════════════════════════════════════════

// charEdge canonical field names and their common aliases
const FIELD_ALIASES = {
  date:      ['date', 'time', 'datetime', 'timestamp', 'trade date', 'exec date', 'execution date', 'open date', 'close date', 'entry date', 'exit date', 'date/time'],
  symbol:    ['symbol', 'ticker', 'instrument', 'asset', 'pair', 'market', 'contract', 'product', 'stock', 'security'],
  side:      ['side', 'action', 'type', 'direction', 'buy/sell', 'b/s', 'order type', 'trade type', 'position type'],
  quantity:  ['quantity', 'qty', 'shares', 'lots', 'contracts', 'size', 'amount', 'volume', 'units', 'filled qty'],
  price:     ['price', 'avg price', 'fill price', 'entry price', 'execution price', 'trade price', 'avg fill'],
  pnl:       ['pnl', 'p&l', 'profit', 'profit/loss', 'net p&l', 'realized pnl', 'net profit', 'gain', 'gain/loss', 'result', 'net'],
  commission:['commission', 'fee', 'fees', 'comm', 'charges', 'costs', 'brokerage'],
  notes:     ['notes', 'comment', 'comments', 'memo', 'description', 'remark', 'remarks', 'tag', 'tags'],
  strategy:  ['strategy', 'setup', 'playbook', 'system', 'method', 'pattern'],
  duration:  ['duration', 'hold time', 'time in trade', 'trade duration'],
  stopLoss:  ['stop loss', 'stop', 'sl', 'stoploss', 'protective stop'],
  takeProfit:['take profit', 'tp', 'target', 'profit target', 'takeprofit'],
  risk:      ['risk', 'risk amount', 'max risk', 'risk $'],
  rMultiple: ['r-multiple', 'r multiple', 'r', 'reward/risk', 'risk:reward'],
};

/**
 * Normalize a string for comparison (lowercase, trimmed, strip non-alpha chars)
 */
function normalize(str) {
  return (str || '').toLowerCase().trim().replace(/[^a-z0-9\s/&]/g, '');
}

/**
 * Simple word overlap similarity (0-1 score)
 */
function similarity(a, b) {
  const wordsA = new Set(normalize(a).split(/\s+/));
  const wordsB = new Set(normalize(b).split(/\s+/));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  return overlap / Math.max(wordsA.size, wordsB.size);
}

/**
 * Attempt to match CSV headers to charEdge fields.
 * Returns a mapping: { csvHeader: charEdgeField | null }
 * and a confidence score per match.
 *
 * @param {string[]} headers - CSV column headers
 * @returns {{ mapping: Record<string, string|null>, confidence: Record<string, number> }}
 */
export function autoMapColumns(headers) {
  const mapping = {};
  const confidence = {};
  const usedFields = new Set();

  for (const header of headers) {
    const norm = normalize(header);
    let bestField = null;
    let bestScore = 0;

    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (usedFields.has(field)) continue;

      for (const alias of aliases) {
        // Exact match
        if (norm === normalize(alias)) {
          bestField = field;
          bestScore = 1;
          break;
        }
        // Substring match
        if (norm.includes(normalize(alias)) || normalize(alias).includes(norm)) {
          const score = 0.8;
          if (score > bestScore) {
            bestScore = score;
            bestField = field;
          }
        }
        // Fuzzy similarity
        const score = similarity(norm, alias);
        if (score > bestScore && score >= 0.5) {
          bestScore = score;
          bestField = field;
        }
      }
      if (bestScore === 1) break;
    }

    if (bestField && bestScore >= 0.4) {
      mapping[header] = bestField;
      confidence[header] = bestScore;
      usedFields.add(bestField);
    } else {
      mapping[header] = null;
      confidence[header] = 0;
    }
  }

  return { mapping, confidence };
}

/**
 * Apply a column mapping to transform parsed CSV rows into charEdge trade objects.
 *
 * @param {Object[]} rows - Parsed CSV rows
 * @param {Record<string, string>} mapping - Column mapping { csvHeader: charEdgeField }
 * @returns {Object[]}
 */
export function applyMapping(rows, mapping) {
  const reverseMap = {};
  for (const [csv, field] of Object.entries(mapping)) {
    if (field) reverseMap[field] = csv;
  }

  return rows.map((row) => {
    const trade = {};
    for (const [field, csvCol] of Object.entries(reverseMap)) {
      trade[field] = row[csvCol] ?? '';
    }
    return trade;
  });
}

/**
 * Get list of available charEdge target fields for mapping.
 */
export function getTargetFields() {
  return Object.keys(FIELD_ALIASES).map((key) => ({
    key,
    label: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
    required: ['date', 'symbol'].includes(key),
  }));
}

export { FIELD_ALIASES };
