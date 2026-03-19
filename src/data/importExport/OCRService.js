// ═══════════════════════════════════════════════════════════════════
// charEdge — OCR Service (Phase 8 Sprint 8.10)
//
// Client-side OCR via Tesseract.js for broker statement photos.
// Lazy-loads the WASM worker only when camera import is used.
// ═══════════════════════════════════════════════════════════════════

let _worker = null;

// ─── Lazy Worker Init ───────────────────────────────────────────

async function _getWorker() {
  if (_worker) return _worker;

  // Dynamic import — Tesseract.js is only loaded when OCR is needed
  const Tesseract = await import('tesseract.js');

  _worker = await Tesseract.createWorker('eng', 1, {
    logger: (info) => {
      if (info.status === 'recognizing text') {
        // Could dispatch progress events here
      }
    },
  });

  return _worker;
}

// ─── Image Preprocessing ────────────────────────────────────────

/**
 * Preprocess an image for better OCR accuracy.
 * Applies contrast enhancement and converts to grayscale.
 *
 * @param {File|Blob} imageFile - Input image
 * @returns {Promise<HTMLCanvasElement>} Preprocessed canvas
 */
export async function preprocessImage(imageFile) {
  const bitmap = await createImageBitmap(imageFile);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');

  ctx.drawImage(bitmap, 0, 0);

  // Grayscale + contrast enhancement
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    // Convert to grayscale
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

    // Contrast boost (factor 1.5)
    const contrast = 1.5;
    const adjusted = ((gray / 255 - 0.5) * contrast + 0.5) * 255;
    const clamped = Math.max(0, Math.min(255, adjusted));

    data[i] = clamped;
    data[i + 1] = clamped;
    data[i + 2] = clamped;
  }

  ctx.putImageData(imageData, 0, 0);
  bitmap.close();

  return canvas;
}

// ─── OCR Extraction ─────────────────────────────────────────────

/**
 * Extract text from an image file.
 *
 * @param {File|Blob} imageFile - Input image
 * @param {Object} [options]
 * @param {boolean} [options.preprocess=true] - Apply preprocessing
 * @returns {Promise<{ text: string, confidence: number, lines: string[] }>}
 */
export async function extractText(imageFile, options = {}) {
  const { preprocess = true } = options;

  let source = imageFile;
  if (preprocess) {
    const canvas = await preprocessImage(imageFile);
    source = canvas;
  }

  const worker = await _getWorker();
  const result = await worker.recognize(source);

  const text = result.data.text || '';
  const confidence = result.data.confidence || 0;
  const lines = text.split('\n').filter((l) => l.trim().length > 0);

  return { text, confidence, lines };
}

/**
 * Extract tabular data from OCR text.
 * Attempts to parse table-like structures from statement photos.
 *
 * @param {string[]} lines - OCR text lines
 * @returns {Object[]} Parsed rows as key-value objects
 */
export function extractTable(lines) {
  if (lines.length < 2) return [];

  // Try to detect delimiter — tabs, multiple spaces, or pipes
  const firstLine = lines[0];
  let delimiter;

  if (firstLine.includes('\t')) {
    delimiter = /\t+/;
  } else if (firstLine.includes('|')) {
    delimiter = /\s*\|\s*/;
  } else {
    // Multiple spaces (3+) as delimiter
    delimiter = /\s{3,}/;
  }

  const headerCells = firstLine.split(delimiter).map((c) => c.trim()).filter(Boolean);

  if (headerCells.length < 2) {
    // Fallback: try 2+ spaces
    const retry = firstLine.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
    if (retry.length >= 2) {
      return _parseWithHeaders(retry, lines.slice(1), /\s{2,}/);
    }
    return [];
  }

  return _parseWithHeaders(headerCells, lines.slice(1), delimiter);
}

function _parseWithHeaders(headers, dataLines, delimiter) {
  const rows = [];

  for (const line of dataLines) {
    const cells = line.split(delimiter).map((c) => c.trim()).filter(Boolean);
    if (cells.length < headers.length - 1) continue; // Allow 1 missing column

    const row = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] || '';
    });
    rows.push(row);
  }

  return rows;
}

// ─── Cleanup ────────────────────────────────────────────────────

/**
 * Terminate the OCR worker to free resources.
 */
export async function terminate() {
  if (_worker) {
    await _worker.terminate();
    _worker = null;
  }
}

export default { preprocessImage, extractText, extractTable, terminate };
