// ═══════════════════════════════════════════════════════════════════
// charEdge — Auto S/R Detection Engine (Sprint 6)
// Algorithmically detects support/resistance levels from price data
// using pivot point density analysis and strength scoring.
// ═══════════════════════════════════════════════════════════════════

/**
 * Detect support and resistance levels from OHLCV bars.
 * Uses pivot point clustering with strength scoring.
 * @param {Object[]} bars - OHLCV data
 * @param {Object} [options]
 * @returns {Object[]} Array of { price, type, strength, touches, zone }
 */
export function detectSupportResistance(bars, options = {}) {
  const {
    pivotRange = 5,        // Bars to look left/right for pivot detection
    zoneMerge = 0.003,     // Merge levels within 0.3% of each other
    minTouches = 2,        // Minimum touches to qualify as S/R
    maxLevels = 15,        // Maximum returned levels
    recencyWeight = 1.5,   // Recent touches weighted more
  } = options;

  if (!bars || bars.length < pivotRange * 2 + 1) return [];

  // Step 1: Find swing highs and lows (pivots)
  const pivots = [];
  for (let i = pivotRange; i < bars.length - pivotRange; i++) {
    let isSwingHigh = true;
    let isSwingLow = true;

    for (let j = 1; j <= pivotRange; j++) {
      if (bars[i].high <= bars[i - j].high || bars[i].high <= bars[i + j].high) isSwingHigh = false;
      if (bars[i].low >= bars[i - j].low || bars[i].low >= bars[i + j].low) isSwingLow = false;
    }

    if (isSwingHigh) pivots.push({ price: bars[i].high, type: 'resistance', barIdx: i, time: bars[i].time });
    if (isSwingLow) pivots.push({ price: bars[i].low, type: 'support', barIdx: i, time: bars[i].time });
  }

  if (pivots.length === 0) return [];

  // Step 2: Cluster nearby pivots into zones
  const sortedPivots = [...pivots].sort((a, b) => a.price - b.price);
  const zones = [];
  let currentZone = { price: sortedPivots[0].price, type: sortedPivots[0].type, pivots: [sortedPivots[0]] };

  for (let i = 1; i < sortedPivots.length; i++) {
    const p = sortedPivots[i];
    const pctDiff = Math.abs(p.price - currentZone.price) / currentZone.price;

    if (pctDiff < zoneMerge) {
      currentZone.pivots.push(p);
      // Average the price
      currentZone.price = currentZone.pivots.reduce((s, pv) => s + pv.price, 0) / currentZone.pivots.length;
    } else {
      zones.push(currentZone);
      currentZone = { price: p.price, type: p.type, pivots: [p] };
    }
  }
  zones.push(currentZone);

  // Step 3: Score each zone
  const lastBarIdx = bars.length - 1;
  const scored = zones.map((zone) => {
    const touches = zone.pivots.length;
    if (touches < minTouches) return null;

    // Recency: how recent is the most recent touch?
    const mostRecent = Math.max(...zone.pivots.map((p) => p.barIdx));
    const recencyScore = 1 + recencyWeight * (mostRecent / lastBarIdx);

    // Volume at level (sum volume of touching bars)
    let volumeScore = 0;
    for (const pv of zone.pivots) {
      if (bars[pv.barIdx]) volumeScore += bars[pv.barIdx].volume || 0;
    }
    const avgVolume = bars.reduce((s, b) => s + (b.volume || 0), 0) / bars.length;
    const volRatio = avgVolume > 0 ? volumeScore / (zone.pivots.length * avgVolume) : 1;

    const strength = touches * recencyScore * Math.sqrt(volRatio);

    // Determine type by majority
    const supports = zone.pivots.filter((p) => p.type === 'support').length;
    const resistances = zone.pivots.filter((p) => p.type === 'resistance').length;
    const type = supports > resistances ? 'support' : 'resistance';

    // Zone width
    const prices = zone.pivots.map((p) => p.price);
    const zoneHigh = Math.max(...prices);
    const zoneLow = Math.min(...prices);

    return {
      price: zone.price,
      type,
      strength: Math.round(strength * 100) / 100,
      touches,
      zoneHigh,
      zoneLow,
      mostRecentBar: mostRecent,
      mostRecentTime: zone.pivots.find((p) => p.barIdx === mostRecent)?.time,
    };
  }).filter(Boolean);

  // Step 4: Sort by strength and return top levels
  scored.sort((a, b) => b.strength - a.strength);
  return scored.slice(0, maxLevels);
}

/**
 * Get auto S/R levels formatted for chart rendering.
 */
export function getAutoSRForChart(bars, options = {}) {
  const levels = detectSupportResistance(bars, options);
  const maxStrength = levels.length > 0 ? Math.max(...levels.map((l) => l.strength)) : 1;

  return levels.map((level) => ({
    ...level,
    opacity: 0.2 + 0.6 * (level.strength / maxStrength), // Stronger = more opaque
    width: level.zoneHigh - level.zoneLow,
    color: level.type === 'support' ? 'rgba(38, 166, 154, 0.25)' : 'rgba(239, 83, 80, 0.25)',
    borderColor: level.type === 'support' ? '#26A69A' : '#EF5350',
    label: `${level.type === 'support' ? 'S' : 'R'} (${level.touches}x)`,
  }));
}
