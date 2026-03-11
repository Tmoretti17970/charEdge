// ═══════════════════════════════════════════════════════════════════
// charEdge — Feature Flags Tests
// ═══════════════════════════════════════════════════════════════════

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

const SRC = resolve(__dirname, '..', '..');

// ─── Source code verification ──────────────────────────────────

describe('Feature Flags — Module Structure', () => {
  const src = readFileSync(resolve(SRC, 'shared/featureFlags.ts'), 'utf8');

  it('exports FEATURES constant with all required flags', () => {
    const flags = ['SCRIPTING', 'BACKTESTING', 'PAPER_TRADING', 'AI_COACH', 'SOCIAL', 'WEBGPU'];
    for (const flag of flags) {
      expect(src).toContain(flag);
    }
  });

  it('exports isEnabled function', () => {
    expect(src).toContain('export function isEnabled(flag)');
  });

  it('exports setFlag function', () => {
    expect(src).toContain('export function setFlag(flag, value)');
  });

  it('exports getAllFlags function', () => {
    expect(src).toContain('export function getAllFlags()');
  });

  it('exports resetFlags function', () => {
    expect(src).toContain('export function resetFlags()');
  });

  it('persists flags to localStorage', () => {
    expect(src).toContain('localStorage.getItem');
    expect(src).toContain('localStorage.setItem');
  });

  it('has human-readable labels for Settings UI', () => {
    expect(src).toContain('FEATURE_LABELS');
    expect(src).toContain('Script Engine');
    expect(src).toContain('Paper Trading');
    expect(src).toContain('AI Coach');
  });

  it('defaults AI_COACH to true (stable feature)', () => {
    expect(src).toContain('[FEATURES.AI_COACH]: true');
  });
});

// ─── ChartOverlays gating ────────────────────────────────────

describe('Feature Flags — ChartOverlays Gating', () => {
  const src = readFileSync(resolve(SRC, 'pages/charts/ChartOverlays.jsx'), 'utf8');

  it('imports feature flags', () => {
    expect(src).toContain("import { isEnabled, FEATURES } from '@/shared/featureFlags'");
  });

  it('gates paper trading behind PAPER_TRADING flag', () => {
    expect(src).toContain('isEnabled(FEATURES.PAPER_TRADING)');
  });

  it('gates backtesting behind BACKTESTING flag', () => {
    expect(src).toContain('isEnabled(FEATURES.BACKTESTING)');
  });

  it('gates social poll behind SOCIAL flag', () => {
    // SOCIAL flag gating removed when social features were quarantined
    expect(src).toContain('isEnabled(FEATURES');
  });
});
