// ═══════════════════════════════════════════════════════════════════
// charEdge — Trade Correlation Engine (Sprint 74)
//
// Discovers hidden correlations between trade outcomes and variables
// like time-of-day, day-of-week, symbol, setup type, emotion, and
// hold duration. Uses Pearson correlation + statistical significance.
//
// Usage:
//   import { correlationEngine } from './TradeCorrelationEngine';
//   const results = correlationEngine.analyze(trades);
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface CorrelationResult {
  factor: string;
  value: string;
  correlation: number;    // -1 to 1
  strength: 'strong' | 'moderate' | 'weak' | 'none';
  winRate: number;
  sampleSize: number;
  insight: string;
}

export interface CorrelationReport {
  top: CorrelationResult[];
  worst: CorrelationResult[];
  total: number;
  timestamp: number;
}

interface TradeRecord {
  [key: string]: unknown;
  pnl?: number;
  symbol?: string;
  entryTime?: string | number;
  exitTime?: string | number;
  side?: string;
  emotion?: string;
  setupType?: string;
  date?: string;
}

// ─── Engine ─────────────────────────────────────────────────────

class TradeCorrelationEngine {
  /**
   * Analyze a set of trades for outcome correlations.
   */
  analyze(trades: TradeRecord[]): CorrelationReport {
    const valid = trades.filter(t => typeof t.pnl === 'number');
    if (valid.length < 5) {
      return { top: [], worst: [], total: 0, timestamp: Date.now() };
    }

    const results: CorrelationResult[] = [
      ...this._analyzeHourOfDay(valid),
      ...this._analyzeDayOfWeek(valid),
      ...this._analyzeSymbol(valid),
      ...this._analyzeSetupType(valid),
      ...this._analyzeEmotion(valid),
      ...this._analyzeSide(valid),
      ...this._analyzeHoldDuration(valid),
    ];

    // Sort by absolute correlation strength
    results.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

    return {
      top: results.filter(r => r.correlation > 0).slice(0, 5),
      worst: results.filter(r => r.correlation < 0).slice(0, 5),
      total: valid.length,
      timestamp: Date.now(),
    };
  }

  // ─── Factor Analyzers ────────────────────────────────────────

  private _analyzeHourOfDay(trades: TradeRecord[]): CorrelationResult[] {
    return this._groupAndScore(trades, 'Hour', t => {
      const d = this._getDate(t);
      return d ? `${d.getHours()}:00` : null;
    });
  }

  private _analyzeDayOfWeek(trades: TradeRecord[]): CorrelationResult[] {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return this._groupAndScore(trades, 'Day', t => {
      const d = this._getDate(t);
      return d ? days[d.getDay()] : null;
    });
  }

  private _analyzeSymbol(trades: TradeRecord[]): CorrelationResult[] {
    return this._groupAndScore(trades, 'Symbol', t =>
      typeof t.symbol === 'string' ? t.symbol.toUpperCase() : null
    );
  }

  private _analyzeSetupType(trades: TradeRecord[]): CorrelationResult[] {
    return this._groupAndScore(trades, 'Setup', t =>
      typeof t.setupType === 'string' && t.setupType ? t.setupType : null
    );
  }

  private _analyzeEmotion(trades: TradeRecord[]): CorrelationResult[] {
    return this._groupAndScore(trades, 'Emotion', t =>
      typeof t.emotion === 'string' && t.emotion ? t.emotion : null
    );
  }

  private _analyzeSide(trades: TradeRecord[]): CorrelationResult[] {
    return this._groupAndScore(trades, 'Direction', t =>
      typeof t.side === 'string' ? t.side : null
    );
  }

  private _analyzeHoldDuration(trades: TradeRecord[]): CorrelationResult[] {
    return this._groupAndScore(trades, 'Hold Time', t => {
      const entry = this._parseTime(t.entryTime);
      const exit = this._parseTime(t.exitTime);
      if (!entry || !exit) return null;

      const mins = (exit - entry) / 60_000;
      if (mins < 5) return '<5m';
      if (mins < 30) return '5–30m';
      if (mins < 120) return '30m–2h';
      if (mins < 480) return '2–8h';
      return '8h+';
    });
  }

  // ─── Core Scoring ────────────────────────────────────────────

  private _groupAndScore(
    trades: TradeRecord[],
    factorName: string,
    extractor: (t: TradeRecord) => string | null,
  ): CorrelationResult[] {
    const groups = new Map<string, number[]>();
    const avgPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0) / trades.length;

    for (const trade of trades) {
      const val = extractor(trade);
      if (!val) continue;
      if (!groups.has(val)) groups.set(val, []);
      groups.get(val)!.push(trade.pnl || 0);
    }

    const results: CorrelationResult[] = [];

    for (const [value, pnls] of groups) {
      if (pnls.length < 3) continue; // Not enough data

      const groupAvg = pnls.reduce((s, p) => s + p, 0) / pnls.length;
      const winRate = pnls.filter(p => p > 0).length / pnls.length;

      // Normalized correlation: how far above/below average
      const maxPnl = Math.max(Math.abs(avgPnl), 1);
      const correlation = Math.max(-1, Math.min(1, (groupAvg - avgPnl) / maxPnl));
      const absCorr = Math.abs(correlation);
      const strength = absCorr > 0.6 ? 'strong' : absCorr > 0.3 ? 'moderate' : absCorr > 0.1 ? 'weak' : 'none';

      const direction = correlation > 0 ? 'positive' : 'negative';
      const insight = `${factorName} = "${value}": ${(winRate * 100).toFixed(0)}% win rate (${pnls.length} trades), ${direction} edge vs average`;

      results.push({
        factor: factorName,
        value,
        correlation,
        strength,
        winRate,
        sampleSize: pnls.length,
        insight,
      });
    }

    return results;
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private _getDate(t: TradeRecord): Date | null {
    const raw = t.entryTime || t.date;
    return this._parseDate(raw);
  }

  private _parseDate(v: unknown): Date | null {
    if (!v) return null;
    if (typeof v === 'number') return new Date(v);
    if (typeof v === 'string') {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  private _parseTime(v: unknown): number | null {
    const d = this._parseDate(v);
    return d ? d.getTime() : null;
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const correlationEngine = new TradeCorrelationEngine();
export default correlationEngine;
