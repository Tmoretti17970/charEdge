// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — useMediaQuery Hook (TypeScript)
//
// Reactive media query listener. Returns boolean matching state.
// Phase 2: Converted to TypeScript.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';

/**
 * Subscribe to a CSS media query and return its match state.
 */
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia(query).matches;
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mql = window.matchMedia(query);
        const handler = (e: MediaQueryListEvent): void => setMatches(e.matches);

        if (mql.addEventListener) {
            mql.addEventListener('change', handler);
            return () => mql.removeEventListener('change', handler);
        }
        // Legacy Safari fallback
        mql.addListener(handler);
        return () => mql.removeListener(handler);
    }, [query]);

    return matches;
}

interface Breakpoints {
    isMobile: boolean;
    isTablet: boolean;
    isCompact: boolean;
    isDesktop: boolean;
}

/**
 * Pre-built breakpoint hook matching charEdge layout tiers.
 */
export function useBreakpoints(): Breakpoints {
    const isMobile = useMediaQuery('(max-width: 480px)');
    const isTablet = useMediaQuery('(max-width: 768px)');
    const isCompact = useMediaQuery('(max-width: 1024px)');

    return {
        isMobile,
        isTablet,
        isCompact,
        isDesktop: !isCompact,
    };
}

export default useMediaQuery;
