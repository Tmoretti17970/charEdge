// ═══════════════════════════════════════════════════════════════════
// charEdge — Prediction Price Alert Setup
//
// Allows users to set probability threshold alerts on markets.
// Persisted to localStorage. Shows in-app toast when triggered.
// ═══════════════════════════════════════════════════════════════════

import { memo, useState, useCallback, useMemo } from 'react';
import usePredictionAlertStore from '../../../state/usePredictionAlertStore.js';
import styles from './PredictionAlertSetup.module.css';

export default memo(function PredictionAlertSetup({ market }) {
  const allAlerts = usePredictionAlertStore((s) => s.alerts);
  const addAlert = usePredictionAlertStore((s) => s.addAlert);
  const removeAlert = usePredictionAlertStore((s) => s.removeAlert);
  const alerts = useMemo(() => allAlerts.filter((a) => a.marketId === market.id), [allAlerts, market.id]);

  const [threshold, setThreshold] = useState(50);
  const [direction, setDirection] = useState('above'); // 'above' | 'below'
  const [showForm, setShowForm] = useState(false);

  const handleAdd = useCallback(() => {
    addAlert({
      marketId: market.id,
      marketTitle: market.question,
      threshold,
      direction,
      source: market.source,
    });
    setShowForm(false);
  }, [market, threshold, direction, addAlert]);

  return (
    <div className={styles.alertSetup}>
      <div className={styles.header}>
        <span className={styles.bellIcon}>🔔</span>
        <span className={styles.headerTitle}>Price Alerts</span>
        <button className={styles.addBtn} onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕' : '+ Add'}
        </button>
      </div>

      {/* Existing alerts */}
      {alerts.length > 0 && (
        <div className={styles.alertList}>
          {alerts.map((alert) => (
            <div key={alert.id} className={styles.alertItem}>
              <span className={styles.alertCondition}>
                {alert.direction === 'above' ? '↑' : '↓'} {alert.direction} {alert.threshold}%
              </span>
              <span className={`${styles.alertStatus} ${alert.triggered ? styles.triggered : ''}`}>
                {alert.triggered ? 'Triggered' : 'Active'}
              </span>
              <button className={styles.removeBtn} onClick={() => removeAlert(alert.id)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add alert form */}
      {showForm && (
        <div className={styles.form}>
          <div className={styles.formRow}>
            <span className={styles.formLabel}>Alert when probability goes</span>
          </div>
          <div className={styles.formControls}>
            <select className={styles.dirSelect} value={direction} onChange={(e) => setDirection(e.target.value)}>
              <option value="above">Above</option>
              <option value="below">Below</option>
            </select>
            <div className={styles.thresholdWrap}>
              <input
                type="range"
                className={styles.thresholdSlider}
                min={1}
                max={99}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
              <span className={styles.thresholdValue}>{threshold}%</span>
            </div>
          </div>
          <button className={styles.createBtn} onClick={handleAdd}>
            Create Alert
          </button>
        </div>
      )}

      {alerts.length === 0 && !showForm && <p className={styles.emptyText}>No alerts set for this market</p>}
    </div>
  );
});
