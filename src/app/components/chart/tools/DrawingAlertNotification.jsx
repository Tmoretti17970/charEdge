// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Alert Notification Toast
// Shows a brief toast when a drawing alert fires (price crossing).
// Listens for charEdge:drawing-alert custom event.
// Apple-style glassmorphism with direction arrow and auto-dismiss.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';

const DISMISS_MS = 5000;

export default function DrawingAlertNotification() {
  const [alerts, setAlerts] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
    const t = timersRef.current.get(id);
    if (t) { clearTimeout(t); timersRef.current.delete(id); }
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const detail = e.detail;
      if (!detail) return;
      const id = `alert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const alert = { id, ...detail, createdAt: Date.now() };
      setAlerts(prev => [...prev.slice(-4), alert]); // Cap at 5
      
      // Play chime
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = detail.direction === 'up' ? 880 : 660;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      } catch {}

      // Auto-dismiss
      const timer = setTimeout(() => dismiss(id), DISMISS_MS);
      timersRef.current.set(id, timer);
    };

    window.addEventListener('charEdge:drawing-alert', handler);
    return () => {
      window.removeEventListener('charEdge:drawing-alert', handler);
      for (const t of timersRef.current.values()) clearTimeout(t);
    };
  }, [dismiss]);

  if (alerts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', top: 64, right: 16,
      display: 'flex', flexDirection: 'column', gap: 8,
      zIndex: 10001, pointerEvents: 'none',
    }}>
      {alerts.map(alert => {
        const age = Date.now() - alert.createdAt;
        const fadeOut = age > DISMISS_MS - 600;
        return (
          <div
            key={alert.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(24, 26, 32, 0.92)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(41, 98, 255, 0.2)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              color: '#D1D4DC',
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
              fontSize: 13,
              pointerEvents: 'auto',
              cursor: 'pointer',
              animation: 'slideInRight 0.25s ease-out',
              opacity: fadeOut ? 0.4 : 1,
              transition: 'opacity 0.6s ease',
            }}
            onClick={() => dismiss(alert.id)}
          >
            {/* Direction arrow */}
            <span style={{
              fontSize: 18,
              color: alert.direction === 'up' ? '#26A69A' : '#EF5350',
            }}>
              {alert.direction === 'up' ? '↑' : '↓'}
            </span>

            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 2 }}>
                🔔 Drawing Alert
              </div>
              <div style={{ fontSize: 11, color: '#787B86' }}>
                Price {alert.direction === 'up' ? 'crossed above' : 'crossed below'} {alert.drawingType || 'line'}
                {alert.price != null && ` at ${Number(alert.price).toFixed(2)}`}
              </div>
            </div>

            <span style={{ fontSize: 10, color: '#787B86' }}>
              {new Date(alert.timestamp || alert.createdAt).toLocaleTimeString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
