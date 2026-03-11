// Sprint 22 — Screenshot & Share Polish (Source Verification)
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';
const ROOT = resolve(__dirname, '..', '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf-8');

describe('Sprint 22 · ChartSnapshotModal — Screenshot & Share Polish', () => {
  const src = read('app/components/chart/panels/ChartSnapshotModal.jsx');

  it('has high-DPI 3x capture function', () => {
    expect(src).toContain('captureHiDPI');
    expect(src).toContain('scale = 3');
  });

  it('applies watermark with symbol/timeframe/date', () => {
    expect(src).toContain('watermarkText');
    expect(src).toContain('charEdge');
    expect(src).toContain('toLocaleDateString');
  });

  it('has one-click copy to clipboard', () => {
    expect(src).toContain('handleCopyToClipboard');
    expect(src).toContain('navigator.clipboard.write');
    expect(src).toContain('ClipboardItem');
  });

  it('generates iframe embed snippet', () => {
    expect(src).toContain('embedSnippet');
    expect(src).toContain('<iframe');
    expect(src).toContain('frameborder');
  });

  it('has copy embed button', () => {
    expect(src).toContain('handleCopyEmbed');
    expect(src).toContain('Embed Code');
  });

  it('shows copy status feedback', () => {
    expect(src).toContain('copyStatus');
    expect(src).toContain("'Copied!'");
  });

  it('has Copy to Clipboard button in footer', () => {
    expect(src).toContain('Copy to Clipboard');
  });
});
