// ═══════════════════════════════════════════════════════════════════
// charEdge — Volume Anomaly Detector (AI Copilot Sprint 8)
//
// Statistical volume analysis for institutional activity detection.
// Identifies accumulation/distribution patterns via OBV divergence,
// relative volume, and volume-weighted price clustering.
//
// Merges with existing AnomalyDetector for unified anomaly scoring.
//
// Usage:
//   import { volumeAutoencoder } from './VolumeAutoencoder';
//   const analysis = volumeAutoencoder.analyze(bars);
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

export interface VolumeAnomaly {
  index: number;
  time: number;
  type: 'volume_surge' | 'volume_drought' | 'accumulation_spike' | 'distribution_spike';
  severity: 'low' | 'medium' | 'high';
  zScore: number;
  description: string;
}

export interface VolumeAnalysis {
  flowSignal: 'accumulation' | 'distribution' | 'neutral';
  institutionalScore: number;    // 0-100
  anomalies: VolumeAnomaly[];
  relativeVolume: number;        // current vs 20-period average
  obvTrend: 'rising' | 'falling' | 'flat';
  volumeProfile: 'increasing' | 'decreasing' | 'stable';
  summary: string;
}

// ─── Analyzer ───────────────────────────────────────────────────

export class VolumeAutoencoder {
  /**
   * Full volume analysis on bar data.
   */
  analyze(bars: Bar[]): VolumeAnalysis {
    if (bars.length < 20) {
      return {
        flowSignal: 'neutral',
        institutionalScore: 0,
        anomalies: [],
        relativeVolume: 1,
        obvTrend: 'flat',
        volumeProfile: 'stable',
        summary: 'Insufficient data for volume analysis',
      };
    }

    const anomalies = this.getVolumeAnomalies(bars);
    const flowSignal = this.getFlowSignal(bars);
    const institutionalScore = this.getInstitutionalScore(bars);
    const relativeVolume = this._relativeVolume(bars);
    const obvTrend = this._obvTrend(bars);
    const volumeProfile = this._volumeProfile(bars);

    const summary = this._buildSummary(flowSignal, institutionalScore, relativeVolume, obvTrend, anomalies.length);

    return { flowSignal, institutionalScore, anomalies, relativeVolume, obvTrend, volumeProfile, summary };
  }

  /**
   * Detect volume anomalies.
   */
  getVolumeAnomalies(bars: Bar[]): VolumeAnomaly[] {
    if (bars.length < 20) return [];

    const anomalies: VolumeAnomaly[] = [];
    const volumes = bars.map(b => b.volume);
    const window = 20;

    for (let i = window; i < bars.length; i++) {
      const slice = volumes.slice(i - window, i);
      const mean = slice.reduce((s, v) => s + v, 0) / window;
      const std = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / window);

      if (std === 0) continue;
      const zScore = (volumes[i] - mean) / std;

      if (zScore > 2.5) {
        // High volume — check if accumulation or distribution
        const priceChange = bars[i].close - bars[i].open;
        const type: VolumeAnomaly['type'] = priceChange >= 0 ? 'accumulation_spike' : 'distribution_spike';
        const severity: VolumeAnomaly['severity'] = zScore > 4 ? 'high' : zScore > 3 ? 'medium' : 'low';

        anomalies.push({
          index: i,
          time: bars[i].time,
          type,
          severity,
          zScore: Math.round(zScore * 100) / 100,
          description: `${severity} volume ${type === 'accumulation_spike' ? 'accumulation' : 'distribution'} (${zScore.toFixed(1)}σ above mean)`,
        });
      } else if (zScore < -1.5) {
        anomalies.push({
          index: i,
          time: bars[i].time,
          type: 'volume_drought',
          severity: 'low',
          zScore: Math.round(zScore * 100) / 100,
          description: `Volume drought — ${Math.abs(zScore).toFixed(1)}σ below mean`,
        });
      }
    }

    return anomalies;
  }

  /**
   * Determine accumulation vs distribution flow.
   */
  getFlowSignal(bars: Bar[]): 'accumulation' | 'distribution' | 'neutral' {
    if (bars.length < 20) return 'neutral';

    // Money flow: volume-weighted price direction
    let buyVolume = 0, sellVolume = 0;
    for (const bar of bars.slice(-20)) {
      const range = bar.high - bar.low;
      if (range === 0) continue;
      // Chaikin money flow component
      const mfMultiplier = ((bar.close - bar.low) - (bar.high - bar.close)) / range;
      if (mfMultiplier > 0) buyVolume += bar.volume * mfMultiplier;
      else sellVolume += bar.volume * Math.abs(mfMultiplier);
    }

    const total = buyVolume + sellVolume;
    if (total === 0) return 'neutral';

    const ratio = buyVolume / total;
    if (ratio > 0.6) return 'accumulation';
    if (ratio < 0.4) return 'distribution';
    return 'neutral';
  }

  /**
   * Score institutional activity likelihood (0-100).
   */
  getInstitutionalScore(bars: Bar[]): number {
    if (bars.length < 20) return 0;

    let score = 0;
    const recent = bars.slice(-20);

    // 1. Relative volume spikes (25 pts)
    const relVol = this._relativeVolume(bars);
    if (relVol > 2.5) score += 25;
    else if (relVol > 1.5) score += 15;
    else if (relVol > 1.2) score += 5;

    // 2. Volume clustering at specific price levels (25 pts)
    const vpoc = this._volumePointOfControl(recent);
    if (vpoc.concentration > 0.3) score += 25;
    else if (vpoc.concentration > 0.2) score += 15;

    // 3. OBV divergence from price (25 pts)
    const obvDiv = this._obvDivergence(recent);
    if (Math.abs(obvDiv) > 0.3) score += 25;
    else if (Math.abs(obvDiv) > 0.15) score += 15;

    // 4. Large-bar count (bars > 2x avg range with high volume) (25 pts)
    const avgRange = recent.reduce((s, b) => s + (b.high - b.low), 0) / recent.length;
    const avgVol = recent.reduce((s, b) => s + b.volume, 0) / recent.length;
    const largeBars = recent.filter(b =>
      (b.high - b.low) > avgRange * 2 && b.volume > avgVol * 1.5
    ).length;
    if (largeBars >= 3) score += 25;
    else if (largeBars >= 1) score += 15;

    return Math.min(100, score);
  }

  /**
   * Get formatted summary for AI context.
   */
  getAnalysisForAI(bars: Bar[]): string {
    const analysis = this.analyze(bars);
    if (analysis.institutionalScore < 10 && analysis.anomalies.length === 0) return '';

    return `--- Volume Analysis ---\nFlow: ${analysis.flowSignal} | Institutional: ${analysis.institutionalScore}/100 | ${analysis.summary}`;
  }

  // ── Internal Helpers ────────────────────────────────────────

  private _relativeVolume(bars: Bar[]): number {
    const recent = bars.slice(-3);
    const baseline = bars.slice(-23, -3);
    if (baseline.length === 0) return 1;

    const recentAvg = recent.reduce((s, b) => s + b.volume, 0) / recent.length;
    const baselineAvg = baseline.reduce((s, b) => s + b.volume, 0) / baseline.length;
    return baselineAvg > 0 ? recentAvg / baselineAvg : 1;
  }

  private _obvTrend(bars: Bar[]): 'rising' | 'falling' | 'flat' {
    if (bars.length < 10) return 'flat';

    let obv = 0;
    const obvValues: number[] = [0];
    for (let i = 1; i < bars.length; i++) {
      if (bars[i].close > bars[i - 1].close) obv += bars[i].volume;
      else if (bars[i].close < bars[i - 1].close) obv -= bars[i].volume;
      obvValues.push(obv);
    }

    const recent = obvValues.slice(-5);
    const earlier = obvValues.slice(-10, -5);
    const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
    const earlierAvg = earlier.reduce((s, v) => s + v, 0) / (earlier.length || 1);

    const diff = earlierAvg !== 0 ? (recentAvg - earlierAvg) / Math.abs(earlierAvg) : 0;
    if (diff > 0.05) return 'rising';
    if (diff < -0.05) return 'falling';
    return 'flat';
  }

  private _volumeProfile(bars: Bar[]): 'increasing' | 'decreasing' | 'stable' {
    if (bars.length < 20) return 'stable';
    const first10 = bars.slice(-20, -10).reduce((s, b) => s + b.volume, 0) / 10;
    const last10 = bars.slice(-10).reduce((s, b) => s + b.volume, 0) / 10;
    const ratio = first10 > 0 ? last10 / first10 : 1;
    if (ratio > 1.3) return 'increasing';
    if (ratio < 0.7) return 'decreasing';
    return 'stable';
  }

  private _volumePointOfControl(bars: Bar[]): { price: number; concentration: number } {
    // Simple VPOC: find price level with most volume
    const bucketSize = bars.length > 0
      ? (Math.max(...bars.map(b => b.high)) - Math.min(...bars.map(b => b.low))) / 20
      : 1;
    if (bucketSize === 0) return { price: 0, concentration: 0 };

    const minPrice = Math.min(...bars.map(b => b.low));
    const buckets: Record<number, number> = {};
    let totalVol = 0;

    for (const bar of bars) {
      const bucket = Math.floor((bar.close - minPrice) / bucketSize);
      buckets[bucket] = (buckets[bucket] || 0) + bar.volume;
      totalVol += bar.volume;
    }

    let maxBucket = 0, maxVol = 0;
    for (const [bucket, vol] of Object.entries(buckets)) {
      if (vol > maxVol) {
        maxVol = vol;
        maxBucket = Number(bucket);
      }
    }

    return {
      price: minPrice + maxBucket * bucketSize + bucketSize / 2,
      concentration: totalVol > 0 ? maxVol / totalVol : 0,
    };
  }

  private _obvDivergence(bars: Bar[]): number {
    if (bars.length < 10) return 0;

    // Compare price trend vs OBV trend
    const firstHalf = bars.slice(0, Math.floor(bars.length / 2));
    const secondHalf = bars.slice(Math.floor(bars.length / 2));

    const priceSlope = (secondHalf[secondHalf.length - 1].close - firstHalf[0].close) / firstHalf[0].close;

    let obv1 = 0, obv2 = 0;
    for (let i = 1; i < firstHalf.length; i++) {
      obv1 += firstHalf[i].close > firstHalf[i - 1].close ? firstHalf[i].volume : -firstHalf[i].volume;
    }
    for (let i = 1; i < secondHalf.length; i++) {
      obv2 += secondHalf[i].close > secondHalf[i - 1].close ? secondHalf[i].volume : -secondHalf[i].volume;
    }

    const obvSlope = obv1 !== 0 ? (obv2 - obv1) / Math.abs(obv1) : 0;

    // Divergence = price going one way, OBV going the other
    if (priceSlope > 0 && obvSlope < -0.1) return -0.5; // Bearish divergence
    if (priceSlope < 0 && obvSlope > 0.1) return 0.5;   // Bullish divergence
    return 0;
  }

  private _buildSummary(
    flow: string, instScore: number, relVol: number, obvTrend: string, anomalyCount: number,
  ): string {
    const parts: string[] = [];
    parts.push(`${flow} flow`);
    if (instScore > 50) parts.push(`strong institutional activity (${instScore}/100)`);
    else if (instScore > 20) parts.push(`moderate institutional signs (${instScore}/100)`);
    parts.push(`rel vol ${relVol.toFixed(1)}x`);
    parts.push(`OBV ${obvTrend}`);
    if (anomalyCount > 0) parts.push(`${anomalyCount} anomalies detected`);
    return parts.join(', ');
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const volumeAutoencoder = new VolumeAutoencoder();
export default volumeAutoencoder;
