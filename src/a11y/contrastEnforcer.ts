// ═══════════════════════════════════════════════════════════════════
// charEdge — WCAG 2.1 Contrast Enforcer (4.6.1)
//
// Pure utility for ensuring text/background color pairs meet the
// WCAG AA minimum contrast ratio of 4.5:1 (3:1 for large text).
//
// Functions:
//   relativeLuminance(hex)      — WCAG 2.1 relative luminance
//   contrastRatio(fg, bg)       — contrast ratio between two hex colors
//   enforceContrast(fg, bg, r)  — auto-adjust fg to meet ratio r
//   meetsAA(fg, bg)             — boolean check for 4.5:1
//   meetsAALarge(fg, bg)        — boolean check for 3:1
// ═══════════════════════════════════════════════════════════════════

/**
 * Parse a hex color string to [r, g, b] (0–255).
 * Supports #RGB, #RRGGBB, #RRGGBBAA.
 */
function hexToRgb(hex: string): [number, number, number] {
    let h = hex.replace(/^#/, '');
    if (h.length === 3) h = (h[0] ?? '0') + (h[0] ?? '0') + (h[1] ?? '0') + (h[1] ?? '0') + (h[2] ?? '0') + (h[2] ?? '0');
    if (h.length === 8) h = h.slice(0, 6); // strip alpha
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Convert [r, g, b] (0–255) back to #RRGGBB.
 */
function rgbToHex(r: number, g: number, b: number): string {
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    return '#' + [clamp(r), clamp(g), clamp(b)]
        .map(v => v.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * WCAG 2.1 relative luminance.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function relativeLuminance(hex: string): number {
    const rgb = hexToRgb(hex);
    const linearized = rgb.map(c => {
        const s = c / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * (linearized[0] ?? 0) + 0.7152 * (linearized[1] ?? 0) + 0.0722 * (linearized[2] ?? 0);
}

/**
 * WCAG 2.1 contrast ratio between two colors.
 * Returns a value ≥ 1.0 (1:1 = identical, 21:1 = max).
 */
export function contrastRatio(fg: string, bg: string): number {
    const l1 = relativeLuminance(fg);
    const l2 = relativeLuminance(bg);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if a fg/bg pair meets WCAG AA for normal text (4.5:1).
 */
export function meetsAA(fg: string, bg: string): boolean {
    return contrastRatio(fg, bg) >= 4.5;
}

/**
 * Check if a fg/bg pair meets WCAG AA for large text (3:1).
 */
export function meetsAALarge(fg: string, bg: string): boolean {
    return contrastRatio(fg, bg) >= 3.0;
}

/**
 * Auto-adjust a foreground color to meet a target contrast ratio
 * against a given background. Lightens or darkens the fg as needed.
 *
 * @param fg  — Foreground hex color
 * @param bg  — Background hex color
 * @param targetRatio — Minimum contrast ratio (default 4.5 for WCAG AA)
 * @returns Adjusted foreground hex color that meets the target ratio
 */
export function enforceContrast(
    fg: string,
    bg: string,
    targetRatio: number = 4.5,
): string {
    // Already meets requirement
    if (contrastRatio(fg, bg) >= targetRatio) return fg;

    const bgLum = relativeLuminance(bg);
    const [r, g, b] = hexToRgb(fg);

    // Determine direction: lighten if bg is dark, darken if bg is light
    const lighten = bgLum < 0.5;

    // Binary search for the minimum adjustment that meets the ratio
    let lo = 0;
    let hi = 1;
    let bestColor = fg;

    for (let i = 0; i < 32; i++) {
        const mid = (lo + hi) / 2;
        let nr: number, ng: number, nb: number;

        if (lighten) {
            // Blend toward white
            nr = r + (255 - r) * mid;
            ng = g + (255 - g) * mid;
            nb = b + (255 - b) * mid;
        } else {
            // Blend toward black
            nr = r * (1 - mid);
            ng = g * (1 - mid);
            nb = b * (1 - mid);
        }

        const candidate = rgbToHex(nr, ng, nb);
        const ratio = contrastRatio(candidate, bg);

        if (ratio >= targetRatio) {
            bestColor = candidate;
            hi = mid; // Try less adjustment
        } else {
            lo = mid; // Need more adjustment
        }
    }

    return bestColor;
}

/**
 * Batch-check a set of fg/bg pairs and return failing ones.
 * Useful for CI audits.
 */
export function auditContrast(
    pairs: Array<{ name: string; fg: string; bg: string; large?: boolean }>,
): Array<{ name: string; fg: string; bg: string; ratio: number; required: number }> {
    return pairs
        .map(p => ({
            ...p,
            ratio: contrastRatio(p.fg, p.bg),
            required: p.large ? 3.0 : 4.5,
        }))
        .filter(p => p.ratio < p.required);
}
