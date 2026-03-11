// ═══════════════════════════════════════════════════════════════════
// charEdge — Note Miner (P1-B #13)
// Extracts actionable patterns from journal notes using keyword
// extraction and optional LLM analysis.
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} MinedPattern
 * @property {string} pattern    - The detected pattern text
 * @property {string} category   - 'setup' | 'mistake' | 'emotion' | 'insight' | 'rule'
 * @property {number} frequency  - How many times this pattern appeared
 * @property {number} avgPnl     - Average P&L when this pattern appears
 * @property {string[]} dates    - Dates where this pattern was noted
 */

// ─── Keyword Dictionaries ───────────────────────────────────────

const SETUP_KEYWORDS = [
  'breakout', 'pullback', 'reversal', 'trend', 'range', 'support', 'resistance',
  'double top', 'double bottom', 'head and shoulders', 'flag', 'wedge', 'channel',
  'volume spike', 'divergence', 'gap', 'squeeze', 'momentum',
];

const MISTAKE_KEYWORDS = [
  'fomo', 'revenge', 'overtrade', 'oversize', 'chased', 'ignored stop',
  'moved stop', 'averaged down', 'too early', 'too late', 'didn\'t follow',
  'broke rules', 'impulsive', 'no plan', 'skipped', 'forced',
];

const EMOTION_KEYWORDS = [
  'anxious', 'confident', 'greedy', 'fearful', 'frustrated', 'calm',
  'patient', 'impatient', 'excited', 'nervous', 'angry', 'euphoric',
  'disciplined', 'reckless', 'focused', 'distracted', 'tilted',
];

const RULE_KEYWORDS = [
  'rule', 'plan', 'checklist', 'criteria', 'follow', 'stick to',
  'max loss', 'daily limit', 'position size', 'risk per trade',
];

/**
 * Mine patterns from journal note text.
 *
 * @param {Object[]} entries - Journal entries { date, notes, trades? }
 * @returns {MinedPattern[]} Sorted by frequency descending
 */
export function mineNotes(entries) {
  if (!entries?.length) return [];

  const patternMap = {};

  for (const entry of entries) {
    if (!entry.notes) continue;
    const text = entry.notes.toLowerCase();
    const entryPnl = (entry.trades || []).reduce((s, t) => s + (t.pnl || 0), 0);

    // ─── Setup Patterns ──────────────────────────────────────
    for (const kw of SETUP_KEYWORDS) {
      if (text.includes(kw)) {
        _addPattern(patternMap, kw, 'setup', entry.date, entryPnl);
      }
    }

    // ─── Mistake Patterns ────────────────────────────────────
    for (const kw of MISTAKE_KEYWORDS) {
      if (text.includes(kw)) {
        _addPattern(patternMap, kw, 'mistake', entry.date, entryPnl);
      }
    }

    // ─── Emotion Patterns ────────────────────────────────────
    for (const kw of EMOTION_KEYWORDS) {
      if (text.includes(kw)) {
        _addPattern(patternMap, kw, 'emotion', entry.date, entryPnl);
      }
    }

    // ─── Rule Patterns ────────────────────────────────────────
    for (const kw of RULE_KEYWORDS) {
      if (text.includes(kw)) {
        _addPattern(patternMap, kw, 'rule', entry.date, entryPnl);
      }
    }
  }

  // ─── Build & Sort Results ──────────────────────────────────
  const results = Object.values(patternMap).map((p) => ({
    pattern: p.pattern,
    category: p.category,
    frequency: p.frequency,
    avgPnl: p.frequency > 0 ? p.totalPnl / p.frequency : 0,
    dates: p.dates.slice(-10), // Keep last 10 occurrences
  }));

  results.sort((a, b) => b.frequency - a.frequency);
  return results;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function _addPattern(map, keyword, category, date, pnl) {
  const key = `${category}:${keyword}`;
  if (!map[key]) {
    map[key] = {
      pattern: keyword,
      category,
      frequency: 0,
      totalPnl: 0,
      dates: [],
    };
  }
  map[key].frequency += 1;
  map[key].totalPnl += pnl;
  map[key].dates.push(date);
}

/**
 * Get the most impactful patterns — those with highest frequency AND strongest P&L correlation.
 *
 * @param {MinedPattern[]} patterns - Output from mineNotes
 * @param {number} [limit=5]
 * @returns {MinedPattern[]}
 */
export function getTopPatterns(patterns, limit = 5) {
  if (!patterns?.length) return [];

  // Score = frequency * abs(avgPnl) — highlights frequent AND impactful patterns
  const scored = patterns.map((p) => ({
    ...p,
    _score: p.frequency * Math.abs(p.avgPnl) + p.frequency,
  }));

  scored.sort((a, b) => b._score - a._score);
  return scored.slice(0, limit).map(({ _score, ...rest }) => rest);
}
