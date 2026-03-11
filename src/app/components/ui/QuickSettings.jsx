// ═══════════════════════════════════════════════════════════════════
// charEdge — Quick Settings Popover
//
// Accessible from the sidebar gear icon. Shows the top 5-6 most
// commonly changed settings in a compact floating panel.
// Theme, default symbol, timeframe, risk per trade, account size.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { C, F, M } from '../../../constants.js';
import { useUIStore } from '../../../state/useUIStore';
import { useUserStore } from '../../../state/useUserStore';
import { alpha } from '@/shared/colorUtils';

export default function QuickSettings({ _anchorRef, onClose }) {
  const panelRef = useRef(null);
  const theme = useUserStore((s) => s.theme);
  const toggleTheme = useUserStore((s) => s.toggleTheme);
  const setPage = useUIStore((s) => s.setPage);

  const defaultSymbol = useUserStore((s) => s.defaultSymbol);
  const defaultTf = useUserStore((s) => s.defaultTf);
  const riskPerTrade = useUserStore((s) => s.riskPerTrade);
  const accountSize = useUserStore((s) => s.accountSize);
  const update = useUserStore((s) => s.update);

  // Close on click outside
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: 70,
        bottom: 80,
        width: 280,
        background: alpha(C.sf, 0.97),
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${alpha(C.bd, 0.5)}`,
        borderRadius: 14,
        boxShadow: `0 12px 40px ${alpha(C.bg, 0.5)}, 0 2px 8px ${alpha(C.bg, 0.3)}`,
        padding: '6px 0',
        zIndex: 1000,
        animation: 'scaleInSm 0.15s ease-out',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 16px 8px',
          fontSize: 11,
          fontWeight: 700,
          color: C.t3,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        Quick Settings
      </div>

      {/* Theme Toggle */}
      <QSRow
        label="Theme"
        onClick={toggleTheme}
      >
        <div style={{
          display: 'flex',
          gap: 4,
          background: C.bg2,
          borderRadius: 8,
          padding: 2,
        }}>
          <div
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              fontFamily: F,
              background: theme === 'dark' ? C.b + '20' : 'transparent',
              color: theme === 'dark' ? C.b : C.t3,
              cursor: 'pointer',
            }}
            onClick={(e) => { e.stopPropagation(); if (theme !== 'dark') toggleTheme(); }}
          >
            🌙
          </div>
          <div
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              fontFamily: F,
              background: theme === 'light' ? C.b + '20' : 'transparent',
              color: theme === 'light' ? C.b : C.t3,
              cursor: 'pointer',
            }}
            onClick={(e) => { e.stopPropagation(); if (theme !== 'light') toggleTheme(); }}
          >
            ☀️
          </div>
        </div>
      </QSRow>

      <QSDivider />

      {/* Default Symbol */}
      <QSRow label="Default Symbol">
        <input
          value={defaultSymbol || ''}
          onChange={(e) => update({ defaultSymbol: e.target.value.toUpperCase() })}
          placeholder="BTC"
          style={{
            width: 60,
            padding: '4px 8px',
            borderRadius: 6,
            border: `1px solid ${C.bd}`,
            background: C.bg2,
            color: C.t1,
            fontSize: 12,
            fontFamily: M,
            fontWeight: 600,
            textAlign: 'center',
            textTransform: 'uppercase',
            outline: 'none',
          }}
        />
      </QSRow>

      {/* Default Timeframe */}
      <QSRow label="Timeframe">
        <select
          value={defaultTf || '3m'}
          onChange={(e) => update({ defaultTf: e.target.value })}
          style={{
            padding: '4px 8px',
            borderRadius: 6,
            border: `1px solid ${C.bd}`,
            background: C.bg2,
            color: C.t1,
            fontSize: 12,
            fontFamily: M,
            fontWeight: 600,
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="1d">1D</option>
          <option value="5d">5D</option>
          <option value="1m">1M</option>
          <option value="3m">3M</option>
          <option value="6m">6M</option>
          <option value="1y">1Y</option>
        </select>
      </QSRow>

      <QSDivider />

      {/* Risk Per Trade */}
      <QSRow label="Risk / Trade">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="number"
            value={riskPerTrade || ''}
            onChange={(e) => update({ riskPerTrade: Number(e.target.value) || 0 })}
            placeholder="1"
            step="0.1"
            style={{
              width: 46,
              padding: '4px 6px',
              borderRadius: 6,
              border: `1px solid ${C.bd}`,
              background: C.bg2,
              color: C.t1,
              fontSize: 12,
              fontFamily: M,
              fontWeight: 600,
              textAlign: 'center',
              outline: 'none',
            }}
          />
          <span style={{ fontSize: 11, color: C.t3, fontFamily: M }}>%</span>
        </div>
      </QSRow>

      {/* Account Size */}
      <QSRow label="Account Size">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, color: C.t3, fontFamily: M }}>$</span>
          <input
            type="number"
            value={accountSize || ''}
            onChange={(e) => update({ accountSize: Number(e.target.value) || 0 })}
            placeholder="25000"
            style={{
              width: 72,
              padding: '4px 6px',
              borderRadius: 6,
              border: `1px solid ${C.bd}`,
              background: C.bg2,
              color: C.t1,
              fontSize: 12,
              fontFamily: M,
              fontWeight: 600,
              textAlign: 'right',
              outline: 'none',
            }}
          />
        </div>
      </QSRow>

      <QSDivider />

      {/* All Settings link */}
      <div
        onClick={() => { setPage('settings'); onClose(); }}
        style={{
          padding: '10px 16px',
          fontSize: 12,
          fontWeight: 600,
          fontFamily: F,
          color: C.b,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
        className="tf-btn"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
        All Settings…
      </div>

    </div>
  );
}

// ─── Quick Settings Row ─────────────────────────────────────────

function QSRow({ label, children, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 500,
          fontFamily: F,
          color: C.t2,
        }}
      >
        {label}
      </span>
      <div onClick={(e) => { if (!onClick) e.stopPropagation(); }}>
        {children}
      </div>
    </div>
  );
}

function QSDivider() {
  return (
    <div
      style={{
        height: 1,
        background: C.bd,
        margin: '4px 16px',
        opacity: 0.5,
      }}
    />
  );
}
