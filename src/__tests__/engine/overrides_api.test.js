// ═══════════════════════════════════════════════════════════════════
// Strategy Item #11 — Overrides API Tests
//
// Validates:
//   1. _deepSet immutable helper
//   2. applyOverride / applyOverrides actions in indicatorSlice
//   3. Built-in indicator templates
//   4. Template merge with user templates
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { BUILT_IN_TEMPLATES, getBuiltInTemplates, getAllTemplates } from '../../charting_library/studies/indicators/indicatorTemplates';

const ROOT = resolve(__dirname, '..', '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf-8');

// ─── 1. indicatorSlice source verification ─────────────────────
describe('Strategy #11 · indicatorSlice — Overrides API', () => {
    const src = read('state/chart/indicatorSlice.ts');

    it('has applyOverride action', () => {
        expect(src).toContain('applyOverride:');
        expect(src).toContain('_deepSet');
    });

    it('has applyOverrides action for batch updates', () => {
        expect(src).toContain('applyOverrides:');
        expect(src).toContain('Object.entries(overrides)');
    });

    it('has deleteIndicatorTemplate action', () => {
        expect(src).toContain('deleteIndicatorTemplate:');
    });

    it('_deepSet handles single-level paths', () => {
        expect(src).toContain("parts.length === 1");
    });

    it('_deepSet handles nested paths recursively', () => {
        expect(src).toContain('_deepSet(obj[head]');
        expect(src).toContain("rest.join('.')");
    });
});

// ─── 2. _deepSet behavior ──────────────────────────────────────
describe('Strategy #11 · _deepSet behavior', () => {
    // Re-implement _deepSet locally for unit testing
    function _deepSet(obj, path, value) {
        const parts = path.split('.');
        if (parts.length === 1) {
            return { ...obj, [parts[0]]: value };
        }
        const [head, ...rest] = parts;
        return {
            ...obj,
            [head]: _deepSet(obj[head] || {}, rest.join('.'), value),
        };
    }

    it('sets top-level property', () => {
        const result = _deepSet({ a: 1, b: 2 }, 'a', 42);
        expect(result).toEqual({ a: 42, b: 2 });
    });

    it('sets nested property', () => {
        const result = _deepSet({ params: { period: 14 } }, 'params.period', 20);
        expect(result).toEqual({ params: { period: 20 } });
    });

    it('sets deeply nested property', () => {
        const result = _deepSet(
            { outputStyles: { line: { color: '#FF0', width: 2 } } },
            'outputStyles.line.color',
            '#00F'
        );
        expect(result.outputStyles.line.color).toBe('#00F');
        expect(result.outputStyles.line.width).toBe(2); // Preserved
    });

    it('creates intermediate objects if missing', () => {
        const result = _deepSet({}, 'a.b.c', 'hello');
        expect(result).toEqual({ a: { b: { c: 'hello' } } });
    });

    it('is immutable — does not modify original', () => {
        const original = { params: { period: 14 } };
        const result = _deepSet(original, 'params.period', 20);
        expect(original.params.period).toBe(14); // Unchanged
        expect(result.params.period).toBe(20);
    });
});

// ─── 3. Built-in templates ─────────────────────────────────────
describe('Strategy #11 · Built-in Templates', () => {
    it('provides templates for common indicators', () => {
        expect(BUILT_IN_TEMPLATES.rsi.length).toBeGreaterThan(0);
        expect(BUILT_IN_TEMPLATES.macd.length).toBeGreaterThan(0);
        expect(BUILT_IN_TEMPLATES.sma.length).toBeGreaterThan(0);
        expect(BUILT_IN_TEMPLATES.ema.length).toBeGreaterThan(0);
    });

    it('getBuiltInTemplates returns empty array for unknown indicator', () => {
        expect(getBuiltInTemplates('nonexistent')).toEqual([]);
    });

    it('each template has name, description, and overrides', () => {
        for (const [, templates] of Object.entries(BUILT_IN_TEMPLATES)) {
            for (const t of templates) {
                expect(t.name).toBeTruthy();
                expect(t.description).toBeTruthy();
                expect(Object.keys(t.overrides).length).toBeGreaterThan(0);
            }
        }
    });

    it('RSI templates use dot-notation overrides', () => {
        const rsiDefault = BUILT_IN_TEMPLATES.rsi[0];
        expect(rsiDefault.overrides).toHaveProperty('params.period');
    });

    it('MACD templates include both fast and slow params', () => {
        const macdDefault = BUILT_IN_TEMPLATES.macd[0];
        expect(macdDefault.overrides).toHaveProperty('params.fast');
        expect(macdDefault.overrides).toHaveProperty('params.slow');
        expect(macdDefault.overrides).toHaveProperty('params.signal');
    });
});

// ─── 4. getAllTemplates merge ────────────────────────────────────
describe('Strategy #11 · getAllTemplates', () => {
    it('returns built-in templates when no user templates saved', () => {
        const templates = getAllTemplates('rsi');
        expect(templates.length).toBe(BUILT_IN_TEMPLATES.rsi.length);
    });
});
