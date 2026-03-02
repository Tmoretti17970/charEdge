// ═══════════════════════════════════════════════════════════════════
// charEdge — Import/Export Shared Helpers
// ═══════════════════════════════════════════════════════════════════

export function _uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function _parseNum(val) {
  if (val == null || val === '') return null;
  const n = parseFloat(
    String(val)
      .replace(/[$,()]/g, '')
      .trim(),
  );
  return isNaN(n) ? null : n;
}

export function _parseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
