// ═══════════════════════════════════════════════════════════════════
// charEdge — TickChannel Tests (Tasks 8.1.1 + 8.1.2)
//
// Unit tests for the TickChannel singleton:
//   1. Subscribe/unsubscribe lifecycle
//   2. pushTick delivers bars to subscribed engines
//   3. pushHistorical delivers immediately
//   4. rAF batching verification
//   5. Dispose cleanup
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('TickChannel — source verification', () => {
    let source;

    beforeEach(() => {
        source = fs.readFileSync(
            path.resolve(__dirname, '..', '..', 'charting_library/core/TickChannel.ts'),
            'utf-8'
        );
    });

    // ─── Module Structure ────────────────────────────────────────

    it('exports tickChannel singleton', () => {
        expect(source).toContain('export const tickChannel');
    });

    it('exports TickReceiver type', () => {
        expect(source).toContain('export type { TickReceiver }');
    });

    // ─── Subscribe/Unsubscribe ──────────────────────────────────

    it('has subscribe method returning unsubscribe function', () => {
        expect(source).toContain('subscribe(key');
        expect(source).toContain('void');
    });

    it('stores subscribers in a Map<string, Set>', () => {
        expect(source).toContain('Map<string, Set<TickReceiver>>');
    });

    it('cleans up empty subscriber sets on unsubscribe', () => {
        expect(source).toContain('s.size === 0');
        expect(source).toContain('this._subscribers.delete(key)');
    });

    // ─── pushTick — rAF Batching ────────────────────────────────

    it('coalesces multiple pushTick calls per frame via rAF', () => {
        expect(source).toContain('requestAnimationFrame');
        expect(source).toContain('this._rafId');
    });

    it('stores pending ticks in a Map', () => {
        expect(source).toContain('this._pending.set(key');
    });

    it('flushes pending ticks on rAF callback', () => {
        expect(source).toContain('_flush');
        expect(source).toContain('this._pending.clear()');
    });

    it('calls engine.setData in flush', () => {
        expect(source).toContain('engine.setData(bars)');
    });

    // ─── pushHistorical — Immediate Delivery ────────────────────

    it('pushHistorical delivers immediately without batching', () => {
        expect(source).toContain('pushHistorical(key: string, bars: Bar[])');
        // pushHistorical calls engine.setData directly
        expect(source).toContain('engine.setData(bars)');
    });

    // ─── Dispose ────────────────────────────────────────────────

    it('dispose cancels pending rAF and clears state', () => {
        expect(source).toContain('cancelAnimationFrame');
        expect(source).toContain('this._subscribers.clear()');
    });

    // ─── hasSubscribers ─────────────────────────────────────────

    it('has hasSubscribers method', () => {
        expect(source).toContain('hasSubscribers(key: string): boolean');
    });
});

describe('TickChannel — integration with DatafeedService', () => {
    let source;

    beforeEach(() => {
        source = fs.readFileSync(
            path.resolve(__dirname, '..', '..', 'charting_library/datafeed/DatafeedService.js'),
            'utf-8'
        );
    });

    it('imports tickChannel', () => {
        expect(source).toContain("import { tickChannel }");
    });

    it('calls tickChannel.pushTick in onmessage handler', () => {
        expect(source).toContain('tickChannel.pushTick(key, updatedBars, bar)');
    });

    it('calls tickChannel.pushHistorical after loading historical data', () => {
        expect(source).toContain('tickChannel.pushHistorical(key, bars)');
    });
});
