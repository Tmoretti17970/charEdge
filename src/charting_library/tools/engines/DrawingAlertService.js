// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Alert Service
// Monitors price ticks and fires alerts when price crosses drawing
// lines (trendlines, horizontal lines, fib levels, etc.).
// Uses a simple last-price-vs-current comparison for crossover detection.
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {{
 *   drawingId: string,
 *   drawingType: string,
 *   direction: 'up' | 'down',
 *   price: number,
 *   timestamp: number,
 *   label?: string,
 * }} DrawingAlertEvent
 */

const ALERTABLE_TYPES = new Set([
  'trendline', 'extendedLine', 'ray', 'horizontalLine',
  'fibRetracement', 'fibExtension',
]);

/**
 * Creates a DrawingAlertService instance.
 * @param {object} opts
 * @param {() => any[]} opts.getDrawings - return current drawings array
 * @param {(point: {price:number, time:number}) => {x:number,y:number}|null} opts.anchorToPixel
 * @param {(alert: DrawingAlertEvent) => void} opts.onAlert - callback when alert triggers
 */
export function createDrawingAlertService({ getDrawings, anchorToPixel, onAlert }) {
  let lastPrice = null;
  let enabledAlerts = new Map(); // drawingId → { enabled: true, label?, oneShot? }
  let firedCache = new Set(); // drawingId keys that have fired (for one-shot)

  /**
   * Enable an alert on a specific drawing.
   */
  function enableAlert(drawingId, opts = {}) {
    enabledAlerts.set(drawingId, {
      enabled: true,
      label: opts.label || '',
      oneShot: opts.oneShot ?? true,
    });
    firedCache.delete(drawingId);
  }

  /**
   * Disable an alert on a specific drawing.
   */
  function disableAlert(drawingId) {
    enabledAlerts.delete(drawingId);
    firedCache.delete(drawingId);
  }

  /**
   * Check if a drawing has an alert enabled.
   */
  function hasAlert(drawingId) {
    return enabledAlerts.has(drawingId);
  }

  /**
   * Get all enabled alert drawing IDs
   */
  function getAlertedIds() {
    return [...enabledAlerts.keys()];
  }

  /**
   * Called on each price tick to check for crossovers.
   * @param {number} currentPrice
   */
  function onPriceTick(currentPrice) {
    if (lastPrice === null) {
      lastPrice = currentPrice;
      return;
    }

    const drawings = getDrawings();
    if (!drawings || drawings.length === 0) {
      lastPrice = currentPrice;
      return;
    }

    for (const drawing of drawings) {
      if (!ALERTABLE_TYPES.has(drawing.type)) continue;
      if (!enabledAlerts.has(drawing.id)) continue;
      if (firedCache.has(drawing.id)) continue;

      const alertOpts = enabledAlerts.get(drawing.id);
      if (!alertOpts?.enabled) continue;

      // Get the drawing's price level(s)
      const levels = getDrawingPriceLevels(drawing);

      for (const level of levels) {
        const crossed = checkCross(lastPrice, currentPrice, level.price);
        if (crossed) {
          const direction = currentPrice > lastPrice ? 'up' : 'down';
          const event = {
            drawingId: drawing.id,
            drawingType: drawing.type,
            direction,
            price: level.price,
            timestamp: Date.now(),
            label: alertOpts.label || level.label || `${drawing.type} cross`,
          };
          onAlert(event);

          if (alertOpts.oneShot) {
            firedCache.add(drawing.id);
          }
          break; // Only one alert per tick per drawing
        }
      }
    }

    lastPrice = currentPrice;
  }

  /**
   * Extract price levels from a drawing.
   */
  function getDrawingPriceLevels(drawing) {
    const levels = [];
    if (!drawing.points || drawing.points.length === 0) return levels;

    switch (drawing.type) {
      case 'horizontalLine':
        levels.push({ price: drawing.points[0].price, label: 'Horizontal Line' });
        break;

      case 'trendline':
      case 'extendedLine':
      case 'ray': {
        // For trendlines, use both endpoints
        for (let i = 0; i < drawing.points.length; i++) {
          if (drawing.points[i]?.price != null) {
            levels.push({ price: drawing.points[i].price, label: `Point ${i + 1}` });
          }
        }
        break;
      }

      case 'fibRetracement':
      case 'fibExtension': {
        // Report the levels that are enabled/visible
        const fibLevels = drawing.style?.fibLevels;
        if (fibLevels && fibLevels.length > 0) {
          const startPrice = drawing.points[0]?.price ?? 0;
          const endPrice = drawing.points[1]?.price ?? 0;
          const range = endPrice - startPrice;
          for (const fl of fibLevels) {
            if (fl.enabled === false || fl.visible === false) continue;
            const price = startPrice + range * (1 - fl.value);
            if (isFinite(price)) {
              levels.push({ price, label: `Fib ${(fl.value * 100).toFixed(1)}%` });
            }
          }
        }
        break;
      }
    }

    return levels;
  }

  /**
   * Check if price crossed a level between two ticks.
   */
  function checkCross(prevPrice, currentPrice, levelPrice) {
    if (prevPrice === null || currentPrice === null) return false;
    return (prevPrice < levelPrice && currentPrice >= levelPrice) ||
           (prevPrice > levelPrice && currentPrice <= levelPrice);
  }

  /**
   * Reset all state.
   */
  function dispose() {
    lastPrice = null;
    enabledAlerts.clear();
    firedCache.clear();
  }

  return {
    enableAlert,
    disableAlert,
    hasAlert,
    getAlertedIds,
    onPriceTick,
    dispose,
  };
}
