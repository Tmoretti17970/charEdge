// ═══════════════════════════════════════════════════════════════════
// charEdge v10.4 — Dashboard Widgets (Barrel Re-export)
//
// Sprint 9 #68: Decomposed from 832-line monolith into individual
// widget files. This file re-exports all widgets for backward
// compatibility — existing import sites continue to work.
//
// Widget Components:
//   StreakWidget         — C8.3: Win/loss streak tracker
//   RollingMetricsWidget — C8.4: 7/30/90-day rolling performance
//   GoalProgressWidget   — C8.5: Goal progress bars
//   SmartAlertFeedWidget — C8.6: Severity-colored alert feed
//   ContextPerformanceWidget — C8.7: Per-tag trading performance
//   DailyDebriefWidget   — C8.8: Today's summary with emotions
//   QuickStatsBar        — C8.11: Sticky top-of-page stats strip
//   DashboardPollWidget  — Social poll placeholder (quarantined)
//
// Data Exports:
//   WIDGET_REGISTRY      — C8.2: Widget metadata + categories
//   DASHBOARD_PRESETS     — C8.9: Preset dashboard layouts
// ═══════════════════════════════════════════════════════════════════

// ─── Widget Components ──────────────────────────────────────────
export { StreakWidget } from './StreakWidget.jsx';
export { RollingMetricsWidget } from './RollingMetricsWidget.jsx';
export { GoalProgressWidget } from './GoalProgressWidget.jsx';
export { SmartAlertFeedWidget } from './SmartAlertFeedWidget.jsx';
export { ContextPerformanceWidget } from './ContextPerformanceWidget.jsx';
export { DailyDebriefWidget } from './DailyDebriefWidget.jsx';
export { QuickStatsBar } from './QuickStatsBar.jsx';
export { DashboardPollWidget } from './DashboardPollWidget.jsx';

// ─── Widget Registry & Presets ──────────────────────────────────

/** C8.2 — Widget metadata: id, label, icon, grid span, default visibility, category. */
export const WIDGET_REGISTRY = {
  'stat-cards': { id: 'stat-cards', label: 'Key Stats', icon: '📊', span: 2, default: true, category: 'core' },
  'win-donut': { id: 'win-donut', label: 'Win Rate', icon: '🎯', span: 1, default: true, category: 'core' },
  'equity-curve': { id: 'equity-curve', label: 'Equity Curve', icon: '📈', span: 2, default: true, category: 'core' },
  'daily-pnl': { id: 'daily-pnl', label: 'Daily P&L', icon: '📊', span: 1, default: true, category: 'core' },
  calendar: { id: 'calendar', label: 'Calendar Heatmap', icon: '📅', span: 1, default: true, category: 'core' },
  streaks: { id: 'streaks', label: 'Streak Tracker', icon: '🔥', span: 1, default: true, category: 'performance' },
  rolling: { id: 'rolling', label: 'Rolling Metrics', icon: '📈', span: 1, default: true, category: 'performance' },
  goals: { id: 'goals', label: 'Goal Progress', icon: '🎯', span: 1, default: true, category: 'performance' },
  debrief: { id: 'debrief', label: 'Daily Debrief', icon: '☀️', span: 1, default: true, category: 'daily' },
  alerts: { id: 'alerts', label: 'Smart Alerts', icon: '🔔', span: 1, default: false, category: 'intelligence' },
  expectancy: { id: 'expectancy', label: 'Expectancy', icon: '🎲', span: 1, default: true, category: 'intelligence' },
  'context-perf': {
    id: 'context-perf',
    label: 'Context Performance',
    icon: '🧠',
    span: 1,
    default: false,
    category: 'intelligence',
  },
  'prop-firm': {
    id: 'prop-firm',
    label: 'Prop Firm Tracker',
    icon: '🏢',
    span: 2,
    default: false,
    category: 'advanced',
  },
  'recent-trades': {
    id: 'recent-trades',
    label: 'Recent Trades',
    icon: '📋',
    span: 1,
    default: true,
    category: 'core',
  },
  insights: { id: 'insights', label: 'Insights', icon: '💡', span: 1, default: true, category: 'core' },
  'risk-metrics': { id: 'risk-metrics', label: 'Risk Metrics', icon: '🛡', span: 1, default: true, category: 'risk' },
  'advanced-metrics': {
    id: 'advanced-metrics',
    label: 'Advanced Metrics',
    icon: '⚗️',
    span: 1,
    default: true,
    category: 'risk',
  },
  'community-poll': {
    id: 'community-poll',
    label: 'Poll of the Day',
    icon: '🗳️',
    span: 1,
    default: true,
    category: 'social',
  },
  'daily-challenge': {
    id: 'daily-challenge',
    label: 'Daily Challenge',
    icon: '⚡',
    span: 1,
    default: true,
    category: 'gamification',
  },
  'xp-activity': {
    id: 'xp-activity',
    label: 'XP Activity',
    icon: '✨',
    span: 1,
    default: true,
    category: 'gamification',
  },
  'weekly-challenge': {
    id: 'weekly-challenge',
    label: 'Weekly Challenge',
    icon: '🗓️',
    span: 1,
    default: true,
    category: 'gamification',
  },
};

/** C8.9 — Dashboard layout presets. */
export const DASHBOARD_PRESETS = {
  default: {
    label: 'Default',
    icon: '📊',
    widgets: [
      'stat-cards',
      'debrief',
      'daily-challenge',
      'community-poll',
      'equity-curve',
      'daily-pnl',
      'calendar',
      'streaks',
      'rolling',
      'goals',
      'expectancy',
      'recent-trades',
      'insights',
      'risk-metrics',
      'advanced-metrics',
    ],
  },
  scalper: {
    label: 'Scalper',
    icon: '⚡',
    description: "Focus on today's performance, streaks, and rapid feedback",
    widgets: ['stat-cards', 'debrief', 'streaks', 'rolling', 'daily-pnl', 'recent-trades', 'goals', 'context-perf'],
  },
  swing: {
    label: 'Swing Trader',
    icon: '🌊',
    description: 'Equity curve, calendar view, goal tracking, risk focus',
    widgets: [
      'stat-cards',
      'equity-curve',
      'calendar',
      'goals',
      'rolling',
      'risk-metrics',
      'advanced-metrics',
      'insights',
    ],
  },
  prop: {
    label: 'Prop Firm',
    icon: '🏢',
    description: 'Prop firm evaluation tracker front and center',
    widgets: ['stat-cards', 'prop-firm', 'debrief', 'daily-pnl', 'risk-metrics', 'streaks', 'goals', 'recent-trades'],
  },
  intelligence: {
    label: 'Intelligence',
    icon: '🧠',
    description: 'Smart alerts, context performance, pattern insights',
    widgets: ['stat-cards', 'debrief', 'alerts', 'expectancy', 'context-perf', 'streaks', 'rolling', 'insights', 'recent-trades'],
  },
};
