// ═══════════════════════════════════════════════════════════════════
// charEdge — Markets Row Context Menu (Sprint 24)
//
// Right-click context menu for watchlist rows.
// Actions: Set Alert (above/below), Add to Compare, Open Chart, Remove
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, memo, useRef } from 'react';
import { C, F, M } from '../../../constants.js';
import { radii, transition } from '../../../theme/tokens.js';
import { useAlertStore } from '../../../state/useAlertStore';
import { useMarketsPrefsStore } from '../../../state/useMarketsPrefsStore';
import { useWatchlistStore } from '../../../state/useWatchlistStore';

// ─── Component ──────────────────────────────────────────────────

function MarketsRowContextMenu({ x, y, symbol, price, onClose }) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const addCompareSymbol = useMarketsPrefsStore((s) => s.addCompareSymbol);
  const setSelectedSymbol = useMarketsPrefsStore((s) => s.setSelectedSymbol);
  const removeSymbol = useWatchlistStore((s) => s.removeSymbol);
  const setAlertPickerOpen = useMarketsPrefsStore((s) => s.setAlertPickerOpen);

  const [showAlertSub, setShowAlertSub] = useState(false);
  const [alertCreated, setAlertCreated] = useState(null);
  const menuRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleQuickAlert = (condition) => {
    const displayPrice = price || 0;
    addAlert({
      symbol,
      condition,
      price: displayPrice,
      note: `[Quick] ${condition === 'above' ? 'Above' : 'Below'} $${displayPrice.toFixed(2)}`,
      repeating: false,
      style: 'price',
    });
    setAlertCreated(condition);
    setTimeout(() => { setAlertCreated(null); onClose(); }, 800);
  };

  // Position: keep menu within viewport
  const menuStyle = {
    position: 'fixed',
    top: Math.min(y, window.innerHeight - 260),
    left: Math.min(x, window.innerWidth - 200),
    zIndex: 950,
    width: 192,
    background: C.bg,
    border: `1px solid ${C.bd}30`,
    borderRadius: radii.md,
    boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
    padding: 4,
    animation: 'ctx-pop 0.12s ease-out',
  };

  const itemStyle = {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 10px', borderRadius: 4,
    fontSize: 11, fontWeight: 600, fontFamily: F,
    color: C.t2, background: 'transparent',
    border: 'none', cursor: 'pointer',
    width: '100%', textAlign: 'left',
    transition: `background ${transition.fast}`,
  };

  return (
    <div ref={menuRef} style={menuStyle}>
      {/* ── Symbol header ─────────────────────────────── */}
      <div style={{
        padding: '4px 10px 6px', fontSize: 9, fontWeight: 700, fontFamily: M,
        color: C.t3, textTransform: 'uppercase', letterSpacing: '0.08em',
        borderBottom: `1px solid ${C.bd}15`, marginBottom: 4,
      }}>
        {symbol}
        {price > 0 && <span style={{ color: C.t2, marginLeft: 6 }}>${price.toFixed(2)}</span>}
      </div>

      {/* ── Set Alert ─────────────────────────────────── */}
      <button
        style={itemStyle}
        onClick={() => setShowAlertSub(!showAlertSub)}
        onMouseEnter={(e) => { e.currentTarget.style.background = `${C.bd}15`; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{ fontSize: 13 }}>🔔</span> Set Alert
        <span style={{ marginLeft: 'auto', fontSize: 8, color: C.t3 }}>▸</span>
      </button>
      {showAlertSub && (
        <div style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button
            onClick={() => handleQuickAlert('above')}
            style={{ ...itemStyle, fontSize: 10, color: alertCreated === 'above' ? '#34c759' : C.t2 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${C.bd}15`; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {alertCreated === 'above' ? '✓ Created' : '↑ Alert Above'}
          </button>
          <button
            onClick={() => handleQuickAlert('below')}
            style={{ ...itemStyle, fontSize: 10, color: alertCreated === 'below' ? '#34c759' : C.t2 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${C.bd}15`; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {alertCreated === 'below' ? '✓ Created' : '↓ Alert Below'}
          </button>
          <button
            onClick={() => { setAlertPickerOpen(true); onClose(); }}
            style={{ ...itemStyle, fontSize: 10, color: '#f0b64e' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${C.bd}15`; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            ⚡ Smart Alert...
          </button>
        </div>
      )}

      {/* ── Other actions ─────────────────────────────── */}
      <button
        onClick={() => { addCompareSymbol(symbol); onClose(); }}
        style={itemStyle}
        onMouseEnter={(e) => { e.currentTarget.style.background = `${C.bd}15`; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{ fontSize: 13 }}>📊</span> Add to Compare
      </button>

      <button
        onClick={() => { setSelectedSymbol(symbol); onClose(); }}
        style={itemStyle}
        onMouseEnter={(e) => { e.currentTarget.style.background = `${C.bd}15`; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{ fontSize: 13 }}>📋</span> View Details
      </button>

      <div style={{ height: 1, background: `${C.bd}15`, margin: '4px 0' }} />

      <button
        onClick={() => { removeSymbol(symbol); onClose(); }}
        style={{ ...itemStyle, color: C.r }}
        onMouseEnter={(e) => { e.currentTarget.style.background = `${C.r}08`; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{ fontSize: 13 }}>🗑</span> Remove from Watchlist
      </button>

      <style>{`
        @keyframes ctx-pop {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

export { MarketsRowContextMenu };
export default memo(MarketsRowContextMenu);
