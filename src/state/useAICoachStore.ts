// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — AI Coach Store (H2.3)
// Zustand state for trade grading, behavioral patterns, coaching
// reports, pre-trade analysis, and weekly summaries.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { gradeTrade, detectPatterns } from '../charting_library/ai/AITradeCoach.js';
import { generateWeeklyReport } from '../charting_library/ai/CoachingEngine.js';
import { analyzePreTrade } from '../charting_library/ai/PreTradeAnalyzer.js';
import { summarizeWeek } from '../charting_library/ai/JournalSummarizer.js';

const useAICoachStore = create(
  persist(
    (set, get) => ({
      // ─── State ──────────────────────────────────────────
      grades: [],          // Array of { tradeId, grade, timestamp }
      patterns: [],        // Detected behavioral patterns
      selectedGrade: null, // Currently viewing grade card
      panelOpen: false,

      // ─── H2.3: Coaching State ──────────────────────────
      weeklyReports: [],   // Array of coaching reports (max 12)
      preTrades: [],       // Recent pre-trade analyses (max 20)
      weeklySummaries: [],  // Weekly journal summaries (max 12)
      coachTab: 'report',  // Active tab: 'report' | 'pretrade' | 'summary'

      // ─── Settings ───────────────────────────────────────
      autoGrade: true,     // Auto-grade on journal entry

      // ─── Actions ────────────────────────────────────────

      /**
       * Grade a trade and store the result.
       * @param {Object} trade - Trade data
       * @param {Object[]} bars - Historical OHLCV context
       */
      gradeAndStore(trade, bars) {
        const grade = gradeTrade(trade, bars);
        const entry = {
          id: crypto.randomUUID(),
          tradeId: trade.id || Date.now().toString(),
          trade: {
            side: trade.side || (trade.pnl >= 0 ? 'long' : 'short'),
            entryPrice: trade.entryPrice || trade.entry,
            exitPrice: trade.exitPrice || trade.exit,
            pnl: trade.pnl,
            symbol: trade.symbol,
          },
          grade,
          timestamp: Date.now(),
        };

        const grades = [entry, ...get().grades].slice(0, 200);
        const patterns = detectPatterns(grades.map(g => g.grade));

        set({ grades, patterns });
        return grade;
      },

      setSelectedGrade(gradeEntry) {
        set({ selectedGrade: gradeEntry });
      },

      clearSelectedGrade() {
        set({ selectedGrade: null });
      },

      togglePanel() {
        set(s => ({ panelOpen: !s.panelOpen }));
      },

      setAutoGrade(enabled) {
        set({ autoGrade: enabled });
      },

      clearGrades() {
        set({ grades: [], patterns: [] });
      },

      // Get aggregate stats
      getStats() {
        const { grades } = get();
        if (!grades.length) return null;

        const scores = grades.map(g => g.grade.overallScore);
        const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
        const wins = grades.filter(g => g.grade.isWin).length;

        return {
          totalGraded: grades.length,
          averageScore: Math.round(avg),
          averageGrade: grades.length > 0 ? getGradeLetter(avg) : 'N/A',
          winRate: grades.length > 0 ? Math.round((wins / grades.length) * 100) : 0,
          recentTrend: grades.length >= 5
            ? (scores.slice(0, 5).reduce((s, v) => s + v, 0) / 5 >
               scores.slice(Math.max(0, scores.length - 5)).reduce((s, v) => s + v, 0) / 5
              ? 'improving' : 'declining')
            : 'neutral',
        };
      },

      // ─── H2.3: Coaching Actions ─────────────────────────

      setCoachTab(tab) {
        set({ coachTab: tab });
      },

      generateReport(trades, analytics, settings) {
        const report = generateWeeklyReport(trades, analytics, settings);
        if (!report) return null;
        const reports = [report, ...get().weeklyReports].slice(0, 12);
        set({ weeklyReports: reports });
        return report;
      },

      analyzeSetup(setup, trades, analytics) {
        const result = analyzePreTrade(setup, trades, analytics);
        const preTrades = [{ ...result, setup, timestamp: Date.now() }, ...get().preTrades].slice(0, 20);
        set({ preTrades });
        return result;
      },

      generateSummary(trades, notes, analytics) {
        const summary = summarizeWeek(trades, notes, analytics);
        const summaries = [summary, ...get().weeklySummaries].slice(0, 12);
        set({ weeklySummaries: summaries });
        return summary;
      },
    }),
    {
      name: 'charEdge-ai-coach',
      version: 2,
      partialize: (state) => ({
        grades: state.grades.slice(0, 50),
        autoGrade: state.autoGrade,
        weeklyReports: (state.weeklyReports || []).slice(0, 4),
        weeklySummaries: (state.weeklySummaries || []).slice(0, 4),
      }),
    },
  ),
);

function getGradeLetter(score) {
  if (score >= 93) return 'A';
  if (score >= 83) return 'B';
  if (score >= 73) return 'C';
  if (score >= 63) return 'D';
  return 'F';
}

export { useAICoachStore };
export default useAICoachStore;
