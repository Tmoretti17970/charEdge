// ═══════════════════════════════════════════════════════════════════
// charEdge — Liquidity Heatmap Renderer
// Paints resting limit orders (Order Book DOM) behind price action.
// High liquidity = brighter colors (heat).
// ═══════════════════════════════════════════════════════════════════

export class HeatmapRenderer {
  /**
   * Render the continuous DOM heatmap
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} aggregator - The OrderFlowAggregator containing domHistory
   * @param {number} startIdx - First visible bar index
   * @param {number} endIdx - Last visible bar index
   * @param {number} barSpacing - Width between bars
   * @param {Function} priceToY - Function mapping a price down to a Y pixel coordinate
   * @param {Object} visibleRange - { min: Number, max: Number } visible price range
   * @param {number} intensity - User-selectable intensity multiplier (e.g., 0.5 to 2.0)
   */
  static draw(ctx, aggregator, startIdx, endIdx, barSpacing, priceToY, visibleRange, intensity = 1.0) {
    if (!aggregator || !aggregator.domHistory || aggregator.domHistory.length === 0) return;

    const history = aggregator.domHistory;
    const latestSnapshot = history[history.length - 1];
    if (!latestSnapshot.bids?.length && !latestSnapshot.asks?.length) return;

    // Determine a bucket size that produces visible bands on screen.
    // We want ~50-80 bands across the visible price range.
    const priceRange = visibleRange.max - visibleRange.min;
    if (priceRange <= 0) return;
    const NUM_BUCKETS = 60;
    const bucketSize = priceRange / NUM_BUCKETS;

    // Aggregate bid and ask levels into buckets
    const bidBuckets = new Map(); // bucketPrice -> totalQty
    const askBuckets = new Map();
    let maxQty = 0;

    const aggregate = (levels, target) => {
      for (const [priceStr, qtyStr] of levels) {
        const price = parseFloat(priceStr);
        if (price < visibleRange.min || price > visibleRange.max) continue;
        const qty = parseFloat(qtyStr);
        const bucket = Math.floor(price / bucketSize) * bucketSize;
        const existing = target.get(bucket) || 0;
        const newTotal = existing + qty;
        target.set(bucket, newTotal);
        if (newTotal > maxQty) maxQty = newTotal;
      }
    };

    aggregate(latestSnapshot.bids, bidBuckets);
    aggregate(latestSnapshot.asks, askBuckets);

    if (maxQty === 0) maxQty = 1;

    const MIN_BAND_HEIGHT = 3; // Minimum pixels per band for visibility

    // Draw heatmap bands spanning the full visible width
    const totalWidth = (endIdx - startIdx + 1) * barSpacing;

    // Draw Ask bands (resistance / selling liquidity)
    askBuckets.forEach((qty, bucketPrice) => {
      const normalized = Math.min((qty / maxQty) * intensity, 1.0);
      if (normalized > 0.05) {
        const y1 = priceToY(bucketPrice + bucketSize);
        const y2 = priceToY(bucketPrice);
        const h = Math.max(MIN_BAND_HEIGHT, Math.abs(y2 - y1));
        ctx.fillStyle = `rgba(255, 80, 40, ${normalized * 0.85})`;
        ctx.fillRect(0, Math.min(y1, y2), totalWidth, h);
      }
    });

    // Draw Bid bands (support / buying liquidity)
    bidBuckets.forEach((qty, bucketPrice) => {
      const normalized = Math.min((qty / maxQty) * intensity, 1.0);
      if (normalized > 0.05) {
        const y1 = priceToY(bucketPrice + bucketSize);
        const y2 = priceToY(bucketPrice);
        const h = Math.max(MIN_BAND_HEIGHT, Math.abs(y2 - y1));
        ctx.fillStyle = `rgba(30, 144, 255, ${normalized * 0.85})`;
        ctx.fillRect(0, Math.min(y1, y2), totalWidth, h);
      }
    });
  }
}
