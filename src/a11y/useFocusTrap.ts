// ═══════════════════════════════════════════════════════════════════
// charEdge — Focus Trap Hook (Phase 3, Task 3.1.4)
//
// Traps keyboard focus inside a container element (modal, dialog,
// drawer). Tab wraps at boundaries. Escape triggers close.
// Returns focus to the previously focused element on unmount.
//
// Usage:
//   const ref = useRef<HTMLDivElement>(null);
//   useFocusTrap(ref, { onClose: handleClose });
//   return <div ref={ref}>...modal content...</div>;
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef, useCallback } from 'react';
import type { RefObject } from 'react';

// ─── Types ──────────────────────────────────────────────────────

export interface FocusTrapOptions {
    /** Ref to the element that should receive initial focus */
    initialFocusRef?: RefObject<HTMLElement | null>;
    /** Return focus to the previously focused element on unmount (default: true) */
    returnFocusOnClose?: boolean;
    /** Close trap on Escape key (default: true) */
    closeOnEscape?: boolean;
    /** Callback when Escape is pressed */
    onClose?: () => void;
    /** Whether the trap is active (default: true) */
    active?: boolean;
    /** P2 4.1: Keys that should NOT be trapped — they bubble to global handlers */
    passthroughKeys?: string[];
}

// ─── Focusable Element Selector ─────────────────────────────────

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
].join(', ');

/**
 * Get all focusable elements within a container.
 */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
    const elements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    return Array.from(elements).filter(el => {
        // Filter out elements that are visually hidden
        const style = getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
    });
}

// ─── Hook ───────────────────────────────────────────────────────

/**
 * Trap focus within a container element.
 *
 * @param containerRef - Ref to the container element
 * @param options - Configuration options
 */
export function useFocusTrap(
    containerRef: RefObject<HTMLElement | null>,
    options: FocusTrapOptions = {},
): void {
    const {
        initialFocusRef,
        returnFocusOnClose = true,
        closeOnEscape = true,
        onClose,
        active = true,
        passthroughKeys,
    } = options;

    // Store the element that was focused before the trap activated
    const previousFocusRef = useRef<HTMLElement | null>(null);

    // Handle Tab key navigation
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (!containerRef.current) return;

            // P2 4.1: Passthrough keys — let these bubble to global handlers
            if (passthroughKeys && passthroughKeys.includes(e.key)) {
                return; // Don't prevent or stop — let it bubble
            }

            // Escape — close the trap
            if (e.key === 'Escape' && closeOnEscape && onClose) {
                e.preventDefault();
                e.stopPropagation();
                onClose();
                return;
            }

            // Tab — trap focus
            if (e.key === 'Tab') {
                const focusable = getFocusableElements(containerRef.current);
                if (focusable.length === 0) return;

                const first = focusable[0];
                const last = focusable[focusable.length - 1];

                if (e.shiftKey) {
                    // Shift+Tab at first element → wrap to last
                    if (document.activeElement === first || !containerRef.current.contains(document.activeElement)) {
                        e.preventDefault();
                        last.focus();
                    }
                } else {
                    // Tab at last element → wrap to first
                    if (document.activeElement === last || !containerRef.current.contains(document.activeElement)) {
                        e.preventDefault();
                        first.focus();
                    }
                }
            }
        },
        [containerRef, closeOnEscape, onClose, passthroughKeys],
    );

    useEffect(() => {
        if (!active || !containerRef.current) return;

        const container = containerRef.current;

        // Save current focus
        previousFocusRef.current = document.activeElement as HTMLElement;

        // Set initial focus
        requestAnimationFrame(() => {
            if (initialFocusRef?.current) {
                initialFocusRef.current.focus();
            } else {
                // Focus the first focusable element, or the container itself
                const focusable = getFocusableElements(container);
                if (focusable.length > 0) {
                    focusable[0].focus();
                } else {
                    // Make container focusable temporarily
                    container.setAttribute('tabindex', '-1');
                    container.focus();
                }
            }
        });

        // Add keyboard listener
        container.addEventListener('keydown', handleKeyDown);

        // Cleanup
        return () => {
            container.removeEventListener('keydown', handleKeyDown);

            // Return focus to previously focused element
            if (returnFocusOnClose && previousFocusRef.current) {
                try {
                    previousFocusRef.current.focus();
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                } catch (_) {
                    // Element may have been removed from DOM
                }
            }
        };
    }, [active, containerRef, handleKeyDown, initialFocusRef, returnFocusOnClose]);
}

export default useFocusTrap;
