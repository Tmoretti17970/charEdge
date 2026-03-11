// ═══════════════════════════════════════════════════════════════════
// charEdge — ThemeColors
//
// Sprint 7 #60: Bridge between oklch CSS custom properties
// (brand-colors.css) and the WebGL/Canvas rendering pipeline.
//
// Reads CSS custom properties at runtime, converts computed
// colors to hex strings suitable for the `ResolvedTheme` system,
// and caches results to avoid per-frame DOM reads.
//
// Usage:
//   import { getCSSThemeColors, invalidateCSSColors } from './ThemeColors';
//   const colors = getCSSThemeColors();
//   // colors.bullCandle → '#26A69A' (from --brand-teal)
//
// The cache is invalidated when the theme changes or when
// `invalidateCSSColors()` is called explicitly.
// ═══════════════════════════════════════════════════════════════════

/** Mapping from CSS custom property → ResolvedTheme key. */
const CSS_TO_THEME: ReadonlyArray<[string, string]> = [
    ['--brand-teal', 'bullCandle'],
    ['--brand-coral', 'bearCandle'],
    ['--brand-teal', 'bullVolume'],   // Volume uses same base hue
    ['--brand-coral', 'bearVolume'],
    ['--brand-bg-0', 'bg'],
    ['--brand-text-primary', 'fg'],
    ['--brand-bg-1', 'axisBg'],
    ['--brand-text-secondary', 'axisText'],
    ['--brand-navy-light', 'gridLine'],
    ['--brand-navy-light', 'gridColor'],
];

/** Cached results. */
let _cache: Record<string, string> | null = null;
/** Timestamp of last cache fill. */
let _cacheTime = 0;
/** Cache TTL in ms — re-read CSS at most once per second. */
const CACHE_TTL_MS = 1000;

/**
 * Convert a computed CSS color value (any format the browser resolves)
 * to a hex string for the rendering pipeline.
 *
 * Uses an offscreen canvas 1×1 to let the browser parse oklch/rgb/hsl → rgba,
 * then extracts the components. This works universally across color spaces.
 */
let _conversionCtx: CanvasRenderingContext2D | null = null;

function cssColorToHex(cssValue: string): string {
    if (!cssValue || cssValue === 'transparent') return '';

    // Fast path: already hex
    if (cssValue.startsWith('#')) return cssValue;

    // Use a 1×1 canvas to let the browser resolve any CSS color to rgba
    if (!_conversionCtx) {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        _conversionCtx = canvas.getContext('2d', { willReadFrequently: true });
    }
    if (!_conversionCtx) return '';

    _conversionCtx.clearRect(0, 0, 1, 1);
    _conversionCtx.fillStyle = cssValue;
    _conversionCtx.fillRect(0, 0, 1, 1);
    const pixels = _conversionCtx.getImageData(0, 0, 1, 1).data;
    const r = pixels[0]!;
    const g = pixels[1]!;
    const b = pixels[2]!;
    const a = pixels[3]!;

    // If fully transparent, return empty (let theme fallback handle it)
    if (a === 0) return '';

    if (a < 255) {
        // Return rgba hex (8 digits)
        return '#' +
            r.toString(16).padStart(2, '0') +
            g.toString(16).padStart(2, '0') +
            b.toString(16).padStart(2, '0') +
            a.toString(16).padStart(2, '0');
    }

    return '#' +
        r.toString(16).padStart(2, '0') +
        g.toString(16).padStart(2, '0') +
        b.toString(16).padStart(2, '0');
}

/**
 * Read CSS custom properties from :root and return a partial theme
 * object with hex color values.
 *
 * Results are cached for CACHE_TTL_MS to avoid hammering getComputedStyle.
 * Call `invalidateCSSColors()` when the theme changes to force a re-read.
 *
 * @returns Partial theme object with only the properties that were found in CSS.
 */
export function getCSSThemeColors(): Record<string, string> {
    const now = performance.now();

    // Return cache if still fresh
    if (_cache && (now - _cacheTime) < CACHE_TTL_MS) {
        return _cache;
    }

    // Guard: SSR or no DOM
    if (typeof document === 'undefined' || !document.documentElement) {
        return {};
    }

    const style = getComputedStyle(document.documentElement);
    const result: Record<string, string> = {};
    let anyFound = false;

    for (const [cssProp, themeKey] of CSS_TO_THEME) {
        const raw = style.getPropertyValue(cssProp).trim();
        if (!raw) continue;

        const hex = cssColorToHex(raw);
        if (hex) {
            // Volume colors need alpha for transparency
            if (themeKey === 'bullVolume' || themeKey === 'bearVolume') {
                // Append 50% alpha if not already present
                result[themeKey] = hex.length <= 7 ? hex + '4D' : hex;
            } else {
                result[themeKey] = hex;
            }
            anyFound = true;
        }
    }

    _cache = anyFound ? result : {};
    _cacheTime = now;
    return _cache;
}

/**
 * Invalidate the CSS color cache. Call when:
 * - Theme switches
 * - Brand colors CSS changes
 * - System color scheme changes
 */
export function invalidateCSSColors(): void {
    _cache = null;
    _cacheTime = 0;
}

/**
 * Check whether CSS custom properties from brand-colors.css are available.
 * Returns true if at least --brand-teal is defined.
 */
export function hasBrandColors(): boolean {
    if (typeof document === 'undefined') return false;
    const val = getComputedStyle(document.documentElement)
        .getPropertyValue('--brand-teal')
        .trim();
    return val.length > 0;
}
