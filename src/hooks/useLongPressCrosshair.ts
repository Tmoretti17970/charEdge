// ═══════════════════════════════════════════════════════════════════
// charEdge — Long-Press Crosshair Hook (Task 2.7.5)
//
// Mobile-first crosshair activation via long-press gesture.
// Activate crosshair after 300ms hold, update on touchmove,
// deactivate on touchend.
// ═══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';

export interface CrosshairPosition {
    x: number;
    y: number;
    clientX: number;
    clientY: number;
}

export interface UseLongPressCrosshairOptions {
    /** Delay in ms before activating crosshair (default: 300) */
    delay?: number;
    /** Max move delta in px before cancelling (default: 5) */
    moveThreshold?: number;
    /** Enable/disable the hook (default: true) */
    enabled?: boolean;
}

export interface UseLongPressCrosshairReturn {
    isCrosshairActive: boolean;
    position: CrosshairPosition | null;
    /** Ref to attach to the chart container element */
    containerRef: React.RefObject<HTMLElement | null>;
}

/**
 * React hook for mobile-first crosshair activation via long-press.
 */
export function useLongPressCrosshair(
    options: UseLongPressCrosshairOptions = {}
): UseLongPressCrosshairReturn {
    const {
        delay = 300,
        moveThreshold = 5,
        enabled = true,
    } = options;

    const containerRef = useRef<HTMLElement | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const startPosRef = useRef<{ x: number; y: number } | null>(null);

    const [isCrosshairActive, setIsCrosshairActive] = useState(false);
    const [position, setPosition] = useState<CrosshairPosition | null>(null);

    const clearTimer = useCallback(() => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const getRelativePosition = useCallback(
        (touch: Touch): CrosshairPosition | null => {
            const el = containerRef.current;
            if (!el) return null;
            const rect = el.getBoundingClientRect();
            return {
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top,
                clientX: touch.clientX,
                clientY: touch.clientY,
            };
        },
        []
    );

    useEffect(() => {
        const el = containerRef.current;
        if (!el || !enabled) return;

        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length !== 1) return;
            const touch = e.touches[0]!;
            startPosRef.current = { x: touch.clientX, y: touch.clientY };

            timerRef.current = setTimeout(() => {
                const pos = getRelativePosition(touch);
                if (pos) {
                    setIsCrosshairActive(true);
                    setPosition(pos);
                    // Prevent scroll while crosshair is active
                    e.preventDefault();
                }
            }, delay);
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length !== 1) return;
            const touch = e.touches[0]!;

            if (!isCrosshairActive) {
                // Check if movement exceeds threshold → cancel long-press
                if (startPosRef.current) {
                    const dx = Math.abs(touch.clientX - startPosRef.current.x);
                    const dy = Math.abs(touch.clientY - startPosRef.current.y);
                    if (dx > moveThreshold || dy > moveThreshold) {
                        clearTimer();
                    }
                }
                return;
            }

            // Update crosshair position during active mode
            e.preventDefault();
            const pos = getRelativePosition(touch);
            if (pos) setPosition(pos);
        };

        const handleTouchEnd = () => {
            clearTimer();
            if (isCrosshairActive) {
                setIsCrosshairActive(false);
                setPosition(null);
            }
            startPosRef.current = null;
        };

        el.addEventListener('touchstart', handleTouchStart, { passive: false });
        el.addEventListener('touchmove', handleTouchMove, { passive: false });
        el.addEventListener('touchend', handleTouchEnd);
        el.addEventListener('touchcancel', handleTouchEnd);

        return () => {
            clearTimer();
            el.removeEventListener('touchstart', handleTouchStart);
            el.removeEventListener('touchmove', handleTouchMove);
            el.removeEventListener('touchend', handleTouchEnd);
            el.removeEventListener('touchcancel', handleTouchEnd);
        };
    }, [enabled, delay, moveThreshold, isCrosshairActive, clearTimer, getRelativePosition]);

    return { isCrosshairActive, position, containerRef };
}
