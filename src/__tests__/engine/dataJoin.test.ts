// ═══════════════════════════════════════════════════════════════════
// charEdge — DataJoin Unit Tests
// Sprint 19 #124
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataJoin } from '../../charting_library/gpu/DataJoin';

// Shim GPUBufferUsage for Node.js test environment
(globalThis as unknown).GPUBufferUsage = {
    MAP_READ: 0x0001,
    MAP_WRITE: 0x0002,
    COPY_SRC: 0x0004,
    COPY_DST: 0x0008,
    INDEX: 0x0010,
    VERTEX: 0x0020,
    UNIFORM: 0x0040,
    STORAGE: 0x0080,
    INDIRECT: 0x0100,
    QUERY_RESOLVE: 0x0200,
};

// ─── GPU Device Mock ────────────────────────────────────────────

function mockGPUDevice(): unknown {
    const buffers: Map<number, { destroyed: boolean; size: number; usage: number; label: string }> = new Map();
    let nextId = 1;

    return {
        createBuffer(desc: { size: number; usage: number; label?: string }) {
            const id = nextId++;
            const buf = { destroyed: false, size: desc.size, usage: desc.usage, label: desc.label || '', id, destroy() { buf.destroyed = true; } };
            buffers.set(id, buf);
            return buf;
        },
        queue: {
            writeBuffer: vi.fn(),
        },
        _buffers: buffers,
    };
}

// ─── Tests ──────────────────────────────────────────────────────

describe('DataJoin: enter/update/exit lifecycle', () => {
    let join: DataJoin;
    let device: ReturnType<typeof mockGPUDevice>;

    beforeEach(() => {
        join = new DataJoin();
        device = mockGPUDevice();
    });

    it('enter: creates a new buffer on first join', () => {
        const data = new Float32Array([1, 2, 3, 4]);
        const result = join.join(device, 'test', data);

        expect(result).not.toBeNull();
        expect(result!.label).toBe('test');
        expect(result!.length).toBe(4);
        expect(result!.capacity).toBeGreaterThanOrEqual(4);
        expect(result!.generation).toBe(1);
        expect(join.size).toBe(1);
    });

    it('update: reuses buffer on subsequent joins', () => {
        const data1 = new Float32Array([1, 2, 3]);
        const data2 = new Float32Array([4, 5, 6]);

        const result1 = join.join(device, 'test', data1);
        const result2 = join.join(device, 'test', data2);

        // Same buffer object should be reused
        expect(result2!.buffer).toBe(result1!.buffer);
        expect(result2!.generation).toBe(2);
        expect(result2!.length).toBe(3);
    });

    it('update: grows buffer when data exceeds capacity', () => {
        const small = new Float32Array(10);
        const large = new Float32Array(1000);

        const result1 = join.join(device, 'grow', small);
        const result2 = join.join(device, 'grow', large);

        // Should have created a new, larger buffer
        expect(result2!.buffer).not.toBe(result1!.buffer);
        expect(result2!.capacity).toBeGreaterThanOrEqual(1000);
        expect(result2!.generation).toBe(1); // Reset on regrow
    });

    it('exit: destroys buffer when null is passed', () => {
        const data = new Float32Array([1, 2, 3]);
        const result = join.join(device, 'ephemeral', data);
        expect(join.has('ephemeral')).toBe(true);

        const exited = join.join(device, 'ephemeral', null);
        expect(exited).toBeNull();
        expect(join.has('ephemeral')).toBe(false);
        expect((result!.buffer as unknown).destroyed).toBe(true);
    });

    it('exit on non-existent key is safe', () => {
        const result = join.join(device, 'ghost', null);
        expect(result).toBeNull();
    });

    it('capacitive growth uses powers of 2', () => {
        const data = new Float32Array(300);
        const result = join.join(device, 'pow2', data);
        // capacity should be >= 300 and a power of 2
        expect(result!.capacity).toBeGreaterThanOrEqual(300);
        expect(Math.log2(result!.capacity) % 1).toBe(0);
    });

    it('clear() destroys all buffers', () => {
        join.join(device, 'a', new Float32Array(10));
        join.join(device, 'b', new Float32Array(20));
        join.join(device, 'c', new Float32Array(30));
        expect(join.size).toBe(3);

        join.clear();
        expect(join.size).toBe(0);
    });

    it('joinMany() processes multiple entries', () => {
        const results = join.joinMany(device, [
            { key: 'x', data: new Float32Array([1, 2]) },
            { key: 'y', data: new Float32Array([3, 4, 5]) },
            { key: 'z', data: null },
        ]);

        expect(results.get('x')).not.toBeNull();
        expect(results.get('y')).not.toBeNull();
        expect(results.get('z')).toBeNull();
        expect(join.size).toBe(2);
    });

    it('getStats() reports memory usage', () => {
        join.join(device, 'stat1', new Float32Array(100));
        join.join(device, 'stat2', new Float32Array(200));

        const stats = join.getStats();
        expect(stats.activeBuffers).toBe(2);
        expect(stats.totalActiveBytes).toBe((100 + 200) * 4);
        expect(stats.totalCapacityBytes).toBeGreaterThanOrEqual(stats.totalActiveBytes);
        expect(stats.utilization).toBeGreaterThan(0);
        expect(stats.utilization).toBeLessThanOrEqual(1);
    });

    it('writeBuffer is called on enter and update', () => {
        join.join(device, 'writes', new Float32Array([1]));
        expect(device.queue.writeBuffer).toHaveBeenCalledTimes(1);

        join.join(device, 'writes', new Float32Array([2]));
        expect(device.queue.writeBuffer).toHaveBeenCalledTimes(2);
    });
});
