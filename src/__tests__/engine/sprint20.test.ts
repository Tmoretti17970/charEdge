// ═══════════════════════════════════════════════════════════════════
// charEdge — Sprint 20 Test Suite
// #125 ComputeRenderBridge, #127 MiniChartEngine, #129 CrossChartTransfer
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Shim GPUBufferUsage for Node.js test environment
(globalThis as unknown).GPUBufferUsage = {
    MAP_READ: 0x0001, MAP_WRITE: 0x0002, COPY_SRC: 0x0004, COPY_DST: 0x0008,
    INDEX: 0x0010, VERTEX: 0x0020, UNIFORM: 0x0040, STORAGE: 0x0080,
    INDIRECT: 0x0100, QUERY_RESOLVE: 0x0200,
};

// ─── #125 ComputeRenderBridge Tests ──────────────────────────────

import { ComputeRenderBridge } from '../../charting_library/gpu/ComputeRenderBridge';
import type { JoinedBuffer } from '../../charting_library/gpu/DataJoin';

function makeJoined(label: string, gen = 1): JoinedBuffer {
    return {
        buffer: { id: label } as unknown,
        capacity: 256,
        length: 100,
        label,
        generation: gen,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX,
    };
}

function mockRenderPass(): unknown {
    return { setVertexBuffer: vi.fn() };
}

describe('#125 ComputeRenderBridge', () => {
    let bridge: ComputeRenderBridge;

    beforeEach(() => {
        bridge = new ComputeRenderBridge();
    });

    it('binds a joined buffer as vertex buffer', () => {
        const pass = mockRenderPass();
        const joined = makeJoined('ema');

        bridge.bindAsVertexBuffer(pass, 0, joined);

        expect(pass.setVertexBuffer).toHaveBeenCalledWith(0, joined.buffer, 0, 400);
    });

    it('skips rebind if same buffer + same generation', () => {
        const pass = mockRenderPass();
        const joined = makeJoined('ema', 1);

        bridge.bindAsVertexBuffer(pass, 0, joined);
        bridge.bindAsVertexBuffer(pass, 0, joined); // Same gen → skip

        expect(pass.setVertexBuffer).toHaveBeenCalledTimes(1);
    });

    it('rebinds if generation changes', () => {
        const pass = mockRenderPass();
        const joined1 = makeJoined('ema', 1);
        const joined2 = { ...joined1, generation: 2 };

        bridge.bindAsVertexBuffer(pass, 0, joined1);
        bridge.bindAsVertexBuffer(pass, 0, joined2);

        expect(pass.setVertexBuffer).toHaveBeenCalledTimes(2);
    });

    it('binds as instance buffer', () => {
        const pass = mockRenderPass();
        const joined = makeJoined('rsi');

        bridge.bindAsInstanceBuffer(pass, 1, joined);

        expect(pass.setVertexBuffer).toHaveBeenCalledWith(1, joined.buffer, 0, 400);
    });

    it('isVertexCompatible checks VERTEX flag', () => {
        const compatible = makeJoined('ok');
        const incompatible = { ...makeJoined('bad'), usage: GPUBufferUsage.STORAGE };

        expect(ComputeRenderBridge.isVertexCompatible(compatible)).toBe(true);
        expect(ComputeRenderBridge.isVertexCompatible(incompatible)).toBe(false);
    });

    it('getStats tracks round-trips avoided', () => {
        const pass = mockRenderPass();
        bridge.bindAsVertexBuffer(pass, 0, makeJoined('a', 1));
        bridge.bindAsInstanceBuffer(pass, 1, makeJoined('b', 1));

        const stats = bridge.getStats();
        expect(stats.boundVertexSlots).toBe(1);
        expect(stats.boundInstanceSlots).toBe(1);
        expect(stats.totalRoundTripsAvoided).toBe(2);
    });

    it('clearAll resets bindings', () => {
        const pass = mockRenderPass();
        bridge.bindAsVertexBuffer(pass, 0, makeJoined('x'));
        bridge.clearAll();

        const stats = bridge.getStats();
        expect(stats.boundVertexSlots).toBe(0);
        expect(stats.boundInstanceSlots).toBe(0);
    });
});

// ─── #127 MiniChartEngine Tests ──────────────────────────────────

// @vitest-environment jsdom (declared here programmatically since we need both)
import { drawLine, drawBar, drawPie, drawGrid, drawAxes } from '../../app/components/charts/MiniChartEngine';

function createCanvas(w = 300, h = 200): CanvasRenderingContext2D {
    // jsdom doesn't support canvas natively — create a full mock context
    const ctx: unknown = {
        canvas: { width: w, height: h },
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        bezierCurveTo: vi.fn(),
        quadraticCurveTo: vi.fn(),
        arc: vi.fn(),
        closePath: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        fillText: vi.fn(),
        createLinearGradient: vi.fn().mockReturnValue({
            addColorStop: vi.fn(),
        }),
        lineWidth: 1,
        strokeStyle: '',
        fillStyle: '',
        lineJoin: '',
        lineCap: '',
        font: '',
        textAlign: '',
        textBaseline: '',
    };
    return ctx as CanvasRenderingContext2D;
}

describe('#127 MiniChartEngine', () => {
    it('drawLine renders without errors', () => {
        const ctx = createCanvas();
        const data = [{ x: 0, y: 10 }, { x: 1, y: 20 }, { x: 2, y: 15 }, { x: 3, y: 25 }];
        expect(() => drawLine(ctx, data)).not.toThrow();
    });

    it('drawLine handles < 2 points gracefully', () => {
        const ctx = createCanvas();
        expect(() => drawLine(ctx, [{ x: 0, y: 1 }])).not.toThrow();
        expect(() => drawLine(ctx, [])).not.toThrow();
    });

    it('drawBar renders with positive and negative values', () => {
        const ctx = createCanvas();
        const data = [
            { x: 0, y: 10 }, { x: 1, y: -5 }, { x: 2, y: 20 }, { x: 3, y: -3 },
        ];
        expect(() => drawBar(ctx, data)).not.toThrow();
    });

    it('drawPie renders slices', () => {
        const ctx = createCanvas();
        const slices = [
            { value: 60, label: 'Win', color: '#26A69A' },
            { value: 40, label: 'Loss', color: '#EF5350' },
        ];
        expect(() => drawPie(ctx, slices)).not.toThrow();
    });

    it('drawPie as doughnut with inner radius', () => {
        const ctx = createCanvas();
        const slices = [
            { value: 70, label: 'A', color: '#42A5F5' },
            { value: 30, label: 'B', color: '#AB47BC' },
        ];
        expect(() => drawPie(ctx, slices, { innerRadius: 40 })).not.toThrow();
    });

    it('drawGrid renders without errors', () => {
        const ctx = createCanvas();
        expect(() => drawGrid(ctx)).not.toThrow();
    });

    it('drawAxes renders labels', () => {
        const ctx = createCanvas();
        const data = [{ x: 0, y: 10 }, { x: 1, y: 20 }];
        expect(() => drawAxes(ctx, data)).not.toThrow();
    });

    it('drawLine with all options', () => {
        const ctx = createCanvas();
        const data = Array.from({ length: 20 }, (_, i) => ({ x: i, y: Math.sin(i) * 10 }));
        expect(() => drawLine(ctx, data, {
            color: '#FF6B6B',
            lineWidth: 3,
            showDots: true,
            dotRadius: 4,
            fillGradient: true,
            fillAlpha: 0.2,
            smooth: true,
        })).not.toThrow();
    });
});

// ─── #129 CrossChartTransfer Tests ───────────────────────────────

import { CrossChartTransfer } from '../../charting_library/core/CrossChartTransfer';
import type { TransferableEngine, TransferPayload } from '../../charting_library/core/CrossChartTransfer';

function mockEngine(id: string): TransferableEngine {
    return {
        exportPane: vi.fn().mockReturnValue({
            paneState: { id: 'pane_0', heightFraction: 0.15 },
            indicators: [{ indicatorId: 'rsi', params: { period: 14 } }],
            sourceEngineId: id,
            sourcePaneIdx: 0,
        } as TransferPayload),
        importPane: vi.fn().mockReturnValue(true),
        getContainer: vi.fn().mockReturnValue({
            getBoundingClientRect: () => ({
                left: 0, right: 500, top: 0, bottom: 400,
            }),
        }),
    };
}

describe('#129 CrossChartTransfer', () => {
    beforeEach(() => {
        CrossChartTransfer.reset();
    });

    it('register and unregister engines', () => {
        CrossChartTransfer.register('a', mockEngine('a'));
        expect(CrossChartTransfer.getEngineIds()).toEqual(['a']);

        CrossChartTransfer.unregister('a');
        expect(CrossChartTransfer.getEngineIds()).toEqual([]);
    });

    it('available is true with 2+ engines', () => {
        expect(CrossChartTransfer.available).toBe(false);
        CrossChartTransfer.register('a', mockEngine('a'));
        expect(CrossChartTransfer.available).toBe(false);
        CrossChartTransfer.register('b', mockEngine('b'));
        expect(CrossChartTransfer.available).toBe(true);
    });

    it('transfer calls exportPane then importPane', () => {
        const engineA = mockEngine('a');
        const engineB = mockEngine('b');
        CrossChartTransfer.register('a', engineA);
        CrossChartTransfer.register('b', engineB);

        const success = CrossChartTransfer.transfer('a', 0, 'b', 1);
        expect(success).toBe(true);
        expect(engineA.exportPane).toHaveBeenCalledWith(0);
        expect(engineB.importPane).toHaveBeenCalledWith(expect.any(Object), 1);
    });

    it('transfer returns false for same engine', () => {
        CrossChartTransfer.register('a', mockEngine('a'));
        expect(CrossChartTransfer.transfer('a', 0, 'a', 1)).toBe(false);
    });

    it('transfer returns false for missing engines', () => {
        CrossChartTransfer.register('a', mockEngine('a'));
        expect(CrossChartTransfer.transfer('a', 0, 'ghost', 0)).toBe(false);
    });

    it('hitTestEngines detects correct engine', () => {
        const engine = mockEngine('chart-1');
        CrossChartTransfer.register('chart-1', engine);

        expect(CrossChartTransfer.hitTestEngines(250, 200)).toBe('chart-1');
        expect(CrossChartTransfer.hitTestEngines(600, 200)).toBeNull();
    });

    it('emits transfer events', () => {
        const listener = vi.fn();
        const unsub = CrossChartTransfer.on(listener);

        CrossChartTransfer.register('a', mockEngine('a'));
        CrossChartTransfer.register('b', mockEngine('b'));
        CrossChartTransfer.transfer('a', 0, 'b');

        expect(listener).toHaveBeenCalledTimes(2);
        expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'transfer-start' }));
        expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'transfer-complete' }));

        unsub();
    });

    it('beginDrag / endDrag manage active transfer', () => {
        const engine = mockEngine('src');
        CrossChartTransfer.register('src', engine);

        CrossChartTransfer.beginDrag('src', 0);
        expect(CrossChartTransfer.activeTransfer).not.toBeNull();

        CrossChartTransfer.endDrag();
        expect(CrossChartTransfer.activeTransfer).toBeNull();
    });

    it('reset clears everything', () => {
        CrossChartTransfer.register('a', mockEngine('a'));
        CrossChartTransfer.reset();
        expect(CrossChartTransfer.getEngineIds()).toEqual([]);
    });
});
