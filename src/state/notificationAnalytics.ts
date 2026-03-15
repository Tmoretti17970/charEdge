// ═══════════════════════════════════════════════════════════════════
// charEdge — Notification Analytics (Sprint 20)
//
// Helps users understand their alert patterns and optimize:
//   - Alert performance stats (active, stale, most active)
//   - Response time tracking
//   - False positive detection
//   - Optimization suggestions
//
// Usage:
//   import { getAlertAnalytics } from './notificationAnalytics';
//   const stats = getAlertAnalytics(alerts, history);
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

interface AlertSnapshot {
  id: string;
  symbol: string;
  condition: string;
  price: number;
  triggered: boolean;
  lastTriggered?: number;
  createdAt?: number;
  triggerCount?: number;
  expired?: boolean;
}

interface HistoryEntry {
  alertId: string;
  symbol: string;
  timestamp: number;
  priceAtTrigger: number;
  priceAfter5min?: number;
  priceAfter15min?: number;
  /** Time in ms from trigger to user opening chart */
  responseTimeMs?: number;
}

export interface AlertAnalytics {
  /** Total active alerts */
  totalActive: number;
  /** Alerts that haven't triggered in 30+ days */
  staleCount: number;
  staleAlerts: { id: string; symbol: string; daysSinceCreated: number }[];
  /** Most frequently triggered alert */
  mostActive: { symbol: string; condition: string; count: number } | null;
  /** Average response time (ms) when user has acted */
  avgResponseTimeMs: number;
  /** False positive rate (triggered but price reversed within 5min) */
  falsePositiveRate: number;
  /** Alerts by symbol */
  alertsBySymbol: Record<string, number>;
  /** Triggers by day of week (0=Sun..6=Sat) */
  triggersByDayOfWeek: number[];
  /** Triggers by hour (0–23) */
  triggersByHour: number[];
  /** Optimization suggestions */
  suggestions: AnalyticsSuggestion[];
}

export interface AnalyticsSuggestion {
  type: 'removeStale' | 'adjustThreshold' | 'consolidate' | 'frequencyChange';
  title: string;
  body: string;
  icon: string;
  /** Alert IDs this suggestion relates to */
  relatedAlertIds: string[];
}

// ─── Analytics Engine ───────────────────────────────────────────

const STALE_DAYS = 30;
const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000;

/**
 * Compute alert analytics from current alerts and trigger history.
 */
export function getAlertAnalytics(
  alerts: AlertSnapshot[],
  history: HistoryEntry[],
): AlertAnalytics {
  const now = Date.now();
  const active = alerts.filter((a) => !a.triggered && !a.expired);

  // ── Stale detection ──
  const staleAlerts = active
    .filter((a) => {
      const sinceCreated = now - (a.createdAt || now);
      return sinceCreated > STALE_MS && !a.lastTriggered;
    })
    .map((a) => ({
      id: a.id,
      symbol: a.symbol,
      daysSinceCreated: Math.floor((now - (a.createdAt || now)) / (24 * 60 * 60 * 1000)),
    }));

  // ── Most active ──
  const symbolCondMap = new Map<string, number>();
  const symbolCondDetails = new Map<string, { symbol: string; condition: string }>();
  for (const entry of history) {
    const key = `${entry.symbol}`;
    symbolCondMap.set(key, (symbolCondMap.get(key) || 0) + 1);
    if (!symbolCondDetails.has(key)) {
      symbolCondDetails.set(key, { symbol: entry.symbol, condition: '' });
    }
  }
  let mostActive: AlertAnalytics['mostActive'] = null;
  let maxCount = 0;
  symbolCondMap.forEach((count, key) => {
    if (count > maxCount) {
      maxCount = count;
      const details = symbolCondDetails.get(key);
      mostActive = { symbol: details?.symbol || key, condition: details?.condition || '', count };
    }
  });

  // ── Response time ──
  const responseTimes = history.filter((h) => h.responseTimeMs && h.responseTimeMs > 0);
  const avgResponseTimeMs = responseTimes.length
    ? responseTimes.reduce((sum, h) => sum + (h.responseTimeMs || 0), 0) / responseTimes.length
    : 0;

  // ── False positive rate ──
  const withAfterPrice = history.filter((h) => h.priceAfter5min != null);
  const falsePositives = withAfterPrice.filter((h) => {
    if (!h.priceAfter5min) return false;
    // Consider it a false positive if price reversed >1% within 5min
    const pctChange = ((h.priceAfter5min - h.priceAtTrigger) / h.priceAtTrigger) * 100;
    return Math.abs(pctChange) > 1;
  });
  const falsePositiveRate = withAfterPrice.length
    ? falsePositives.length / withAfterPrice.length
    : 0;

  // ── Alerts by symbol ──
  const alertsBySymbol: Record<string, number> = {};
  for (const a of alerts) {
    alertsBySymbol[a.symbol] = (alertsBySymbol[a.symbol] || 0) + 1;
  }

  // ── Trigger distribution ──
  const triggersByDayOfWeek = new Array(7).fill(0);
  const triggersByHour = new Array(24).fill(0);
  for (const entry of history) {
    const d = new Date(entry.timestamp);
    triggersByDayOfWeek[d.getDay()]++;
    triggersByHour[d.getHours()]++;
  }

  // ── Suggestions ──
  const suggestions: AnalyticsSuggestion[] = [];

  if (staleAlerts.length > 3) {
    suggestions.push({
      type: 'removeStale',
      title: `Remove ${staleAlerts.length} stale alerts`,
      body: `${staleAlerts.length} alerts haven't triggered in ${STALE_DAYS}+ days. Consider cleaning them up.`,
      icon: '🧹',
      relatedAlertIds: staleAlerts.map((a) => a.id),
    });
  }

  // Consolidation suggestion: symbols with 5+ alerts
  const overdoneSymbols = Object.entries(alertsBySymbol).filter(([, count]) => count >= 5);
  for (const [symbol, count] of overdoneSymbols) {
    suggestions.push({
      type: 'consolidate',
      title: `Consolidate ${symbol} alerts`,
      body: `You have ${count} alerts on ${symbol}. Consider using an alert template instead.`,
      icon: '📦',
      relatedAlertIds: alerts.filter((a) => a.symbol === symbol).map((a) => a.id),
    });
  }

  if (falsePositiveRate > 0.5 && withAfterPrice.length >= 5) {
    suggestions.push({
      type: 'frequencyChange',
      title: 'High false positive rate',
      body: `${Math.round(falsePositiveRate * 100)}% of your alerts reversed quickly. Try "Balanced" frequency mode.`,
      icon: '📊',
      relatedAlertIds: [],
    });
  }

  return {
    totalActive: active.length,
    staleCount: staleAlerts.length,
    staleAlerts,
    mostActive,
    avgResponseTimeMs,
    falsePositiveRate,
    alertsBySymbol,
    triggersByDayOfWeek,
    triggersByHour,
    suggestions,
  };
}

export default getAlertAnalytics;
