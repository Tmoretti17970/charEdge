// ═══════════════════════════════════════════════════════════════════
// charEdge — Intel Pulse Store
//
// Computes market regime, Fear & Greed score, and VIX data
// for The Pulse hero strip on the Intel page.
//
// All data is derived/computed — no external API calls yet.
// Will integrate with real data sources in later phases.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

// ─── Fear & Greed Computation ────────────────────────────────────
// Composite of multiple indicators, each scored 0-100
// Higher = more greed, Lower = more fear

function computeFearGreed() {
  // Mock components (will be replaced with real data feeds)
  const vixScore = 62; // Inverse VIX: low VIX = greed
  const momentumScore = 71; // S&P 500 vs 125-day MA
  const breadthScore = 58; // Advancing vs declining stocks
  const putCallScore = 65; // Low put/call = greed
  const safeHavenScore = 54; // Low bond demand = greed
  const junkBondScore = 68; // High junk demand = greed
  const volScore = 60; // Low realized vol = greed

  const composite = Math.round(
    (vixScore + momentumScore + breadthScore + putCallScore + safeHavenScore + junkBondScore + volScore) / 7,
  );

  return composite;
}

function getFearGreedLabel(score) {
  if (score <= 20) return 'Extreme Fear';
  if (score <= 40) return 'Fear';
  if (score <= 60) return 'Neutral';
  if (score <= 80) return 'Greed';
  return 'Extreme Greed';
}

function getFearGreedColor(score) {
  if (score <= 20) return '#dc2626'; // deep red
  if (score <= 40) return '#ef4444'; // red
  if (score <= 60) return '#f59e0b'; // yellow
  if (score <= 80) return '#22c55e'; // green
  return '#16a34a'; // deep green
}

// ─── Market Regime Computation ───────────────────────────────────

function computeRegime(vix) {
  if (vix < 15)
    return { label: 'Risk-On', color: '#22c55e', description: 'Low volatility — favorable for risk assets' };
  if (vix < 20) return { label: 'Neutral', color: '#f59e0b', description: 'Standard conditions — balanced approach' };
  if (vix < 30)
    return { label: 'Cautious', color: '#f97316', description: 'Elevated volatility — reduce position sizes' };
  return { label: 'Risk-Off', color: '#ef4444', description: 'High volatility — capital preservation mode' };
}

// ─── AI Summary Generation ───────────────────────────────────────

function generateSummary(regime, fearGreedScore, vix) {
  const sentiment = fearGreedScore > 60 ? 'Bullish' : fearGreedScore > 40 ? 'Mixed' : 'Bearish';
  const volatility = vix < 15 ? 'low' : vix < 20 ? 'normal' : vix < 30 ? 'elevated' : 'extreme';

  const summaries = {
    'Bullish-low': 'Markets bullish with low volatility. Tech leading, breadth broadening.',
    'Bullish-normal': 'Cautiously bullish ahead of key economic data. Momentum favors upside.',
    'Bullish-elevated': 'Bullish bias despite elevated VIX. Watch for sector rotation signals.',
    'Bullish-extreme': 'Unusual: bullish sentiment with extreme volatility. Proceed with caution.',
    'Mixed-low': 'Consolidation phase with low volatility. Range-bound trading likely.',
    'Mixed-normal': 'Mixed signals across sectors. Calendar events may catalyze direction.',
    'Mixed-elevated': 'Uncertainty rising. Defensive sectors outperforming growth.',
    'Mixed-extreme': 'High uncertainty with extreme moves. Risk management critical.',
    'Bearish-low': 'Bearish sentiment in calm markets. Watch for breakdown signals.',
    'Bearish-normal': 'Selling pressure building. Safe haven demand increasing.',
    'Bearish-elevated': 'Risk-off positioning accelerating. Consider hedging strategies.',
    'Bearish-extreme': 'Extreme fear dominating. Historically a contrarian signal.',
  };

  return summaries[`${sentiment}-${volatility}`] || 'Analyzing market conditions...';
}

// ─── Store ───────────────────────────────────────────────────────

const useIntelPulseStore = create((set, get) => {
  const vix = 18.4;
  const vixChange = -1.2;
  const fearGreedScore = computeFearGreed();
  const regime = computeRegime(vix);
  const summary = generateSummary(regime, fearGreedScore, vix);

  return {
    // VIX data
    vix,
    vixChange,

    // Fear & Greed
    fearGreedScore,
    fearGreedLabel: getFearGreedLabel(fearGreedScore),
    fearGreedColor: getFearGreedColor(fearGreedScore),

    // Market Regime
    regime,

    // AI Summary
    summary,

    // Refresh (will connect to real data sources later)
    refresh: () => {
      const newVix = get().vix;
      const newScore = computeFearGreed();
      const newRegime = computeRegime(newVix);
      const newSummary = generateSummary(newRegime, newScore, newVix);

      set({
        fearGreedScore: newScore,
        fearGreedLabel: getFearGreedLabel(newScore),
        fearGreedColor: getFearGreedColor(newScore),
        regime: newRegime,
        summary: newSummary,
      });
    },
  };
});

export default useIntelPulseStore;
