// ═══════════════════════════════════════════════════════════════════
// Unit Tests — Chart Engine Modules
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';
import { LODManager } from '../../../charting_library/renderers/LODManager.ts';
import { GPUMemoryBudget } from '../../../charting_library/gpu/GPUMemoryBudget.ts';
import { hashShaderSource } from '../../../charting_library/gpu/ShaderCache.ts';

// ─── LOD Manager ────────────────────────────────────────────────

describe('LOD Manager', () => {
    it('returns Level 0 for wide bar spacing', () => {
        const lod = new LODManager();
        const config = lod.computeLevel(12);
        expect(config.level).toBe(0);
        expect(config.label).toBe('Full Candles');
        expect(config.drawWicks).toBe(true);
        expect(config.drawBodyFills).toBe(true);
    });

    it('returns Level 1 for medium bar spacing', () => {
        const lod = new LODManager();
        const config = lod.computeLevel(6);
        expect(config.level).toBe(1);
        expect(config.label).toBe('Simplified Bars');
        expect(config.drawBodyFills).toBe(false);
    });

    it('returns Level 2 for narrow bar spacing', () => {
        const lod = new LODManager();
        const config = lod.computeLevel(3);
        expect(config.level).toBe(2);
        expect(config.label).toBe('Dots');
        expect(config.drawWicks).toBe(false);
        expect(config.drawVolume).toBe(false);
    });

    it('returns Level 3 for very narrow bar spacing', () => {
        const lod = new LODManager();
        const config = lod.computeLevel(1);
        expect(config.level).toBe(3);
        expect(config.label).toBe('Aggregated Blocks');
        expect(config.aggregationFactor).toBe(4);
    });

    it('fires transition callbacks on level change', () => {
        const lod = new LODManager();
        const callback = vi.fn();
        lod.onTransition(callback);

        lod.computeLevel(12); // Level 0
        lod.computeLevel(3);  // Level 2, should fire
        expect(callback).toHaveBeenCalledOnce();
        expect(callback).toHaveBeenCalledWith(expect.objectContaining({ level: 2 }));
    });

    it('supports forceLevel for debugging', () => {
        const lod = new LODManager();
        const config = lod.forceLevel(3);
        expect(config.level).toBe(3);
        expect(lod.getLevel()).toBe(3);
    });
});

// ─── GPU Memory Budget ──────────────────────────────────────────

describe('GPU Memory Budget', () => {
    it('tracks allocations correctly', () => {
        const budget = new GPUMemoryBudget();
        budget.allocate('candles', 1024, 'rendering');
        budget.allocate('volume', 512, 'rendering');

        expect(budget.getUsedBytes()).toBe(1536);
        expect(budget.getStatus().allocationCount).toBe(2);
    });

    it('releases allocations', () => {
        const budget = new GPUMemoryBudget();
        budget.allocate('test', 1000);
        expect(budget.getUsedBytes()).toBe(1000);
        budget.release('test');
        expect(budget.getUsedBytes()).toBe(0);
    });

    it('reports correct warning levels', () => {
        const budget = new GPUMemoryBudget({ budgetBytes: 1000 });

        budget.allocate('small', 500);
        expect(budget.getStatus().warningLevel).toBe('ok');

        budget.allocate('medium', 260);
        expect(budget.getStatus().warningLevel).toBe('warning'); // 76%

        budget.allocate('large', 150);
        expect(budget.getStatus().warningLevel).toBe('critical'); // 91%
    });

    it('evicts LRU entries when over budget', () => {
        const budget = new GPUMemoryBudget({ budgetBytes: 1000 });
        budget.allocate('old', 400, 'a');
        budget.allocate('newer', 400, 'b');
        budget.touch('newer'); // Make 'newer' more recently accessed

        const freed = budget.evictLRU(300);
        expect(freed).toBeGreaterThanOrEqual(300);
        // 'old' should have been evicted first (least recently used)
        expect(budget.getUsedBytes()).toBeLessThanOrEqual(400);
    });

    it('provides category breakdown', () => {
        const budget = new GPUMemoryBudget();
        budget.allocate('c1', 100, 'candles');
        budget.allocate('c2', 200, 'candles');
        budget.allocate('v1', 50, 'volume');

        const breakdown = budget.getCategoryBreakdown();
        expect(breakdown.candles).toEqual({ bytes: 300, count: 2 });
        expect(breakdown.volume).toEqual({ bytes: 50, count: 1 });
    });

    it('resets all allocations', () => {
        const budget = new GPUMemoryBudget();
        budget.allocate('test', 1000);
        budget.reset();
        expect(budget.getUsedBytes()).toBe(0);
        expect(budget.getStatus().allocationCount).toBe(0);
    });
});

// ─── Shader Cache ───────────────────────────────────────────────

describe('Shader Cache Hash', () => {
    it('generates consistent hashes for same input', () => {
        const h1 = hashShaderSource('vert', 'frag');
        const h2 = hashShaderSource('vert', 'frag');
        expect(h1).toBe(h2);
    });

    it('generates different hashes for different inputs', () => {
        const h1 = hashShaderSource('vert1', 'frag1');
        const h2 = hashShaderSource('vert2', 'frag2');
        expect(h1).not.toBe(h2);
    });

    it('returns a compact string', () => {
        const hash = hashShaderSource('some vertex shader', 'some fragment shader');
        expect(typeof hash).toBe('string');
        expect(hash.length).toBeGreaterThan(0);
        expect(hash.length).toBeLessThan(20);
    });
});
