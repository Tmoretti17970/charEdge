// ═══════════════════════════════════════════════════════════════════
// Unit Tests — UX & Accessibility Utilities
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';
import { AriaLivePrice } from '@/a11y/ariaLivePrice.ts';
import { ChartKeyboardNav } from '@/a11y/chartKeyboardNav.ts';
import { BatteryAware } from '@/app/misc/batteryAware.ts';

// ─── ARIA Live Price ────────────────────────────────────────────

describe('ARIA Live Price', () => {
    it('does not announce without mounting', () => {
        const alp = new AriaLivePrice();
        const result = alp.announce('BTCUSDT', 97000);
        expect(result).toBe(false);
    });

    it('accepts custom config', () => {
        const alp = new AriaLivePrice({
            significantChangePercent: 1.0,
            debounceMs: 10000,
            politeness: 'assertive',
        });
        expect(alp).toBeDefined();
    });

    it('getText returns empty before mount', () => {
        const alp = new AriaLivePrice();
        expect(alp.getText()).toBe('');
    });
});

// ─── Chart Keyboard Navigation ──────────────────────────────────

describe('Chart Keyboard Nav', () => {
    it('creates with callbacks', () => {
        const nav = new ChartKeyboardNav({
            onMove: vi.fn(),
            onSelect: vi.fn(),
            onDismiss: vi.fn(),
            onZoom: vi.fn(),
        });
        expect(nav).toBeDefined();
    });

    it('can enable/disable', () => {
        const nav = new ChartKeyboardNav({});
        nav.setEnabled(false);
        nav.setEnabled(true);
        // No error
    });

    it('can update callbacks', () => {
        const onMove = vi.fn();
        const nav = new ChartKeyboardNav({});
        nav.setCallbacks({ onMove });
        // Callback updated without error
    });

    it('detach without attach is safe', () => {
        const nav = new ChartKeyboardNav({});
        expect(() => nav.detach()).not.toThrow();
    });
});

// ─── Battery-Aware Mode ─────────────────────────────────────────

describe('Battery-Aware Mode', () => {
    it('defaults to full mode', () => {
        const ba = new BatteryAware();
        const status = ba.getStatus();
        expect(status.mode).toBe('full');
        expect(status.targetFps).toBe(60);
        expect(status.animationsEnabled).toBe(true);
    });

    it('can force reduced mode', () => {
        const ba = new BatteryAware();
        ba.forceMode('reduced');
        const status = ba.getStatus();
        expect(status.mode).toBe('reduced');
        expect(status.targetFps).toBe(30);
    });

    it('can force minimal mode', () => {
        const ba = new BatteryAware();
        ba.forceMode('minimal');
        const status = ba.getStatus();
        expect(status.mode).toBe('minimal');
        expect(status.targetFps).toBe(15);
        expect(status.animationsEnabled).toBe(false);
        expect(status.reducedTicks).toBe(true);
    });

    it('fires onChange callbacks', () => {
        const ba = new BatteryAware();
        const callback = vi.fn();
        ba.onChange(callback);

        ba.forceMode('minimal');
        expect(callback).toHaveBeenCalledOnce();
        expect(callback).toHaveBeenCalledWith(
            expect.objectContaining({ mode: 'minimal' }),
        );
    });

    it('unsubscribes from onChange', () => {
        const ba = new BatteryAware();
        const callback = vi.fn();
        const unsub = ba.onChange(callback);
        unsub();

        ba.forceMode('reduced');
        expect(callback).not.toHaveBeenCalled();
    });

    it('reports unsupported when Battery API unavailable', async () => {
        const ba = new BatteryAware();
        await ba.init(); // Node.js has no Battery API
        expect(ba.getStatus().supported).toBe(false);
        expect(ba.getMode()).toBe('full'); // Falls back to full
    });
});
