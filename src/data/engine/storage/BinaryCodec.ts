// ═══════════════════════════════════════════════════════════════════
// charEdge — Binary Block Codec
//
// Sprint 9 #71: Extracted from TimeSeriesStore.ts.
// Encodes/decodes OHLCV bars to/from binary blocks with CRC32
// integrity verification. Each bar = 6 × Float64 = 48 bytes.
// ═══════════════════════════════════════════════════════════════════

// @ts-expect-error — .ts imports resolved by Vite
import { logger } from '@/observability/logger.ts';
import { type Bar, FIELDS_PER_BAR, BYTES_PER_BAR, CRC32_SIZE } from './types.ts';

// ─── CRC32 ──────────────────────────────────────────────────────

const _crc32Table: Uint32Array = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let crc = i;
        for (let j = 0; j < 8; j++) {
            crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
        }
        table[i] = crc;
    }
    return table;
})();

// eslint-disable-next-line @typescript-eslint/naming-convention
function _crc32(buffer: ArrayBuffer): number {
    const bytes = new Uint8Array(buffer);
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
        const byteVal = bytes[i] ?? 0;
        const idx = (crc ^ byteVal) & 0xFF;
        crc = (_crc32Table[idx] ?? 0) ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ─── Encode ─────────────────────────────────────────────────────

/**
 * Encode an array of bars into a binary block with CRC32 checksum.
 * Layout: [Float64 × 6 × N bars] + [Uint32 CRC32]
 */
export function encodeBlock(bars: Bar[]): ArrayBuffer {
    const dataBuffer = new ArrayBuffer(bars.length * BYTES_PER_BAR);
    const view = new Float64Array(dataBuffer);
    for (let i = 0; i < bars.length; i++) {
        const bar = bars[i];
        if (!bar) continue;
        const offset = i * FIELDS_PER_BAR;
        view[offset] = bar.t;
        view[offset + 1] = bar.o;
        view[offset + 2] = bar.h;
        view[offset + 3] = bar.l;
        view[offset + 4] = bar.c;
        view[offset + 5] = bar.v;
    }
    // Append CRC32
    const crc = _crc32(dataBuffer);
    const checksummedBuffer = new Uint8Array(dataBuffer.byteLength + CRC32_SIZE);
    checksummedBuffer.set(new Uint8Array(dataBuffer));
    new DataView(checksummedBuffer.buffer, dataBuffer.byteLength, CRC32_SIZE).setUint32(0, crc, true);
    return checksummedBuffer.buffer;
}

// ─── Decode ─────────────────────────────────────────────────────

/**
 * Decode a binary block back into bars. Verifies CRC32 integrity.
 * Returns null if the block is corrupt or malformed.
 */
export function decodeBlock(buffer: ArrayBuffer): Bar[] | null {
    if (buffer.byteLength <= CRC32_SIZE) return null;

    const dataLen = buffer.byteLength - CRC32_SIZE;
    if (dataLen % BYTES_PER_BAR !== 0) return null;

    // Verify CRC32
    const dataBuffer = buffer.slice(0, dataLen);
    const storedCrc = new DataView(buffer, dataLen, CRC32_SIZE).getUint32(0, true);
    const computedCrc = _crc32(dataBuffer);
    if (storedCrc !== computedCrc) {
        logger.data.warn('[TimeSeriesStore] CRC32 mismatch — corrupt block');
        return null;
    }

    const view = new Float64Array(dataBuffer);
    const count = view.length / FIELDS_PER_BAR;
    const bars: Bar[] = new Array(count);
    for (let i = 0; i < count; i++) {
        const offset = i * FIELDS_PER_BAR;
        bars[i] = {
            t: view[offset] ?? 0,
            o: view[offset + 1] ?? 0,
            h: view[offset + 2] ?? 0,
            l: view[offset + 3] ?? 0,
            c: view[offset + 4] ?? 0,
            v: view[offset + 5] ?? 0,
        };
    }
    return bars;
}
