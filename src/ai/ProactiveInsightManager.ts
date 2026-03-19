// ═══════════════════════════════════════════════════════════════════
// charEdge — Proactive Insight Manager (AI Copilot Sprint 20)
//
// Monitors chart events and queues significant AI insights.
// Only alerts on truly noteworthy events (regime shifts, anomalies,
// divergences). Subtle badge notification — never pop-ups/overlays.
//
// Usage:
//   import { proactiveInsightManager } from './ProactiveInsightManager';
//   proactiveInsightManager.onChartEvent({ type: 'regime_change', ... });
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export type InsightPriority = 'low' | 'medium' | 'high';

export type InsightType =
  | 'regime_shift'
  | 'volume_anomaly'
  | 'pattern_detected'
  | 'confluence_change'
  | 'sentiment_shift'
  | 'scanner_opportunity'
  | 'risk_warning';

export interface ProactiveInsight {
  id: string;
  type: InsightType;
  priority: InsightPriority;
  symbol: string;
  title: string;
  description: string;
  timestamp: number;
  dismissed: boolean;
  data?: Record<string, unknown>;
}

export interface ChartEvent {
  type: string;
  symbol: string;
  data: Record<string, unknown>;
}

type InsightCallback = (insight: ProactiveInsight) => void;

// ─── Significance Thresholds ────────────────────────────────────

const THRESHOLDS = {
  volumeZScore: 3.0,       // Only flag extreme volume
  confluenceChange: 30,    // Score change > 30 points
  sentimentShift: 20,      // Fear/Greed change > 20 points
  patternConfidence: 60,   // Only show high-confidence patterns
  scannerScore: 70,        // Only show top opportunities
};

// ─── Manager ────────────────────────────────────────────────────

export class ProactiveInsightManager {
  private _queue: ProactiveInsight[] = [];
  private _listeners = new Set<InsightCallback>();
  private _maxQueue = 20;
  private _enabled = true;

  /**
   * Process a chart event and optionally queue an insight.
   */
  onChartEvent(event: ChartEvent): ProactiveInsight | null {
    if (!this._enabled) return null;

    const insight = this._evaluateEvent(event);
    if (insight) {
      this._queueInsight(insight);
      return insight;
    }
    return null;
  }

  /**
   * Get all pending (non-dismissed) insights.
   */
  getQueuedInsights(): ProactiveInsight[] {
    return this._queue.filter(i => !i.dismissed);
  }

  /**
   * Get insight count (badge number).
   */
  getPendingCount(): number {
    return this._queue.filter(i => !i.dismissed).length;
  }

  /**
   * Dismiss an insight.
   */
  dismissInsight(id: string): void {
    const insight = this._queue.find(i => i.id === id);
    if (insight) insight.dismissed = true;
  }

  /**
   * Dismiss all insights.
   */
  dismissAll(): void {
    for (const i of this._queue) i.dismissed = true;
  }

  /**
   * Subscribe to new insights.
   */
  onInsight(cb: InsightCallback): () => void {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  /**
   * Enable/disable proactive insights.
   */
  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
  }

  get isEnabled(): boolean {
    return this._enabled;
  }

  /**
   * Get insights formatted for AI context.
   */
  getInsightsForAI(): string {
    const pending = this.getQueuedInsights();
    if (pending.length === 0) return '';

    const lines = pending.slice(0, 3).map(i =>
      `${i.priority.toUpperCase()}: ${i.title} — ${i.description}`
    );
    return `--- Proactive Insights ---\n${lines.join('\n')}`;
  }

  // ── Event Evaluation ────────────────────────────────────────

  private _evaluateEvent(event: ChartEvent): ProactiveInsight | null {
    switch (event.type) {
      case 'regime_change':
        return this._createInsight('regime_shift', 'high', event.symbol,
          `Regime shift on ${event.symbol}`,
          `Market regime changed to ${event.data.newRegime || 'unknown'}`,
          event.data);

      case 'volume_anomaly': {
        const zScore = Number(event.data.zScore) || 0;
        if (zScore < THRESHOLDS.volumeZScore) return null;
        return this._createInsight('volume_anomaly', zScore > 4 ? 'high' : 'medium', event.symbol,
          `Volume spike on ${event.symbol}`,
          `${zScore.toFixed(1)}σ above average — possible institutional activity`,
          event.data);
      }

      case 'pattern_detected': {
        const confidence = Number(event.data.confidence) || 0;
        if (confidence < THRESHOLDS.patternConfidence) return null;
        return this._createInsight('pattern_detected', 'medium', event.symbol,
          `${event.data.pattern || 'Pattern'} on ${event.symbol}`,
          `${confidence}% confidence ${event.data.direction || ''} pattern`,
          event.data);
      }

      case 'confluence_change': {
        const change = Number(event.data.change) || 0;
        if (Math.abs(change) < THRESHOLDS.confluenceChange) return null;
        return this._createInsight('confluence_change', 'medium', event.symbol,
          `Confluence shift on ${event.symbol}`,
          `MTF agreement ${change > 0 ? 'improved' : 'deteriorated'} by ${Math.abs(change)} points`,
          event.data);
      }

      case 'sentiment_shift': {
        const change = Number(event.data.change) || 0;
        if (Math.abs(change) < THRESHOLDS.sentimentShift) return null;
        return this._createInsight('sentiment_shift', 'low', event.symbol,
          'Market sentiment shift',
          `Fear & Greed moved ${change} points`,
          event.data);
      }

      case 'scanner_opportunity': {
        const score = Number(event.data.score) || 0;
        if (score < THRESHOLDS.scannerScore) return null;
        return this._createInsight('scanner_opportunity', 'medium', event.symbol,
          `Opportunity: ${event.symbol}`,
          `Scanner score ${score}/100 — ${event.data.summary || 'potential setup'}`,
          event.data);
      }

      default:
        return null;
    }
  }

  // ── Helpers ─────────────────────────────────────────────────

  private _createInsight(
    type: InsightType, priority: InsightPriority,
    symbol: string, title: string, description: string,
    data?: Record<string, unknown>,
  ): ProactiveInsight {
    return {
      id: `insight_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type, priority, symbol, title, description,
      timestamp: Date.now(),
      dismissed: false,
      data,
    };
  }

  private _queueInsight(insight: ProactiveInsight): void {
    // Deduplicate: don't add if same type + symbol in last 5 minutes
    const fiveMin = 5 * 60 * 1000;
    const duplicate = this._queue.find(i =>
      i.type === insight.type &&
      i.symbol === insight.symbol &&
      !i.dismissed &&
      (Date.now() - i.timestamp) < fiveMin
    );
    if (duplicate) return;

    this._queue.push(insight);
    if (this._queue.length > this._maxQueue) {
      this._queue = this._queue.slice(-this._maxQueue);
    }

    for (const cb of this._listeners) {
      try { cb(insight); } catch { /* ignore */ }
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const proactiveInsightManager = new ProactiveInsightManager();
export default proactiveInsightManager;
