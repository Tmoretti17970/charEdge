// ═══════════════════════════════════════════════════════════════════
// charEdge — Import / Export (Backward-Compatible Barrel)
//
// This file has been refactored into modular files under ./importExport/.
// All public exports are re-exported here for backward compatibility.
// New code should import from './importExport/index.js' directly.
// ═══════════════════════════════════════════════════════════════════

export {
  exportCSV,
  exportJSON,
  downloadFile,
  importFile,
  parseCSV,
  detectBroker,
  normalizeImported,
  TRADE_FIELDS,
  BROKER_LABELS,
  BROKER_PARSERS,
} from './importExport/index.js';
