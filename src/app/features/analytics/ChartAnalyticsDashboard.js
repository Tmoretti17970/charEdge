// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Analytics Dashboard (Sprint 25)
// Aggregates chart usage telemetry, feature adoption,
// and provides iteration insights for continuous improvement.
// ═══════════════════════════════════════════════════════════════════

const ANALYTICS_KEY = 'charEdge-chart-analytics';

let _analyticsData = null;
try {
  const raw = localStorage.getItem(ANALYTICS_KEY);
  if (raw) _analyticsData = JSON.parse(raw);
} catch {}

const DEFAULT_ANALYTICS = {
  // Feature usage counters
  featureUsage: {},
  // Tool usage breakdown
  toolUsage: {},
  // Indicator popularity
  indicatorUsage: {},
  // Timeframe distribution
  timeframeUsage: {},
  // Symbol frequency
  symbolUsage: {},
  // Session metrics
  dailyActiveMinutes: {},
  // Error tracking
  errors: [],
  // Feature discovery (which features are users finding)
  featureDiscovery: {},
  // Last reset
  lastReset: null,
};

export function getAnalytics() {
  return _analyticsData || { ...DEFAULT_ANALYTICS, lastReset: Date.now() };
}

function persist(data) {
  _analyticsData = data;
  try { localStorage.setItem(ANALYTICS_KEY, JSON.stringify(data)); } catch {}
}

/**
 * Track a feature usage event.
 */
export function trackFeature(featureName, detail = {}) {
  const data = getAnalytics();
  data.featureUsage[featureName] = (data.featureUsage[featureName] || 0) + 1;
  persist(data);
}

/**
 * Track a tool usage event.
 */
export function trackTool(toolName) {
  const data = getAnalytics();
  data.toolUsage[toolName] = (data.toolUsage[toolName] || 0) + 1;
  persist(data);
}

/**
 * Track indicator usage.
 */
export function trackIndicator(indicatorName) {
  const data = getAnalytics();
  data.indicatorUsage[indicatorName] = (data.indicatorUsage[indicatorName] || 0) + 1;
  persist(data);
}

/**
 * Track timeframe selection.
 */
export function trackTimeframe(tf) {
  const data = getAnalytics();
  data.timeframeUsage[tf] = (data.timeframeUsage[tf] || 0) + 1;
  persist(data);
}

/**
 * Track symbol analysis.
 */
export function trackSymbol(symbol) {
  const data = getAnalytics();
  data.symbolUsage[symbol] = (data.symbolUsage[symbol] || 0) + 1;
  persist(data);
}

/**
 * Track daily active minutes.
 */
export function trackActiveMinutes(minutes) {
  const data = getAnalytics();
  const today = new Date().toISOString().split('T')[0];
  data.dailyActiveMinutes[today] = (data.dailyActiveMinutes[today] || 0) + minutes;
  // Keep last 90 days
  const keys = Object.keys(data.dailyActiveMinutes).sort();
  while (keys.length > 90) {
    delete data.dailyActiveMinutes[keys.shift()];
  }
  persist(data);
}

/**
 * Track an error event.
 */
export function trackError(error, context = '') {
  const data = getAnalytics();
  data.errors.push({
    message: error.message || String(error),
    context,
    timestamp: Date.now(),
  });
  // Keep last 100 errors
  data.errors = data.errors.slice(-100);
  persist(data);
}

/**
 * Track feature discovery (when a user first uses a feature).
 */
export function trackDiscovery(featureName) {
  const data = getAnalytics();
  if (!data.featureDiscovery[featureName]) {
    data.featureDiscovery[featureName] = Date.now();
    persist(data);
  }
}

/**
 * Generate a summary report of chart analytics.
 */
export function generateAnalyticsReport() {
  const data = getAnalytics();

  // Top features
  const topFeatures = Object.entries(data.featureUsage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Top tools
  const topTools = Object.entries(data.toolUsage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Top indicators
  const topIndicators = Object.entries(data.indicatorUsage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Top symbols
  const topSymbols = Object.entries(data.symbolUsage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Top timeframes
  const topTimeframes = Object.entries(data.timeframeUsage)
    .sort((a, b) => b[1] - a[1]);

  // Active days in last 30
  const last30 = Object.entries(data.dailyActiveMinutes)
    .filter(([date]) => Date.now() - new Date(date).getTime() < 30 * 86400000);
  const activeDays = last30.length;
  const totalMinutes = last30.reduce((s, [, m]) => s + m, 0);

  // Feature adoption rate
  const discoveredFeatures = Object.keys(data.featureDiscovery).length;
  const totalFeatures = 25; // Sprint count
  const adoptionRate = Math.round((discoveredFeatures / totalFeatures) * 100);

  return {
    topFeatures,
    topTools,
    topIndicators,
    topSymbols,
    topTimeframes,
    activeDays,
    totalMinutesLast30: totalMinutes,
    avgDailyMinutes: activeDays > 0 ? Math.round(totalMinutes / activeDays) : 0,
    adoptionRate,
    discoveredFeatures,
    totalErrors: data.errors.length,
    recentErrors: data.errors.slice(-5),
  };
}

/**
 * Reset analytics data.
 */
export function resetAnalytics() {
  _analyticsData = { ...DEFAULT_ANALYTICS, lastReset: Date.now() };
  persist(_analyticsData);
}
