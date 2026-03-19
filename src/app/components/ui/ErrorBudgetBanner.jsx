// ═══════════════════════════════════════════════════════════════════
// charEdge — Error Budget Banner (Sprint 4, Task 4.4.3)
//
// Subtle dismissable warning banner shown when error budgets are
// breached. Listens for 'charEdge:error-budget-breached' events.
// Only shows after errors persist for >5s.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import { C, M } from '../../../constants.js';

function ErrorBudgetBanner() {
  const [visible, setVisible] = useState(false);
  const [categories, setCategories] = useState([]);
  const [dismissed, setDismissed] = useState(false);

  const handleBreach = useCallback((e) => {
    const { breachedCategories } = e.detail || {};
    if (!breachedCategories?.length) return;

    setCategories(breachedCategories);
    setDismissed(false);

    // Delay display by 5s to avoid flashing on transient spikes
    const timer = setTimeout(() => setVisible(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    window.addEventListener('charEdge:error-budget-breached', handleBreach);
    return () => window.removeEventListener('charEdge:error-budget-breached', handleBreach);
  }, [handleBreach]);

  // Auto-hide after 60s
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), 60_000);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible || dismissed) return null;

  return (
    <div
      id="error-budget-banner"
      role="alert"
      style={{
        position: 'fixed',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 16px',
        borderRadius: 10,
        background: 'rgba(239, 83, 80, 0.12)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(239, 83, 80, 0.25)',
        color: '#ef5350',
        fontSize: 12,
        fontFamily: M,
        fontWeight: 600,
        maxWidth: 480,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
        animation: 'fadeSlideDown 0.3s ease',
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
      <div style={{ flex: 1 }}>
        <div>Data quality degraded</div>
        <div style={{ fontSize: 10, fontWeight: 400, color: C.t3, marginTop: 2 }}>
          Issues: {categories.join(', ')}
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        style={{
          all: 'unset',
          cursor: 'pointer',
          padding: '2px 6px',
          borderRadius: 4,
          fontSize: 10,
          color: C.t3,
          flexShrink: 0,
        }}
        aria-label="Dismiss error banner"
      >
        ✕
      </button>
    </div>
  );
}

export default React.memo(ErrorBudgetBanner);
