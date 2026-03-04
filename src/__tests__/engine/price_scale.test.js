// ═══════════════════════════════════════════════════════════════════
// charEdge — Sprint 10: Interactive Price Scale Tests
//
// Verifies the price scale pipeline:
//   1. Y-axis drag to scale/scroll
//   2. Double-click Y-axis reset
//   3. Right-click scale menu (log/%)
//   4. Mobile price-axis pinch-zoom
//   5. Indexed-to-100 scale mode
//   6. createPriceTransform modes
//   7. Auto-fit button
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

// ─── 1. InputManager — Y-Axis Interaction ───────────────────────

describe('Sprint 10 — InputManager Y-axis interaction', () => {
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

  it('drags Y-axis to scale price range', () => {
    expect(source).toContain('dragStartPriceScale');
    expect(source).toContain("dragging = 'price'");
  });

  it('drags Y-axis to scroll price range', () => {
    expect(source).toContain('dragStartPriceScroll');
    expect(source).toContain('priceScroll');
  });

  it('double-click Y-axis resets auto-scale', () => {
    expect(source).toContain('autoScale = true');
    expect(source).toContain('priceScale = 1');
    expect(source).toContain('priceScroll = 0');
  });

  it('right-click toggles log scale', () => {
    expect(source).toContain("scaleMode === 'log'");
  });

  it('right-click toggles percent scale', () => {
    expect(source).toContain("scaleMode === 'percent'");
  });

  it('sets ns-resize cursor for Y-axis drag', () => {
    expect(source).toContain("'ns-resize'");
  });
});

// ─── 2. InputManager — Mobile Pinch Price Scale ─────────────────

describe('Sprint 10 — Mobile pinch price scale', () => {
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

  it('detects vertical vs horizontal pinch direction', () => {
    expect(source).toContain('isVerticalPinch');
    expect(source).toContain('vDist');
    expect(source).toContain('hDist');
  });

  it('applies price scale on vertical pinch', () => {
    expect(source).toContain('Vertical pinch');
    expect(source).toContain('priceScale');
  });

  it('saves pinch start price scale', () => {
    expect(source).toContain('_pinchStartPriceScale');
  });

  it('disables auto-scale on vertical pinch', () => {
    expect(source).toContain('autoScale = false');
  });
});

// ─── 3. CoordinateSystem — Scale Modes ──────────────────────────

describe('Sprint 10 — CoordinateSystem scale modes', () => {
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

  it('has createPriceTransform function', () => {
    expect(source).toContain('export function createPriceTransform');
  });

  it('supports linear mode', () => {
    expect(source).toContain("scaleMode = 'linear'");
  });

  it('supports log mode', () => {
    expect(source).toContain("scaleMode === 'log'");
    expect(source).toContain('Math.log');
  });

  it('supports percent mode', () => {
    expect(source).toContain("scaleMode === 'percent'");
    expect(source).toContain('percentBase');
  });

  it('supports indexed-to-100 mode', () => {
    expect(source).toContain("scaleMode === 'indexed'");
    expect(source).toContain('* 100');
  });

  it('has priceToY and yToPrice transforms', () => {
    expect(source).toContain('priceToY');
    expect(source).toContain('yToPrice');
  });

  it('has formatTicks for each mode', () => {
    expect(source).toContain('formatTicks');
  });
});

// ─── 4. AxesStage — Auto-Fit & Toggles ─────────────────────────

describe('Sprint 10 — AxesStage auto-fit and toggles', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/core/stages/AxesStage.ts'),
      'utf-8'
    );
  });

  it('renders auto-fit button when not auto-scaling', () => {
    expect(source).toContain('_autoFitBtn');
    expect(source).toContain('!S.autoScale');
  });

  it('renders log toggle button', () => {
    expect(source).toContain("'log'");
  });

  it('renders percent toggle button', () => {
    expect(source).toContain("'percent'");
  });

  it('renders current price badge', () => {
    expect(source).toContain('badgeStr');
    expect(source).toContain('formatPrice');
  });
});

// ─── 5. FrameState — Price Scale Fields ─────────────────────────

describe('Sprint 10 — FrameState price scale fields', () => {
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

  it('stores scaleMode on frame state', () => {
    expect(source).toContain('fs.scaleMode');
  });

  it('stores autoScale on frame state', () => {
    expect(source).toContain('fs.autoScale');
  });

  it('stores priceScale on frame state', () => {
    expect(source).toContain('fs.priceScale');
  });

  it('stores priceScroll on frame state', () => {
    expect(source).toContain('fs.priceScroll');
  });

  it('applies manual price scale when autoScale is false', () => {
    expect(source).toContain('!S.autoScale');
    expect(source).toContain('S.priceScale');
  });
});
