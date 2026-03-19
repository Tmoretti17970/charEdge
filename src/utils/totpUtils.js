// ═══════════════════════════════════════════════════════════════════
// charEdge — TOTP Utilities (Sprint 5: Two-Factor Authentication)
//
// Pure-JS utilities for TOTP 2FA — zero external dependencies.
//   - generateSecret()       → random base32 secret
//   - generateBackupCodes()  → array of recovery codes
//   - formatSecret()         → "XXXX XXXX" display format
//   - buildTOTPUri()         → otpauth:// URI for QR codes
//   - generateQRMatrix()     → lightweight QR code matrix
// ═══════════════════════════════════════════════════════════════════

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Generate a random base32-encoded secret (20 bytes / 32 chars).
 * @returns {string}
 */
export function generateSecret() {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    result += BASE32_CHARS[bytes[i] % 32];
  }
  return result;
}

/**
 * Format a base32 secret for display: "XXXX XXXX XXXX XXXX ..."
 * @param {string} secret
 * @returns {string}
 */
export function formatSecret(secret) {
  return secret.match(/.{1,4}/g)?.join(' ') || secret;
}

/**
 * Build an otpauth:// URI for TOTP enrollment.
 * @param {string} secret - Base32 secret
 * @param {string} account - User email or username
 * @param {string} issuer - App name
 * @returns {string}
 */
export function buildTOTPUri(secret, account = 'user', issuer = 'charEdge') {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generate backup/recovery codes.
 * @param {number} count - Number of codes (default 6)
 * @returns {string[]}
 */
export function generateBackupCodes(count = 6) {
  const codes = [];
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No O/I/0/1 for clarity
  for (let i = 0; i < count; i++) {
    let code = '';
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    for (let j = 0; j < 8; j++) {
      code += chars[bytes[j] % chars.length];
    }
    codes.push(code.slice(0, 4) + '-' + code.slice(4));
  }
  return codes;
}

/**
 * Download backup codes as a text file.
 * @param {string[]} codes
 */
export function downloadBackupCodes(codes) {
  const text = [
    'charEdge — Two-Factor Authentication Backup Codes',
    '═══════════════════════════════════════════════════',
    '',
    'Keep these codes safe. Each code can only be used once.',
    '',
    ...codes.map((c, i) => `  ${i + 1}. ${c}`),
    '',
    `Generated: ${new Date().toISOString()}`,
  ].join('\n');

  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'charEdge-backup-codes.txt';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Minimal QR Code Generator ──────────────────────────────────
// Generates a simple QR-like matrix using a deterministic pattern
// from the URI data. For production, swap with a proper QR library.
// This creates a visual representation that looks like a QR code.

/**
 * Generate a QR-like matrix from data for canvas rendering.
 * Uses a simple hash-based pattern generator.
 * @param {string} data - URI to encode
 * @param {number} size - Matrix dimension (default 25)
 * @returns {boolean[][]} 2D boolean matrix
 */
export function generateQRMatrix(data, size = 25) {
  const matrix = Array.from({ length: size }, () => Array(size).fill(false));

  // Finder patterns (3 corners)
  const drawFinder = (ox, oy) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const isEdge = y === 0 || y === 6 || x === 0 || x === 6;
        const isInner = y >= 2 && y <= 4 && x >= 2 && x <= 4;
        matrix[oy + y][ox + x] = isEdge || isInner;
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(size - 7, 0);
  drawFinder(0, size - 7);

  // Timing patterns
  for (let i = 7; i < size - 7; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Data pattern (hash-based)
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
  }

  for (let y = 8; y < size - 8; y++) {
    for (let x = 8; x < size - 8; x++) {
      if (x === 6 || y === 6) continue;
      hash = ((hash << 5) - hash + x * 31 + y * 37) | 0;
      matrix[y][x] = (Math.abs(hash) % 3) !== 0;
    }
  }

  return matrix;
}

/**
 * Render a QR matrix to a canvas element.
 * @param {HTMLCanvasElement} canvas
 * @param {boolean[][]} matrix
 * @param {number} cellSize - Pixels per cell
 * @param {string} fg - Foreground color
 * @param {string} bg - Background color
 */
export function renderQRToCanvas(canvas, matrix, cellSize = 6, fg = '#000', bg = '#fff') {
  const size = matrix.length * cellSize;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = fg;
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y].length; x++) {
      if (matrix[y][x]) {
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }
}
