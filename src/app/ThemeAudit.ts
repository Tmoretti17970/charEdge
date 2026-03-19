// ═══════════════════════════════════════════════════════════════════
// charEdge — Theme Audit (Sprint 96)
//
// Runtime theme health checker. Scans computed styles for
// hardcoded colors, contrast violations, and missing CSS variable
// usage. Dev-only diagnostic.
//
// Usage:
//   import { themeAudit } from './ThemeAudit';
//   const report = themeAudit.run();
//   // Or in console: window.__runThemeAudit()
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface ThemeReport {
  score: number;             // 0–100
  contrastViolations: ContrastIssue[];
  hardcodedColors: HardcodedColor[];
  missingVariables: string[];
  timestamp: number;
}

export interface ContrastIssue {
  element: string;
  foreground: string;
  background: string;
  ratio: number;
  required: number;
  level: 'AA' | 'AAA';
}

export interface HardcodedColor {
  element: string;
  property: string;
  value: string;
}

// ─── Audit ──────────────────────────────────────────────────────

class ThemeAudit {
  /**
   * Run a full theme audit on visible elements.
   */
  run(): ThemeReport {
    const elements = document.querySelectorAll('*');
    const contrastViolations: ContrastIssue[] = [];
    const hardcodedColors: HardcodedColor[] = [];
    const checkedVars = new Set<string>();

    elements.forEach(el => {
      if (!(el instanceof HTMLElement)) return;
      const style = getComputedStyle(el);

      // Check text contrast
      if (el.textContent?.trim() && style.color && style.backgroundColor) {
        const fg = style.color;
        const bg = this._resolveBackground(el);
        if (fg && bg) {
          const ratio = this._contrastRatio(this._parseColor(fg), this._parseColor(bg));
          const fontSize = parseFloat(style.fontSize);
          const isBold = parseInt(style.fontWeight) >= 700;
          const isLargeText = fontSize >= 18 || (fontSize >= 14 && isBold);
          const required = isLargeText ? 3 : 4.5;

          if (ratio < required && ratio > 0) {
            contrastViolations.push({
              element: this._describeEl(el),
              foreground: fg,
              background: bg,
              ratio: Math.round(ratio * 100) / 100,
              required,
              level: 'AA',
            });
          }
        }
      }

      // Check for hardcoded colors
      const colorProps = ['color', 'background-color', 'border-color', 'outline-color'];
      for (const prop of colorProps) {
        const raw = el.style.getPropertyValue(prop);
        if (raw && !raw.startsWith('var(') && this._isColor(raw)) {
          hardcodedColors.push({
            element: this._describeEl(el),
            property: prop,
            value: raw,
          });
        }
      }

      // Track CSS variable usage
      const styleText = el.getAttribute('style') || '';
      const varMatches = styleText.match(/var\(--[^)]+\)/g);
      if (varMatches) varMatches.forEach(v => checkedVars.add(v));
    });

    // Check which theme variables are defined but unused
    const rootStyles = getComputedStyle(document.documentElement);
    const missingVariables: string[] = [];
    const expectedVars = [
      '--bg-primary', '--bg-secondary', '--text-primary', '--text-secondary',
      '--accent', '--border', '--surface', '--error', '--success',
    ];
    for (const v of expectedVars) {
      if (!rootStyles.getPropertyValue(v)) {
        missingVariables.push(v);
      }
    }

    // Score: penalize for violations
    const maxScore = 100;
    const contrastPenalty = Math.min(40, contrastViolations.length * 5);
    const hardcodedPenalty = Math.min(30, hardcodedColors.length * 2);
    const varPenalty = missingVariables.length * 5;
    const score = Math.max(0, maxScore - contrastPenalty - hardcodedPenalty - varPenalty);

    return {
      score,
      contrastViolations: contrastViolations.slice(0, 20),
      hardcodedColors: hardcodedColors.slice(0, 20),
      missingVariables,
      timestamp: Date.now(),
    };
  }

  /**
   * Install dev console helper.
   */
  install(): void {
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__runThemeAudit = () => {
        const report = this.run();
        console.group('🎨 Theme Audit Report');
        console.log(`Score: ${report.score}/100`);
        console.log(`Contrast violations: ${report.contrastViolations.length}`);
        console.log(`Hardcoded colors: ${report.hardcodedColors.length}`);
        console.log(`Missing variables: ${report.missingVariables.join(', ') || 'none'}`);
        if (report.contrastViolations.length) {
          console.table(report.contrastViolations);
        }
        console.groupEnd();
        return report;
      };
    }
  }

  // ─── Color Math ──────────────────────────────────────────────

  private _parseColor(color: string): [number, number, number] {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) return [+match[1], +match[2], +match[3]];
    return [0, 0, 0];
  }

  private _luminance(rgb: [number, number, number]): number {
    const [r, g, b] = rgb.map(c => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  private _contrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
    const l1 = this._luminance(fg);
    const l2 = this._luminance(bg);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  private _resolveBackground(el: Element): string {
    let current: Element | null = el;
    while (current) {
      const bg = getComputedStyle(current).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
      current = current.parentElement;
    }
    return 'rgb(255, 255, 255)';
  }

  private _isColor(val: string): boolean {
    return /^#[0-9a-f]{3,8}$/i.test(val) || /^rgb/i.test(val) || /^hsl/i.test(val);
  }

  private _describeEl(el: HTMLElement): string {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const cls = el.className ? `.${String(el.className).split(' ')[0]}` : '';
    return `${tag}${id}${cls}`.slice(0, 60);
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const themeAudit = new ThemeAudit();
export default themeAudit;
