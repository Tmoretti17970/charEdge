// ═══════════════════════════════════════════════════════════════════
// charEdge — Phase 2 Tests
//
// Covers all 5 remaining Wave 8 tasks:
//   8.3.4 - Time & Sales panel (source verification)
//   8.1.4 - Priority tick queue (TickChannel.setPriority)
//   8.2.2 - Phosphor crosshair (glow at intersection)
//   8.3.8 - Ghost grid lines (0.05 opacity)
//   8.1.5 - FrameState pooling (acquire/release lifecycle)
// ═══════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeEach } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (relPath) =>
    fs.readFileSync(path.resolve(__dirname, '..', '..', relPath), 'utf-8');

// ─── 8.3.4: Time & Sales Panel ──────────────────────────────────

describe('8.3.4 — Time & Sales Panel', () => {
    let source, css;

    beforeEach(() => {
        source = readSrc('app/components/chart/panels/TimeSalesPanel.jsx');
        css = readSrc('app/components/chart/panels/TimeSalesPanel.module.css');
    });

    it('imports webSocketService for TickRingBuffer access', () => {
        expect(source).toContain("import { webSocketService }");
    });

    it('calls getTickBuffer(symbol) to read trade data', () => {
        expect(source).toContain('getTickBuffer(symbol)');
    });

    it('reads from TickRingBuffer using peekLast', () => {
        expect(source).toContain('buf.peekLast(n)');
    });

    it('renders Time, Price, Size, Side columns', () => {
        expect(source).toContain('>Time<');
        expect(source).toContain('>Price<');
        expect(source).toContain('>Size<');
        expect(source).toContain('>Side<');
    });

    it('has buy/sell color coding', () => {
        expect(source).toContain('priceBuy');
        expect(source).toContain('priceSell');
        expect(source).toContain('sideBuy');
        expect(source).toContain('sideSell');
    });

    it('has pause-on-hover functionality', () => {
        expect(source).toContain('onMouseEnter');
        expect(source).toContain('onMouseLeave');
        expect(source).toContain('paused');
    });

    it('displays buy/sell count stats', () => {
        expect(source).toContain('B:{stats.buys}');
        expect(source).toContain('S:{stats.sells}');
    });

    it('has CSS module with proper styling', () => {
        expect(css).toContain('.container');
        expect(css).toContain('.row');
        expect(css).toContain('.pausedBanner');
        expect(css).toContain('flashIn');
    });
});

// ─── 8.1.4: Priority Queue ──────────────────────────────────────

describe('8.1.4 — Priority Tick Queue', () => {
    let source;

    beforeEach(() => {
        source = readSrc('charting_library/core/TickChannel.ts');
    });

    it('has _priority map for key priority levels', () => {
        expect(source).toContain('_priority: Map<string, number>');
    });

    it('has setPriority method', () => {
        expect(source).toContain('setPriority(key: string, level: number)');
    });

    it('sorts keys by priority in _flush', () => {
        expect(source).toContain('pb - pa'); // Higher priority first
    });

    it('clears priority map on dispose', () => {
        expect(source).toContain('this._priority.clear()');
    });

    it('documents active vs background priority levels', () => {
        expect(source).toContain('1 = active');
        expect(source).toContain('0 = background');
    });
});

// ─── 8.2.2: Phosphor Crosshair ──────────────────────────────────

describe('8.2.2 — Phosphor Crosshair', () => {
    let source;

    beforeEach(() => {
        source = readSrc('charting_library/renderers/renderers/GridCrosshair.js');
    });

    it('has glowColor in DEFAULT_CROSSHAIR_THEME', () => {
        expect(source).toContain('glowColor');
    });

    it('has glowRadius in DEFAULT_CROSSHAIR_THEME', () => {
        expect(source).toContain('glowRadius');
    });

    it('creates radial gradient for phosphor glow', () => {
        expect(source).toContain('createRadialGradient');
    });

    it('renders circular glow at intersection', () => {
        expect(source).toContain('ctx.arc(vX, hY, glowR');
    });
});

// ─── 8.3.8: Ghost Grid Lines ────────────────────────────────────

describe('8.3.8 — Ghost Grid Lines', () => {
    let source;

    beforeEach(() => {
        source = readSrc('charting_library/renderers/renderers/GridCrosshair.js');
    });

    it('uses 0.05 opacity for grid lines', () => {
        expect(source).toContain('0.05)');
        expect(source).toContain('Ghost grid');
    });

    it('still has border at higher opacity', () => {
        expect(source).toContain("borderColor: 'rgba(54, 58, 69, 0.6)'");
    });
});

// ─── 8.1.5: FrameState Pooling ──────────────────────────────────

describe('8.1.5 — FrameState Pooling', () => {
    let source, pipelineSource;

    beforeEach(() => {
        source = readSrc('charting_library/core/FrameState.ts');
        pipelineSource = readSrc('charting_library/core/RenderPipeline.ts');
    });

    it('defines _FrameStatePool class', () => {
        expect(source).toContain('class _FrameStatePool');
    });

    it('has acquire method', () => {
        expect(source).toContain('acquire(): FrameState');
    });

    it('has release method', () => {
        expect(source).toContain('release(fs: FrameState)');
    });

    it('pre-allocates pool of 4', () => {
        expect(source).toContain('new _FrameStatePool(4)');
    });

    it('FrameState.create uses pool instead of new', () => {
        expect(source).toContain('_frameStatePool.acquire()');
        expect(source).not.toContain('const fs = new FrameState()');
    });

    it('exports frameStatePool singleton', () => {
        expect(source).toContain('export { _frameStatePool as frameStatePool }');
    });

    it('RenderPipeline releases previous frame to pool', () => {
        expect(pipelineSource).toContain('_prevFrameState.release()');
    });

    it('FrameState has release instance method', () => {
        expect(source).toContain('release(): void');
        expect(source).toContain('_frameStatePool.release(this)');
    });
});
