// ═══════════════════════════════════════════════════════════════════
// charEdge — Prediction Market Fear & Greed Index
//
// Aggregate sentiment signal from prediction market activity:
// volume velocity, market creation rate, probability extremity,
// smart money flow, and breadth.
//
// Score 0-100: 0 = Extreme Fear, 100 = Extreme Greed
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute the Prediction Market Fear & Greed Index.
 * @param {Array} markets - Current markets
 * @param {Object} [prevStats] - Previous period stats for comparison
 * @returns {{ score: number, label: string, color: string, components: Object }}
 */
export function computePredictionFearGreed(markets, _prevStats = null) {
  if (!markets?.length) {
    return { score: 50, label: 'Neutral', color: '#f59e0b', components: {} };
  }

  // Component 1: Volume Momentum (0-100)
  // High volume = greed, low volume = fear
  const totalVolume = markets.reduce((s, m) => s + (m.volume24h || 0), 0);
  const avgVolume = totalVolume / markets.length;
  const volumeScore = Math.min(100, Math.max(0, (avgVolume / 500000) * 50 + 25));

  // Component 2: Probability Extremity (0-100)
  // Markets near 50% = uncertainty/fear, extreme probabilities = conviction/greed
  const probabilities = markets.map((m) => m.outcomes?.[0]?.probability || 50);
  const avgExtremity = probabilities.reduce((s, p) => s + Math.abs(p - 50), 0) / probabilities.length;
  const extremityScore = Math.min(100, (avgExtremity / 40) * 100);

  // Component 3: Positive Momentum (0-100)
  // More markets moving up = greed, more moving down = fear
  const positiveMoves = markets.filter((m) => (m.change24h || 0) > 0).length;
  const negativeMoves = markets.filter((m) => (m.change24h || 0) < 0).length;
  const totalMoves = positiveMoves + negativeMoves;
  const momentumScore = totalMoves > 0 ? (positiveMoves / totalMoves) * 100 : 50;

  // Component 4: Market Breadth (0-100)
  // More active markets = greed, fewer = fear
  const activeMarkets = markets.filter((m) => (m.volume24h || 0) > 0).length;
  const breadthScore = Math.min(100, (activeMarkets / Math.max(markets.length, 1)) * 100);

  // Component 5: Volatility (inverted — high vol = fear, low vol = greed)
  const avgDelta = markets.reduce((s, m) => s + Math.abs(m.change24h || 0), 0) / markets.length;
  const volatilityScore = Math.max(0, 100 - avgDelta * 10);

  // Weighted composite
  const score = Math.round(
    volumeScore * 0.25 + extremityScore * 0.2 + momentumScore * 0.25 + breadthScore * 0.15 + volatilityScore * 0.15,
  );

  const clampedScore = Math.min(100, Math.max(0, score));

  return {
    score: clampedScore,
    label: getLabel(clampedScore),
    color: getColor(clampedScore),
    components: {
      volume: { score: Math.round(volumeScore), weight: 0.25, label: 'Volume Momentum' },
      extremity: { score: Math.round(extremityScore), weight: 0.2, label: 'Conviction Level' },
      momentum: { score: Math.round(momentumScore), weight: 0.25, label: 'Price Momentum' },
      breadth: { score: Math.round(breadthScore), weight: 0.15, label: 'Market Breadth' },
      volatility: { score: Math.round(volatilityScore), weight: 0.15, label: 'Volatility' },
    },
  };
}

function getLabel(score) {
  if (score <= 20) return 'Extreme Fear';
  if (score <= 40) return 'Fear';
  if (score <= 60) return 'Neutral';
  if (score <= 80) return 'Greed';
  return 'Extreme Greed';
}

function getColor(score) {
  if (score <= 20) return '#ef4444';
  if (score <= 40) return '#f97316';
  if (score <= 60) return '#f59e0b';
  if (score <= 80) return '#84cc16';
  return '#22c55e';
}
