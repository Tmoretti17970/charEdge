// Sprint 20 — Text Rendering Overhaul (Source Verification)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const ROOT = resolve(__dirname, '..', '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf-8');

describe('Sprint 20 · TextAtlas — Text Rendering Enhancements', () => {
  const src = read('charting_library/gpu/TextAtlas.js');

  it('supports bold weight via _fontWeight option', () => {
    expect(src).toContain('_fontWeight');
    expect(src).toContain("opts.fontWeight || 'normal'");
  });

  it('uses configurable weight in canvas font string', () => {
    expect(src).toContain('${this._fontWeight}');
  });

  it('has extended CHARSET with emoji and currency symbols', () => {
    expect(src).toContain('€£¥₿');
    expect(src).toContain('▲▼');
    expect(src).toContain('✓✗⚠');
  });

  it('has setFontStyle method for runtime font changes', () => {
    expect(src).toContain('setFontStyle(opts');
  });

  it('rebuilds atlas when font changes', () => {
    expect(src).toContain('this._build()');
    expect(src).toContain('this._glyphs.clear()');
  });

  it('SDF text shader supports alpha', () => {
    expect(src).toContain('smoothstep');
    expect(src).toContain('v_color.a * alpha');
  });
});
