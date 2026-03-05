// ═══════════════════════════════════════════════════════════════════
// charEdge — TickRingBuffer Tests
//
// Tests for the zero-allocation circular buffer for trade ticks.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { TickRingBuffer, SIDE } from '../../data/engine/streaming/TickRingBuffer.ts';

describe('TickRingBuffer', () => {
    // ─── Construction ────────────────────────────────────────────

    it('creates with default capacity', () => {
        const buf = new TickRingBuffer();
        expect(buf.capacity).toBe(16384);
        expect(buf.length).toBe(0);
        expect(buf.isEmpty).toBe(true);
    });

    it('creates with custom capacity', () => {
        const buf = new TickRingBuffer(100);
        expect(buf.capacity).toBe(100);
    });

    it('throws on invalid capacity', () => {
        expect(() => new TickRingBuffer(0)).toThrow(RangeError);
        expect(() => new TickRingBuffer(-1)).toThrow(RangeError);
        expect(() => new TickRingBuffer(1.5)).toThrow(RangeError);
    });

    // ─── Push & Latest ─────────────────────────────────────────

    it('pushes ticks and retrieves latest', () => {
        const buf = new TickRingBuffer(10);
        buf.push(100, 0.5, 1000, SIDE.BUY);
        expect(buf.length).toBe(1);
        expect(buf.isEmpty).toBe(false);

        const tick = buf.latest();
        expect(tick).toEqual({ price: 100, qty: 0.5, time: 1000, side: SIDE.BUY });
    });

    it('latest returns null when empty', () => {
        const buf = new TickRingBuffer(10);
        expect(buf.latest()).toBeNull();
    });

    it('overwrites oldest when full', () => {
        const buf = new TickRingBuffer(3);
        buf.push(10, 1, 100, 0);
        buf.push(20, 2, 200, 1);
        buf.push(30, 3, 300, 0);
        expect(buf.length).toBe(3);

        // Push a 4th — overwrites the first
        buf.push(40, 4, 400, 1);
        expect(buf.length).toBe(3); // Still 3

        const latest = buf.latest();
        expect(latest.price).toBe(40);
    });

    // ─── PeekLast ──────────────────────────────────────────────

    it('peekLast returns zero-copy subarray views (contiguous)', () => {
        const buf = new TickRingBuffer(10);
        buf.push(10, 1, 100, 0);
        buf.push(20, 2, 200, 1);
        buf.push(30, 3, 300, 0);

        const slice = buf.peekLast(2);
        expect(slice.length).toBe(2);
        expect(slice.price[0]).toBe(20);
        expect(slice.price[1]).toBe(30);
        expect(slice.qty[0]).toBe(2);
        expect(slice.qty[1]).toBe(3);
    });

    it('peekLast handles wrapped region (copies)', () => {
        const buf = new TickRingBuffer(3);
        buf.push(10, 1, 100, 0);
        buf.push(20, 2, 200, 1);
        buf.push(30, 3, 300, 0);
        buf.push(40, 4, 400, 1); // wraps

        const slice = buf.peekLast(3);
        expect(slice.length).toBe(3);
        expect(slice.price[0]).toBe(20); // oldest surviving
        expect(slice.price[1]).toBe(30);
        expect(slice.price[2]).toBe(40); // newest
    });

    it('peekLast clamps to available count', () => {
        const buf = new TickRingBuffer(10);
        buf.push(10, 1, 100, 0);
        const slice = buf.peekLast(100);
        expect(slice.length).toBe(1);
    });

    it('peekLast returns empty when buffer is empty', () => {
        const buf = new TickRingBuffer(10);
        const slice = buf.peekLast(5);
        expect(slice.length).toBe(0);
    });

    // ─── VWAP ──────────────────────────────────────────────────

    it('computes VWAP correctly', () => {
        const buf = new TickRingBuffer(10);
        buf.push(100, 10, 1000, 0); // 100 * 10 = 1000
        buf.push(200, 5, 2000, 1);  // 200 * 5 = 1000

        // VWAP = (1000 + 1000) / (10 + 5) = 133.33...
        expect(buf.vwap(2)).toBeCloseTo(133.33, 1);
    });

    it('vwap returns NaN when empty', () => {
        const buf = new TickRingBuffer(10);
        expect(buf.vwap(10)).toBeNaN();
    });

    // ─── Buy/Sell Counts ───────────────────────────────────────

    it('counts buys and sells', () => {
        const buf = new TickRingBuffer(10);
        buf.push(100, 1, 1000, SIDE.BUY);
        buf.push(101, 1, 1001, SIDE.SELL);
        buf.push(102, 1, 1002, SIDE.BUY);
        buf.push(103, 1, 1003, SIDE.BUY);

        const { buys, sells } = buf.buySellCount(4);
        expect(buys).toBe(3);
        expect(sells).toBe(1);
    });

    // ─── Volume by Side ────────────────────────────────────────

    it('sums volume by side', () => {
        const buf = new TickRingBuffer(10);
        buf.push(100, 5, 1000, SIDE.BUY);
        buf.push(101, 3, 1001, SIDE.SELL);
        buf.push(102, 7, 1002, SIDE.BUY);

        const { buyVolume, sellVolume } = buf.volumeBySize(3);
        expect(buyVolume).toBe(12);
        expect(sellVolume).toBe(3);
    });

    // ─── Clear ─────────────────────────────────────────────────

    it('clears without deallocating', () => {
        const buf = new TickRingBuffer(10);
        buf.push(100, 1, 1000, 0);
        buf.push(200, 2, 2000, 1);
        buf.clear();
        expect(buf.length).toBe(0);
        expect(buf.isEmpty).toBe(true);
        expect(buf.latest()).toBeNull();
        expect(buf.capacity).toBe(10); // Memory still allocated
    });

    // ─── Memory ────────────────────────────────────────────────

    it('reports memory usage', () => {
        const buf = new TickRingBuffer(16384);
        // 4 arrays × 16384 × 8 bytes = 524288 bytes
        expect(buf.memoryBytes()).toBe(524288);
    });

    // ─── Snapshot ──────────────────────────────────────────────

    it('creates independent snapshot copies', () => {
        const buf = new TickRingBuffer(10);
        buf.push(100, 1, 1000, 0);
        buf.push(200, 2, 2000, 1);

        const snap = buf.snapshot();
        expect(snap.count).toBe(2);
        expect(snap.price[0]).toBe(100);

        // Mutating buffer doesn't affect snapshot
        buf.push(300, 3, 3000, 0);
        expect(snap.price.length).toBe(2);
    });
});
