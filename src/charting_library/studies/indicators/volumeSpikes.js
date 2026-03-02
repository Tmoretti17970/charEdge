// ═══════════════════════════════════════════════════════════════════
// Volume Spike Detector
// Identifies bars where volume exceeds a multiple of the rolling average.
// ═══════════════════════════════════════════════════════════════════

/**
 * Detect volume spikes in bar data.
 * @param {Array} bars - OHLCV bars
 * @param {number} multiplier - How many times the average volume to qualify as spike (default: 2)
 * @param {number} lookback - Rolling window size for average (default: 20)
 * @returns {{ spikes: boolean[], ratios: number[] }} - Parallel arrays: spike flag + volume/avg ratio
 */
export function detectVolumeSpikes(bars, multiplier = 2, lookback = 20) {
  if (!bars || !bars.length) return { spikes: [], ratios: [] };

  const len = bars.length;
  const spikes = new Array(len).fill(false);
  const ratios = new Array(len).fill(0);

  for (let i = 0; i < len; i++) {
    const vol = bars[i].volume || 0;
    // Calculate rolling average of previous `lookback` bars
    let sum = 0;
    let count = 0;
    const start = Math.max(0, i - lookback);
    for (let j = start; j < i; j++) {
      sum += bars[j].volume || 0;
      count++;
    }

    if (count === 0 || sum === 0) {
      ratios[i] = 0;
      continue;
    }

    const avg = sum / count;
    const ratio = vol / avg;
    ratios[i] = Math.round(ratio * 100) / 100;
    spikes[i] = ratio >= multiplier;
  }

  return { spikes, ratios };
}
