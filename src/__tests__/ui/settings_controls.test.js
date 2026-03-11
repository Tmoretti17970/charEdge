// ═══════════════════════════════════════════════════════════════════
// Batch 14 — Indicator Settings Upgrade (Source Verification)
//
// Validates:
//   1. SettingsControls: shared control library (7 exports)
//   2. SettingsTabShell: tabbed dialog shell
//   3. IndicatorSettingsDialog: 3-tab refactored dialog (Inputs/Style/Visibility)
//   4. indicatorSlice: extended state (outputStyles, visibility, precision, etc.)
//   5. ChartSettingsPanel: uses shared SettingsControls imports
// ═══════════════════════════════════════════════════════════════════

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

const ROOT = resolve(__dirname, '..', '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf-8');

// ─── 1. SettingsControls ─────────────────────────────────────────
describe('Batch 14 · SettingsControls — Shared Library', () => {
    const src = read('app/components/settings/SettingsControls.jsx');

    it('exports ColorSwatch', () => {
        expect(src).toContain('export function ColorSwatch');
    });

    it('exports Toggle', () => {
        expect(src).toContain('export function Toggle');
    });

    it('exports RangeSlider', () => {
        expect(src).toContain('export function RangeSlider');
    });

    it('exports NumberInput', () => {
        expect(src).toContain('export function NumberInput');
    });

    it('exports SelectDropdown', () => {
        expect(src).toContain('export function SelectDropdown');
    });

    it('exports LineStylePicker', () => {
        expect(src).toContain('export function LineStylePicker');
    });

    it('exports SectionLabel', () => {
        expect(src).toContain('export function SectionLabel');
    });

    it('imports shared constants (C, F, M)', () => {
        expect(src).toContain("from '../../../constants.js'");
    });
});

// ─── 2. SettingsTabShell ─────────────────────────────────────────
describe('Batch 14 · SettingsTabShell — Tabbed Dialog', () => {
    const src = read('app/components/settings/SettingsTabShell.jsx');

    it('exports default SettingsTabShell', () => {
        expect(src).toContain('export default function SettingsTabShell');
    });

    it('has tab bar with role=tablist', () => {
        expect(src).toContain('role="tablist"');
    });

    it('supports aria-selected for tabs', () => {
        expect(src).toContain('aria-selected');
    });

    it('has keyboard navigation (ArrowRight/ArrowLeft)', () => {
        expect(src).toContain('ArrowRight');
        expect(src).toContain('ArrowLeft');
    });

    it('supports Escape to close', () => {
        expect(src).toContain("e.key === 'Escape'");
    });

    it('has animated tab underline', () => {
        expect(src).toContain('activeIdx');
        expect(src).toContain('transition');
    });

    it('renders Ok and Cancel buttons', () => {
        expect(src).toContain('Cancel');
        expect(src).toContain('Ok');
    });
});

// ─── 3. IndicatorSettingsDialog — 3 Tab Refactor ─────────────────
describe('Batch 14 · IndicatorSettingsDialog — 3–Tab Upgrade', () => {
    const src = read('app/components/chart/panels/IndicatorSettingsDialog.jsx');

    it('exports default IndicatorSettingsDialog', () => {
        expect(src).toContain('export default function IndicatorSettingsDialog');
    });

    it('imports SettingsTabShell', () => {
        expect(src).toContain('SettingsTabShell');
    });

    it('imports SettingsControls', () => {
        expect(src).toContain('SettingsControls');
    });

    it('defines 3 tabs: inputs, style, visibility', () => {
        expect(src).toContain("id: 'inputs'");
        expect(src).toContain("id: 'style'");
        expect(src).toContain("id: 'visibility'");
    });

    // ─── Inputs Tab ──────────────────
    it('Inputs tab has source dropdown', () => {
        expect(src).toContain('SOURCE_OPTIONS');
        expect(src).toContain('Input Source');
    });

    it('Inputs tab has RangeSlider from params', () => {
        expect(src).toContain('RangeSlider');
        expect(src).toContain('schema.min');
        expect(src).toContain('schema.max');
    });

    it('Inputs tab has Toggle for boolean params', () => {
        expect(src).toContain('Toggle');
        expect(src).toContain("typeof schema.default === 'boolean'");
    });

    // ─── Style Tab ───────────────────
    it('Style tab has per-output styling', () => {
        expect(src).toContain('outputStyles');
        expect(src).toContain('Per-Output Styling');
    });

    it('Style tab has LineStylePicker', () => {
        expect(src).toContain('LineStylePicker');
    });

    it('Style tab has precision dropdown', () => {
        expect(src).toContain('PRECISION_OPTIONS');
        expect(src).toContain('Precision');
    });

    it('Style tab has Show on Price Scale toggle', () => {
        expect(src).toContain('Show on Price Scale');
        expect(src).toContain('showOnScale');
    });

    it('Style tab has Show in Status Line toggle', () => {
        expect(src).toContain('Show in Status Line');
        expect(src).toContain('showInStatusLine');
    });

    // ─── Visibility Tab ──────────────
    it('Visibility tab has timeframe matrix', () => {
        expect(src).toContain('TIMEFRAMES');
        expect(src).toContain('Show on all timeframes');
    });

    it('has template save/load functionality', () => {
        expect(src).toContain('saveTemplate');
        expect(src).toContain('loadTemplate');
        expect(src).toContain('templateName');
    });

    it('reads from INDICATOR_REGISTRY', () => {
        expect(src).toContain('INDICATOR_REGISTRY');
    });
});

// ─── 4. indicatorSlice — Extended State ──────────────────────────
describe('Batch 14 · indicatorSlice — State Extension', () => {
    const src = read('state/chart/indicatorSlice.ts');

    it('has outputStyles normalization', () => {
        expect(src).toContain('outputStyles');
        expect(src).toContain('initOutputStyles');
    });

    it('has visibility state with timeframes/showAll', () => {
        expect(src).toContain('visibility');
        expect(src).toContain('timeframes');
        expect(src).toContain('showAll');
    });

    it('has precision field', () => {
        expect(src).toContain('precision');
    });

    it('has source field', () => {
        expect(src).toContain('source');
    });

    it('has showOnScale field', () => {
        expect(src).toContain('showOnScale');
    });

    it('has showInStatusLine field', () => {
        expect(src).toContain('showInStatusLine');
    });

    it('has updateIndicatorOutputStyle action', () => {
        expect(src).toContain('updateIndicatorOutputStyle');
    });

    it('has setIndicatorVisibility action', () => {
        expect(src).toContain('setIndicatorVisibility');
    });

    it('has setIndicatorPrecision action', () => {
        expect(src).toContain('setIndicatorPrecision');
    });

    it('has setIndicatorSource action', () => {
        expect(src).toContain('setIndicatorSource');
    });

    it('normalizes indicators with registry defaults', () => {
        expect(src).toContain('normalizeIndicator');
    });
});

// ─── 5. ChartSettingsPanel — Shared Imports ──────────────────────
describe('Batch 14 · ChartSettingsPanel — Uses Shared Controls', () => {
    const src = read('app/components/chart/panels/ChartSettingsPanel.jsx');

    it('imports from SettingsControls', () => {
        expect(src).toContain('SettingsControls');
    });

    it('imports ColorSwatch from shared controls', () => {
        expect(src).toContain('ColorSwatch');
    });

    it('imports Toggle from shared controls', () => {
        expect(src).toContain('Toggle');
    });

    it('imports RangeSlider from shared controls', () => {
        expect(src).toContain('RangeSlider');
    });

    it('no longer defines inline ColorSwatch function', () => {
        expect(src).not.toContain('function ColorSwatch');
    });

    it('no longer defines inline Toggle function', () => {
        expect(src).not.toContain('function Toggle');
    });

    it('no longer defines inline RangeSlider function', () => {
        expect(src).not.toContain('function RangeSlider');
    });
});
