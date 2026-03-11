// ═══════════════════════════════════════════════════════════════════
// charEdge — Synthetic Candle Generator (Visual Regression M-3)
//
// Configurable test data utility for generating OHLCV candle arrays
// with controlled behavior: trends, volatility, gaps, spikes, and
// volume patterns. Used by unit tests and benchmarks.
//
// Usage:
//   import { generateSyntheticCandles } from './generateSyntheticCandles';
//   const candles = generateSyntheticCandles({
//     count: 200,
//     startPrice: 150,
//     volatility: 0.02,
//     trend: 0.001,         // +0.1% drift per bar
//     gaps: [{ at: 50, pct: 0.05 }],
//     spikes: [{ at: 100, pct: -0.10 }],
//     volumeProfile: 'random',
//   });
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export interface SyntheticCandleConfig {
    /** Number of candles to generate. Default: 100 */
    count?: number;
    /** Starting close price. Default: 100 */
    startPrice?: number;
    /** Candle interval in ms. Default: 60000 (1 min) */
    intervalMs?: number;
    /** Start timestamp. Default: 1700000000000 */
    startTime?: number;
    /** Per-bar volatility as fraction (e.g. 0.02 = 2%). Default: 0.01 */
    volatility?: number;
    /** Per-bar drift/trend as fraction (e.g. 0.001 = +0.1%). Default: 0 */
    trend?: number;
    /** Random seed for reproducibility. Default: 42 */
    seed?: number;
    /** Base volume. Default: 10000 */
    baseVolume?: number;
    /** Volume profile: 'stable' | 'random' | 'u-shape'. Default: 'random' */
    volumeProfile?: 'stable' | 'random' | 'u-shape';
    /** Inject gap opens at these positions/percentages */
    gaps?: Array<{ at: number; pct: number }>;
    /** Inject price spikes at these positions/percentages */
    spikes?: Array<{ at: number; pct: number }>;
    /** Inject volume spikes at these positions (multiplier of base) */
    volumeSpikes?: Array<{ at: number; multiplier: number }>;
}

export interface SyntheticCandle {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

// ─── Seeded PRNG (Mulberry32) ───────────────────────────────────

function mulberry32(seed: number) {
    return (): number => {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Generate a gaussian-distributed random number from uniform PRNG. */
function gaussianRandom(prng: () => number): number {
    const u1 = prng();
    const u2 = prng();
    return Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.cos(2 * Math.PI * u2);
}

// ─── Generator ──────────────────────────────────────────────────

export function generateSyntheticCandles(config: SyntheticCandleConfig = {}): SyntheticCandle[] {
    const {
        count = 100,
        startPrice = 100,
        intervalMs = 60_000,
        startTime = 1_700_000_000_000,
        volatility = 0.01,
        trend = 0,
        seed = 42,
        baseVolume = 10_000,
        volumeProfile = 'random',
        gaps = [],
        spikes = [],
        volumeSpikes = [],
    } = config;

    const prng = mulberry32(seed);
    const candles: SyntheticCandle[] = [];
    let lastClose = startPrice;

    // Index lookup for gap/spike injections
    const gapMap = new Map(gaps.map(g => [g.at, g.pct]));
    const spikeMap = new Map(spikes.map(s => [s.at, s.pct]));
    const volSpikeMap = new Map(volumeSpikes.map(v => [v.at, v.multiplier]));

    for (let i = 0; i < count; i++) {
        const time = startTime + i * intervalMs;

        // ── Open ──
        let open = lastClose;
        if (gapMap.has(i)) {
            open = lastClose * (1 + gapMap.get(i)!);
        }

        // ── Return ──
        let ret = trend + volatility * gaussianRandom(prng);
        if (spikeMap.has(i)) {
            ret = spikeMap.get(i)!;
        }
        const close = open * (1 + ret);

        // ── High / Low ──
        const intraRange = Math.abs(close - open) + volatility * lastClose * Math.abs(gaussianRandom(prng)) * 0.5;
        const high = Math.max(open, close) + intraRange * prng();
        const low = Math.min(open, close) - intraRange * prng();

        // ── Volume ──
        let volume: number;
        if (volSpikeMap.has(i)) {
            volume = baseVolume * volSpikeMap.get(i)!;
        } else {
            switch (volumeProfile) {
                case 'stable':
                    volume = baseVolume;
                    break;
                case 'u-shape': {
                    // U-shaped: higher at open/close of session, lower mid-day
                    const progress = i / count;
                    const uFactor = 1.5 - Math.sin(progress * Math.PI) * 0.8;
                    volume = baseVolume * uFactor * (0.8 + prng() * 0.4);
                    break;
                }
                default: // 'random'
                    volume = baseVolume * (0.5 + prng() * 1.5);
            }
        }

        candles.push({
            time,
            open: +open.toFixed(4),
            high: +Math.max(high, open, close).toFixed(4),
            low: +Math.min(low, open, close).toFixed(4),
            close: +close.toFixed(4),
            volume: Math.round(volume),
        });

        lastClose = close;
    }

    return candles;
}

export default generateSyntheticCandles;
