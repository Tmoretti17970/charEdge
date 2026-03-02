// ═══════════════════════════════════════════════════════════════════
// charEdge — Performance Heatmap Overlay (Sprint 15)
// Generates trade performance heatmap data for chart overlay.
// Shows where in price space the trader has profitable/losing trades.
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate a heatmap of trade performance across price levels.
 * @param {Object[]} trades - Trade history { entry, exit, pnl, side, symbol }
 * @param {Object[]} bars - Chart bars for price range
 * @param {number} bins - Number of vertical bins
 * @returns {Object[]} Heatmap bins { priceStart, priceEnd, wins, losses, totalPnl, color, opacity }
 */
export function generatePerformanceHeatmap(trades, bars, bins = 24) {
  if (!trades?.length || !bars?.length) return [];

  let minPrice = Infinity, maxPrice = -Infinity;
  for (const b of bars) {
    if (b.low < minPrice) minPrice = b.low;
    if (b.high > maxPrice) maxPrice = b.high;
  }

  if (minPrice === Infinity || minPrice === maxPrice) return [];
  const step = (maxPrice - minPrice) / bins;

  const heatBins = new Array(bins).fill(null).map((_, i) => ({
    priceStart: minPrice + i * step,
    priceEnd: minPrice + (i + 1) * step,
    priceCenter: minPrice + (i + 0.5) * step,
    wins: 0,
    losses: 0,
    totalPnl: 0,
    tradeCount: 0,
  }));

  // Assign trades to bins based on entry price
  for (const trade of trades) {
    const entryPrice = trade.entry || trade.entryPrice || 0;
    if (entryPrice < minPrice || entryPrice > maxPrice) continue;

    let binIdx = Math.floor((entryPrice - minPrice) / step);
    binIdx = Math.max(0, Math.min(binIdx, bins - 1));

    const pnl = trade.pnl || trade.profit || 0;
    heatBins[binIdx].tradeCount++;
    heatBins[binIdx].totalPnl += pnl;
    if (pnl >= 0) heatBins[binIdx].wins++;
    else heatBins[binIdx].losses++;
  }

  // Compute colors and opacity
  const maxPnl = Math.max(...heatBins.map(b => Math.abs(b.totalPnl)), 1);

  return heatBins.map(bin => {
    if (bin.tradeCount === 0) return { ...bin, color: 'transparent', opacity: 0 };

    const winRate = bin.wins / bin.tradeCount;
    const intensity = Math.min(Math.abs(bin.totalPnl) / maxPnl, 1);

    return {
      ...bin,
      winRate: Math.round(winRate * 100),
      color: bin.totalPnl >= 0
        ? `rgba(38, 166, 154, ${0.1 + 0.4 * intensity})`
        : `rgba(239, 83, 80, ${0.1 + 0.4 * intensity})`,
      opacity: 0.1 + 0.5 * intensity,
    };
  });
}

/**
 * Generate time-of-day performance distribution.
 * @param {Object[]} trades
 * @returns {Object[]} Hourly P&L distribution
 */
export function generateTimeHeatmap(trades) {
  const hours = new Array(24).fill(null).map((_, h) => ({
    hour: h,
    label: `${String(h).padStart(2, '0')}:00`,
    tradeCount: 0,
    totalPnl: 0,
    wins: 0,
    losses: 0,
  }));

  for (const trade of trades) {
    const time = trade.entryTime || trade.timestamp || trade.time;
    if (!time) continue;
    const hour = new Date(time).getHours();
    const pnl = trade.pnl || trade.profit || 0;
    hours[hour].tradeCount++;
    hours[hour].totalPnl += pnl;
    if (pnl >= 0) hours[hour].wins++;
    else hours[hour].losses++;
  }

  return hours;
}

/**
 * Generate day-of-week performance distribution.
 */
export function generateDayHeatmap(trades) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => ({
    day: d,
    dayIdx: i,
    tradeCount: 0,
    totalPnl: 0,
    wins: 0,
    losses: 0,
  }));

  for (const trade of trades) {
    const time = trade.entryTime || trade.timestamp || trade.time;
    if (!time) continue;
    const dayIdx = new Date(time).getDay();
    const pnl = trade.pnl || trade.profit || 0;
    days[dayIdx].tradeCount++;
    days[dayIdx].totalPnl += pnl;
    if (pnl >= 0) days[dayIdx].wins++;
    else days[dayIdx].losses++;
  }

  return days;
}
