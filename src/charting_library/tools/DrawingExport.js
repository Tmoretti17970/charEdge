// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Export / Import / Sharing (Sprint 20)
//
// Export all drawings as JSON for backup, import from JSON,
// generate shareable links, and capture drawing screenshots.
// ═══════════════════════════════════════════════════════════════════

import { logger } from '@/observability/logger';

const EXPORT_VERSION = 1;

/**
 * Export drawings to a JSON string with full metadata.
 * @param {Array} drawings — array of drawing objects from the engine
 * @param {string} symbol — active chart symbol
 * @param {string} tf — active timeframe
 * @returns {string} JSON string
 */
export function exportDrawings(drawings, symbol = '', tf = '') {
  const exportData = {
    version: EXPORT_VERSION,
    timestamp: Date.now(),
    symbol,
    tf,
    count: drawings.length,
    drawings: drawings.map((d) => ({
      id: d.id,
      type: d.type,
      label: d.label || '',
      locked: d.locked || false,
      visible: d.visible !== false,
      style: { ...d.style },
      pricePoints: d.pricePoints?.map((pp) => ({ price: pp.price, time: pp.time })) || [],
      text: d.text || '',
      syncAcrossTimeframes: d.syncAcrossTimeframes || false,
      _groupId: d._groupId || null,
    })),
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Import drawings from a JSON string.
 * Validates format and assigns new IDs to avoid conflicts.
 * @param {string} json — exported JSON string
 * @returns {{ drawings: Array, meta: object } | null}
 */
export function importDrawings(json) {
  try {
    const data = JSON.parse(json);
    if (!data.drawings || !Array.isArray(data.drawings)) {
      logger.data.warn('[DrawingExport] Invalid format: no drawings array');
      return null;
    }

    const imported = data.drawings.map((d) => ({
      ...d,
      id: `imported-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      state: 'idle',
    }));

    return {
      drawings: imported,
      meta: {
        version: data.version,
        timestamp: data.timestamp,
        symbol: data.symbol,
        tf: data.tf,
        count: imported.length,
      },
    };
  } catch (err) {
    logger.data.error('[DrawingExport] Import failed:', err);
    return null;
  }
}

/**
 * Generate a shareable link by encoding drawings into a URL parameter.
 * Uses base64 encoding for compactness.
 * @param {Array} drawings — drawings to share
 * @returns {string} shareable URL fragment
 */
export function generateShareLink(drawings) {
  try {
    const compact = drawings.map((d) => ({
      t: d.type,
      s: d.style,
      pp: d.pricePoints?.map((pp) => [pp.price, pp.time]) || [],
      l: d.label || '',
      txt: d.text || '',
    }));
    const json = JSON.stringify(compact);
    const encoded = btoa(unescape(encodeURIComponent(json)));
    return `?drawings=${encoded}`;
  } catch (err) {
    logger.data.error('[DrawingExport] Share link generation failed:', err);
    return '';
  }
}

/**
 * Parse drawings from a share link parameter.
 * @param {string} encoded — base64 encoded string from URL
 * @returns {Array|null} parsed drawing data
 */
export function parseShareLink(encoded) {
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    const compact = JSON.parse(json);
    return compact.map((d) => ({
      type: d.t,
      style: d.s,
      pricePoints: (d.pp || []).map((pp) => ({ price: pp[0], time: pp[1] })),
      label: d.l || '',
      text: d.txt || '',
      id: `shared-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      state: 'idle',
      locked: false,
      visible: true,
    }));
  } catch (err) {
    logger.data.error('[DrawingExport] Share link parse failed:', err);
    return null;
  }
}

/**
 * Download drawings as a .json file.
 * @param {string} jsonString — output from exportDrawings()
 * @param {string} filename — optional filename
 */
export function downloadDrawings(jsonString, filename = 'charEdge-drawings.json') {
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Trigger a file picker and import drawings from the selected JSON file.
 * @returns {Promise<{ drawings: Array, meta: object } | null>}
 */
export function pickAndImportDrawings() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = (e) => {
      const file = e.target?.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result;
        if (typeof text === 'string') {
          resolve(importDrawings(text));
        } else {
          resolve(null);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}
