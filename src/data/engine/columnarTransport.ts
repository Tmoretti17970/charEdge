// ═══════════════════════════════════════════════════════════════════
// charEdge — Columnar Data Transport (Phase 5)
// Zero-copy encode/decode for SSE bridge + OPFS cache
// ═══════════════════════════════════════════════════════════════════

import { BarDataBuffer } from '../../charting_library/core/BarDataBuffer.ts';

/**
 * Header layout (28 bytes):
 *   [0..3]   magic "CBAR" (4 bytes)
 *   [4..7]   version (uint32)
 *   [8..11]  barCount (uint32)
 *   [12..15] columnCount (uint32)
 *   [16..23] timestampMs (float64, epoch when encoded)
 *   [24..27] reserved (4 bytes)
 *
 * Body: 6 × barCount float64 arrays packed sequentially
 *   time, open, high, low, close, volume
 */

const MAGIC = 0x52414243; // "CBAR" in little-endian
const VERSION = 1;
const HEADER_SIZE = 28;
const COLUMN_COUNT = 6;

/**
 * Encode a BarDataBuffer into a single ArrayBuffer for transport.
 * Suitable for SSE streaming, OPFS storage, or postMessage.
 */
export function encodeColumnar(buffer: BarDataBuffer): ArrayBuffer {
    const n = buffer.length;
    const bodySize = COLUMN_COUNT * n * 8; // 6 columns × n bars × 8 bytes
    const totalSize = HEADER_SIZE + bodySize;
    const ab = new ArrayBuffer(totalSize);

    // Write header
    const headerView = new DataView(ab);
    headerView.setUint32(0, MAGIC, true);
    headerView.setUint32(4, VERSION, true);
    headerView.setUint32(8, n, true);
    headerView.setUint32(12, COLUMN_COUNT, true);
    headerView.setFloat64(16, Date.now());
    headerView.setUint32(24, 0, true); // reserved

    // Write columns sequentially
    const body = new Float64Array(ab, HEADER_SIZE);
    const columns = ['time', 'open', 'high', 'low', 'close', 'volume'] as const;
    let offset = 0;

    for (const col of columns) {
        const src = buffer[col];
        body.set(src.subarray(0, n), offset);
        offset += n;
    }

    return ab;
}

/**
 * Decode a columnar ArrayBuffer back into a BarDataBuffer.
 * Zero-copy when possible (typed array views into the same buffer).
 */
export function decodeColumnar(data: ArrayBuffer): BarDataBuffer {
    const headerView = new DataView(data);

    // Validate magic
    const magic = headerView.getUint32(0, true);
    if (magic !== MAGIC) {
        throw new Error(`Invalid columnar data: expected magic 0x${MAGIC.toString(16)}, got 0x${magic.toString(16)}`);
    }

    const version = headerView.getUint32(4, true);
    if (version !== VERSION) {
        throw new Error(`Unsupported columnar version: ${version}`);
    }

    const barCount = headerView.getUint32(8, true);
    const colCount = headerView.getUint32(12, true);

    if (colCount !== COLUMN_COUNT) {
        throw new Error(`Unexpected column count: ${colCount}`);
    }

    // Read columns
    const body = new Float64Array(data, HEADER_SIZE);
    const buf = new BarDataBuffer(barCount);

    const columns = ['time', 'open', 'high', 'low', 'close', 'volume'] as const;
    let offset = 0;

    for (const col of columns) {
        buf[col].set(body.subarray(offset, offset + barCount));
        offset += barCount;
    }

    // Set internal length
    (buf as unknown as { _length: number })._length = barCount;

    return buf;
}

/**
 * Get the timestamp when a columnar payload was encoded.
 */
export function getColumnarTimestamp(data: ArrayBuffer): number {
    const view = new DataView(data);
    return view.getFloat64(16);
}

/**
 * Get the bar count from a columnar header without full decode.
 */
export function getColumnarBarCount(data: ArrayBuffer): number {
    const view = new DataView(data);
    return view.getUint32(8, true);
}
