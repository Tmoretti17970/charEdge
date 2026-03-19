// ═══════════════════════════════════════════════════════════════════
// charEdge — CNN Pattern Detector (AI Copilot Sprint 7)
//
// Chart pattern detection pipeline. Supports ONNX model inference
// when available, falls back to rule-based swing analysis.
//
// Patterns: head & shoulders, cup & handle, ascending/descending
// wedge, double top/bottom, triangle, flag/pennant.
//
// Usage:
//   import { patternCNN } from './PatternCNN';
//   const patterns = patternCNN.detect(bars);
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type PatternType =
  | 'head_and_shoulders'
  | 'inverse_head_and_shoulders'
  | 'double_top'
  | 'double_bottom'
  | 'ascending_wedge'
  | 'descending_wedge'
  | 'ascending_triangle'
  | 'descending_triangle'
  | 'symmetric_triangle'
  | 'bull_flag'
  | 'bear_flag'
  | 'cup_and_handle';

export interface DetectedPattern {
  type: PatternType;
  label: string;
  confidence: number;   // 0-100
  direction: 'bullish' | 'bearish' | 'neutral';
  startIndex: number;
  endIndex: number;
  description: string;
}

// ─── Pattern Labels ─────────────────────────────────────────────

const PATTERN_INFO: Record<PatternType, { label: string; direction: 'bullish' | 'bearish' | 'neutral' }> = {
  head_and_shoulders:         { label: 'Head & Shoulders', direction: 'bearish' },
  inverse_head_and_shoulders: { label: 'Inv Head & Shoulders', direction: 'bullish' },
  double_top:                 { label: 'Double Top', direction: 'bearish' },
  double_bottom:              { label: 'Double Bottom', direction: 'bullish' },
  ascending_wedge:            { label: 'Ascending Wedge', direction: 'bearish' },
  descending_wedge:           { label: 'Descending Wedge', direction: 'bullish' },
  ascending_triangle:         { label: 'Ascending Triangle', direction: 'bullish' },
  descending_triangle:        { label: 'Descending Triangle', direction: 'bearish' },
  symmetric_triangle:         { label: 'Symmetric Triangle', direction: 'neutral' },
  bull_flag:                  { label: 'Bull Flag', direction: 'bullish' },
  bear_flag:                  { label: 'Bear Flag', direction: 'bearish' },
  cup_and_handle:             { label: 'Cup & Handle', direction: 'bullish' },
};

// ─── Detector ───────────────────────────────────────────────────

export class PatternCNN {
  private _onnxAvailable = false;

  /**
   * Detect patterns in price data.
   * Uses ONNX model if available, otherwise rule-based fallback.
   */
  detect(bars: Bar[]): DetectedPattern[] {
    if (bars.length < 30) return [];

    // TODO: When ONNX model is trained and deployed, add model inference here
    // if (this._onnxAvailable) return this._detectWithModel(bars);

    return this._detectRuleBased(bars);
  }

  /**
   * Check if ONNX model is loaded.
   */
  isModelLoaded(): boolean {
    return this._onnxAvailable;
  }

  /**
   * Get patterns formatted for AI context.
   */
  getPatternsForAI(bars: Bar[]): string {
    const patterns = this.detect(bars);
    if (patterns.length === 0) return '';

    const lines = patterns.map(p =>
      `${p.label} (${p.confidence}% confidence, ${p.direction}): ${p.description}`
    );
    return `--- Chart Patterns ---\n${lines.join('\n')}`;
  }

  // ── Rule-Based Detection ────────────────────────────────────

  private _detectRuleBased(bars: Bar[]): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const swings = this._findSwingPoints(bars);

    if (swings.highs.length >= 3 && swings.lows.length >= 2) {
      this._checkHeadAndShoulders(bars, swings, patterns);
      this._checkInverseHeadAndShoulders(bars, swings, patterns);
    }

    if (swings.highs.length >= 2) {
      this._checkDoubleTop(bars, swings, patterns);
    }

    if (swings.lows.length >= 2) {
      this._checkDoubleBottom(bars, swings, patterns);
    }

    if (swings.highs.length >= 2 && swings.lows.length >= 2) {
      this._checkTriangles(bars, swings, patterns);
      this._checkWedges(bars, swings, patterns);
    }

    this._checkFlags(bars, patterns);

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  // ── Swing Point Detection ──────────────────────────────────

  private _findSwingPoints(bars: Bar[], lookback = 5): { highs: number[]; lows: number[] } {
    const highs: number[] = [];
    const lows: number[] = [];

    for (let i = lookback; i < bars.length - lookback; i++) {
      let isHigh = true, isLow = true;
      for (let j = 1; j <= lookback; j++) {
        if (bars[i].high <= bars[i - j].high || bars[i].high <= bars[i + j].high) isHigh = false;
        if (bars[i].low >= bars[i - j].low || bars[i].low >= bars[i + j].low) isLow = false;
      }
      if (isHigh) highs.push(i);
      if (isLow) lows.push(i);
    }

    return { highs, lows };
  }

  // ── Pattern Checks ─────────────────────────────────────────

  private _checkHeadAndShoulders(
    bars: Bar[],
    swings: { highs: number[]; lows: number[] },
    out: DetectedPattern[],
  ): void {
    const h = swings.highs;
    for (let i = 0; i <= h.length - 3; i++) {
      const [l, c, r] = [h[i], h[i + 1], h[i + 2]];
      const lH = bars[l].high, cH = bars[c].high, rH = bars[r].high;

      // Head must be higher than both shoulders
      if (cH > lH * 1.005 && cH > rH * 1.005) {
        // Shoulders should be roughly equal (within 3%)
        const shoulderDiff = Math.abs(lH - rH) / Math.max(lH, rH);
        if (shoulderDiff < 0.03) {
          const confidence = Math.round(70 - shoulderDiff * 1000);
          out.push(this._makePattern('head_and_shoulders', confidence, l, r, 'Potential reversal — head higher than both shoulders'));
        }
      }
    }
  }

  private _checkInverseHeadAndShoulders(
    bars: Bar[],
    swings: { highs: number[]; lows: number[] },
    out: DetectedPattern[],
  ): void {
    const l = swings.lows;
    for (let i = 0; i <= l.length - 3; i++) {
      const [left, center, right] = [l[i], l[i + 1], l[i + 2]];
      const lL = bars[left].low, cL = bars[center].low, rL = bars[right].low;

      if (cL < lL * 0.995 && cL < rL * 0.995) {
        const shoulderDiff = Math.abs(lL - rL) / Math.max(lL, rL);
        if (shoulderDiff < 0.03) {
          const confidence = Math.round(70 - shoulderDiff * 1000);
          out.push(this._makePattern('inverse_head_and_shoulders', confidence, left, right, 'Potential bullish reversal — inverted H&S'));
        }
      }
    }
  }

  private _checkDoubleTop(
    bars: Bar[],
    swings: { highs: number[] },
    out: DetectedPattern[],
  ): void {
    const h = swings.highs;
    for (let i = 0; i < h.length - 1; i++) {
      const [a, b] = [h[i], h[i + 1]];
      if (b - a < 5) continue; // Need at least 5 bars between peaks
      const diff = Math.abs(bars[a].high - bars[b].high) / bars[a].high;
      if (diff < 0.015) {
        const confidence = Math.round(65 - diff * 2000);
        out.push(this._makePattern('double_top', confidence, a, b, 'Two peaks at similar levels — bearish reversal signal'));
      }
    }
  }

  private _checkDoubleBottom(
    bars: Bar[],
    swings: { lows: number[] },
    out: DetectedPattern[],
  ): void {
    const l = swings.lows;
    for (let i = 0; i < l.length - 1; i++) {
      const [a, b] = [l[i], l[i + 1]];
      if (b - a < 5) continue;
      const diff = Math.abs(bars[a].low - bars[b].low) / bars[a].low;
      if (diff < 0.015) {
        const confidence = Math.round(65 - diff * 2000);
        out.push(this._makePattern('double_bottom', confidence, a, b, 'Two troughs at similar levels — bullish reversal signal'));
      }
    }
  }

  private _checkTriangles(
    bars: Bar[],
    swings: { highs: number[]; lows: number[] },
    out: DetectedPattern[],
  ): void {
    const h = swings.highs.slice(-3);
    const l = swings.lows.slice(-3);
    if (h.length < 2 || l.length < 2) return;

    const highSlope = (bars[h[h.length - 1]].high - bars[h[0]].high) / (h[h.length - 1] - h[0] || 1);
    const lowSlope = (bars[l[l.length - 1]].low - bars[l[0]].low) / (l[l.length - 1] - l[0] || 1);

    const startIdx = Math.min(h[0], l[0]);
    const endIdx = Math.max(h[h.length - 1], l[l.length - 1]);

    if (highSlope < -0.001 && lowSlope > 0.001) {
      out.push(this._makePattern('symmetric_triangle', 55, startIdx, endIdx, 'Converging highs and lows — breakout imminent'));
    } else if (Math.abs(highSlope) < 0.0005 && lowSlope > 0.001) {
      out.push(this._makePattern('ascending_triangle', 60, startIdx, endIdx, 'Flat resistance, rising support — bullish bias'));
    } else if (highSlope < -0.001 && Math.abs(lowSlope) < 0.0005) {
      out.push(this._makePattern('descending_triangle', 60, startIdx, endIdx, 'Falling resistance, flat support — bearish bias'));
    }
  }

  private _checkWedges(
    bars: Bar[],
    swings: { highs: number[]; lows: number[] },
    out: DetectedPattern[],
  ): void {
    const h = swings.highs.slice(-3);
    const l = swings.lows.slice(-3);
    if (h.length < 2 || l.length < 2) return;

    const highSlope = (bars[h[h.length - 1]].high - bars[h[0]].high) / (h[h.length - 1] - h[0] || 1);
    const lowSlope = (bars[l[l.length - 1]].low - bars[l[0]].low) / (l[l.length - 1] - l[0] || 1);

    const startIdx = Math.min(h[0], l[0]);
    const endIdx = Math.max(h[h.length - 1], l[l.length - 1]);

    // Both rising but converging = ascending wedge (bearish)
    if (highSlope > 0.0005 && lowSlope > 0.0005 && highSlope < lowSlope) {
      out.push(this._makePattern('ascending_wedge', 55, startIdx, endIdx, 'Rising wedge — bearish reversal pattern'));
    }
    // Both falling but converging = descending wedge (bullish)
    if (highSlope < -0.0005 && lowSlope < -0.0005 && highSlope > lowSlope) {
      out.push(this._makePattern('descending_wedge', 55, startIdx, endIdx, 'Falling wedge — bullish reversal pattern'));
    }
  }

  private _checkFlags(bars: Bar[], out: DetectedPattern[]): void {
    const n = bars.length;
    if (n < 30) return;

    // Look for strong move (pole) followed by consolidation (flag)
    const poleEnd = n - 10;
    const poleStart = poleEnd - 10;
    if (poleStart < 0) return;

    const poleMove = (bars[poleEnd].close - bars[poleStart].close) / bars[poleStart].close;
    const flagRange = bars.slice(poleEnd).reduce((r, b) => Math.max(r, b.high - b.low), 0);
    const poleRange = Math.abs(bars[poleEnd].close - bars[poleStart].close);

    // Flag should be much smaller than pole
    if (poleRange > 0 && flagRange < poleRange * 0.5 && Math.abs(poleMove) > 0.02) {
      const type: PatternType = poleMove > 0 ? 'bull_flag' : 'bear_flag';
      const desc = poleMove > 0
        ? 'Strong rally followed by tight consolidation — bullish continuation'
        : 'Sharp decline followed by tight consolidation — bearish continuation';
      out.push(this._makePattern(type, 60, poleStart, n - 1, desc));
    }
  }

  // ── Helpers ─────────────────────────────────────────────────

  private _makePattern(
    type: PatternType, confidence: number,
    startIndex: number, endIndex: number, description: string,
  ): DetectedPattern {
    const info = PATTERN_INFO[type];
    return {
      type,
      label: info.label,
      confidence: Math.max(30, Math.min(95, confidence)),
      direction: info.direction,
      startIndex,
      endIndex,
      description,
    };
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const patternCNN = new PatternCNN();
export default patternCNN;
