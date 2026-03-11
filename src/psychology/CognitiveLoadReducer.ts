// ═══════════════════════════════════════════════════════════════════
// charEdge — Cognitive Load Auto-Reduction (4.7.8)
//
// Monitors chart complexity (indicators, drawings, overlays) and
// progressively reduces visual noise when thresholds are exceeded.
// ═══════════════════════════════════════════════════════════════════

export interface CognitiveMetrics {
  indicatorCount: number;
  drawingCount: number;
  overlayCount: number;
  /** Computed complexity score 0-100 */
  complexityScore: number;
  /** Current reduction level */
  reductionLevel: 'none' | 'mild' | 'moderate' | 'aggressive';
}

const THRESHOLDS = {
  /** Indicators before mild reduction */
  indicatorsMild: 4,
  /** Indicators before moderate reduction */
  indicatorsModerate: 6,
  /** Drawings before mild */
  drawingsMild: 8,
  /** Drawings before moderate */
  drawingsModerate: 15,
  /** Total complexity score for aggressive */
  aggressiveScore: 70,
};

/**
 * Compute cognitive complexity score from chart element counts.
 * Score 0-100 where 100 = maximum overload.
 */
export function computeComplexity(
  indicatorCount: number,
  drawingCount: number,
  overlayCount: number,
): number {
  // Weighted formula: indicators are heaviest cognitive load
  const iScore = Math.min(indicatorCount * 12, 50);  // max 50 from indicators
  const dScore = Math.min(drawingCount * 3, 30);      // max 30 from drawings
  const oScore = Math.min(overlayCount * 8, 20);      // max 20 from overlays
  return Math.min(iScore + dScore + oScore, 100);
}

/**
 * Determine reduction level from complexity score.
 */
export function getReductionLevel(score: number): CognitiveMetrics['reductionLevel'] {
  if (score >= THRESHOLDS.aggressiveScore) return 'aggressive';
  if (score >= 45) return 'moderate';
  if (score >= 25) return 'mild';
  return 'none';
}

/**
 * Apply cognitive load reduction to the chart container.
 *
 * @param container - The chart container element
 * @param level - Reduction level to apply
 */
export function applyCognitiveReduction(
  container: HTMLElement,
  level: CognitiveMetrics['reductionLevel'],
): void {
  // Reset
  container.removeAttribute('data-cognitive-reduction');

  if (level === 'none') return;

  container.setAttribute('data-cognitive-reduction', level);

  // Level-specific reductions
  switch (level) {
    case 'mild':
      // Fade non-essential overlays to 60% opacity
      container.querySelectorAll('[data-overlay-priority="low"]').forEach((el) => {
        (el as HTMLElement).style.opacity = '0.6';
      });
      break;

    case 'moderate':
      // Fade non-essential overlays to 40%
      container.querySelectorAll('[data-overlay-priority="low"]').forEach((el) => {
        (el as HTMLElement).style.opacity = '0.4';
      });
      // Collapse indicator legends
      container.querySelectorAll('[data-indicator-legend]').forEach((el) => {
        (el as HTMLElement).style.maxHeight = '0';
        (el as HTMLElement).style.overflow = 'hidden';
      });
      break;

    case 'aggressive':
      // Hide low-priority overlays completely
      container.querySelectorAll('[data-overlay-priority="low"]').forEach((el) => {
        (el as HTMLElement).style.display = 'none';
      });
      // Collapse legends
      container.querySelectorAll('[data-indicator-legend]').forEach((el) => {
        (el as HTMLElement).style.maxHeight = '0';
        (el as HTMLElement).style.overflow = 'hidden';
      });
      // Reduce drawing opacity
      container.querySelectorAll('[data-drawing]').forEach((el) => {
        (el as HTMLElement).style.opacity = '0.5';
      });
      break;
  }
}

/**
 * Reset all cognitive reduction styles.
 */
export function resetCognitiveReduction(container: HTMLElement): void {
  container.removeAttribute('data-cognitive-reduction');

  container.querySelectorAll('[data-overlay-priority="low"]').forEach((el) => {
    (el as HTMLElement).style.removeProperty('opacity');
    (el as HTMLElement).style.removeProperty('display');
  });
  container.querySelectorAll('[data-indicator-legend]').forEach((el) => {
    (el as HTMLElement).style.removeProperty('max-height');
    (el as HTMLElement).style.removeProperty('overflow');
  });
  container.querySelectorAll('[data-drawing]').forEach((el) => {
    (el as HTMLElement).style.removeProperty('opacity');
  });
}

/**
 * Full cognitive load analysis.
 */
export function analyzeCognitiveLoad(
  indicatorCount: number,
  drawingCount: number,
  overlayCount: number,
): CognitiveMetrics {
  const complexityScore = computeComplexity(indicatorCount, drawingCount, overlayCount);
  return {
    indicatorCount,
    drawingCount,
    overlayCount,
    complexityScore,
    reductionLevel: getReductionLevel(complexityScore),
  };
}

export default {
  computeComplexity,
  getReductionLevel,
  applyCognitiveReduction,
  resetCognitiveReduction,
  analyzeCognitiveLoad,
};
