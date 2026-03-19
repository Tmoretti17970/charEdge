// ═══════════════════════════════════════════════════════════════════
// charEdge — Multi-Symbol Scanner Engine (AI Copilot Sprint 6)
//
// Background scanner: runs FeatureExtractor + LocalInsightEngine on
// each watchlist symbol, ranks by opportunity quality, surfaces
// top N as AI panel notification cards.
//
// Usage:
//   import { scannerEngine } from './ScannerEngine';
//   const results = await scannerEngine.scan(symbols, getBarsFn);
//   const top3 = scannerEngine.getTopN(3);
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

export interface ScanSignal {
  type: string;
  description: string;
  strength: number; // 0-100
}

export interface ScanResult {
  symbol: string;
  score: number;            // 0-100 composite opportunity score
  regime: string;           // market regime label
  direction: 'bullish' | 'bearish' | 'neutral';
  topSignals: ScanSignal[];
  momentum: number;         // -100 to 100
  volumeScore: number;      // 0-100
  volatility: number;       // normalized 0-100
  summary: string;
  scannedAt: number;
}

export interface ScanProgress {
  completed: number;
  total: number;
  currentSymbol: string;
}

type GetBarsFn = (symbol: string) => Promise<Bar[]> | Bar[];
type ProgressCallback = (progress: ScanProgress) => void;

// ─── Scanner ────────────────────────────────────────────────────

export class ScannerEngine {
  private _results: ScanResult[] = [];
  private _lastScanTime = 0;
  private _scanning = false;

  /**
   * Scan multiple symbols and rank by opportunity quality.
   */
  async scan(
    symbols: string[],
    getBarsFn: GetBarsFn,
    onProgress?: ProgressCallback,
  ): Promise<ScanResult[]> {
    if (this._scanning) return this._results;
    this._scanning = true;
    this._results = [];

    try {
      for (let i = 0; i < symbols.length; i++) {
        const symbol = symbols[i];
        onProgress?.({ completed: i, total: symbols.length, currentSymbol: symbol });

        try {
          const bars = await getBarsFn(symbol);
          if (!bars || bars.length < 20) continue;

          const result = this._analyzeSymbol(symbol, bars);
          this._results.push(result);
        } catch {
          // Skip symbols that fail to load
        }
      }

      // Sort by score descending
      this._results.sort((a, b) => b.score - a.score);
      this._lastScanTime = Date.now();

      onProgress?.({ completed: symbols.length, total: symbols.length, currentSymbol: '' });
    } finally {
      this._scanning = false;
    }

    return this._results;
  }

  /**
   * Get top N ranked opportunities.
   */
  getTopN(n = 3): ScanResult[] {
    return this._results.slice(0, n);
  }

  /**
   * Get all results from last scan.
   */
  getLastScanResults(): ScanResult[] {
    return [...this._results];
  }

  /**
   * Check if a scan is in progress.
   */
  get isScanning(): boolean {
    return this._scanning;
  }

  /**
   * Time of last completed scan.
   */
  get lastScanTime(): number {
    return this._lastScanTime;
  }

  /**
   * Get formatted summary for AI context.
   */
  getScanSummaryForAI(): string {
    if (this._results.length === 0) return '';

    const top = this.getTopN(5);
    const lines = top.map((r, i) =>
      `${i + 1}. ${r.symbol} — ${r.regime} (${r.score}/100): ${r.summary}`
    );
    return `--- Scanner Results ---\n${lines.join('\n')}`;
  }

  // ── Single Symbol Analysis ──────────────────────────────────

  private _analyzeSymbol(symbol: string, bars: Bar[]): ScanResult {
    const n = bars.length;
    const recent = bars.slice(-50);
    const closes = recent.map(b => b.close);
    const volumes = recent.map(b => b.volume);

    // ── Momentum ──────────────────────────────────────────────
    const ema8 = this._ema(closes, 8);
    const ema21 = this._ema(closes, 21);
    const lastEma8 = ema8[ema8.length - 1];
    const lastEma21 = ema21[ema21.length - 1];
    const emaSpread = ((lastEma8 - lastEma21) / lastEma21) * 100;

    const rsi = this._rsi(closes, 14);
    const momentumScore = this._calcMomentum(emaSpread, rsi);

    // ── Volume ────────────────────────────────────────────────
    const avgVol = volumes.slice(-20).reduce((s, v) => s + v, 0) / 20;
    const recentVol = volumes.slice(-3).reduce((s, v) => s + v, 0) / 3;
    const relativeVolume = avgVol > 0 ? recentVol / avgVol : 1;
    const volumeScore = Math.min(100, Math.round(relativeVolume * 50));

    // ── Volatility ────────────────────────────────────────────
    const atr = this._atr(recent, 14);
    const avgClose = closes.reduce((s, c) => s + c, 0) / closes.length;
    const atrPct = avgClose > 0 ? (atr / avgClose) * 100 : 0;
    const volatility = Math.min(100, Math.round(atrPct * 20));

    // ── Regime Classification ─────────────────────────────────
    const regime = this._classifyRegime(emaSpread, rsi, relativeVolume);

    // ── Direction ─────────────────────────────────────────────
    const direction: 'bullish' | 'bearish' | 'neutral' =
      emaSpread > 0.2 && rsi > 45 ? 'bullish' :
      emaSpread < -0.2 && rsi < 55 ? 'bearish' : 'neutral';

    // ── Signals ───────────────────────────────────────────────
    const signals = this._detectSignals(closes, volumes, rsi, emaSpread, relativeVolume);

    // ── Composite Score ───────────────────────────────────────
    // Weight: momentum 40%, volume 25%, signal strength 25%, volatility 10%
    const signalAvg = signals.length > 0
      ? signals.reduce((s, sig) => s + sig.strength, 0) / signals.length
      : 0;
    const score = Math.round(
      Math.abs(momentumScore) * 0.4 +
      volumeScore * 0.25 +
      signalAvg * 0.25 +
      volatility * 0.10
    );

    // ── Summary ───────────────────────────────────────────────
    const topSig = signals[0]?.description || 'No strong signals';
    const summary = `${regime} | RSI ${rsi.toFixed(0)} | Vol ${relativeVolume.toFixed(1)}x | ${topSig}`;

    return {
      symbol,
      score: Math.min(100, score),
      regime,
      direction,
      topSignals: signals.slice(0, 3),
      momentum: Math.round(momentumScore),
      volumeScore,
      volatility,
      summary,
      scannedAt: Date.now(),
    };
  }

  // ── Signal Detection ────────────────────────────────────────

  private _detectSignals(
    closes: number[], volumes: number[],
    rsi: number, emaSpread: number, relVol: number,
  ): ScanSignal[] {
    const signals: ScanSignal[] = [];

    // RSI extremes
    if (rsi > 70) {
      signals.push({ type: 'rsi_overbought', description: `RSI overbought at ${rsi.toFixed(0)}`, strength: Math.min(90, rsi) });
    } else if (rsi < 30) {
      signals.push({ type: 'rsi_oversold', description: `RSI oversold at ${rsi.toFixed(0)}`, strength: Math.min(90, 100 - rsi) });
    }

    // Volume spike
    if (relVol > 2.0) {
      signals.push({ type: 'volume_spike', description: `Volume ${relVol.toFixed(1)}x average`, strength: Math.min(95, relVol * 30) });
    }

    // Strong trend
    if (Math.abs(emaSpread) > 1.0) {
      const dir = emaSpread > 0 ? 'bullish' : 'bearish';
      signals.push({ type: 'strong_trend', description: `Strong ${dir} trend (EMA spread ${emaSpread.toFixed(2)}%)`, strength: Math.min(85, Math.abs(emaSpread) * 30) });
    }

    // Price at extremes (Bollinger-like)
    const n = closes.length;
    if (n >= 20) {
      const mean = closes.slice(-20).reduce((s, c) => s + c, 0) / 20;
      const std = Math.sqrt(closes.slice(-20).reduce((s, c) => s + (c - mean) ** 2, 0) / 20);
      const lastClose = closes[n - 1];
      const zScore = std > 0 ? (lastClose - mean) / std : 0;

      if (Math.abs(zScore) > 2) {
        const side = zScore > 0 ? 'upper' : 'lower';
        signals.push({ type: 'bb_extreme', description: `Price at ${side} Bollinger band (${zScore.toFixed(1)}σ)`, strength: Math.min(80, Math.abs(zScore) * 30) });
      }
    }

    // Breakout detection (new 5-bar high/low on volume)
    if (n >= 20) {
      const last5High = Math.max(...closes.slice(-5));
      const prev15High = Math.max(...closes.slice(-20, -5));
      const last5Low = Math.min(...closes.slice(-5));
      const prev15Low = Math.min(...closes.slice(-20, -5));

      if (last5High > prev15High && relVol > 1.3) {
        signals.push({ type: 'breakout_high', description: 'Breakout above recent highs on volume', strength: 75 });
      }
      if (last5Low < prev15Low && relVol > 1.3) {
        signals.push({ type: 'breakdown_low', description: 'Breakdown below recent lows on volume', strength: 75 });
      }
    }

    return signals.sort((a, b) => b.strength - a.strength);
  }

  // ── Regime Classification ───────────────────────────────────

  private _classifyRegime(emaSpread: number, rsi: number, relVol: number): string {
    if (emaSpread > 1.0 && rsi > 60) return 'Strong Uptrend';
    if (emaSpread > 0.2 && rsi > 45) return 'Mild Uptrend';
    if (emaSpread < -1.0 && rsi < 40) return 'Strong Downtrend';
    if (emaSpread < -0.2 && rsi < 55) return 'Mild Downtrend';
    if (Math.abs(emaSpread) > 0.8 && relVol > 2) return 'Breakout';
    if (Math.abs(emaSpread) < 0.15) return 'Consolidation';
    return 'Choppy';
  }

  // ── Indicators ──────────────────────────────────────────────

  private _calcMomentum(emaSpread: number, rsi: number): number {
    // -100 to 100
    const emaPart = Math.max(-50, Math.min(50, emaSpread * 15));
    const rsiPart = ((rsi - 50) / 50) * 50;
    return Math.max(-100, Math.min(100, emaPart + rsiPart));
  }

  private _ema(data: number[], period: number): number[] {
    const result: number[] = [data[0]];
    const k = 2 / (period + 1);
    for (let i = 1; i < data.length; i++) {
      result[i] = data[i] * k + result[i - 1] * (1 - k);
    }
    return result;
  }

  private _rsi(data: number[], period: number): number {
    if (data.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = data.length - period; i < data.length; i++) {
      const change = data[i] - data[i - 1];
      if (change > 0) gains += change; else losses -= change;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    return 100 - 100 / (1 + avgGain / avgLoss);
  }

  private _atr(bars: Bar[], period: number): number {
    if (bars.length < period + 1) return 0;
    let sum = 0;
    for (let i = bars.length - period; i < bars.length; i++) {
      const tr = Math.max(
        bars[i].high - bars[i].low,
        Math.abs(bars[i].high - bars[i - 1].close),
        Math.abs(bars[i].low - bars[i - 1].close),
      );
      sum += tr;
    }
    return sum / period;
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const scannerEngine = new ScannerEngine();
export default scannerEngine;
