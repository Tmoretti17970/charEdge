// ═══════════════════════════════════════════════════════════════════
// charEdge — Import File Function
// ═══════════════════════════════════════════════════════════════════

import { parseCSV } from './parseCSV.js';
import { detectBroker, BROKER_PARSERS, BROKER_LABELS } from './brokerDetection.js';
import { normalizeBatch } from '../../charting_library/model/TradeSchema.js';
import { tradeHash } from '../../charting_library/datafeed/csv.js';

/**
 * Normalize an array of imported trades through the schema validator.
 * @param {Object[]} trades
 * @returns {{ trades: Object[], errors: Array }}
 */
export function normalizeImported(trades) {
  if (!trades?.length) return { trades: [], errors: [] };
  return normalizeBatch(trades);
}

/**
 * Import trades from a file (CSV or JSON).
 *
 * @param {File} file - Browser File object
 * @param {Object} [options] - Import options
 * @param {string} [options.forceBroker] - Force a specific broker parser
 * @param {Object[]} [options.existingTrades] - Existing trades for dedup (uses tradeHash)
 * @returns {Promise<{ ok: boolean, trades: Object[], broker: string, duplicates?: number, error?: string }>}
 */
export async function importFile(file, options = {}) {
  const { forceBroker = null, existingTrades = [] } = typeof options === 'string'
    ? { forceBroker: options } // backwards compat: importFile(file, 'broker')
    : (options || {});

  try {
    const text = await file.text();
    const name = (file.name || '').toLowerCase();

    // Build dedup hash set from existing trades
    const existingHashes = existingTrades.length > 0
      ? new Set(existingTrades.filter(t => t.date && t.symbol).map(tradeHash))
      : null;

    // ─── JSON Import ──────────────────────────────────────
    if (name.endsWith('.json')) {
      const json = JSON.parse(text);
      let rawTrades = [];
      if (json.trades && Array.isArray(json.trades)) {
        rawTrades = json.trades;
      } else if (Array.isArray(json)) {
        rawTrades = json;
      }
      if (rawTrades.length === 0) {
        return { ok: false, trades: [], broker: 'unknown', error: 'JSON file does not contain a trades array.' };
      }
      const { trades: normalized } = normalizeImported(rawTrades);

      // Dedup against existing trades
      const { unique, duplicates } = _dedup(normalized, existingHashes);

      return { ok: true, trades: unique, broker: 'charEdge', count: unique.length, duplicates };
    }

    // ─── CSV Import ───────────────────────────────────────
    const rows = parseCSV(text);
    if (rows.length === 0) {
      return { ok: false, trades: [], broker: 'unknown', error: 'No data rows found in CSV.' };
    }

    const headers = Object.keys(rows[0]);
    const broker = forceBroker || detectBroker(headers);
    const parser = BROKER_PARSERS[broker] || BROKER_PARSERS.generic;
    const rawTrades = parser(rows);

    // Normalize through schema validator
    const { trades: normalized, errors: schemaErrors } = normalizeImported(rawTrades);

    // Dedup against existing trades
    const { unique, duplicates } = _dedup(normalized, existingHashes);

    return {
      ok: true,
      trades: unique,
      broker,
      brokerLabel: BROKER_LABELS[broker] || broker,
      count: unique.length,
      duplicates,
      skipped: rows.length - normalized.length,
      schemaErrors: schemaErrors.length > 0 ? schemaErrors : undefined,
    };
  } catch (e) {
    return { ok: false, trades: [], broker: 'unknown', error: e.message };
  }
}

/**
 * Filter out duplicate trades using tradeHash.
 * @param {Object[]} trades - Normalized trades to check
 * @param {Set|null} existingHashes - Hash set of existing trades (or null to skip)
 * @returns {{ unique: Object[], duplicates: number }}
 */
function _dedup(trades, existingHashes) {
  if (!existingHashes || existingHashes.size === 0) {
    return { unique: trades, duplicates: 0 };
  }

  let duplicates = 0;
  const unique = [];
  for (const trade of trades) {
    try {
      const hash = tradeHash(trade);
      if (existingHashes.has(hash)) {
        duplicates++;
      } else {
        existingHashes.add(hash); // prevent intra-file dupes too
        unique.push(trade);
      }
    } catch {
      // If hash fails (missing fields), keep the trade
      unique.push(trade);
    }
  }
  return { unique, duplicates };
}

