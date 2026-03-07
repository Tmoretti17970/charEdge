// ═══════════════════════════════════════════════════════════════════
// charEdge — InformationHierarchy (P1-A #7)
// Dynamic information hierarchy — progressively hides visual elements
// at low zoom levels to reduce clutter, revealing full detail at
// high zoom. Consumed by render stages to decide what to draw.
// ═══════════════════════════════════════════════════════════════════

/**
 * Detail level determines how much visual information is shown.
 * - `full`: ≤60 bars — show everything (volume, indicators, labels, grid text)
 * - `standard`: 61–200 bars — hide volume bars, simplify indicator labels
 * - `minimal`: >200 bars — hide grid text, only show candles + price overlays
 */
export type DetailLevel = 'full' | 'standard' | 'minimal';

/**
 * Visibility flags derived from the detail level.
 * Each render stage checks the relevant flag.
 */
export interface DetailFlags {
  level: DetailLevel;
  showVolume: boolean;
  showGridText: boolean;
  showIndicatorLabels: boolean;
  showTradeMarkers: boolean;
  showSessionDividers: boolean;
  showGhostBoxes: boolean;
  /** Opacity multiplier for secondary elements (0–1) */
  secondaryOpacity: number;
}

// ─── Thresholds ─────────────────────────────────────────────────

const FULL_THRESHOLD = 60;
const STANDARD_THRESHOLD = 200;

// ─── Core Function ──────────────────────────────────────────────

/**
 * Compute the current detail level based on how many bars are visible.
 *
 * @param visibleBars - Number of bars currently visible on the chart
 * @returns DetailLevel | 'full', 'standard', or 'minimal'
 */
export function computeDetailLevel(visibleBars: number): DetailLevel {
  if (visibleBars <= FULL_THRESHOLD) return 'full';
  if (visibleBars <= STANDARD_THRESHOLD) return 'standard';
  return 'minimal';
}

/**
 * Compute all visibility flags at once from the visible bar count.
 * This is the primary API — call once per frame in FrameState or RenderPipeline.
 *
 * @param visibleBars - Number of bars currently visible
 * @param userShowVolume - Whether the user has volume toggled on (from props)
 * @returns DetailFlags object consumed by render stages
 */
export function computeDetailFlags(visibleBars: number, userShowVolume: boolean): DetailFlags {
  const level = computeDetailLevel(visibleBars);

  switch (level) {
    case 'full':
      return {
        level,
        showVolume: userShowVolume,
        showGridText: true,
        showIndicatorLabels: true,
        showTradeMarkers: true,
        showSessionDividers: true,
        showGhostBoxes: true,
        secondaryOpacity: 1.0,
      };

    case 'standard':
      return {
        level,
        showVolume: false,       // Hide volume bars to reduce density
        showGridText: true,
        showIndicatorLabels: false, // Simplify: no indicator value labels
        showTradeMarkers: true,
        showSessionDividers: true,
        showGhostBoxes: false,   // Ghost boxes too dense at this zoom
        secondaryOpacity: 0.7,
      };

    case 'minimal':
      return {
        level,
        showVolume: false,
        showGridText: false,     // No grid text — only grid lines
        showIndicatorLabels: false,
        showTradeMarkers: false, // Trade markers overlap at extreme zoom-out
        showSessionDividers: false,
        showGhostBoxes: false,
        secondaryOpacity: 0.4,
      };
  }
}
