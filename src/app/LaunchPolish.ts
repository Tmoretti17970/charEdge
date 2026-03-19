// ═══════════════════════════════════════════════════════════════════
// charEdge — Launch Polish (Sprint 100) 🎉
//
// Performance budgets, usage telemetry (local-only, opt-in),
// app version display, guided tour steps, and console welcome.
//
// Usage:
//   import { launchPolish } from './LaunchPolish';
//   launchPolish.init();
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface PerfBudget {
  metric: string;
  budget: number;
  actual: number;
  unit: string;
  status: 'pass' | 'warn' | 'fail';
}

export interface TourStep {
  id: string;
  title: string;
  description: string;
  target: string; // CSS selector
  position: 'top' | 'bottom' | 'left' | 'right';
}

export interface UsageStats {
  tradesLogged: number;
  chartsViewed: number;
  aiQueriesRun: number;
  sessionsCount: number;
  firstSeen: number;
  lastSeen: number;
}

// ─── Constants ──────────────────────────────────────────────────

const VERSION = '1.0.0';
const BUILD = '100';
const STATS_KEY = 'charEdge-usage-stats';
const TOUR_KEY = 'charEdge-tour-complete';

// ─── Launch Polish ──────────────────────────────────────────────

class LaunchPolish {
  private _stats: UsageStats;

  constructor() {
    this._stats = this._loadStats();
  }

  /**
   * Initialize launch polish features.
   */
  init(): void {
    this._printWelcome();
    this._recordSession();
  }

  // ─── Version ─────────────────────────────────────────────────

  getVersion(): string { return VERSION; }
  getBuild(): string { return BUILD; }
  getFullVersion(): string { return `v${VERSION} (build ${BUILD})`; }

  // ─── Performance Budgets ─────────────────────────────────────

  async checkPerfBudgets(): Promise<PerfBudget[]> {
    const budgets: PerfBudget[] = [];

    // Bundle size (rough estimate from loaded scripts)
    const scripts = document.querySelectorAll('script[src]');
    budgets.push({
      metric: 'Script Count',
      budget: 20,
      actual: scripts.length,
      unit: 'files',
      status: scripts.length <= 20 ? 'pass' : scripts.length <= 30 ? 'warn' : 'fail',
    });

    // LCP via Performance API
    try {
      const entries = performance.getEntriesByType('largest-contentful-paint');
      const lcp = entries.length > 0 ? (entries[entries.length - 1] as PerformanceEntry & { startTime: number }).startTime : 0;
      budgets.push({
        metric: 'LCP',
        budget: 2500,
        actual: Math.round(lcp),
        unit: 'ms',
        status: lcp <= 2500 ? 'pass' : lcp <= 4000 ? 'warn' : 'fail',
      });
    } catch { /* */ }

    // FID (estimated from long tasks)
    try {
      const longTasks = performance.getEntriesByType('longtask');
      const maxDuration = longTasks.length > 0 ? Math.max(...longTasks.map(t => t.duration)) : 0;
      budgets.push({
        metric: 'Longest Task',
        budget: 100,
        actual: Math.round(maxDuration),
        unit: 'ms',
        status: maxDuration <= 100 ? 'pass' : maxDuration <= 300 ? 'warn' : 'fail',
      });
    } catch { /* */ }

    // DOM size
    const domSize = document.querySelectorAll('*').length;
    budgets.push({
      metric: 'DOM Nodes',
      budget: 1500,
      actual: domSize,
      unit: 'nodes',
      status: domSize <= 1500 ? 'pass' : domSize <= 3000 ? 'warn' : 'fail',
    });

    // Memory (if available)
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    if (mem) {
      const mb = Math.round(mem.usedJSHeapSize / 1048576);
      budgets.push({
        metric: 'JS Heap',
        budget: 100,
        actual: mb,
        unit: 'MB',
        status: mb <= 100 ? 'pass' : mb <= 200 ? 'warn' : 'fail',
      });
    }

    return budgets;
  }

  // ─── Guided Tour ─────────────────────────────────────────────

  getTourSteps(): TourStep[] {
    return [
      { id: 'sidebar', title: 'Navigation', description: 'Access all views from the sidebar', target: 'nav, [role="navigation"]', position: 'right' },
      { id: 'charts', title: 'Live Charts', description: 'Real-time charts with technical indicators', target: '[data-page="charts"]', position: 'bottom' },
      { id: 'journal', title: 'Trade Journal', description: 'Log and review your trades with AI insights', target: '[data-page="journal"]', position: 'bottom' },
      { id: 'copilot', title: 'AI Copilot', description: 'Ask questions and get analysis from the AI', target: '[data-copilot]', position: 'left' },
      { id: 'markets', title: 'Markets', description: 'Track watchlists and market data', target: '[data-page="markets"]', position: 'bottom' },
    ];
  }

  isTourComplete(): boolean {
    return localStorage.getItem(TOUR_KEY) === 'true';
  }

  completeTour(): void {
    localStorage.setItem(TOUR_KEY, 'true');
  }

  // ─── Usage Stats ─────────────────────────────────────────────

  getStats(): UsageStats { return { ...this._stats }; }

  recordEvent(type: 'trade' | 'chart' | 'ai'): void {
    if (type === 'trade') this._stats.tradesLogged++;
    if (type === 'chart') this._stats.chartsViewed++;
    if (type === 'ai') this._stats.aiQueriesRun++;
    this._saveStats();
  }

  // ─── Internal ────────────────────────────────────────────────

  private _printWelcome(): void {
    const style = 'color:#6366f1;font-size:14px;font-weight:bold;';
    const sub = 'color:#888;font-size:12px;';
    console.log('%c⚡ charEdge', style);
    console.log(`%c${this.getFullVersion()} — Find Your Edge`, sub);
    console.log('%cType window.__runThemeAudit() for theme diagnostics', sub);
  }

  private _recordSession(): void {
    this._stats.sessionsCount++;
    this._stats.lastSeen = Date.now();
    if (!this._stats.firstSeen) this._stats.firstSeen = Date.now();
    this._saveStats();
  }

  private _loadStats(): UsageStats {
    try {
      const raw = localStorage.getItem(STATS_KEY);
      return raw ? JSON.parse(raw) : this._defaultStats();
    } catch { return this._defaultStats(); }
  }

  private _saveStats(): void {
    try { localStorage.setItem(STATS_KEY, JSON.stringify(this._stats)); }
    catch { /* */ }
  }

  private _defaultStats(): UsageStats {
    return { tradesLogged:0, chartsViewed:0, aiQueriesRun:0, sessionsCount:0, firstSeen:0, lastSeen:0 };
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const launchPolish = new LaunchPolish();
export default launchPolish;
