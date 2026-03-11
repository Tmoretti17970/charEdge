// ═══════════════════════════════════════════════════════════════════
// charEdge — View Transitions Hook (TypeScript)
//
// Phase 4 Task 4.2.2: Smooth cross-page transitions via the
// View Transitions API with automatic CSS-transition fallback.
// Phase 2: Converted to TypeScript.
// ═══════════════════════════════════════════════════════════════════

import { useCallback, useRef } from 'react';

interface ViewTransitionResult {
    navigate: (updateFn: () => void, viewTransitionName?: string) => void;
    readonly isTransitioning: boolean;
}

/**
 * Check if the View Transitions API is supported.
 */
export function supportsViewTransitions(): boolean {
    return typeof document !== 'undefined' && 'startViewTransition' in document;
}

/**
 * Hook for View Transition API-powered page transitions.
 */
export function useViewTransition(): ViewTransitionResult {
    const isTransitioning = useRef(false);

    const navigate = useCallback((updateFn: () => void, viewTransitionName?: string) => {
        if (!supportsViewTransitions()) {
            updateFn();
            return;
        }

        if (viewTransitionName) {
            document.documentElement.style.viewTransitionName = viewTransitionName;
        }

        isTransitioning.current = true;

        const transition = (document as Document & { startViewTransition: (cb: () => void) => { finished: Promise<void> } }).startViewTransition(() => {
            updateFn();
        });

        transition.finished.then(() => {
            isTransitioning.current = false;
            if (viewTransitionName) {
                document.documentElement.style.viewTransitionName = '';
            }
        }).catch(() => {
            isTransitioning.current = false;
        });
    }, []);

    return {
        navigate,
        get isTransitioning() { return isTransitioning.current; },
    };
}

export default useViewTransition;
