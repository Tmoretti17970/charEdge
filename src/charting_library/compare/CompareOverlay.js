// ═══════════════════════════════════════════════════════════════════
// charEdge — Compare Mode (Multi-Symbol Overlay)
//
// Phase 7 Task 7.1.7: Overlay multiple symbols on a single chart
// with normalized/percentage scaling for comparison.
//
// Usage:
//   const compare = new CompareOverlay(primaryBars, 'BTC/USDT');
//   compare.addSymbol('ETH/USDT', ethBars, '#8B5CF6');
//   const normalized = compare.getNormalized();
// ═══════════════════════════════════════════════════════════════════

/**
 * Compare overlay engine for multi-symbol price comparison.
 */
export class CompareOverlay {
  /**
   * @param {Array<Object>} primaryBars - Primary symbol OHLCV bars
   * @param {string} primarySymbol
   */
  constructor(primaryBars = [], primarySymbol = '') {
    this.primary = { symbol: primarySymbol, bars: primaryBars, color: 'var(--tf-t1)' };
    /** @type {Map<string, { symbol: string, bars: Array, color: string }>} */
    this.overlays = new Map();
  }

  /**
   * Add a symbol for comparison.
   * @param {string} symbol
   * @param {Array<Object>} bars - OHLCV bars
   * @param {string} [color] - Line color
   */
  addSymbol(symbol, bars, color) {
    const colors = ['#8B5CF6', '#F59E0B', '#EC4899', '#14B8A6', '#6366F1', '#EF4444'];
    this.overlays.set(symbol, {
      symbol,
      bars,
      color: color || colors[this.overlays.size % colors.length],
    });
  }

  /**
   * Remove a symbol from comparison.
   */
  removeSymbol(symbol) {
    this.overlays.delete(symbol);
  }

  /**
   * Get all symbols as percentage change from their first bar.
   * Normalizes each series to start at 0% for fair comparison.
   *
   * @returns {Array<{ symbol: string, color: string, data: Array<{ time: number, pct: number }> }>}
   */
  getNormalized() {
    const all = [this.primary, ...this.overlays.values()];

    return all.map(({ symbol, bars, color }) => {
      if (!bars.length) return { symbol, color, data: [] };

      const basePrice = bars[0].close;
      if (!basePrice || basePrice === 0) return { symbol, color, data: [] };

      const data = bars.map((bar) => ({
        time: bar.time,
        pct: ((bar.close - basePrice) / basePrice) * 100,
      }));

      return { symbol, color, data };
    });
  }

  /**
   * Get all symbols as raw price series.
   */
  getRaw() {
    const all = [this.primary, ...this.overlays.values()];
    return all.map(({ symbol, bars, color }) => ({
      symbol,
      color,
      data: bars.map((b) => ({ time: b.time, value: b.close })),
    }));
  }

  /**
   * Get correlation matrix between all symbols.
   * @returns {Object} { pairs: [{ a, b, correlation }] }
   */
  getCorrelation() {
    const all = [this.primary, ...this.overlays.values()];
    const pairs = [];

    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        const corr = this._pearsonCorrelation(
          a.bars.map((b) => b.close),
          b.bars.map((b) => b.close),
        );
        pairs.push({ a: a.symbol, b: b.symbol, correlation: corr });
      }
    }

    return { pairs };
  }

  /**
   * Calculate Pearson correlation coefficient.
   */
  _pearsonCorrelation(x, y) {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    const xSlice = x.slice(-n);
    const ySlice = y.slice(-n);

    const xMean = xSlice.reduce((a, b) => a + b, 0) / n;
    const yMean = ySlice.reduce((a, b) => a + b, 0) / n;

    let num = 0,
      denX = 0,
      denY = 0;
    for (let i = 0; i < n; i++) {
      const dx = xSlice[i] - xMean;
      const dy = ySlice[i] - yMean;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }

    const den = Math.sqrt(denX * denY);
    return den === 0 ? 0 : Math.round((num / den) * 1000) / 1000;
  }

  get symbolCount() {
    return 1 + this.overlays.size;
  }
  get symbols() {
    return [this.primary.symbol, ...this.overlays.keys()];
  }
}

export default CompareOverlay;
