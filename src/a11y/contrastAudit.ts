// ═══════════════════════════════════════════════════════════════════
// charEdge — Color Contrast Audit (Phase 3, Task 3.1.2)
//
// WCAG 2.1 AA contrast checker. Computes luminance ratios between
// foreground and background colors. Supports hex, rgb(), and
// CSS custom properties.
//
// Usage:
//   import { checkContrast, auditPageContrast } from './contrastAudit.ts';
//   const { ratio, aa, aaa } = checkContrast('#a0a4b8', '#0e1013');
// ═══════════════════════════════════════════════════════════════════

/** WCAG 2.1 minimum contrast ratios */
const AA_NORMAL = 4.5;
const AA_LARGE = 3.0;
const AAA_NORMAL = 7.0;
const AAA_LARGE = 4.5;

export interface ContrastResult {
    ratio: number;
    aa: boolean;      // Passes AA for normal text (4.5:1)
    aaLarge: boolean;  // Passes AA for large text (3:1)
    aaa: boolean;     // Passes AAA for normal text (7:1)
    aaaLarge: boolean; // Passes AAA for large text (4.5:1)
}

export interface ContrastViolation {
    element: HTMLElement;
    selector: string;
    text: string;
    foreground: string;
    background: string;
    ratio: number;
    fontSize: number;
    isLarge: boolean;
    required: number;
}

// ─── Color Parsing ──────────────────────────────────────────────

interface RGB { r: number; g: number; b: number }

/**
 * Parse a CSS color string to RGB values (0-255).
 */
function parseColor(color: string): RGB | null {
    if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return null;

    // hex
    const hexMatch = color.match(/^#([0-9a-f]{3,8})$/i);
    if (hexMatch) {
        let hex = hexMatch[1];
        if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        return {
            r: parseInt(hex.slice(0, 2), 16),
            g: parseInt(hex.slice(2, 4), 16),
            b: parseInt(hex.slice(4, 6), 16),
        };
    }

    // rgb/rgba
    const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgbMatch) {
        return {
            r: parseInt(rgbMatch[1], 10),
            g: parseInt(rgbMatch[2], 10),
            b: parseInt(rgbMatch[3], 10),
        };
    }

    return null;
}

/**
 * Compute relative luminance per WCAG 2.1 formula.
 * @see https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
function relativeLuminance(rgb: RGB): number {
    const [rs, gs, bs] = [rgb.r, rgb.g, rgb.b].map(c => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Compute contrast ratio between two colors.
 */
function contrastRatio(fg: RGB, bg: RGB): number {
    const l1 = relativeLuminance(fg);
    const l2 = relativeLuminance(bg);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Check contrast ratio between two CSS color strings.
 */
export function checkContrast(foreground: string, background: string): ContrastResult {
    const fg = parseColor(foreground);
    const bg = parseColor(background);

    if (!fg || !bg) {
        return { ratio: 0, aa: false, aaLarge: false, aaa: false, aaaLarge: false };
    }

    const ratio = Math.round(contrastRatio(fg, bg) * 100) / 100;

    return {
        ratio,
        aa: ratio >= AA_NORMAL,
        aaLarge: ratio >= AA_LARGE,
        aaa: ratio >= AAA_NORMAL,
        aaaLarge: ratio >= AAA_LARGE,
    };
}

/**
 * Determine if text is "large" per WCAG (≥18pt or ≥14pt bold).
 */
function isLargeText(fontSize: number, fontWeight: number | string): boolean {
    const boldThreshold = typeof fontWeight === 'string'
        ? fontWeight === 'bold' || fontWeight === 'bolder' || parseInt(fontWeight, 10) >= 700
        : fontWeight >= 700;

    // 18pt = 24px, 14pt = 18.66px
    return fontSize >= 24 || (fontSize >= 18.66 && boldThreshold);
}

/**
 * Walk up the DOM to find the effective background color.
 */
function getEffectiveBackground(el: HTMLElement): string {
    let node: HTMLElement | null = el;
    while (node) {
        const bg = getComputedStyle(node).backgroundColor;
        const rgb = parseColor(bg);
        if (rgb && (rgb.r !== 0 || rgb.g !== 0 || rgb.b !== 0)) {
            return bg;
        }
        // Check for non-transparent bg
        if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
            return bg;
        }
        node = node.parentElement;
    }
    return '#ffffff'; // Assume white if no background found
}

/**
 * Scan visible text elements on the page for contrast violations.
 */
export function auditPageContrast(root: HTMLElement = document.body): ContrastViolation[] {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            const text = node.textContent?.trim();
            if (!text || text.length === 0) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        },
    });

    const violations: ContrastViolation[] = [];
    const checked = new Set<HTMLElement>();

    let node: Node | null;
    while ((node = walker.nextNode())) {
        const el = node.parentElement;
        if (!el || checked.has(el)) continue;
        checked.add(el);

        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;

        const fg = style.color;
        const bg = getEffectiveBackground(el);
        const fgRGB = parseColor(fg);
        const bgRGB = parseColor(bg);
        if (!fgRGB || !bgRGB) continue;

        const ratio = Math.round(contrastRatio(fgRGB, bgRGB) * 100) / 100;
        const fontSize = parseFloat(style.fontSize);
        const large = isLargeText(fontSize, style.fontWeight);
        const required = large ? AA_LARGE : AA_NORMAL;

        if (ratio < required) {
            const text = (el.textContent || '').trim().slice(0, 50);
            violations.push({
                element: el,
                selector: buildSelector(el),
                text,
                foreground: fg,
                background: bg,
                ratio,
                fontSize,
                isLarge: large,
                required,
            });
        }
    }

    return violations;
}

/**
 * Build a readable CSS selector for an element.
 */
function buildSelector(el: HTMLElement): string {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const classes = el.className && typeof el.className === 'string'
        ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
        : '';
    return `${tag}${id}${classes}`.slice(0, 80);
}

/**
 * Console report of contrast violations (dev tool).
 */
export function reportContrast(root?: HTMLElement): void {
    const violations = auditPageContrast(root);

    if (violations.length === 0) {
         
        console.info('✅ All text meets WCAG AA contrast requirements');
        return;
    }

     
    console.warn(`⚠️ ${violations.length} contrast violations:`);
     
    console.table(violations.map(v => ({
        selector: v.selector,
        text: v.text,
        ratio: `${v.ratio}:1`,
        required: `${v.required}:1`,
        fg: v.foreground,
        bg: v.background,
    })));
}
