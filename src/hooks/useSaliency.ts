// ═══════════════════════════════════════════════════════════════════
// charEdge — Signal-State Saliency Hook (F5.2)
//
// Monitors indicator output values and transitions indicators from
// grayscale (noise) to full-color (signal) when crossing thresholds.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef, useCallback } from 'react';

export interface SaliencyRule {
  /** Indicator key (e.g., 'rsi', 'macd') */
  key: string;
  /** Condition: value crosses this threshold to become salient */
  condition: (value: number) => boolean;
  /** Optional: CSS color override when salient */
  color?: string;
}

/** Default saliency rules for common indicators */
export const DEFAULT_SALIENCY_RULES: SaliencyRule[] = [
  { key: 'rsi', condition: (v) => v > 70 || v < 30 },
  { key: 'stoch', condition: (v) => v > 80 || v < 20 },
  { key: 'cci', condition: (v) => v > 100 || v < -100 },
  { key: 'macd_histogram', condition: (v) => Math.abs(v) > 0 },
  { key: 'adx', condition: (v) => v > 25 },
  { key: 'bb_width', condition: (v) => v < 0.02 || v > 0.1 },
  { key: 'mfi', condition: (v) => v > 80 || v < 20 },
  { key: 'atr', condition: (v) => v > 0 }, // always salient when visible
];

/**
 * Hook that manages indicator saliency — gray when dormant, color when active.
 *
 * Applies `[data-salient]` attribute to indicator DOM elements when
 * their values cross defined thresholds.
 *
 * @param containerRef - Ref to the chart/indicator container
 * @param indicatorValues - Current indicator output values
 * @param rules - Saliency rules (defaults provided)
 */
export function useSaliency(
  // eslint-disable-next-line no-undef
  containerRef: React.RefObject<HTMLElement | null>,
  indicatorValues: Record<string, number>,
  rules: SaliencyRule[] = DEFAULT_SALIENCY_RULES,
): void {
  const prevSalientRef = useRef<Set<string>>(new Set());

  const updateSaliency = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const nowSalient = new Set<string>();

    for (const rule of rules) {
      const value = indicatorValues[rule.key];
      if (value !== undefined && rule.condition(value)) {
        nowSalient.add(rule.key);
      }
    }

    // Apply/remove [data-salient] on indicator elements
    const indicators = container.querySelectorAll('[data-indicator-key]');
    indicators.forEach((el) => {
      const key = (el as HTMLElement).dataset.indicatorKey;
      if (!key) return;

      if (nowSalient.has(key)) {
        el.setAttribute('data-salient', '');
        // Optionally set override color
        const rule = rules.find((r) => r.key === key);
        if (rule?.color) {
          (el as HTMLElement).style.setProperty('--tf-salient-color', rule.color);
        }
      } else {
        el.removeAttribute('data-salient');
        (el as HTMLElement).style.removeProperty('--tf-salient-color');
      }
    });

    prevSalientRef.current = nowSalient;
  }, [containerRef, indicatorValues, rules]);

  useEffect(() => {
    updateSaliency();
  }, [updateSaliency]);
}

export default useSaliency;
