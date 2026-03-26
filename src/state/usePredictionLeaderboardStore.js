// ═══════════════════════════════════════════════════════════════════
// charEdge — Prediction Leaderboard Store
//
// Tracks user's virtual predictions and computes accuracy score.
// Uses Brier scoring for calibration measurement.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const usePredictionLeaderboardStore = create(
  persist(
    (set, get) => ({
      // ─── State ──────────────────────────────────────────────
      predictions: [], // User's recorded predictions
      resolvedCount: 0, // Predictions that have resolved
      brierScore: null, // Overall calibration score (0 = perfect, 1 = worst)
      streak: 0, // Consecutive correct predictions
      bestStreak: 0,

      // ─── Actions ────────────────────────────────────────────

      /** Record a prediction on a market. */
      addPrediction: ({ marketId, marketTitle, outcome, confidence, source }) => {
        const prediction = {
          id: `pred-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          marketId,
          marketTitle,
          outcome, // Which outcome the user thinks will win
          confidence, // User's confidence 0-100
          source,
          createdAt: Date.now(),
          resolved: false,
          correct: null,
          actualOutcome: null,
        };
        set((s) => ({ predictions: [prediction, ...s.predictions] }));
      },

      /** Resolve a prediction (mark it correct or incorrect). */
      resolvePrediction: (predictionId, actualOutcome) => {
        const { predictions, streak, bestStreak } = get();
        const updated = predictions.map((p) => {
          if (p.id !== predictionId) return p;
          const correct = p.outcome === actualOutcome;
          return { ...p, resolved: true, correct, actualOutcome, resolvedAt: Date.now() };
        });

        const pred = updated.find((p) => p.id === predictionId);
        const newStreak = pred?.correct ? streak + 1 : 0;

        set({
          predictions: updated,
          resolvedCount: updated.filter((p) => p.resolved).length,
          streak: newStreak,
          bestStreak: Math.max(bestStreak, newStreak),
          brierScore: computeBrierScore(updated.filter((p) => p.resolved)),
        });
      },

      /** Remove a prediction. */
      removePrediction: (predictionId) => {
        set((s) => ({
          predictions: s.predictions.filter((p) => p.id !== predictionId),
        }));
      },

      /** Get stats summary. */
      getStats: () => {
        const { predictions, brierScore, streak, bestStreak } = get();
        const resolved = predictions.filter((p) => p.resolved);
        const correct = resolved.filter((p) => p.correct);
        const accuracy = resolved.length > 0 ? Math.round((correct.length / resolved.length) * 100) : 0;

        return {
          totalPredictions: predictions.length,
          resolvedCount: resolved.length,
          correctCount: correct.length,
          accuracy,
          brierScore: brierScore != null ? brierScore.toFixed(3) : '—',
          streak,
          bestStreak,
          calibrationGrade: getCalibrationGrade(brierScore),
        };
      },

      /** Get recent predictions (last 20). */
      getRecent: () => {
        return get().predictions.slice(0, 20);
      },
    }),
    {
      name: 'charEdge-prediction-leaderboard',
      version: 1,
    },
  ),
);

// ─── Brier Score computation ───────────────────────────────────

function computeBrierScore(resolvedPredictions) {
  if (resolvedPredictions.length === 0) return null;

  let sumSquaredError = 0;
  for (const p of resolvedPredictions) {
    const forecasted = (p.confidence || 50) / 100; // Convert to 0-1
    const actual = p.correct ? 1 : 0;
    sumSquaredError += Math.pow(forecasted - actual, 2);
  }

  return sumSquaredError / resolvedPredictions.length;
}

function getCalibrationGrade(brierScore) {
  if (brierScore == null) return '—';
  if (brierScore <= 0.1) return 'A+';
  if (brierScore <= 0.15) return 'A';
  if (brierScore <= 0.2) return 'B+';
  if (brierScore <= 0.25) return 'B';
  if (brierScore <= 0.3) return 'C';
  if (brierScore <= 0.4) return 'D';
  return 'F';
}

export default usePredictionLeaderboardStore;
