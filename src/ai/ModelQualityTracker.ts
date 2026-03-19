// ═══════════════════════════════════════════════════════════════════
// charEdge — Model Quality Tracker (Sprint 27)
//
// Tracks inference quality heuristics across interactions.
// Suggests model upgrade when quality metrics indicate the current
// model is insufficient.
//
// Usage:
//   import { modelQualityTracker } from './ModelQualityTracker';
//   modelQualityTracker.recordInteraction(response, latencyMs, modelTier);
//   if (modelQualityTracker.shouldSuggestUpgrade()) { ... }
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export interface QualityMetrics {
  interactionCount: number;
  totalResponseChars: number;
  shortResponseCount: number;    // responses < 50 chars
  totalLatencyMs: number;
  currentModelTier: string;
  lastChecked: number;
}

export interface QualitySummary {
  interactionCount: number;
  avgResponseLength: number;
  shortResponseRate: number;
  avgLatencyMs: number;
  currentModelTier: string;
  suggestUpgrade: boolean;
  upgradeReason: string | null;
}

const STORAGE_KEY = 'charEdge-model-quality';
const SHORT_RESPONSE_THRESHOLD = 50;
const MIN_INTERACTIONS_FOR_SUGGESTION = 10;
const SHORT_RATE_THRESHOLD = 0.3; // 30%

// ─── Tracker ────────────────────────────────────────────────────

export class ModelQualityTracker {
  private _metrics: QualityMetrics;

  constructor() {
    this._metrics = this._load();
  }

  /**
   * Record a completed AI interaction.
   */
  recordInteraction(response: string, latencyMs: number, modelTier = 'small'): void {
    this._metrics.interactionCount++;
    this._metrics.totalResponseChars += response.length;
    this._metrics.totalLatencyMs += latencyMs;
    this._metrics.currentModelTier = modelTier;

    if (response.length < SHORT_RESPONSE_THRESHOLD) {
      this._metrics.shortResponseCount++;
    }

    this._metrics.lastChecked = Date.now();
    this._save();
  }

  /**
   * Whether the tracker recommends upgrading to a larger model.
   */
  shouldSuggestUpgrade(): boolean {
    const summary = this.getSummary();
    return summary.suggestUpgrade;
  }

  /**
   * Get a full quality summary with upgrade recommendation.
   */
  getSummary(): QualitySummary {
    const m = this._metrics;
    const avgLen = m.interactionCount > 0 ? m.totalResponseChars / m.interactionCount : 0;
    const shortRate = m.interactionCount > 0 ? m.shortResponseCount / m.interactionCount : 0;
    const avgLatency = m.interactionCount > 0 ? m.totalLatencyMs / m.interactionCount : 0;

    let suggestUpgrade = false;
    let upgradeReason: string | null = null;

    // Only suggest upgrade from 'small' model after enough interactions
    if (
      m.currentModelTier === 'small' &&
      m.interactionCount >= MIN_INTERACTIONS_FOR_SUGGESTION &&
      shortRate > SHORT_RATE_THRESHOLD
    ) {
      suggestUpgrade = true;
      upgradeReason = `${Math.round(shortRate * 100)}% of your responses are very short — a larger model like Qwen 2.5 (1.1GB) would give richer, more detailed analysis.`;
    }

    return {
      interactionCount: m.interactionCount,
      avgResponseLength: Math.round(avgLen),
      shortResponseRate: Math.round(shortRate * 100) / 100,
      avgLatencyMs: Math.round(avgLatency),
      currentModelTier: m.currentModelTier,
      suggestUpgrade,
      upgradeReason,
    };
  }

  /**
   * Reset all tracked metrics.
   */
  reset(): void {
    this._metrics = this._defaults();
    this._save();
  }

  // ── Persistence ────────────────────────────────────────────

  private _load(): QualityMetrics {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return this._defaults();
  }

  private _save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._metrics));
    } catch { /* storage full or unavailable */ }
  }

  private _defaults(): QualityMetrics {
    return {
      interactionCount: 0,
      totalResponseChars: 0,
      shortResponseCount: 0,
      totalLatencyMs: 0,
      currentModelTier: 'small',
      lastChecked: 0,
    };
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const modelQualityTracker = new ModelQualityTracker();
export default modelQualityTracker;
