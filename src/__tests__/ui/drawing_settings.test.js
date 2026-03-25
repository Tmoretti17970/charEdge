// ═══════════════════════════════════════════════════════════════════
// Drawing Settings Upgrade — Source Verification Tests
//
// Validates the TradingView-grade overhaul:
//   1. DrawingSettingsDialog: 4-tab dialog (Style/Text/Coordinates/Visibility)
//      + tool-config-driven architecture + Inputs tab for Position tools
//   2. DrawingEditPopup: gear icon bridge for ALL tools
//   3. drawingSlice: drawingDefaults store extension
//   4. SettingsControls: new shared control components
//   5. DrawingModel: extended style properties
// ═══════════════════════════════════════════════════════════════════

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

const ROOT = resolve(__dirname, '..', '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf-8');

// ─── 1. DrawingSettingsDialog ────────────────────────────────────
describe('DrawingSettingsDialog — TradingView-Grade Overhaul', () => {
  const src = read('app/components/chart/panels/DrawingSettingsDialog.jsx');

  it('exports default DrawingSettingsDialog', () => {
    expect(src).toContain('export default function DrawingSettingsDialog');
  });

  it('imports SettingsTabShell', () => {
    expect(src).toContain('SettingsTabShell');
  });

  it('imports new TradingView-grade controls', () => {
    expect(src).toContain('CheckboxRow');
    expect(src).toContain('LineCompound');
    expect(src).toContain('LineEndPicker');
    expect(src).toContain('FontToolbar');
    expect(src).toContain('StyledTextArea');
    expect(src).toContain('TextAlignmentPicker');
    expect(src).toContain('StepperInput');
    expect(src).toContain('TimeframeVisibilityRow');
  });

  // ─── Tool Config ─────────────────
  it('has tool-config-driven architecture', () => {
    expect(src).toContain('getToolConfig');
    // Tool sets (LINE_TOOLS, SHAPE_TOOLS, etc.) extracted to drawingToolConfig.ts
    expect(src).toContain('drawingToolConfig');
  });

  // ─── Style Tab ───────────────────
  it('Style tab has Extend dropdown', () => {
    expect(src).toContain('EXTEND_OPTIONS');
    // Extend option labels moved to drawingToolConfig.ts
    expect(src).toContain('hasExtend');
  });

  it('Style tab has line end picker', () => {
    expect(src).toContain('LineEndPicker');
    expect(src).toContain('lineEndLeft');
    expect(src).toContain('lineEndRight');
  });

  it('Style tab has Middle point and Price labels checkboxes', () => {
    expect(src).toContain('Middle point');
    expect(src).toContain('Price labels');
  });

  it('Style tab has Stats section with dropdown and position', () => {
    expect(src).toContain('STATS_OPTIONS');
    expect(src).toContain('Stats position');
    expect(src).toContain('Always show stats');
  });

  it('Style tab has Middle line and Background for shapes', () => {
    expect(src).toContain('Middle line');
    expect(src).toContain('Background');
    expect(src).toContain('showBackground');
  });

  it('Style tab has Stop/Target colors for position tools', () => {
    expect(src).toContain('Stop color');
    expect(src).toContain('Target color');
    expect(src).toContain('Compact stats mode');
  });

  it('Style tab has Fib level controls with editable grid', () => {
    expect(src).toContain('Fib Levels');
    expect(src).toContain('DEFAULT_FIB_LEVELS');
    expect(src).toContain('fibGrid');
  });

  it('has save-as-default functionality', () => {
    expect(src).toContain('Save as Default');
    expect(src).toContain('setDrawingDefault');
  });

  // ─── Text Tab ────────────────────
  it('Text tab has font toolbar and text area', () => {
    expect(src).toContain('FontToolbar');
    expect(src).toContain('StyledTextArea');
    expect(src).toContain('Add text');
  });

  it('Text tab has text alignment picker', () => {
    expect(src).toContain('TextAlignmentPicker');
    expect(src).toContain('textAlignV');
    expect(src).toContain('textAlignH');
  });

  // ─── Coordinates Tab ─────────────
  it('Coordinates tab has TradingView-style point format', () => {
    expect(src).toContain('(price, bar)');
    expect(src).toContain('StepperInput');
  });

  // ─── Visibility Tab ──────────────
  it('Visibility tab has per-timeframe rows', () => {
    expect(src).toContain('TIMEFRAME_ROWS');
    expect(src).toContain('TimeframeVisibilityRow');
    // Timeframe labels (Seconds, Minutes, etc.) moved to drawingToolConfig.ts
    expect(src).toContain('row.label');
  });

  it('Visibility tab has Ticks and Ranges checkboxes', () => {
    expect(src).toContain('visibilityTicks');
    expect(src).toContain('visibilityRanges');
    expect(src).toContain('"Ticks"');
    expect(src).toContain('"Ranges"');
  });

  // ─── Inputs Tab (Position tools) ─
  it('Inputs tab has position tool fields', () => {
    expect(src).toContain('Account size');
    expect(src).toContain('Lot size');
    expect(src).toContain('Entry price');
    expect(src).toContain('Leverage');
    expect(src).toContain('Profit Level');
    expect(src).toContain('Stop Level');
    expect(src).toContain('QTY precision');
  });

  // ─── isComplexTool ───────────────
  it('isComplexTool returns true for ALL tools', () => {
    expect(src).toContain('isComplexTool');
    expect(src).toContain('() => true');
  });
});

// ─── 2. DrawingQuickEditor — Gear Icon Bridge ──────────────────────
describe('DrawingQuickEditor — Gear Icon Bridge', () => {
  const src = read('app/components/chart/tools/DrawingQuickEditor.jsx');

  it('imports DrawingSettingsDialog', () => {
    expect(src).toContain('DrawingSettingsDialog');
  });

  it('has showFullSettings state', () => {
    expect(src).toContain('showFullSettings');
    expect(src).toContain('setShowFullSettings');
  });

  it('has gear icon button', () => {
    expect(src).toContain('Settings');
    expect(src).toContain('setShowFullSettings');
  });

  it('renders DrawingSettingsDialog when showFullSettings is true', () => {
    expect(src).toContain('<DrawingSettingsDialog');
  });
});

// ─── 3. drawingSlice — Defaults Store ────────────────────────────
describe('drawingSlice — Drawing Defaults Extension', () => {
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

// ─── 4. SettingsControls — New Components ────────────────────────
describe('SettingsControls — New TradingView-Grade Components', () => {
  const src = read('app/components/settings/SettingsControls.jsx');

  it('exports CheckboxRow', () => {
    expect(src).toContain('export function CheckboxRow');
  });

  it('exports LineCompound', () => {
    expect(src).toContain('export function LineCompound');
  });

  it('exports LineEndPicker', () => {
    expect(src).toContain('export function LineEndPicker');
  });

  it('exports FontToolbar', () => {
    expect(src).toContain('export function FontToolbar');
  });

  it('exports StyledTextArea', () => {
    expect(src).toContain('export function StyledTextArea');
  });

  it('exports TextAlignmentPicker', () => {
    expect(src).toContain('export function TextAlignmentPicker');
  });

  it('exports StepperInput', () => {
    expect(src).toContain('export function StepperInput');
  });

  it('exports TimeframeVisibilityRow', () => {
    expect(src).toContain('export function TimeframeVisibilityRow');
  });
});

// ─── 5. DrawingModel — Extended Style Properties ─────────────────
describe('DrawingModel — Extended Style Properties', () => {
  const src = read('charting_library/tools/tools/DrawingModel.js');

  it('has new TradingView-grade style properties in typedef', () => {
    expect(src).toContain('@property {string}  [extend]');
    expect(src).toContain('@property {string}  [lineEndLeft]');
    expect(src).toContain('@property {boolean} [middlePoint]');
    expect(src).toContain('@property {boolean} [priceLabels]');
    expect(src).toContain('@property {string}  [stats]');
    expect(src).toContain('@property {boolean} [middleLine]');
  });

  it('trendline has new default properties', () => {
    expect(src).toContain("extend: 'none'");
    expect(src).toContain("lineEndLeft: 'none'");
    expect(src).toContain('middlePoint: false');
    expect(src).toContain("stats: 'hidden'");
  });

  it('longposition has stop/target colors and position fields', () => {
    expect(src).toContain("stopColor: '#F23645'");
    expect(src).toContain("targetColor: '#089981'");
    expect(src).toContain('accountSize: 1000');
    expect(src).toContain('leverage: 10000');
  });

  it('rect has border and middle line defaults', () => {
    expect(src).toContain("borderColor: '#2962FF'");
    expect(src).toContain('middleLine: false');
    expect(src).toContain("middleLineColor: '#787B86'");
    expect(src).toContain('showBackground: true');
  });
});
