// ═══════════════════════════════════════════════════════════════════
// charEdge — Batch 7: Ghost Box Renderer Tests (Tasks 4.8.1–3)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import { GhostBoxRenderer } from '../../charting_library/renderers/GhostBoxRenderer.js';

// ─── Mock Data ──────────────────────────────────────────────────

const makeTrade = (overrides = {}) => ({
    id: 'trade-1',
    entryPrice: 100,
    exitPrice: 110,
    entryDate: Date.now() - 60_000 * 30, // 30 min ago
    exitDate: Date.now() - 60_000 * 10,  // 10 min ago
    pnl: 50,
    side: 'long',
    setup: 'Breakout',
    emotion: 'confident',
    notes: 'Solid entry on breakout above resistance.',
    tags: ['momentum', 'breakout'],
    rMultiple: 2.5,
    ...overrides,
});

// Simple mapping functions for testing
const timeToX = (t) => (t - (Date.now() - 60_000 * 60)) / 60_000; // 1px per minute
const priceToY = (p) => 500 - (p - 50) * 5; // inverted Y

// ─── Tests ──────────────────────────────────────────────────────

describe('GhostBoxRenderer', () => {
    let renderer;

    beforeEach(() => {
        renderer = new GhostBoxRenderer();
    });

    it('starts with visibility off', () => {
        expect(renderer.visible).toBe(false);
    });

    it('setVisible toggles visibility', () => {
        renderer.setVisible(true);
        expect(renderer.visible).toBe(true);
        renderer.setVisible(false);
        expect(renderer.visible).toBe(false);
    });

    it('hitTest returns null when no regions exist', () => {
        expect(renderer.hitTest(100, 200)).toBeNull();
    });

    it('getHitRegions returns empty array initially', () => {
        expect(renderer.getHitRegions()).toEqual([]);
    });

    it('clear removes all hit regions', () => {
        // Manually add a region for testing
        renderer._tradeHitRegions = [{ x1: 0, y1: 0, x2: 100, y2: 100, trade: makeTrade() }];
        expect(renderer.getHitRegions().length).toBe(1);
        renderer.clear();
        expect(renderer.getHitRegions()).toEqual([]);
    });

    it('hitTest returns trade inside region', () => {
        const trade = makeTrade();
        renderer._tradeHitRegions = [{ x1: 10, y1: 10, x2: 50, y2: 50, trade }];
        expect(renderer.hitTest(25, 25)).toBe(trade);
        expect(renderer.hitTest(10, 10)).toBe(trade); // on boundary
        expect(renderer.hitTest(50, 50)).toBe(trade); // on boundary
    });

    it('hitTest returns null outside all regions', () => {
        const trade = makeTrade();
        renderer._tradeHitRegions = [{ x1: 10, y1: 10, x2: 50, y2: 50, trade }];
        expect(renderer.hitTest(0, 0)).toBeNull();
        expect(renderer.hitTest(60, 60)).toBeNull();
        expect(renderer.hitTest(25, 60)).toBeNull();
    });

    it('hitTest returns first match for overlapping regions', () => {
        const trade1 = makeTrade({ id: 'trade-1' });
        const trade2 = makeTrade({ id: 'trade-2' });
        renderer._tradeHitRegions = [
            { x1: 10, y1: 10, x2: 50, y2: 50, trade: trade1 },
            { x1: 20, y1: 20, x2: 60, y2: 60, trade: trade2 },
        ];
        // Point in overlap zone → returns first match
        expect(renderer.hitTest(30, 30)?.id).toBe('trade-1');
    });

    it('render clears regions when not visible', () => {
        renderer._tradeHitRegions = [{ x1: 0, y1: 0, x2: 100, y2: 100, trade: makeTrade() }];
        renderer.setVisible(false);
        // Call render with null ctx (won't actually draw — tests region clearing)
        renderer.render(null, [makeTrade()], timeToX, priceToY, null);
        expect(renderer.getHitRegions()).toEqual([]);
    });

    it('render clears regions when trades is empty', () => {
        renderer._tradeHitRegions = [{ x1: 0, y1: 0, x2: 100, y2: 100, trade: makeTrade() }];
        renderer.setVisible(true);
        renderer.render(null, [], timeToX, priceToY, null);
        expect(renderer.getHitRegions()).toEqual([]);
    });

    it('skips trades without exit data', () => {
        renderer.setVisible(true);
        const openTrade = makeTrade({ exitPrice: null, exitDate: null });
        // Mock canvas context
        const ctx = {
            save: () => { },
            restore: () => { },
            beginPath: () => { },
            rect: () => { },
            clip: () => { },
            fillRect: () => { },
            strokeRect: () => { },
            setLineDash: () => { },
            fillText: () => { },
            fillStyle: '',
            strokeStyle: '',
            lineWidth: 0,
            font: '',
            textAlign: '',
        };
        renderer.render(ctx, [openTrade], timeToX, priceToY, null);
        expect(renderer.getHitRegions()).toEqual([]);
    });
});
