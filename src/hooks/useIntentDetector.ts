// ═══════════════════════════════════════════════════════════════════
// charEdge — Intent Detection Engine (G1.1)
//
// Heuristic intent engine classifying user behavior into 4 modes:
//   Drawing / Scalping / Analysis / Trading
// ═══════════════════════════════════════════════════════════════════

export type IntentMode = 'drawing' | 'scalping' | 'analysis' | 'trading';

export interface IntentState {
  mode: IntentMode;
  confidence: number; // 0-1
  signals: Record<string, number>;
  lastChanged: number;
}

interface IntentSignals {
  /** Active drawing tool selected */
  hasDrawingTool: boolean;
  /** Number of anchor clicks in last 10s */
  anchorClicks: number;
  /** Number of timeframe switches in last 30s */
  tfSwitches: number;
  /** Current zoom level (bars visible) */
  visibleBars: number;
  /** Number of indicators added in last 60s */
  indicatorsAdded: number;
  /** Scroll speed (px/sec average over last 5s) */
  scrollSpeed: number;
  /** Order entry panel visible */
  orderEntryVisible: boolean;
  /** Active position open */
  hasOpenPosition: boolean;
}

const DECAY_RATE = 0.95; // Signal decay per second
const CONFIDENCE_THRESHOLD = 0.4;

/**
 * Detect user intent from behavioral signals.
 */
export function detectIntent(signals: IntentSignals): IntentState {
  const scores: Record<IntentMode, number> = {
    drawing: 0,
    scalping: 0,
    analysis: 0,
    trading: 0,
  };

  // Drawing intent
  if (signals.hasDrawingTool) scores.drawing += 0.5;
  scores.drawing += Math.min(0.3, signals.anchorClicks * 0.1);

  // Scalping intent
  scores.scalping += Math.min(0.4, signals.tfSwitches * 0.1);
  if (signals.visibleBars < 50) scores.scalping += 0.2;
  if (signals.scrollSpeed > 200) scores.scalping += 0.1;

  // Analysis intent
  scores.analysis += Math.min(0.3, signals.indicatorsAdded * 0.1);
  if (signals.scrollSpeed < 30 && signals.visibleBars > 100) scores.analysis += 0.2;
  if (signals.visibleBars > 200) scores.analysis += 0.15;

  // Trading intent
  if (signals.orderEntryVisible) scores.trading += 0.4;
  if (signals.hasOpenPosition) scores.trading += 0.3;

  // Normalize and find winner
  const total = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
  const normalized: Record<string, number> = {};
  let maxMode: IntentMode = 'analysis';
  let maxScore = 0;

  for (const [mode, score] of Object.entries(scores)) {
    const n = score / total;
    normalized[mode] = n;
    if (n > maxScore) {
      maxScore = n;
      maxMode = mode as IntentMode;
    }
  }

  return {
    mode: maxScore >= CONFIDENCE_THRESHOLD ? maxMode : 'analysis',
    confidence: maxScore,
    signals: normalized,
    lastChanged: Date.now(),
  };
}

export default detectIntent;
