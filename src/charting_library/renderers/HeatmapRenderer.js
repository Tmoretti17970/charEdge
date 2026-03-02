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

    // Determine the max liquidity (qty) in the currently visible range across history
    // to normalize the color scale. (Optimization: we can cache this or use an exponentially weighted average)
    let maxQty = 0;

    // For MVP, we will just scan the latest snapshot to establish a baseline "max"
    // so the colors don't flicker wildly on every frame
    const latestSnapshot = history[history.length - 1];

    const scanLevels = (levels) => {
      for (const [priceStr, qtyStr] of levels) {
        const price = parseFloat(priceStr);
        if (price >= visibleRange.min && price <= visibleRange.max) {
          const qty = parseFloat(qtyStr);
          if (qty > maxQty) maxQty = qty;
        }
      }
    };

    scanLevels(latestSnapshot.bids);
    scanLevels(latestSnapshot.asks);

    // Prevent division by zero
    if (maxQty === 0) maxQty = 1;

    // We will draw vertical segmented "bands" for each bar based on the
    // nearest DOM snapshot in time.

    const tickSize = aggregator.tickSize;

    // Calculate an average time per bar to map historical DOM snapshots to x-coordinates
    // Note: For a true continuous heatmap, we map DOM snapshots linearly across the canvas.
    // For this chart overlay, we map them directly under the bars.

    const timePerBar = 60000; // Assuming 1m default for now, can be passed in later

    for (let i = startIdx; i <= endIdx; i++) {
        // Find a matching DOM snapshot (simplified for MVP: just use the latest for testing,
        // or map by index if history aligns with bars)

        // In reality, domHistory is asynchronous ticks. We'll simulate drawing the
        // last known DOM state spreading backwards for visually continuous bands.

        // For drawing, we'll iterate through the latest snapshot
        // (A real implementation loops over `history` mapping time to X coordinate)

        const x = (i - startIdx) * barSpacing;
        const width = barSpacing;

        // Draw Asks (Resistance / Selling Liquidity)
        latestSnapshot.asks.forEach(([priceStr, qtyStr]) => {
            const price = parseFloat(priceStr);
            if (price < visibleRange.min || price > visibleRange.max) return;

            const qty = parseFloat(qtyStr);
            const normalized = Math.min((qty / maxQty) * intensity, 1.0);

            if (normalized > 0.1) {
                // Orange/Red Heat for Asks
                ctx.fillStyle = `rgba(255, 100, 0, ${normalized})`;

                const y = priceToY(price);
                const h = Math.abs(priceToY(price - tickSize) - y); // Height of one tick bucket
                ctx.fillRect(x, Math.min(y, y - h), width, Math.max(1, h));
            }
        });

        // Draw Bids (Support / Buying Liquidity)
        latestSnapshot.bids.forEach(([priceStr, qtyStr]) => {
            const price = parseFloat(priceStr);
            if (price < visibleRange.min || price > visibleRange.max) return;

            const qty = parseFloat(qtyStr);
            const normalized = Math.min((qty / maxQty) * intensity, 1.0);

            if (normalized > 0.1) {
                // Light Blue/White Heat for Bids
                ctx.fillStyle = `rgba(0, 150, 255, ${normalized})`;

                const y = priceToY(price);
                const h = Math.abs(priceToY(price - tickSize) - y); // Height of one tick bucket
                ctx.fillRect(x, Math.min(y, y - h), width, Math.max(1, h));
            }
        });
    }
  }
}
