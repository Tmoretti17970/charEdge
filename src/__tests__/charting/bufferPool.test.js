// ═══════════════════════════════════════════════════════════════════
// Tests for BufferPool — typed array recycling
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import { BufferPool } from '../../charting_library/core/BufferPool.ts';

describe('BufferPool', () => {
    let pool;

    beforeEach(() => {
        pool = new BufferPool();
    });

    it('acquires Float32Array of at least requested size', () => {
        const buf = pool.acquire(Float32Array, 100);
        expect(buf).toBeInstanceOf(Float32Array);
        expect(buf.length).toBeGreaterThanOrEqual(100);
    });

    it('rounds up to power of 2', () => {
        const buf = pool.acquire(Float32Array, 100);
        expect(buf.length).toBe(128); // Next power of 2
    });

    it('minimum size is 64', () => {
        const buf = pool.acquire(Float32Array, 1);
        expect(buf.length).toBe(64);
    });

    it('reuses released buffers', () => {
        const buf1 = pool.acquire(Float32Array, 100);
        const ref = buf1; // Keep reference
        pool.release(buf1);

        const buf2 = pool.acquire(Float32Array, 100);
        expect(buf2).toBe(ref); // Same buffer reused
    });

    it('does not reuse buffers of different sizes', () => {
        const buf1 = pool.acquire(Float32Array, 100);
        pool.release(buf1);

        const buf2 = pool.acquire(Float32Array, 500);
        expect(buf2.length).toBe(512); // Different bucket
        expect(buf2).not.toBe(buf1);
    });

    it('does not reuse buffers of different types', () => {
        const f32 = pool.acquire(Float32Array, 100);
        pool.release(f32);

        const f64 = pool.acquire(Float64Array, 100);
        expect(f64).toBeInstanceOf(Float64Array);
        expect(f64.length).toBe(128);
    });

    it('f32 shorthand works', () => {
        const buf = pool.f32(256);
        expect(buf).toBeInstanceOf(Float32Array);
        expect(buf.length).toBe(256);
    });

    it('f64 shorthand works', () => {
        const buf = pool.f64(300);
        expect(buf).toBeInstanceOf(Float64Array);
        expect(buf.length).toBe(512);
    });

    it('clear empties all buckets', () => {
        pool.acquire(Float32Array, 100);
        pool.acquire(Float32Array, 200);
        pool.clear();

        const stats = pool.getStats();
        expect(stats.pooled).toBe(0);
        expect(stats.buckets).toBe(0);
    });

    it('getStats tracks active/pooled counts', () => {
        const buf = pool.acquire(Float32Array, 100);
        let stats = pool.getStats();
        expect(stats.active).toBe(1);
        expect(stats.pooled).toBe(0);

        pool.release(buf);
        stats = pool.getStats();
        expect(stats.active).toBe(0);
        expect(stats.pooled).toBe(1);
        expect(stats.memoryBytes).toBeGreaterThan(0);
    });

    it('trim reduces free buffers to max 2 per bucket', () => {
        // Acquire and release 5 buffers of same size
        const bufs = [];
        for (let i = 0; i < 5; i++) {
            bufs.push(pool.acquire(Float32Array, 100));
        }
        for (const b of bufs) pool.release(b);

        let stats = pool.getStats();
        expect(stats.pooled).toBe(5);

        pool.trim();
        stats = pool.getStats();
        expect(stats.pooled).toBe(2);
    });

    it('respects max free per bucket limit', () => {
        // Acquire and release 10 buffers (max is 8)
        const bufs = [];
        for (let i = 0; i < 10; i++) {
            bufs.push(pool.acquire(Float32Array, 100));
        }
        for (const b of bufs) pool.release(b);

        const stats = pool.getStats();
        expect(stats.pooled).toBeLessThanOrEqual(8);
    });
});
