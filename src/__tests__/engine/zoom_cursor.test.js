// ═══════════════════════════════════════════════════════════════════
// charEdge — Sprint 5: Zoom-to-Cursor Precision Tests
//
// Verifies the zoom-to-cursor pipeline:
//   1. Zoom anchors to cursor X via _zoomAnchorFrac
//   2. Fractional bar spacing during zoom (no premature rounding)
//   3. Pinch-zoom anchors to pinch center
//   4. CoordinateSystem has xToIndex for pixel→bar conversion
//   5. FrameState computes fractional barSpacing
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

// ─── 1. InputManager — Zoom Anchor ─────────────────────────────

describe('Sprint 5 — InputManager zoom-to-cursor', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/core/InputManager.ts'),
      'utf-8'
    );
  });

  it('stores _zoomAnchorFrac as 0-1 fraction', () => {
    expect(source).toContain('_zoomAnchorFrac');
  });

  it('computes anchor from cursor position on discrete wheel', () => {
    // In the discrete wheel section, anchor is set from pos.x / R.cW
    const wheelSection = source.split('Discrete mouse wheel')[1] || '';
    expect(wheelSection).toContain('pos.x / R.cW');
  });

  it('computes anchor from cursor position on trackpad pinch', () => {
    // In the trackpad pinch section, anchor is set from pos.x / R.cW
    const trackpadSection = source.split('Trackpad pinch-zoom')[1]?.split('Discrete')[0] || '';
    expect(trackpadSection).toContain('pos.x / R.cW');
  });

  it('clamps anchor fraction to 0-1 range', () => {
    expect(source).toContain('Math.max(0, Math.min(1, pos.x / R.cW))');
  });

  it('adjusts scrollOffset around anchor during zoom animation', () => {
    // In _startZoomAnimation, offset is adjusted by barDelta * (1 - _zoomAnchorFrac)
    expect(source).toContain('1 - this._zoomAnchorFrac');
  });
});

// ─── 2. InputManager — Fractional Zoom (no premature snapping) ──

describe('Sprint 5 — InputManager fractional zoom', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/core/InputManager.ts'),
      'utf-8'
    );
  });

  it('does NOT Math.round zoom target on discrete wheel (fractional during animation)', () => {
    // The discrete wheel section should NOT have Math.round on the target
    const discreteSection = source.split('Discrete mouse wheel')[1]?.split('}')[0] || '';
    expect(discreteSection).not.toContain('Math.round(currentTarget');
  });

  it('does NOT Math.round zoom target on trackpad pinch (fractional during animation)', () => {
    const trackpadSection = source.split('Trackpad pinch-zoom')[1]?.split('Discrete')[0] || '';
    expect(trackpadSection).not.toContain('Math.round(currentTarget');
  });

  it('only Math.round on zoom settle (within ZOOM_SNAP)', () => {
    // In _startZoomAnimation, Math.round is called when animation settles
    const zoomAnimSection = source.split('_startZoomAnimation')[1]?.split('onMouseMove')[0] || '';
    expect(zoomAnimSection).toContain('Math.round(this._targetVisibleBars)');
  });

  it('uses ZOOM_SNAP threshold for settle detection', () => {
    expect(source).toContain('ZOOM_SNAP');
  });

  it('uses ZOOM_LERP for smooth interpolation', () => {
    expect(source).toContain('diff * ZOOM_LERP');
  });
});

// ─── 3. InputManager — Pinch Zoom ──────────────────────────────

describe('Sprint 5 — InputManager pinch-zoom', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/core/InputManager.ts'),
      'utf-8'
    );
  });

  it('stores _pinchAnchorFrac from pinch center', () => {
    expect(source).toContain('_pinchAnchorFrac');
  });

  it('computes pinch center via _getTouchCenter', () => {
    expect(source).toContain('_getTouchCenter');
  });

  it('computes pinch distance via _getTouchDistance', () => {
    expect(source).toContain('_getTouchDistance');
  });

  it('anchors pinch zoom around pinch center', () => {
    expect(source).toContain('1 - this._pinchAnchorFrac');
  });

  it('tracks pinch start distance and bars', () => {
    expect(source).toContain('_pinchStartDist');
    expect(source).toContain('_pinchStartBars');
  });
});

// ─── 4. CoordinateSystem — Time Transform ──────────────────────

describe('Sprint 5 — CoordinateSystem time transforms', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/core/CoordinateSystem.js'),
      'utf-8'
    );
  });

  it('has createTimeTransform function', () => {
    expect(source).toContain('createTimeTransform');
  });

  it('has indexToX for bar-to-pixel conversion', () => {
    expect(source).toContain('indexToX');
  });

  it('has xToIndex for pixel-to-bar conversion', () => {
    expect(source).toContain('xToIndex');
  });

  it('supports fractional barSpacing', () => {
    // barSpacing is used directly without rounding in the transform
    expect(source).toContain('barSpacing');
  });
});

// ─── 5. FrameState — Fractional barSpacing ─────────────────────

describe('Sprint 5 — FrameState fractional barSpacing', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/core/FrameState.ts'),
      'utf-8'
    );
  });

  it('computes barSpacing as chartWidth / visibleBars (naturally fractional)', () => {
    expect(source).toContain('chartWidth / S.visibleBars');
  });

  it('stores barSpacing on frame state', () => {
    expect(source).toContain('fs.barSpacing = barSpacing');
  });

  it('stores visibleBars from engine state', () => {
    expect(source).toContain('fs.visibleBars = S.visibleBars');
  });
});
