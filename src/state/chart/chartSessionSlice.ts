// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Session Analytics & Timer (Sprint 13)
// Extends existing session store with chart-specific analytics.
// Tracks session duration, activity, and break reminders.
// ═══════════════════════════════════════════════════════════════════

const SESSION_KEY = 'charEdge-chart-sessions';

// Load persisted sessions
let _savedChartSessions = [];
try {
  const raw = localStorage.getItem(SESSION_KEY);
  if (raw) _savedChartSessions = JSON.parse(raw);
} catch (_) {}

/**
 * Create chart session analytics state (for integration with existing stores).
 */
export const createChartSessionSlice = (set, get) => ({
  // Current session
  chartSessionActive: false,
  chartSessionStart: null,
  chartSessionElapsed: 0,
  _chartTimerInterval: null,

  // Activity counters
  chartSessionStats: {
    chartsViewed: 0,
    symbolsAnalyzed: [],
    drawingsCreated: 0,
    indicatorsAdded: 0,
    tradesLogged: 0,
    snapshotsTaken: 0,
  },

  // Break management
  breakReminderEnabled: true,
  breakIntervalMinutes: 45,
  showBreakModal: false,

  // Session history
  chartSessions: _savedChartSessions,

  startChartSession: () => {
    const interval = setInterval(() => {
      const state = get();
      if (!state.chartSessionActive) return;
      const elapsed = Math.floor((Date.now() - state.chartSessionStart) / 1000);
      set({ chartSessionElapsed: elapsed });

      // Break reminder
      if (state.breakReminderEnabled && elapsed > 0) {
        const breakSec = state.breakIntervalMinutes * 60;
        if (elapsed % breakSec < 2 && elapsed >= breakSec) {
          set({ showBreakModal: true });
        }
      }
    }, 1000);

    set({
      chartSessionActive: true,
      chartSessionStart: Date.now(),
      chartSessionElapsed: 0,
      chartSessionStats: {
        chartsViewed: 0,
        symbolsAnalyzed: [],
        drawingsCreated: 0,
        indicatorsAdded: 0,
        tradesLogged: 0,
        snapshotsTaken: 0,
      },
      _chartTimerInterval: interval,
    });
  },

  endChartSession: () => {
    const state = get();
    if (!state.chartSessionActive) return null;
    clearInterval(state._chartTimerInterval);

    const session = {
      id: `csess_${state.chartSessionStart}`,
      start: state.chartSessionStart,
      end: Date.now(),
      duration: state.chartSessionElapsed,
      ...state.chartSessionStats,
      uniqueSymbols: [...new Set(state.chartSessionStats.symbolsAnalyzed)].length,
    };

    const sessions = [...state.chartSessions, session].slice(-100);
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(sessions)); } catch (_) {}

    set({
      chartSessionActive: false,
      chartSessionStart: null,
      _chartTimerInterval: null,
      chartSessions: sessions,
    });
    return session;
  },

  trackChartActivity: (type, detail) => set(s => {
    const stats = { ...s.chartSessionStats };
    switch (type) {
      case 'chart_view': stats.chartsViewed++; break;
      case 'symbol': stats.symbolsAnalyzed = [...stats.symbolsAnalyzed, detail]; break;
      case 'drawing': stats.drawingsCreated++; break;
      case 'indicator': stats.indicatorsAdded++; break;
      case 'trade': stats.tradesLogged++; break;
      case 'snapshot': stats.snapshotsTaken++; break;
    }
    return { chartSessionStats: stats };
  }),

  dismissBreak: () => set({ showBreakModal: false }),
  setBreakInterval: (min) => set({ breakIntervalMinutes: min }),
  toggleBreakReminder: () => set(s => ({ breakReminderEnabled: !s.breakReminderEnabled })),
});

/**
 * Format seconds to HH:MM:SS or MM:SS.
 */
export function formatSessionTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
