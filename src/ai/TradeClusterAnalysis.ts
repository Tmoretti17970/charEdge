// ═══════════════════════════════════════════════════════════════════
// charEdge — Trade Cluster Analysis (Sprint 89)
//
// K-means clustering for trade pattern discovery. Groups trades
// into behavioral clusters and generates AI-powered cluster names.
//
// Usage:
//   import { tradeClusterAnalysis } from './TradeClusterAnalysis';
//   const clusters = await tradeClusterAnalysis.analyze(trades, 4);
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface ClusterResult {
  clusters: TradeCluster[];
  k: number;
  silhouetteScore: number;
  totalTrades: number;
}

export interface TradeCluster {
  id: number;
  name: string;
  size: number;
  centroid: number[];
  stats: {
    avgPnl: number;
    winRate: number;
    avgHoldTime: number;
    topSetup: string;
    topEmotion: string;
  };
  tradeIndices: number[];
}

// ─── Encoding Maps ──────────────────────────────────────────────

const SETUP_CODES: Record<string, number> = {
  breakout: 1, pullback: 2, reversal: 3, continuation: 4,
  scalp: 5, swing: 6, momentum: 7, '': 0,
};
const EMOTION_CODES: Record<string, number> = {
  calm: 1, confident: 2, anxious: 3, fearful: 4,
  greedy: 5, frustrated: 6, revenge: 7, neutral: 8, '': 0,
};

// ─── Analysis ───────────────────────────────────────────────────

class TradeClusterAnalysis {
  /**
   * Cluster trades into k groups. Auto-selects k if not provided.
   */
  async analyze(
    trades: Record<string, unknown>[],
    k?: number,
  ): Promise<ClusterResult> {
    const valid = trades.filter(t => typeof t.pnl === 'number');
    if (valid.length < 10) {
      return { clusters: [], k: 0, silhouetteScore: 0, totalTrades: 0 };
    }

    // Extract feature vectors
    const vectors = valid.map(t => this._extractFeatures(t));

    // Normalize features
    const normalized = this._normalize(vectors);

    // Auto-select k if not provided (try 3–6, pick best silhouette)
    const bestK = k || this._autoSelectK(normalized);

    // Run K-means
    const { assignments, centroids } = this._kmeans(normalized, bestK);

    // Build cluster results
    const clusters = this._buildClusters(valid, assignments, centroids);

    // Calculate silhouette score
    const silhouette = this._silhouetteScore(normalized, assignments);

    // Name clusters via AI
    await this._nameClusters(clusters);

    return {
      clusters,
      k: bestK,
      silhouetteScore: Math.round(silhouette * 100) / 100,
      totalTrades: valid.length,
    };
  }

  // ─── Feature Extraction ──────────────────────────────────────

  private _extractFeatures(t: Record<string, unknown>): number[] {
    const pnl = typeof t.pnl === 'number' ? t.pnl : 0;
    const d = t.entryTime ? new Date(t.entryTime as string | number) : new Date(t.date as string || '');
    const hour = isNaN(d.getTime()) ? 12 : d.getHours();
    const day = isNaN(d.getTime()) ? 3 : d.getDay();
    const setup = SETUP_CODES[String(t.setupType || '').toLowerCase()] ?? 0;
    const emotion = EMOTION_CODES[String(t.emotion || '').toLowerCase()] ?? 0;
    const hold = typeof t.holdMinutes === 'number' ? t.holdMinutes : 30;

    return [pnl, hour, day, setup, emotion, hold];
  }

  // ─── Normalization ───────────────────────────────────────────

  private _normalize(vectors: number[][]): number[][] {
    const dims = vectors[0].length;
    const mins = new Array(dims).fill(Infinity);
    const maxs = new Array(dims).fill(-Infinity);

    for (const v of vectors) {
      for (let d = 0; d < dims; d++) {
        if (v[d] < mins[d]) mins[d] = v[d];
        if (v[d] > maxs[d]) maxs[d] = v[d];
      }
    }

    return vectors.map(v =>
      v.map((val, d) => {
        const range = maxs[d] - mins[d];
        return range === 0 ? 0 : (val - mins[d]) / range;
      })
    );
  }

  // ─── K-Means ─────────────────────────────────────────────────

  private _kmeans(data: number[][], k: number, maxIter = 50) {
    const n = data.length;
    const dims = data[0].length;

    // Initialize centroids (K-means++)
    // Phase 3 Task #37: Fixed off-by-one in centroid selection
    const centroids: number[][] = [data[Math.floor(Math.random() * n)]];
    while (centroids.length < k) {
      const dists = data.map(p => Math.min(...centroids.map(c => this._dist(p, c))));
      const total = dists.reduce((s, d) => s + d * d, 0);
      let r = Math.random() * total;
      let added = false;
      for (let i = 0; i < n; i++) {
        r -= dists[i] * dists[i];
        if (r <= 0) { centroids.push([...data[i]]); added = true; break; }
      }
      // Fallback: if floating-point prevented selection, pick random
      if (!added) {
        centroids.push([...data[Math.floor(Math.random() * n)]]);
      }
    }

    let assignments = new Array(n).fill(0);

    for (let iter = 0; iter < maxIter; iter++) {
      // Assign
      const newAssignments = data.map(p => {
        let minDist = Infinity, minIdx = 0;
        for (let c = 0; c < k; c++) {
          const d = this._dist(p, centroids[c]);
          if (d < minDist) { minDist = d; minIdx = c; }
        }
        return minIdx;
      });

      // Check convergence
      if (newAssignments.every((a, i) => a === assignments[i])) break;
      assignments = newAssignments;

      // Update centroids
      for (let c = 0; c < k; c++) {
        const members = data.filter((_, i) => assignments[i] === c);
        if (members.length === 0) continue;
        for (let d = 0; d < dims; d++) {
          centroids[c][d] = members.reduce((s, m) => s + m[d], 0) / members.length;
        }
      }
    }

    return { assignments, centroids };
  }

  private _autoSelectK(data: number[][]): number {
    let bestK = 3, bestScore = -1;
    for (let k = 3; k <= Math.min(6, Math.floor(data.length / 5)); k++) {
      const { assignments } = this._kmeans(data, k);
      const score = this._silhouetteScore(data, assignments);
      if (score > bestScore) { bestScore = score; bestK = k; }
    }
    return bestK;
  }

  private _dist(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
    return Math.sqrt(sum);
  }

  private _silhouetteScore(data: number[][], assignments: number[]): number {
    const n = data.length;
    if (n < 3) return 0;

    let totalS = 0;
    for (let i = 0; i < n; i++) {
      const cluster = assignments[i];
      const sameCluster = data.filter((_, j) => j !== i && assignments[j] === cluster);
      const a = sameCluster.length > 0
        ? sameCluster.reduce((s, p) => s + this._dist(data[i], p), 0) / sameCluster.length
        : 0;

      let minB = Infinity;
      const clusters = [...new Set(assignments)].filter(c => c !== cluster);
      for (const c of clusters) {
        const otherCluster = data.filter((_, j) => assignments[j] === c);
        const avgDist = otherCluster.reduce((s, p) => s + this._dist(data[i], p), 0) / otherCluster.length;
        if (avgDist < minB) minB = avgDist;
      }
      if (minB === Infinity) minB = 0;

      const s = Math.max(a, minB) === 0 ? 0 : (minB - a) / Math.max(a, minB);
      totalS += s;
    }

    return totalS / n;
  }

  // ─── Cluster Building ────────────────────────────────────────

  private _buildClusters(
    trades: Record<string, unknown>[],
    assignments: number[],
    centroids: number[][],
  ): TradeCluster[] {
    const k = centroids.length;
    const clusters: TradeCluster[] = [];

    for (let c = 0; c < k; c++) {
      const indices = assignments.map((a, i) => a === c ? i : -1).filter(i => i >= 0);
      const clusterTrades = indices.map(i => trades[i]);

      if (clusterTrades.length === 0) continue;

      const pnls = clusterTrades.map(t => (t.pnl as number) || 0);
      const wins = pnls.filter(p => p > 0).length;

      // Find top setup/emotion
      const setupCounts: Record<string, number> = {};
      const emotionCounts: Record<string, number> = {};
      for (const t of clusterTrades) {
        const s = String(t.setupType || 'unknown').toLowerCase();
        const e = String(t.emotion || 'unknown').toLowerCase();
        setupCounts[s] = (setupCounts[s] || 0) + 1;
        emotionCounts[e] = (emotionCounts[e] || 0) + 1;
      }

      const topSetup = Object.entries(setupCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'mixed';
      const topEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'mixed';

      clusters.push({
        id: c,
        name: `Cluster ${c + 1}`, // Will be named by AI
        size: clusterTrades.length,
        centroid: centroids[c],
        stats: {
          avgPnl: Math.round(pnls.reduce((s, p) => s + p, 0) / pnls.length * 100) / 100,
          winRate: Math.round((wins / pnls.length) * 100),
          avgHoldTime: 0,
          topSetup,
          topEmotion,
        },
        tradeIndices: indices,
      });
    }

    return clusters;
  }

  private async _nameClusters(clusters: TradeCluster[]): Promise<void> {
    try {
      const { aiRouter } = await import('./AIRouter');
      const summaries = clusters.map(c =>
        `Cluster ${c.id + 1}: ${c.size} trades, ${c.stats.winRate}% win rate, avg P&L $${c.stats.avgPnl}, top setup: ${c.stats.topSetup}, top emotion: ${c.stats.topEmotion}`
      ).join('\n');

      const result = await aiRouter.route({
        type: 'classify',
        messages: [
          { role: 'system', content: 'Name each trading behavior cluster with a short 2-3 word label. Reply with one name per line.' },
          { role: 'user', content: summaries },
        ],
        maxTokens: 60,
        temperature: 0.3,
      });

      const names = result.content.split('\n').map(l => l.replace(/^[\d.]+[.):\s]*/, '').trim()).filter(Boolean);
      for (let i = 0; i < Math.min(names.length, clusters.length); i++) {
        clusters[i].name = names[i];
      }
    } catch { /* Keep default names */ }
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const tradeClusterAnalysis = new TradeClusterAnalysis();
export default tradeClusterAnalysis;
