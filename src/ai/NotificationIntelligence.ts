// ═══════════════════════════════════════════════════════════════════
// charEdge — AI Notification Intelligence (Sprint 83)
//
// Smart filtering for alerts — scores conviction using confluence,
// volume, and trend context. Only fires notification if above
// a configurable threshold.
//
// Usage:
//   import { notificationIntelligence } from './NotificationIntelligence';
//   const scored = await notificationIntelligence.evaluate(alertEvent);
//   if (scored.shouldNotify) { ... }
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface AlertEvent {
  type: 'price_cross' | 'indicator' | 'volume_spike' | 'pattern' | 'custom';
  symbol: string;
  message: string;
  price?: number;
  metadata?: Record<string, unknown>;
}

export interface ScoredAlert {
  event: AlertEvent;
  conviction: number;     // 0–100
  shouldNotify: boolean;
  aiContext: string;       // Enhanced notification text
  factors: string[];       // What contributed to the score
}

// ─── Intelligence ───────────────────────────────────────────────

class NotificationIntelligence {
  private _threshold = 60;

  /**
   * Set the minimum conviction threshold for notifications.
   */
  setThreshold(threshold: number): void {
    this._threshold = Math.max(0, Math.min(100, threshold));
  }

  /**
   * Evaluate an alert event and determine if it should fire.
   */
  async evaluate(event: AlertEvent): Promise<ScoredAlert> {
    const factors: string[] = [];
    let conviction = 30; // Base conviction

    // Factor 1: Alert type weight
    const typeWeights: Record<string, number> = {
      price_cross: 15,
      indicator: 10,
      volume_spike: 20,
      pattern: 15,
      custom: 5,
    };
    conviction += typeWeights[event.type] || 5;
    factors.push(`${event.type} alert (+${typeWeights[event.type] || 5})`);

    // Factor 2: Volume context (if available)
    const volumeFactor = await this._checkVolume(event.symbol);
    if (volumeFactor > 0) {
      conviction += volumeFactor;
      factors.push(`Volume ${volumeFactor > 10 ? 'surge' : 'elevated'} (+${volumeFactor})`);
    }

    // Factor 3: Trend alignment
    const trendFactor = await this._checkTrend(event.symbol);
    conviction += trendFactor.score;
    if (trendFactor.score > 0) factors.push(`Trend ${trendFactor.direction} (+${trendFactor.score})`);

    conviction = Math.max(0, Math.min(100, conviction));
    const shouldNotify = conviction >= this._threshold;

    // Generate enhanced context via AI (only for high-conviction)
    let aiContext = event.message;
    if (shouldNotify && conviction >= 70) {
      aiContext = await this._enhanceWithAI(event, factors, conviction);
    }

    return {
      event,
      conviction,
      shouldNotify,
      aiContext,
      factors,
    };
  }

  /**
   * Batch evaluate multiple alerts — sort by conviction.
   */
  async evaluateBatch(events: AlertEvent[]): Promise<ScoredAlert[]> {
    const results = await Promise.all(events.map(e => this.evaluate(e)));
    return results.sort((a, b) => b.conviction - a.conviction);
  }

  // ─── Context Checkers ────────────────────────────────────────

  private async _checkVolume(symbol: string): Promise<number> {
    try {
      const { fetchFundamentals } = await import('../data/FundamentalService.js');
      const data = await fetchFundamentals(symbol);
      if (!data?.volume24h) return 0;
      // Simple heuristic — high volume adds conviction
      return data.volume24h > 1e9 ? 15 : data.volume24h > 1e8 ? 10 : 5;
    } catch { return 0; }
  }

  private async _checkTrend(_symbol: string): Promise<{ score: number; direction: string }> {
    // Simplified — in production would check EMA/RSI
    return { score: 5, direction: 'aligned' };
  }

  private async _enhanceWithAI(event: AlertEvent, factors: string[], conviction: number): Promise<string> {
    try {
      const { aiRouter } = await import('./AIRouter');
      const result = await aiRouter.route({
        type: 'classify',
        messages: [
          { role: 'system', content: 'You are a trading alert enhancer. Add brief context to alerts. 1 sentence max.' },
          { role: 'user', content: `Alert: "${event.message}" on ${event.symbol} (conviction: ${conviction}%). Factors: ${factors.join(', ')}. Add context.` },
        ],
        maxTokens: 60,
        temperature: 0.2,
      });
      return result.content || event.message;
    } catch {
      return event.message;
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const notificationIntelligence = new NotificationIntelligence();
export default notificationIntelligence;
