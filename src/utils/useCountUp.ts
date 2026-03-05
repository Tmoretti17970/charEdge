import { useState, useEffect } from 'react';

/**
 * A hook that animates a number from 0 to its target value.
 * Used for Apple HIG style stat card loading animations.
 */
export function useCountUp(end: number, durationMs: number = 600, shouldAnimate: boolean = true): number {
    const [value, setValue] = useState(0);

    useEffect(() => {
        if (!shouldAnimate || end === null || isNaN(end)) {
            setValue(end);
            return;
        }

        let startTimestamp: number | null = null;
        let animationFrameId: number;

        const easeOutQuart = (t: number): number => 1 - Math.pow(1 - t, 4);

        const step = (timestamp: number): void => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = timestamp - startTimestamp;
            const percentage = Math.min(progress / durationMs, 1);

            const easedProgress = easeOutQuart(percentage);
            setValue(end * easedProgress);

            if (progress < durationMs) {
                animationFrameId = window.requestAnimationFrame(step);
            } else {
                setValue(end);
            }
        };

        animationFrameId = window.requestAnimationFrame(step);

        return () => {
            window.cancelAnimationFrame(animationFrameId);
        };
    }, [end, durationMs, shouldAnimate]);

    return value;
}
