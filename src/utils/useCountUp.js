import { useState, useEffect } from 'react';

/**
 * A hook that animates a number from 0 to its target value.
 * Used for Apple HIG style stat card loading animations.
 *
 * @param {number} end - The target number
 * @param {number} durationMs - Duration of the animation
 * @param {boolean} shouldAnimate - If false, returns the end value immediately
 * @returns {number} The current animating frame value
 */
export function useCountUp(end, durationMs = 600, shouldAnimate = true) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!shouldAnimate || end === null || isNaN(end)) {
      setValue(end);
      return;
    }

    let startTimestamp = null;
    let animationFrameId;

    const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

    const step = (timestamp) => {
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
