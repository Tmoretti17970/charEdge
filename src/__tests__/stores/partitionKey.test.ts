// ═══════════════════════════════════════════════════════════════════
// charEdge — partitionKey.ts Tests
// Sprint 18 #113: Time-partitioned bar keys
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
    quarterFromTimestamp,
    partitionKey,
    quarterStartMs,
    quarterEndMs,
    partitionsForRange,
    parsePartitionKey,
    isLegacyKey,
    groupBarsByPartition,
} from '../../data/engine/storage/partitionKey';

// ─── Reference timestamps ───────────────────────────────────────

// 2024-01-15 = Q1, 2024-04-15 = Q2, 2024-07-15 = Q3, 2024-10-15 = Q4
const JAN_15_2024 = Date.UTC(2024, 0, 15);  // Q1
const APR_15_2024 = Date.UTC(2024, 3, 15);  // Q2
const JUL_15_2024 = Date.UTC(2024, 6, 15);  // Q3
const OCT_15_2024 = Date.UTC(2024, 9, 15);  // Q4
const JAN_01_2025 = Date.UTC(2025, 0, 1);   // Q1 2025

// ─── quarterFromTimestamp ────────────────────────────────────────

describe('partitionKey: quarterFromTimestamp', () => {
    it('returns correct quarter for each month', () => {
        expect(quarterFromTimestamp(JAN_15_2024)).toBe('2024-Q1');
        expect(quarterFromTimestamp(APR_15_2024)).toBe('2024-Q2');
        expect(quarterFromTimestamp(JUL_15_2024)).toBe('2024-Q3');
        expect(quarterFromTimestamp(OCT_15_2024)).toBe('2024-Q4');
    });

    it('handles quarter boundary (Jan 1)', () => {
        expect(quarterFromTimestamp(JAN_01_2025)).toBe('2025-Q1');
    });

    it('handles last day of quarter', () => {
        const dec31 = Date.UTC(2024, 11, 31, 23, 59, 59);
        expect(quarterFromTimestamp(dec31)).toBe('2024-Q4');
    });
});

// ─── partitionKey ────────────────────────────────────────────────

describe('partitionKey: partitionKey()', () => {
    it('builds correct key format', () => {
        expect(partitionKey('BTCUSDT', '1h', JAN_15_2024)).toBe('BTCUSDT:1h:2024-Q1');
        expect(partitionKey('ETHUSDT', '1D', OCT_15_2024)).toBe('ETHUSDT:1D:2024-Q4');
    });
});

// ─── quarterStartMs / quarterEndMs ───────────────────────────────

describe('partitionKey: quarter boundaries', () => {
    it('quarterStartMs returns first ms of quarter', () => {
        expect(quarterStartMs('2024-Q1')).toBe(Date.UTC(2024, 0, 1));
        expect(quarterStartMs('2024-Q2')).toBe(Date.UTC(2024, 3, 1));
        expect(quarterStartMs('2024-Q3')).toBe(Date.UTC(2024, 6, 1));
        expect(quarterStartMs('2024-Q4')).toBe(Date.UTC(2024, 9, 1));
    });

    it('quarterEndMs returns first ms of next quarter', () => {
        expect(quarterEndMs('2024-Q1')).toBe(Date.UTC(2024, 3, 1));
        expect(quarterEndMs('2024-Q4')).toBe(Date.UTC(2025, 0, 1));
    });

    it('quarters are contiguous', () => {
        expect(quarterEndMs('2024-Q1')).toBe(quarterStartMs('2024-Q2'));
        expect(quarterEndMs('2024-Q3')).toBe(quarterStartMs('2024-Q4'));
    });

    it('returns 0 for invalid quarter', () => {
        expect(quarterStartMs('invalid')).toBe(0);
        expect(quarterEndMs('garbage')).toBe(0);
    });
});

// ─── partitionsForRange ──────────────────────────────────────────

describe('partitionKey: partitionsForRange', () => {
    it('returns single partition for intra-quarter range', () => {
        const keys = partitionsForRange('BTCUSDT', '1h', JAN_15_2024, JAN_15_2024 + 86400000);
        expect(keys).toEqual(['BTCUSDT:1h:2024-Q1']);
    });

    it('returns multiple partitions for cross-quarter range', () => {
        const keys = partitionsForRange('BTCUSDT', '1h', JAN_15_2024, JUL_15_2024);
        expect(keys).toEqual(['BTCUSDT:1h:2024-Q1', 'BTCUSDT:1h:2024-Q2', 'BTCUSDT:1h:2024-Q3']);
    });

    it('spans full year', () => {
        const keys = partitionsForRange('ETH', '1D', JAN_15_2024, OCT_15_2024);
        expect(keys.length).toBe(4);
        expect(keys[0]).toBe('ETH:1D:2024-Q1');
        expect(keys[3]).toBe('ETH:1D:2024-Q4');
    });

    it('spans year boundary', () => {
        const keys = partitionsForRange('BTC', '1h', OCT_15_2024, JAN_01_2025);
        expect(keys).toEqual(['BTC:1h:2024-Q4', 'BTC:1h:2025-Q1']);
    });
});

// ─── parsePartitionKey ───────────────────────────────────────────

describe('partitionKey: parsePartitionKey', () => {
    it('parses valid partitioned key', () => {
        const parsed = parsePartitionKey('BTCUSDT:1h:2024-Q1');
        expect(parsed).toEqual({ symbol: 'BTCUSDT', interval: '1h', quarter: '2024-Q1' });
    });

    it('returns null for legacy key', () => {
        expect(parsePartitionKey('BTCUSDT:1h')).toBeNull();
    });

    it('returns null for invalid format', () => {
        expect(parsePartitionKey('BTCUSDT:1h:invalid')).toBeNull();
        expect(parsePartitionKey('nope')).toBeNull();
    });
});

// ─── isLegacyKey ─────────────────────────────────────────────────

describe('partitionKey: isLegacyKey', () => {
    it('detects legacy keys', () => {
        expect(isLegacyKey('BTCUSDT:1h')).toBe(true);
    });

    it('rejects partitioned keys', () => {
        expect(isLegacyKey('BTCUSDT:1h:2024-Q1')).toBe(false);
    });
});

// ─── groupBarsByPartition ────────────────────────────────────────

describe('partitionKey: groupBarsByPartition', () => {
    it('groups bars into correct quarters', () => {
        const bars = [
            { t: JAN_15_2024, o: 100, h: 110, l: 90, c: 105, v: 500 },
            { t: APR_15_2024, o: 105, h: 115, l: 95, c: 110, v: 600 },
            { t: JUL_15_2024, o: 110, h: 120, l: 100, c: 115, v: 700 },
        ];

        const partitions = groupBarsByPartition('BTC', '1h', bars);
        expect(partitions.size).toBe(3);
        expect(partitions.get('BTC:1h:2024-Q1')?.length).toBe(1);
        expect(partitions.get('BTC:1h:2024-Q2')?.length).toBe(1);
        expect(partitions.get('BTC:1h:2024-Q3')?.length).toBe(1);
    });

    it('groups multiple bars in same quarter', () => {
        const bars = [
            { t: JAN_15_2024, o: 100, h: 110, l: 90, c: 105, v: 500 },
            { t: JAN_15_2024 + 3600000, o: 105, h: 115, l: 95, c: 110, v: 600 },
        ];

        const partitions = groupBarsByPartition('BTC', '1h', bars);
        expect(partitions.size).toBe(1);
        expect(partitions.get('BTC:1h:2024-Q1')?.length).toBe(2);
    });

    it('handles empty input', () => {
        const partitions = groupBarsByPartition('BTC', '1h', []);
        expect(partitions.size).toBe(0);
    });
});
