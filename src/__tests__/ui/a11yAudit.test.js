// ═══════════════════════════════════════════════════════════════════
// Phase 4 P2 — Accessibility Audit (Programmatic)
//
// Scans JSX source files for common ARIA & accessibility issues:
//   - Image alt text coverage
//   - Button accessible labels
//   - Landmark roles in layout
//   - Skip-to-content link
//   - Modal dialog ARIA
//   - WCAG AA contrast (hex math verification)
//   - Focus-visible CSS rules
//   - Screen-reader-only utility class
// ═══════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '..', '..');

/** Recursively collect files matching an extension */
function collectFiles(dir, ext, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== '__tests__') {
      collectFiles(full, ext, results);
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

const jsxFiles = collectFiles(SRC, '.jsx');
const allJsxSource = jsxFiles.map(f => fs.readFileSync(f, 'utf8'));

// ═══ Image alt text ═════════════════════════════════════════════
describe('Accessibility: Image Alt Text', () => {
  it('all <img> tags have alt prop', () => {
    const violations = [];
    for (let i = 0; i < jsxFiles.length; i++) {
      const src = allJsxSource[i];
      // Find <img tags without alt
      const imgMatches = src.matchAll(/<img\b[^>]*>/g);
      for (const match of imgMatches) {
        const tag = match[0];
        if (!tag.includes('alt=') && !tag.includes('alt ')) {
          violations.push(`${path.basename(jsxFiles[i])}: <img> missing alt — ${tag.slice(0, 60)}`);
        }
      }
    }
    expect(violations, `Found ${violations.length} images without alt:\n${violations.join('\n')}`).toHaveLength(0);
  });
});

// ═══ Button Accessible Labels ═══════════════════════════════════
describe('Accessibility: Button Labels', () => {
  it('icon-only buttons have aria-label', () => {
    const violations = [];
    for (let i = 0; i < jsxFiles.length; i++) {
      const src = allJsxSource[i];
      // Find buttons that only contain an icon (no text children)
      const btnMatches = src.matchAll(/<button\b([^>]*)>[\s]*<[A-Z][^/]*\/?>[\s]*<\/button>/g);
      for (const match of btnMatches) {
        const attrs = match[1];
        if (!attrs.includes('aria-label') && !attrs.includes('title')) {
          violations.push(`${path.basename(jsxFiles[i])}: icon-only button missing aria-label`);
        }
      }
    }
    // Allow up to 5 violations (some may be false positives from JSX expressions)
    expect(violations.length, `Found ${violations.length} icon-only buttons without aria-label:\n${violations.slice(0, 10).join('\n')}`).toBeLessThanOrEqual(5);
  });
});

// ═══ Landmark Roles ═════════════════════════════════════════════
describe('Accessibility: Landmark Roles', () => {
  it('app uses <main> landmark', () => {
    const hasMain = allJsxSource.some(s => s.includes('<main') || s.includes("role=\"main\"") || s.includes("role='main'"));
    expect(hasMain).toBe(true);
  });

  it('app uses <nav> landmark', () => {
    const hasNav = allJsxSource.some(s => s.includes('<nav') || s.includes("role=\"navigation\"") || s.includes("role='navigation'"));
    expect(hasNav).toBe(true);
  });
});

// ═══ Skip-to-Content Link ═══════════════════════════════════════
describe('Accessibility: Skip Link', () => {
  it('tf-skip-link class exists in CSS', () => {
    const css = fs.readFileSync(path.resolve(SRC, 'theme/utilities.css'), 'utf8');
    expect(css).toContain('.tf-skip-link');
  });

  it('skip link is rendered in the app', () => {
    const hasSkipLink = allJsxSource.some(s =>
      s.includes('tf-skip-link') || s.includes('skip-link') || s.includes('Skip to')
    );
    expect(hasSkipLink).toBe(true);
  });
});

// ═══ Modal Dialog ARIA ══════════════════════════════════════════
describe('Accessibility: Modal ARIA', () => {
  it('modals use role="dialog"', () => {
    // Check ModalOverlay or similar modal components
    const hasDialogRole = allJsxSource.some(s =>
      s.includes('role="dialog"') || s.includes("role='dialog'") || s.includes('role={"dialog"}')
    );
    expect(hasDialogRole).toBe(true);
  });

  it('modals support Escape key to close', () => {
    const hasEscape = allJsxSource.some(s => s.includes('Escape'));
    expect(hasEscape).toBe(true);
  });
});

// ═══ WCAG AA Contrast Verification ═════════════════════════════
describe('Accessibility: Contrast Ratios', () => {
  /** Parse hex to RGB */
  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  /** Relative luminance per WCAG 2.0 */
  function luminance([r, g, b]) {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  /** Contrast ratio between two hex colors */
  function contrastRatio(hex1, hex2) {
    const l1 = luminance(hexToRgb(hex1));
    const l2 = luminance(hexToRgb(hex2));
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  it('--tf-t3 dark (#7078a0) vs --tf-bg (#08090a) ≥ 4.5:1', () => {
    const ratio = contrastRatio('#7078a0', '#08090a');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('--tf-t2 dark (#8b8fa2) vs --tf-bg (#08090a) ≥ 4.5:1', () => {
    const ratio = contrastRatio('#8b8fa2', '#08090a');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('--tf-t1 dark (#ececef) vs --tf-bg (#08090a) ≥ 7:1 (AAA)', () => {
    const ratio = contrastRatio('#ececef', '#08090a');
    expect(ratio).toBeGreaterThanOrEqual(7);
  });

  it('--tf-t3 light (#636d89) vs --tf-bg light (#f8f8fa) ≥ 4.5:1', () => {
    const ratio = contrastRatio('#636d89', '#f8f8fa');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('--tf-t1 light (#111318) vs --tf-bg light (#f8f8fa) ≥ 7:1 (AAA)', () => {
    const ratio = contrastRatio('#111318', '#f8f8fa');
    expect(ratio).toBeGreaterThanOrEqual(7);
  });
});

// ═══ Focus Visible CSS ══════════════════════════════════════════
describe('Accessibility: Focus Management', () => {
  it('accessibility.css has :focus-visible rules', () => {
    const css = fs.readFileSync(path.resolve(SRC, 'theme/accessibility.css'), 'utf8');
    expect(css).toContain(':focus-visible');
  });

  it('accessibility.css has focus-visible for interactive elements', () => {
    const css = fs.readFileSync(path.resolve(SRC, 'theme/accessibility.css'), 'utf8');
    expect(css).toContain('.tf-btn:focus-visible');
    expect(css).toContain('.tf-nav-btn:focus-visible');
    expect(css).toContain('.tf-icon-btn:focus-visible');
  });

  it('.tf-sr-only class is defined', () => {
    const css = fs.readFileSync(path.resolve(SRC, 'theme/accessibility.css'), 'utf8');
    expect(css).toContain('.tf-sr-only');
  });
});

// ═══ Touch Target Size ══════════════════════════════════════════
describe('Accessibility: Touch Targets', () => {
  it('accessibility.css enforces 44px min on touch devices', () => {
    const css = fs.readFileSync(path.resolve(SRC, 'theme/accessibility.css'), 'utf8');
    expect(css).toContain('pointer: coarse');
    expect(css).toContain('min-height: 44px');
    expect(css).toContain('min-width: 44px');
  });

  it('mobile.css enforces 44px min on buttons', () => {
    const css = fs.readFileSync(path.resolve(SRC, 'theme/mobile.css'), 'utf8');
    expect(css).toContain('min-height: 44px');
  });
});

// ═══ Reduced Motion ═════════════════════════════════════════════
describe('Accessibility: Reduced Motion', () => {
  it('accessibility.css has prefers-reduced-motion media query', () => {
    const css = fs.readFileSync(path.resolve(SRC, 'theme/accessibility.css'), 'utf8');
    expect(css).toContain('prefers-reduced-motion: reduce');
  });

  it('chart-components.css has prefers-reduced-motion', () => {
    const css = fs.readFileSync(path.resolve(SRC, 'theme/chart-components.css'), 'utf8');
    expect(css).toContain('prefers-reduced-motion: reduce');
  });
});

// ═══ High Contrast Mode ═════════════════════════════════════════
describe('Accessibility: High Contrast', () => {
  it('utilities.css supports forced-colors mode', () => {
    const css = fs.readFileSync(path.resolve(SRC, 'theme/utilities.css'), 'utf8');
    expect(css).toContain('forced-colors: active');
  });
});
