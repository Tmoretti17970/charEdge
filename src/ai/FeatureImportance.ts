// ═══════════════════════════════════════════════════════════════════
// charEdge — Feature Importance (Sprint 90)
//
// SHAP-like permutation importance for trade outcome prediction.
// Identifies which factors matter most via feature shuffling.
//
// Usage:
//   import { featureImportance } from './FeatureImportance';
//   const result = featureImportance.analyze(trades);
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface ImportanceResult {
  features: FeatureScore[];
  baselineAccuracy: number;
  sampleSize: number;
}

export interface FeatureScore {
  name: string;
  importance: number;     // 0–100 (higher = more important)
  direction: 'positive' | 'negative' | 'neutral';
  description: string;
}

// ─── Feature Definitions ────────────────────────────────────────

const FEATURES = [
  { key: 'hour', name: 'Time of Day', extract: (t: Record<string, unknown>) => {
    const d = t.entryTime ? new Date(t.entryTime as string | number) : null;
    return d && !isNaN(d.getTime()) ? d.getHours() : null;
  }},
  { key: 'day', name: 'Day of Week', extract: (t: Record<string, unknown>) => {
    const d = t.entryTime ? new Date(t.entryTime as string | number) : null;
    return d && !isNaN(d.getTime()) ? d.getDay() : null;
  }},
  { key: 'symbol', name: 'Symbol', extract: (t: Record<string, unknown>) =>
    typeof t.symbol === 'string' ? t.symbol.charCodeAt(0) : null
  },
  { key: 'setup', name: 'Setup Type', extract: (t: Record<string, unknown>) =>
    typeof t.setupType === 'string' ? t.setupType.length : null
  },
  { key: 'emotion', name: 'Emotional State', extract: (t: Record<string, unknown>) =>
    typeof t.emotion === 'string' ? t.emotion.length : null
  },
  { key: 'side', name: 'Direction (Long/Short)', extract: (t: Record<string, unknown>) =>
    t.side === 'long' ? 1 : t.side === 'short' ? -1 : null
  },
  { key: 'holdTime', name: 'Hold Duration', extract: (t: Record<string, unknown>) =>
    typeof t.holdMinutes === 'number' ? t.holdMinutes : null
  },
];

// ─── Analyzer ───────────────────────────────────────────────────

class FeatureImportanceAnalyzer {
  /**
   * Analyze feature importance via permutation testing.
   */
  analyze(trades: Record<string, unknown>[], iterations = 30): ImportanceResult {
    const valid = trades.filter(t => typeof t.pnl === 'number');
    if (valid.length < 15) {
      return { features: [], baselineAccuracy: 0, sampleSize: 0 };
    }

    // Baseline accuracy: how well can we predict win/loss from all features?
    const labels = valid.map(t => ((t.pnl as number) > 0 ? 1 : 0));
    const baselineAcc = this._computeAccuracy(valid, labels, FEATURES);

    // Permutation importance: shuffle each feature, measure accuracy drop
    const scores: FeatureScore[] = [];

    for (const feature of FEATURES) {
      let totalDrop = 0;

      for (let iter = 0; iter < iterations; iter++) {
        // Shuffle this feature's values
        const shuffled = [...valid];
        const values = shuffled.map(t => feature.extract(t));
        this._fisherYates(values);
        const permuted = shuffled.map((t, i) => ({ ...t, [`_perm_${feature.key}`]: values[i] }));

        const permAcc = this._computeAccuracy(permuted, labels, FEATURES, feature.key);
        totalDrop += baselineAcc - permAcc;
      }

      const avgDrop = totalDrop / iterations;
      const importance = Math.max(0, Math.min(100, avgDrop * 200));

      // Determine direction
      const corr = this._correlation(valid, feature, labels);
      const direction = corr > 0.1 ? 'positive' : corr < -0.1 ? 'negative' : 'neutral';

      scores.push({
        name: feature.name,
        importance: Math.round(importance),
        direction,
        description: this._describeFeature(feature.name, importance, direction),
      });
    }

    scores.sort((a, b) => b.importance - a.importance);

    return {
      features: scores,
      baselineAccuracy: Math.round(baselineAcc * 100),
      sampleSize: valid.length,
    };
  }

  // ─── Simple KNN Classifier ──────────────────────────────────

  private _computeAccuracy(
    trades: Record<string, unknown>[],
    labels: number[],
    features: typeof FEATURES,
    shuffledKey?: string,
  ): number {
    // Leave-one-out KNN (k=5) accuracy
    let correct = 0;
    const n = trades.length;

    for (let i = 0; i < Math.min(n, 100); i++) {  // Cap at 100 for performance
      const testFeats = this._extractAllFeatures(trades[i], features, shuffledKey);
      let neighbors: { dist: number; label: number }[] = [];

      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const trainFeats = this._extractAllFeatures(trades[j], features, shuffledKey);
        const dist = this._euclidean(testFeats, trainFeats);
        neighbors.push({ dist, label: labels[j] });
      }

      neighbors.sort((a, b) => a.dist - b.dist);
      const topK = neighbors.slice(0, 5);
      const predicted = topK.reduce((s, n) => s + n.label, 0) > 2.5 ? 1 : 0;
      if (predicted === labels[i]) correct++;
    }

    return correct / Math.min(n, 100);
  }

  private _extractAllFeatures(
    trade: Record<string, unknown>,
    features: typeof FEATURES,
    shuffledKey?: string,
  ): number[] {
    // Phase 3 Task #39: Use permuted value when feature matches shuffledKey
    return features.map(f => {
      if (shuffledKey && f.key === shuffledKey) {
        const permVal = trade[`_perm_${f.key}`];
        return typeof permVal === 'number' ? permVal : (permVal ?? 0) as number;
      }
      const val = f.extract(trade);
      return val ?? 0;
    });
  }

  private _euclidean(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
    return Math.sqrt(sum);
  }

  private _correlation(
    trades: Record<string, unknown>[],
    feature: typeof FEATURES[0],
    labels: number[],
  ): number {
    const values = trades.map(t => feature.extract(t) ?? 0);
    const n = values.length;
    const meanX = values.reduce((s, v) => s + v, 0) / n;
    const meanY = labels.reduce((s, v) => s + v, 0) / n;

    let num = 0, denX = 0, denY = 0;
    for (let i = 0; i < n; i++) {
      const dx = values[i] - meanX;
      const dy = labels[i] - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }

    const den = Math.sqrt(denX * denY);
    return den === 0 ? 0 : num / den;
  }

  private _fisherYates(arr: unknown[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  private _describeFeature(name: string, importance: number, direction: string): string {
    const level = importance > 60 ? 'strongly' : importance > 30 ? 'moderately' : 'weakly';
    return `${name} ${level} influences outcomes (${direction} correlation)`;
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const featureImportance = new FeatureImportanceAnalyzer();
export default featureImportance;
