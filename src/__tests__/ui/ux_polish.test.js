// ═══════════════════════════════════════════════════════════════════
// Phase 4 UX Polish — Tests
// Covers: MetricInfo definitions, ModalOverlay keyboard support,
// design token completeness, and light theme CSS vars.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// ═══ MetricInfo Definitions ═════════════════════════════════════

describe('MetricInfo', () => {
  let METRIC_DEFINITIONS;

  it('exports METRIC_DEFINITIONS', async () => {
    const mod = await import('../../app/components/ui/MetricInfo.jsx');
    METRIC_DEFINITIONS = mod.METRIC_DEFINITIONS;
    expect(METRIC_DEFINITIONS).toBeDefined();
    expect(typeof METRIC_DEFINITIONS).toBe('object');
  });

  it('has all required metric keys', async () => {
    const mod = await import('../../app/components/ui/MetricInfo.jsx');
    const defs = mod.METRIC_DEFINITIONS;
    const required = ['sharpe', 'sortino', 'profitFactor', 'maxDrawdown', 'winRate', 'kelly'];
    for (const key of required) {
      expect(defs[key], `Missing definition for ${key}`).toBeDefined();
      expect(defs[key].name).toBeTruthy();
      expect(defs[key].description).toBeTruthy();
    }
  });

  it('each definition has name, description, and formula', async () => {
    const mod = await import('../../app/components/ui/MetricInfo.jsx');
    const defs = mod.METRIC_DEFINITIONS;
    for (const [key, def] of Object.entries(defs)) {
      expect(def.name, `${key} missing name`).toBeTruthy();
      expect(typeof def.description, `${key} description not string`).toBe('string');
      expect(def.description.length, `${key} description too short`).toBeGreaterThan(10);
      expect(def.formula, `${key} missing formula`).toBeTruthy();
    }
  });

  it('exports MetricInfo component', async () => {
    const mod = await import('../../app/components/ui/MetricInfo.jsx');
    expect(typeof mod.MetricInfo).toBe('function');
  });
});

// ═══ GuidedTour Steps ═══════════════════════════════════════════

describe('GuidedTour', () => {
  it('has 8 tour steps covering navigation and chart features', async () => {
    const src = (await import('fs')).readFileSync(
      (await import('path')).resolve(__dirname, '../../app/components/ui/GuidedTour.jsx'),
      'utf8',
    );
    // Count step objects by their title property
    const titles = src.match(/title:\s*'/g);
    expect(titles.length).toBeGreaterThanOrEqual(8);
  });

  it('includes sidebar navigation steps', async () => {
    const src = (await import('fs')).readFileSync(
      (await import('path')).resolve(__dirname, '../../app/components/ui/GuidedTour.jsx'),
      'utf8',
    );
    expect(src).toContain('nav-journal');
    expect(src).toContain('nav-charts');
    expect(src).toContain('nav-discover');
  });
});

// ═══ ModalOverlay Accessibility ═════════════════════════════════

describe('ModalOverlay', () => {
  it('exports ModalOverlay function', async () => {
    const mod = await import('../../app/components/ui/UIKit.jsx');
    expect(typeof mod.ModalOverlay).toBe('function');
  });

  it('ModalOverlay supports aria-label prop', async () => {
    const mod = await import('../../app/components/ui/UIKit.jsx');
    // Check function accepts 'aria-label' by inspecting source
    const src = mod.ModalOverlay.toString();
    expect(src).toContain('aria-label');
    expect(src).toContain('role');
    expect(src).toContain('dialog');
    expect(src).toContain('Escape');
  });
});

// ═══ InsightsPage MetricInfo Integration ════════════════════════

describe('InsightsPage MetricInfo Integration', () => {
  it('InsightsPage imports MetricInfo', async () => {
    const src = (await import('fs')).readFileSync(
      (await import('path')).resolve(__dirname, '../../pages/InsightsPage.jsx'),
      'utf8',
    );
    expect(src).toContain("import { MetricInfo }");
    expect(src).toContain('metric="winRate"');
    expect(src).toContain('metric="profitFactor"');
    expect(src).toContain('metric="maxDrawdown"');
  });
});

// ═══ Design Token Completeness ══════════════════════════════════

describe('Design Tokens', () => {
  it('space scale includes 7 and 9', async () => {
    const { space } = await import('../../theme/tokens.js');
    expect(space[7]).toBe(28);
    expect(space[9]).toBe(36);
  });

  it('transition tokens include all required presets', async () => {
    const { transition } = await import('../../theme/tokens.js');
    expect(transition.micro).toBeTruthy();
    expect(transition.fast).toBeTruthy();
    expect(transition.base).toBeTruthy();
    expect(transition.enter).toBeTruthy();
    expect(transition.exit).toBeTruthy();
    expect(transition.spring).toBeTruthy();
  });

  it('gradient tokens include brand, glow, subtle', async () => {
    const { gradient } = await import('../../theme/tokens.js');
    expect(gradient.brand).toBeTruthy();
    expect(gradient.glow).toBeTruthy();
    expect(gradient.subtle).toBeTruthy();
  });

  it('text presets include data hierarchy', async () => {
    const { text } = await import('../../theme/tokens.js');
    expect(text.dataHero).toBeDefined();
    expect(text.dataLg).toBeDefined();
    expect(text.dataMd).toBeDefined();
    expect(text.dataSm).toBeDefined();
    expect(text.dataHero.fontSize).toBe(32);
    expect(text.dataLg.fontSize).toBe(20);
  });

  it('shadows include light theme variants', async () => {
    const { shadows } = await import('../../theme/tokens.js');
    expect(shadows.light).toBeDefined();
    expect(shadows.light.sm).toBeTruthy();
    expect(shadows.light.md).toBeTruthy();
    expect(shadows.light.lg).toBeTruthy();
  });

  it('layout.page uses space[8] = 32', async () => {
    const { layout, space } = await import('../../theme/tokens.js');
    expect(layout.page.padding).toBe(space[8]);
    expect(space[8]).toBe(32);
  });
});

// ═══ Light Theme CSS Vars ═══════════════════════════════════════

describe('Light Theme CSS', () => {
  const cssPath = path.resolve(__dirname, '../../theme/tokens.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  it('global.css defines .theme-light with all color vars', () => {
    expect(css).toContain('.theme-light');
    // Core color overrides
    expect(css).toContain('--tf-bg: #f8f8fa');
    expect(css).toContain('--tf-sf: #ffffff');
    expect(css).toContain('--tf-t1: #111318');
    expect(css).toContain('--tf-accent: #d4551e');
    expect(css).toContain('--tf-green: #059669');
    expect(css).toContain('--tf-red: #e11d48');
  });

  it('light theme includes glass overrides', () => {
    expect(css).toContain('--tf-glass-1: rgba(255, 255, 255');
    expect(css).toContain('--tf-glass-2: rgba(255, 255, 255');
    expect(css).toContain('--tf-glass-border: 1px solid rgba(0, 0, 0');
  });

  it('light theme includes shadow overrides', () => {
    expect(css).toContain('--tf-shadow-1:');
    expect(css).toContain('--tf-shadow-2:');
    expect(css).toContain('--tf-shadow-3:');
    expect(css).toContain('--tf-shadow-4:');
  });

  it('light theme includes inner glow override', () => {
    expect(css).toContain('--tf-inner-glow:');
    expect(css).toContain('--tf-inner-glow-strong:');
  });
});

// ═══ Components CSS — Light Theme Parity ════════════════════════

describe('Components CSS Light Theme', () => {
  const cssPath = path.resolve(__dirname, '../../theme/chart-components.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  it('has light theme card hover override', () => {
    expect(css).toContain('html.theme-light .tf-card-hover:hover');
  });

  it('has light theme data row hover', () => {
    expect(css).toContain('html.theme-light .tf-data-row:hover');
  });

  it('has light theme icon button hover', () => {
    expect(css).toContain('html.theme-light .tf-icon-btn:hover');
  });

  it('has light theme nav active', () => {
    expect(css).toContain("html.theme-light .tf-nav-btn[aria-current='page']");
  });

  it('has light theme skeleton shimmer', () => {
    expect(css).toContain('html.theme-light .tf-skeleton::after');
  });

  it('has light theme glass button', () => {
    expect(css).toContain('html.theme-light .tf-glass-btn');
  });
});
