// ═══════════════════════════════════════════════════════════════════
// Batch 15 — Drawing Settings Upgrade (Source Verification)
//
// Validates:
//   1. DrawingSettingsDialog: 3-tab dialog (Style/Coordinates/Visibility)
//   2. DrawingEditPopup: gear icon bridge for complex tools
//   3. drawingSlice: drawingDefaults store extension
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf-8');

// ─── 1. DrawingSettingsDialog ────────────────────────────────────
describe('Batch 15 · DrawingSettingsDialog — Full Settings', () => {
    const src = read('app/components/chart/panels/DrawingSettingsDialog.jsx');

    it('exports default DrawingSettingsDialog', () => {
        expect(src).toContain('export default function DrawingSettingsDialog');
    });

    it('imports SettingsTabShell', () => {
        expect(src).toContain('SettingsTabShell');
    });

    it('imports SettingsControls', () => {
        expect(src).toContain('SettingsControls');
    });

    it('defines 3 tabs: style, coordinates, visibility', () => {
        expect(src).toContain("id: 'style'");
        expect(src).toContain("id: 'coordinates'");
        expect(src).toContain("id: 'visibility'");
    });

    // ─── Style Tab ───────────────────
    it('Style tab has color and line controls', () => {
        expect(src).toContain('ColorSwatch');
        expect(src).toContain('LineStylePicker');
    });

    it('Style tab has fill controls', () => {
        expect(src).toContain('Show Fill');
        expect(src).toContain('fillColor');
    });

    it('Style tab has Fib level controls', () => {
        expect(src).toContain('Fib Levels');
        expect(src).toContain('DEFAULT_FIB_LEVELS');
    });

    it('Style tab has label controls (prices, percentages, position)', () => {
        expect(src).toContain('Show Prices');
        expect(src).toContain('Show Percentages');
        expect(src).toContain('Label Position');
    });

    it('Style tab has log scale toggle', () => {
        expect(src).toContain('Log Scale');
        expect(src).toContain('logScale');
    });

    it('has save-as-default functionality', () => {
        expect(src).toContain('Save as Default');
        expect(src).toContain('setDrawingDefault');
    });

    // ─── Coordinates Tab ─────────────
    it('Coordinates tab has per-anchor point editing', () => {
        expect(src).toContain('Anchor Points');
        expect(src).toContain('Point');
        expect(src).toContain('Price');
        expect(src).toContain('Date/Time');
    });

    // ─── Visibility Tab ──────────────
    it('Visibility tab has timeframe matrix', () => {
        expect(src).toContain('TIMEFRAMES');
        expect(src).toContain('Show on all timeframes');
    });

    // ─── Complex tool checker ────────
    it('exports isComplexTool static method', () => {
        expect(src).toContain('isComplexTool');
        expect(src).toContain('COMPLEX_TOOLS');
    });
});

// ─── 2. DrawingEditPopup — Gear Icon Bridge ──────────────────────
describe('Batch 15 · DrawingEditPopup — Gear Icon Bridge', () => {
    const src = read('app/components/chart/tools/DrawingEditPopup.jsx');

    it('imports DrawingSettingsDialog', () => {
        expect(src).toContain('DrawingSettingsDialog');
    });

    it('has showFullSettings state', () => {
        expect(src).toContain('showFullSettings');
        expect(src).toContain('setShowFullSettings');
    });

    it('listens for charEdge:open-drawing-settings event', () => {
        expect(src).toContain('charEdge:open-drawing-settings');
    });

    it('has gear icon button for complex tools', () => {
        expect(src).toContain('isComplexTool');
        expect(src).toContain('Open full settings');
    });

    it('renders DrawingSettingsDialog when showFullSettings is true', () => {
        expect(src).toContain('<DrawingSettingsDialog');
    });
});

// ─── 3. drawingSlice — Defaults Store ────────────────────────────
describe('Batch 15 · drawingSlice — Drawing Defaults Extension', () => {
    const src = read('state/chart/drawingSlice.ts');

    it('has drawingDefaults state', () => {
        expect(src).toContain('drawingDefaults');
    });

    it('persists drawingDefaults to localStorage', () => {
        expect(src).toContain('charEdge-drawing-defaults');
    });

    it('has setDrawingDefault action', () => {
        expect(src).toContain('setDrawingDefault');
    });

    it('has resetDrawingDefaults action', () => {
        expect(src).toContain('resetDrawingDefaults');
    });
});
