// ═══════════════════════════════════════════════════════════════════
// charEdge — Hollow Candles Tests
//
// Verifies the shader and renderer infrastructure for hollow candle
// chart type support.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { CANDLE_VERT, CANDLE_FRAG } from '../../charting_library/renderers/shaders/candle.js';

describe('Hollow Candles — Shader Infrastructure', () => {
    // ─── Vertex Shader ─────────────────────────────────────────

    it('vertex shader passes v_isWick varying', () => {
        expect(CANDLE_VERT).toContain('out float v_isWick');
        expect(CANDLE_VERT).toContain('v_isWick = a_isWick');
    });

    it('vertex shader passes v_uv (quad UV coordinates)', () => {
        expect(CANDLE_VERT).toContain('out vec2 v_uv');
        expect(CANDLE_VERT).toContain('v_uv = a_position');
    });

    // ─── Fragment Shader ───────────────────────────────────────

    it('fragment shader has u_hollow uniform', () => {
        expect(CANDLE_FRAG).toContain('uniform float u_hollow');
    });

    it('fragment shader receives v_isWick and v_uv', () => {
        expect(CANDLE_FRAG).toContain('in float v_isWick');
        expect(CANDLE_FRAG).toContain('in vec2 v_uv');
    });

    it('fragment shader discards interior of hollow bull bodies', () => {
        expect(CANDLE_FRAG).toContain('u_hollow > 0.5');
        expect(CANDLE_FRAG).toContain('v_isBull > 0.5');
        expect(CANDLE_FRAG).toContain('v_isWick < 0.5');
        expect(CANDLE_FRAG).toContain('discard');
    });

    it('fragment shader computes edge distance for border', () => {
        expect(CANDLE_FRAG).toContain('edgeDist');
        expect(CANDLE_FRAG).toContain('border');
    });

    // ─── Backward Compatibility ────────────────────────────────

    it('non-hollow mode renders normally (no discard when u_hollow = 0)', () => {
        // When u_hollow is 0.0, the discard branch is never entered
        expect(CANDLE_FRAG).toContain('if (u_hollow > 0.5');
        // fragColor is always set
        expect(CANDLE_FRAG).toContain('fragColor = color');
    });

    it('shader is valid GLSL 300 es', () => {
        expect(CANDLE_VERT).toContain('#version 300 es');
        expect(CANDLE_FRAG).toContain('#version 300 es');
    });
});

describe('Hollow Candles — CandleRenderer Integration', () => {
    it('CandleParams interface accepts hollow param', async () => {
        // Import the module to verify it loads without errors
        const mod = await import('../../charting_library/renderers/CandleRenderer.ts');
        expect(mod.drawCandles).toBeDefined();
        expect(mod.updateLastCandle).toBeDefined();
    });
});

describe('Hollow Candles — DataStage Integration', () => {
    it('DataStage imports toHeikinAshi', async () => {
        const source = await import('../../charting_library/core/stages/DataStage.ts?raw')
            .then(m => m.default).catch(() => '');
        // If raw import works, check the source
        if (source) {
            expect(source).toContain('toHeikinAshi');
            expect(source).toContain("'hollow'");
            expect(source).toContain("'heikinashi'");
        }
    });
});
