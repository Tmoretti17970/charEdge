import { describe, it, expect, beforeEach } from 'vitest';
import usePredictionAlertStore from '../../state/usePredictionAlertStore.js';

describe('usePredictionAlertStore', () => {
  beforeEach(() => {
    usePredictionAlertStore.setState({ alerts: [] });
  });

  describe('addAlert', () => {
    it('adds an alert with correct shape', () => {
      usePredictionAlertStore.getState().addAlert({
        marketId: 'm1',
        marketTitle: 'Will BTC hit 100k?',
        threshold: 70,
        direction: 'above',
        source: 'kalshi',
      });

      const alerts = usePredictionAlertStore.getState().alerts;
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({
        marketId: 'm1',
        marketTitle: 'Will BTC hit 100k?',
        threshold: 70,
        direction: 'above',
        source: 'kalshi',
        triggered: false,
        triggeredAt: null,
      });
      expect(alerts[0].id).toMatch(/^alert-/);
    });

    it('adds multiple alerts', () => {
      const store = usePredictionAlertStore.getState();
      store.addAlert({ marketId: 'm1', threshold: 70, direction: 'above' });
      store.addAlert({ marketId: 'm2', threshold: 30, direction: 'below' });

      expect(usePredictionAlertStore.getState().alerts).toHaveLength(2);
    });
  });

  describe('removeAlert', () => {
    it('removes an alert by ID', () => {
      usePredictionAlertStore.getState().addAlert({ marketId: 'm1', threshold: 70, direction: 'above' });
      const alertId = usePredictionAlertStore.getState().alerts[0].id;

      usePredictionAlertStore.getState().removeAlert(alertId);
      expect(usePredictionAlertStore.getState().alerts).toHaveLength(0);
    });

    it('does not remove other alerts', () => {
      const store = usePredictionAlertStore.getState();
      store.addAlert({ marketId: 'm1', threshold: 70, direction: 'above' });
      store.addAlert({ marketId: 'm2', threshold: 30, direction: 'below' });
      const alertId = usePredictionAlertStore.getState().alerts[0].id;

      usePredictionAlertStore.getState().removeAlert(alertId);
      expect(usePredictionAlertStore.getState().alerts).toHaveLength(1);
    });
  });

  describe('getAlertsForMarket', () => {
    it('returns alerts for a specific market', () => {
      const store = usePredictionAlertStore.getState();
      store.addAlert({ marketId: 'm1', threshold: 70, direction: 'above' });
      store.addAlert({ marketId: 'm2', threshold: 30, direction: 'below' });
      store.addAlert({ marketId: 'm1', threshold: 50, direction: 'below' });

      const m1Alerts = usePredictionAlertStore.getState().getAlertsForMarket('m1');
      expect(m1Alerts).toHaveLength(2);
    });
  });

  describe('getActiveAlerts', () => {
    it('returns only untriggered alerts', () => {
      usePredictionAlertStore.getState().addAlert({ marketId: 'm1', threshold: 70, direction: 'above' });
      const alerts = usePredictionAlertStore.getState().alerts;

      // Manually trigger one
      usePredictionAlertStore.setState({
        alerts: [{ ...alerts[0], triggered: true }],
      });

      expect(usePredictionAlertStore.getState().getActiveAlerts()).toHaveLength(0);
    });
  });

  describe('checkAlerts', () => {
    it('triggers alerts when conditions are met (above)', () => {
      usePredictionAlertStore.getState().addAlert({
        marketId: 'm1',
        threshold: 70,
        direction: 'above',
      });

      const markets = [{ id: 'm1', outcomes: [{ probability: 75 }] }];
      const triggered = usePredictionAlertStore.getState().checkAlerts(markets);

      expect(triggered).toHaveLength(1);
      expect(triggered[0].currentProbability).toBe(75);
      expect(usePredictionAlertStore.getState().alerts[0].triggered).toBe(true);
    });

    it('triggers alerts when conditions are met (below)', () => {
      usePredictionAlertStore.getState().addAlert({
        marketId: 'm1',
        threshold: 30,
        direction: 'below',
      });

      const markets = [{ id: 'm1', outcomes: [{ probability: 25 }] }];
      const triggered = usePredictionAlertStore.getState().checkAlerts(markets);

      expect(triggered).toHaveLength(1);
    });

    it('does not trigger when conditions are not met', () => {
      usePredictionAlertStore.getState().addAlert({
        marketId: 'm1',
        threshold: 70,
        direction: 'above',
      });

      const markets = [{ id: 'm1', outcomes: [{ probability: 60 }] }];
      const triggered = usePredictionAlertStore.getState().checkAlerts(markets);

      expect(triggered).toHaveLength(0);
      expect(usePredictionAlertStore.getState().alerts[0].triggered).toBe(false);
    });

    it('does not re-trigger already triggered alerts', () => {
      usePredictionAlertStore.getState().addAlert({
        marketId: 'm1',
        threshold: 70,
        direction: 'above',
      });

      const markets = [{ id: 'm1', outcomes: [{ probability: 75 }] }];
      usePredictionAlertStore.getState().checkAlerts(markets);
      const secondCheck = usePredictionAlertStore.getState().checkAlerts(markets);

      expect(secondCheck).toHaveLength(0);
    });

    it('ignores markets not in the data', () => {
      usePredictionAlertStore.getState().addAlert({
        marketId: 'missing',
        threshold: 70,
        direction: 'above',
      });

      const triggered = usePredictionAlertStore.getState().checkAlerts([]);
      expect(triggered).toHaveLength(0);
    });
  });

  describe('clearTriggered', () => {
    it('removes triggered alerts, keeps active ones', () => {
      usePredictionAlertStore.getState().addAlert({ marketId: 'm1', threshold: 70, direction: 'above' });
      usePredictionAlertStore.getState().addAlert({ marketId: 'm2', threshold: 30, direction: 'below' });

      // Trigger the first one
      usePredictionAlertStore.getState().checkAlerts([{ id: 'm1', outcomes: [{ probability: 80 }] }]);

      usePredictionAlertStore.getState().clearTriggered();
      const alerts = usePredictionAlertStore.getState().alerts;
      expect(alerts).toHaveLength(1);
      expect(alerts[0].marketId).toBe('m2');
    });
  });

  describe('getTriggeredCount', () => {
    it('returns count of triggered alerts', () => {
      usePredictionAlertStore.getState().addAlert({ marketId: 'm1', threshold: 70, direction: 'above' });
      usePredictionAlertStore.getState().checkAlerts([{ id: 'm1', outcomes: [{ probability: 80 }] }]);

      expect(usePredictionAlertStore.getState().getTriggeredCount()).toBe(1);
    });
  });
});
