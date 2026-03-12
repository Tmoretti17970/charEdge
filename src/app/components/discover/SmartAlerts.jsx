// ═══════════════════════════════════════════════════════════════════
// charEdge — Smart Alerts & Notification Engine
//
// Sprint 16: Intelligent, contextual alert management center.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useMemo } from 'react';
import { C, F, M } from '../../../constants.js';
import { alpha } from '@/shared/colorUtils';

const ALERT_TYPES = {
  price: { icon: '💰', label: 'Price Level', color: C.g },
  volume: { icon: '📊', label: 'Volume Spike', color: '#818cf8' },
  pattern: { icon: '📐', label: 'Pattern Complete', color: '#f0b64e' },
  earnings: { icon: '📅', label: 'Earnings Event', color: '#38bdf8' },
  insider: { icon: '🏛️', label: 'Insider Activity', color: '#c084fc' },
  analyst: { icon: '⭐', label: 'Analyst Change', color: '#fb923c' },
  sentiment: { icon: '💬', label: 'Sentiment Shift', color: '#f472b6' },
};

const PRIORITY_META = {
  critical: { label: 'Critical', color: C.r, icon: '🔴' },
  important: { label: 'Important', color: '#f0b64e', icon: '🟡' },
  fyi: { label: 'FYI', color: '#4e8bf5', icon: '🔵' },
};

const MOCK_ALERTS = [
  { id: 1, type: 'price', symbol: 'NVDA', priority: 'critical', message: 'Broke above $900 resistance', time: '3m ago', outcome: null },
  { id: 2, type: 'pattern', symbol: 'META', priority: 'important', message: 'Cup & Handle completion — bullish continuation', time: '12m ago', outcome: null },
  { id: 3, type: 'insider', symbol: 'JPM', priority: 'important', message: 'Cluster buy detected — CEO + Director bought $7.9M', time: '28m ago', outcome: null },
  { id: 4, type: 'volume', symbol: 'TSLA', priority: 'critical', message: 'Volume 3.2x average — unusual activity detected', time: '45m ago', outcome: null },
  { id: 5, type: 'analyst', symbol: 'AAPL', priority: 'fyi', message: 'Morgan Stanley upgraded to Overweight, PT $235', time: '1h ago', outcome: null },
  { id: 6, type: 'sentiment', symbol: 'BTC', priority: 'important', message: 'Social sentiment flipped bullish (was neutral for 5 days)', time: '1h ago', outcome: null },
  { id: 7, type: 'earnings', symbol: 'AMZN', priority: 'fyi', message: 'Earnings in 3 days — IV rank at 78, consider position adjustment', time: '2h ago', outcome: null },
  { id: 8, type: 'price', symbol: 'SPY', priority: 'critical', message: 'Testing 50-day SMA support at $502', time: '3h ago', outcome: '+1.2% bounce' },
  { id: 9, type: 'pattern', symbol: 'GOOGL', priority: 'important', message: 'Golden Cross (50/200 SMA) confirmed on daily', time: '5h ago', outcome: '+3.4% since alert' },
  { id: 10, type: 'volume', symbol: 'AMD', priority: 'fyi', message: 'Dark pool activity spike — 2.8M shares block traded', time: '6h ago', outcome: '-0.8% since alert' },
];

function SmartAlerts() {
  const [collapsed, setCollapsed] = useState(false);
  const [filter, setFilter] = useState('all');
  const [quietMode, setQuietMode] = useState(false);

  const alerts = useMemo(() => {
    if (filter === 'critical') return MOCK_ALERTS.filter((a) => a.priority === 'critical');
    if (filter === 'unresolved') return MOCK_ALERTS.filter((a) => !a.outcome);
    if (filter === 'resolved') return MOCK_ALERTS.filter((a) => a.outcome);
    return MOCK_ALERTS;
  }, [filter]);

  const criticalCount = MOCK_ALERTS.filter((a) => a.priority === 'critical').length;

  return (
    <div style={{ background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 16, overflow: 'hidden' }}>
      <button onClick={() => setCollapsed(!collapsed)} className="tf-btn"
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🔔</span>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: F }}>Smart Alerts</h3>
          {criticalCount > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, color: C.r, background: alpha(C.r, 0.1), padding: '2px 7px', borderRadius: 4, fontFamily: M }}>
              {criticalCount} critical
            </span>
          )}
          {quietMode && (
            <span style={{ fontSize: 9, color: C.t3, fontFamily: F }}>🔇 Quiet</span>
          )}
        </div>
        <span style={{ color: C.t3, fontSize: 11, transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s ease' }}>▾</span>
      </button>

      {!collapsed && (
        <div style={{ padding: '0 20px 20px' }}>
          {/* Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {['all', 'critical', 'unresolved', 'resolved'].map((f) => (
                <button key={f} onClick={() => setFilter(f)} className="tf-btn"
                  style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${filter === f ? C.b : 'transparent'}`, background: filter === f ? alpha(C.b, 0.08) : 'transparent', color: filter === f ? C.b : C.t3, cursor: 'pointer', fontSize: 10, fontWeight: 600, fontFamily: F, textTransform: 'capitalize' }}>
                  {f === 'all' ? '📋 All' : f === 'critical' ? '🔴 Critical' : f === 'unresolved' ? '⏳ Active' : '✅ Resolved'}
                </button>
              ))}
            </div>
            <button onClick={() => setQuietMode(!quietMode)} className="tf-btn"
              style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${quietMode ? C.y : 'transparent'}`, background: quietMode ? alpha(C.y, 0.08) : 'transparent', color: quietMode ? C.y : C.t3, cursor: 'pointer', fontSize: 10, fontWeight: 600, fontFamily: F }}>
              {quietMode ? '🔇 Quiet On' : '🔔 Alerts On'}
            </button>
          </div>

          {/* Alert Feed */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 380, overflowY: 'auto' }}>
            {alerts.map((alert) => {
              const at = ALERT_TYPES[alert.type];
              const pm = PRIORITY_META[alert.priority];
              return (
                <div key={alert.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: alpha(C.sf, alert.priority === 'critical' ? 0.8 : 0.4), border: `1px solid ${alert.priority === 'critical' ? alpha(pm.color, 0.2) : alpha(C.bd, 0.3)}`, borderRadius: 8, borderLeft: `3px solid ${pm.color}` }}>
                  <span style={{ fontSize: 16, marginTop: 2 }}>{at.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>{alert.symbol}</span>
                      <span style={{ fontSize: 8, fontWeight: 700, color: at.color, background: alpha(at.color, 0.1), padding: '1px 5px', borderRadius: 3, fontFamily: F }}>{at.label}</span>
                      <span style={{ fontSize: 8, fontWeight: 600, color: pm.color, fontFamily: F }}>{pm.icon}</span>
                      <span style={{ fontSize: 9, color: C.t3, fontFamily: F, marginLeft: 'auto' }}>{alert.time}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.t2, fontFamily: F, lineHeight: 1.4 }}>{alert.message}</div>
                    {alert.outcome && (
                      <div style={{ marginTop: 4, fontSize: 10, fontFamily: M }}>
                        <span style={{ color: C.t3 }}>Outcome: </span>
                        <span style={{ fontWeight: 600, color: alert.outcome.startsWith('+') ? C.g : C.r }}>{alert.outcome}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export { SmartAlerts };

export default React.memo(SmartAlerts);
