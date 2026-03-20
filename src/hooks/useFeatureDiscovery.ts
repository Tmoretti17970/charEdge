// ═══════════════════════════════════════════════════════════════════
// charEdge — useFeatureDiscovery (Sprint 16)
//
// Hook that returns which features should be spotlighted based on
// trade count + usage. Checks against discoveredFeatures in store.
// ═══════════════════════════════════════════════════════════════════

import { useUserStore } from '../state/useUserStore';
import { useJournalStore } from '../state/useJournalStore';

const FEATURE_MILESTONES = [
  { feature: 'equityCurve',      minTrades: 1,   icon: '📈', title: 'Equity Curve',          desc: 'Track your portfolio growth over time' },
  { feature: 'heatmap',          minTrades: 5,   icon: '🗓', title: 'Trade Heatmap',          desc: 'See when you trade best' },
  { feature: 'strategyDetect',   minTrades: 10,  icon: '📚', title: 'Strategy Detection',     desc: 'Your playbooks are forming!' },
  { feature: 'monteCarlo',       minTrades: 20,  icon: '🔬', title: 'Monte Carlo Simulation', desc: 'Forecast your edge with simulations' },
  { feature: 'psychologyInsight', minTrades: 25, icon: '🧠', title: 'Psychology Analysis',    desc: 'Spot emotional patterns in your trading' },
  { feature: 'riskModel',        minTrades: 50,  icon: '🎯', title: 'Risk Modeling',          desc: 'Full risk analytics suite unlocked' },
  { feature: 'walkForward',      minTrades: 100, icon: '🔄', title: 'Walk-Forward Analysis',  desc: 'Advanced out-of-sample testing' },
];

export function useFeatureDiscovery() {
  const tradeCount = useJournalStore((s) => s.trades?.length ?? 0);
  const discovered = useUserStore((s) => s.discoveredFeatures ?? []);
  const markDiscovered = useUserStore((s) => s.markDiscovered);

  // Features that are newly unlocked (trade count threshold met, not yet discovered)
  const spotlights = FEATURE_MILESTONES.filter(
    (m) => tradeCount >= m.minTrades && !discovered.includes(m.feature)
  );

  // Next milestone (first one not yet unlocked)
  const nextMilestone = FEATURE_MILESTONES.find((m) => tradeCount < m.minTrades);

  return {
    spotlights,
    nextMilestone,
    tradeCount,
    dismiss: (featureId) => markDiscovered(featureId),
  };
}

export { FEATURE_MILESTONES };
