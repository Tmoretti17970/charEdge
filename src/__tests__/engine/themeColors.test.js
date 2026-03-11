// ═══════════════════════════════════════════════════════════════════
// charEdge — ThemeColors Unit Tests
//
// Sprint 7 #60: Verifies the CSS custom property → hex bridge module
// that unifies oklch brand-colors.css with the WebGL rendering pipeline.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

describe('ThemeColors — CSS ↔ WebGL color bridge', () => {
    it('exports getCSSThemeColors, invalidateCSSColors, hasBrandColors', async () => {
        const mod = await import('../../charting_library/core/ThemeColors');
        expect(typeof mod.getCSSThemeColors).toBe('function');
        expect(typeof mod.invalidateCSSColors).toBe('function');
        expect(typeof mod.hasBrandColors).toBe('function');
    });

    it('getCSSThemeColors returns an object (empty in test env without DOM)', async () => {
        const { getCSSThemeColors } = await import('../../charting_library/core/ThemeColors');
        const result = getCSSThemeColors();
        expect(typeof result).toBe('object');
    });

    it('invalidateCSSColors does not throw', async () => {
        const { invalidateCSSColors } = await import('../../charting_library/core/ThemeColors');
        expect(() => invalidateCSSColors()).not.toThrow();
    });

    it('hasBrandColors returns boolean', async () => {
        const { hasBrandColors } = await import('../../charting_library/core/ThemeColors');
        expect(typeof hasBrandColors()).toBe('boolean');
    });

    it('maps CSS custom properties to theme keys', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile(
            'src/charting_library/core/ThemeColors.ts', 'utf8'
        );
        // Verify mapping entries exist
        expect(source).toContain("'--brand-teal'");
        expect(source).toContain("'--brand-coral'");
        expect(source).toContain("'bullCandle'");
        expect(source).toContain("'bearCandle'");
        expect(source).toContain("'bullVolume'");
        expect(source).toContain("'bearVolume'");
    });

    it('is wired into resolveTheme in RenderPipeline', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile(
            'src/charting_library/core/RenderPipeline.ts', 'utf8'
        );
        expect(source).toContain("import { getCSSThemeColors } from './ThemeColors'");
        expect(source).toContain('getCSSThemeColors()');
    });

    it('cache invalidation is wired into ThemeManager.setTheme', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile(
            'src/charting_library/core/ThemeManager.js', 'utf8'
        );
        expect(source).toContain("import { invalidateCSSColors } from './ThemeColors'");
        expect(source).toContain('invalidateCSSColors()');
    });

    it('uses 1×1 canvas for universal color conversion', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile(
            'src/charting_library/core/ThemeColors.ts', 'utf8'
        );
        expect(source).toContain('getImageData(0, 0, 1, 1)');
        expect(source).toContain("getContext('2d'");
    });

    it('has cache TTL to avoid per-frame DOM reads', async () => {
        const fs = await import('fs');
        const source = await fs.promises.readFile(
            'src/charting_library/core/ThemeColors.ts', 'utf8'
        );
        expect(source).toContain('CACHE_TTL_MS');
        expect(source).toContain('performance.now()');
    });
});
