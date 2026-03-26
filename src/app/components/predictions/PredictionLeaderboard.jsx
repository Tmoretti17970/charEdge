// ═══════════════════════════════════════════════════════════════════
// charEdge — Prediction Leaderboard
//
// Shows user's prediction accuracy stats, Brier score, streak,
// and recent predictions with outcomes.
// ═══════════════════════════════════════════════════════════════════

import { memo, useMemo } from 'react';
import usePredictionLeaderboardStore from '../../../state/usePredictionLeaderboardStore.js';
import styles from './PredictionLeaderboard.module.css';

export default memo(function PredictionLeaderboard() {
  const getStats = usePredictionLeaderboardStore((s) => s.getStats);
  const getRecent = usePredictionLeaderboardStore((s) => s.getRecent);
  const _predictions = usePredictionLeaderboardStore((s) => s.predictions);

  const stats = useMemo(() => getStats(), [getStats]);
  const recent = useMemo(() => getRecent(), [getRecent]);

  return (
    <div className={styles.leaderboard}>
      <div className={styles.header}>
        <h3 className={styles.title}>Your Predictions</h3>
        <span className={styles.subtitle}>Track your forecasting accuracy</span>
      </div>

      {/* Stats cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats.accuracy}%</span>
          <span className={styles.statLabel}>Accuracy</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats.calibrationGrade}</span>
          <span className={styles.statLabel}>Calibration</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats.brierScore}</span>
          <span className={styles.statLabel}>Brier Score</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats.streak}</span>
          <span className={styles.statLabel}>Streak</span>
        </div>
      </div>

      {/* Summary row */}
      <div className={styles.summaryRow}>
        <span>{stats.totalPredictions} predictions</span>
        <span>{stats.resolvedCount} resolved</span>
        <span>{stats.correctCount} correct</span>
        <span>Best streak: {stats.bestStreak}</span>
      </div>

      {/* Recent predictions */}
      {recent.length > 0 ? (
        <div className={styles.recentList}>
          <div className={styles.recentHeader}>Recent Predictions</div>
          {recent.map((p) => (
            <div key={p.id} className={styles.recentItem}>
              <span className={styles.recentStatus}>{p.resolved ? (p.correct ? '✓' : '✗') : '○'}</span>
              <span className={styles.recentTitle}>{p.marketTitle}</span>
              <span className={styles.recentOutcome}>{p.outcome}</span>
              <span className={styles.recentConfidence}>{p.confidence}%</span>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>🎯</span>
          <p className={styles.emptyText}>No predictions yet</p>
          <p className={styles.emptySub}>Open a market and record your prediction to start tracking accuracy</p>
        </div>
      )}
    </div>
  );
});
