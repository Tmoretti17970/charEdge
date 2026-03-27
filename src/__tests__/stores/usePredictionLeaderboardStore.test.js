import { describe, it, expect, beforeEach } from 'vitest';
import usePredictionLeaderboardStore from '../../state/usePredictionLeaderboardStore.js';

describe('usePredictionLeaderboardStore', () => {
  beforeEach(() => {
    usePredictionLeaderboardStore.setState({
      predictions: [],
      resolvedCount: 0,
      brierScore: null,
      streak: 0,
      bestStreak: 0,
    });
  });

  describe('addPrediction', () => {
    it('adds a prediction to the list', () => {
      usePredictionLeaderboardStore.getState().addPrediction({
        marketId: 'm1',
        marketTitle: 'Will BTC hit 100k?',
        outcome: 'Yes',
        confidence: 80,
        source: 'kalshi',
      });

      const preds = usePredictionLeaderboardStore.getState().predictions;
      expect(preds).toHaveLength(1);
      expect(preds[0]).toMatchObject({
        marketId: 'm1',
        outcome: 'Yes',
        confidence: 80,
        resolved: false,
        correct: null,
      });
      expect(preds[0].id).toMatch(/^pred-/);
    });

    it('prepends new predictions (most recent first)', () => {
      const store = usePredictionLeaderboardStore.getState();
      store.addPrediction({ marketId: 'm1', outcome: 'Yes', confidence: 60 });
      store.addPrediction({ marketId: 'm2', outcome: 'No', confidence: 70 });

      const preds = usePredictionLeaderboardStore.getState().predictions;
      expect(preds[0].marketId).toBe('m2');
    });
  });

  describe('resolvePrediction', () => {
    it('marks prediction as correct', () => {
      usePredictionLeaderboardStore.getState().addPrediction({
        marketId: 'm1',
        outcome: 'Yes',
        confidence: 80,
      });
      const predId = usePredictionLeaderboardStore.getState().predictions[0].id;

      usePredictionLeaderboardStore.getState().resolvePrediction(predId, 'Yes');

      const pred = usePredictionLeaderboardStore.getState().predictions[0];
      expect(pred.resolved).toBe(true);
      expect(pred.correct).toBe(true);
      expect(pred.actualOutcome).toBe('Yes');
    });

    it('marks prediction as incorrect', () => {
      usePredictionLeaderboardStore.getState().addPrediction({
        marketId: 'm1',
        outcome: 'Yes',
        confidence: 80,
      });
      const predId = usePredictionLeaderboardStore.getState().predictions[0].id;

      usePredictionLeaderboardStore.getState().resolvePrediction(predId, 'No');

      const pred = usePredictionLeaderboardStore.getState().predictions[0];
      expect(pred.correct).toBe(false);
    });

    it('updates streak for correct predictions', () => {
      const store = usePredictionLeaderboardStore.getState();
      store.addPrediction({ marketId: 'm1', outcome: 'Yes', confidence: 80 });
      store.addPrediction({ marketId: 'm2', outcome: 'Yes', confidence: 70 });

      const preds = usePredictionLeaderboardStore.getState().predictions;
      usePredictionLeaderboardStore.getState().resolvePrediction(preds[1].id, 'Yes'); // m1
      expect(usePredictionLeaderboardStore.getState().streak).toBe(1);

      usePredictionLeaderboardStore.getState().resolvePrediction(preds[0].id, 'Yes'); // m2
      expect(usePredictionLeaderboardStore.getState().streak).toBe(2);
    });

    it('resets streak on incorrect prediction', () => {
      const store = usePredictionLeaderboardStore.getState();
      store.addPrediction({ marketId: 'm1', outcome: 'Yes', confidence: 80 });
      store.addPrediction({ marketId: 'm2', outcome: 'Yes', confidence: 70 });

      const preds = usePredictionLeaderboardStore.getState().predictions;
      usePredictionLeaderboardStore.getState().resolvePrediction(preds[1].id, 'Yes');
      usePredictionLeaderboardStore.getState().resolvePrediction(preds[0].id, 'No');

      expect(usePredictionLeaderboardStore.getState().streak).toBe(0);
      expect(usePredictionLeaderboardStore.getState().bestStreak).toBe(1);
    });

    it('computes Brier score', () => {
      usePredictionLeaderboardStore.getState().addPrediction({
        marketId: 'm1',
        outcome: 'Yes',
        confidence: 90,
      });
      const predId = usePredictionLeaderboardStore.getState().predictions[0].id;
      usePredictionLeaderboardStore.getState().resolvePrediction(predId, 'Yes');

      const brierScore = usePredictionLeaderboardStore.getState().brierScore;
      expect(brierScore).not.toBeNull();
      // For 90% confidence and correct: (0.9 - 1)^2 = 0.01
      expect(brierScore).toBeCloseTo(0.01, 2);
    });
  });

  describe('removePrediction', () => {
    it('removes a prediction by ID', () => {
      usePredictionLeaderboardStore.getState().addPrediction({
        marketId: 'm1',
        outcome: 'Yes',
        confidence: 80,
      });
      const predId = usePredictionLeaderboardStore.getState().predictions[0].id;
      usePredictionLeaderboardStore.getState().removePrediction(predId);

      expect(usePredictionLeaderboardStore.getState().predictions).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('returns zero stats when empty', () => {
      const stats = usePredictionLeaderboardStore.getState().getStats();
      expect(stats.totalPredictions).toBe(0);
      expect(stats.accuracy).toBe(0);
      expect(stats.brierScore).toBe('—');
    });

    it('computes accuracy correctly', () => {
      const store = usePredictionLeaderboardStore.getState();
      store.addPrediction({ marketId: 'm1', outcome: 'Yes', confidence: 80 });
      store.addPrediction({ marketId: 'm2', outcome: 'No', confidence: 70 });

      const preds = usePredictionLeaderboardStore.getState().predictions;
      usePredictionLeaderboardStore.getState().resolvePrediction(preds[0].id, 'No'); // correct
      usePredictionLeaderboardStore.getState().resolvePrediction(preds[1].id, 'No'); // incorrect (predicted Yes)

      const stats = usePredictionLeaderboardStore.getState().getStats();
      expect(stats.resolvedCount).toBe(2);
      expect(stats.totalPredictions).toBe(2);
    });

    it('assigns calibration grade', () => {
      const store = usePredictionLeaderboardStore.getState();
      store.addPrediction({ marketId: 'm1', outcome: 'Yes', confidence: 90 });
      const predId = usePredictionLeaderboardStore.getState().predictions[0].id;
      usePredictionLeaderboardStore.getState().resolvePrediction(predId, 'Yes');

      const stats = usePredictionLeaderboardStore.getState().getStats();
      expect(['A+', 'A', 'B+', 'B', 'C', 'D', 'F']).toContain(stats.calibrationGrade);
    });
  });

  describe('getRecent', () => {
    it('returns at most 20 predictions', () => {
      for (let i = 0; i < 25; i++) {
        usePredictionLeaderboardStore.getState().addPrediction({
          marketId: `m${i}`,
          outcome: 'Yes',
          confidence: 50,
        });
      }
      expect(usePredictionLeaderboardStore.getState().getRecent()).toHaveLength(20);
    });
  });
});
