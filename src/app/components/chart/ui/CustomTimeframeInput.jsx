// ═══════════════════════════════════════════════════════════════════
// charEdge — Custom Timeframe Input
// Allows users to type custom intervals (e.g., "7m", "3h", "2D")
// similar to TradingView's custom timeframe feature.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { C, F } from '../../../../constants.js';
import { useChartCoreStore } from '../../../../state/chart/useChartCoreStore';

const _VALID_SUFFIXES = ['m', 'h', 'D', 'd', 'W', 'w', 'M'];

function parseTf(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Try to parse as number + suffix
  const match = trimmed.match(/^(\d+)\s*([mhdwMHDW]?)$/i);
  if (!match) return null;

  const num = parseInt(match[1], 10);
  let suffix = match[2] || 'm'; // default to minutes

  // Normalize suffix
  suffix = suffix.toLowerCase();
  if (suffix === 'h') suffix = 'h';
  else if (suffix === 'd') suffix = 'D';
  else if (suffix === 'w') suffix = 'W';
  else if (suffix === 'm' && num >= 1440) { suffix = 'D'; }

  // Validate ranges
  if (suffix === 'm' && (num < 1 || num > 1440)) return null;
  if (suffix === 'h' && (num < 1 || num > 24)) return null;
  if (suffix === 'D' && (num < 1 || num > 30)) return null;
  if (suffix === 'W' && (num < 1 || num > 4)) return null;

  return `${num}${suffix}`;
}

function CustomTimeframeInput({ onClose }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const setTf = useChartCoreStore((s) => s.setTf);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const parsed = parseTf(value);
    if (parsed) {
      setTf(parsed);
      onClose?.();
    } else {
      setError('Invalid format. Try: 7m, 2h, 3D');
    }
  };

  return (
    <div style={{
      position: 'absolute',
      top: '100%',
      left: 0,
      marginTop: 4,
      background: C.sf2,
      border: `1px solid ${C.bd}`,
      borderRadius: 10,
      padding: 12,
      zIndex: 1000,
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      backdropFilter: 'blur(16px)',
      animation: 'tfDropdownIn 0.15s ease-out',
      minWidth: 200,
    }}>
      <div style={{ fontSize: 10, color: C.t3, fontFamily: F, fontWeight: 600, marginBottom: 8, letterSpacing: '0.5px' }}>
        CUSTOM TIMEFRAME
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 6 }}>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(''); }}
          placeholder="e.g. 7m, 2h, 3D"
          style={{
            flex: 1,
            padding: '6px 10px',
            background: C.sf,
            border: `1px solid ${error ? '#EF5350' : C.bd}`,
            borderRadius: 6,
            color: C.t1,
            fontFamily: F,
            fontSize: 13,
            outline: 'none',
          }}
          onKeyDown={(e) => { if (e.key === 'Escape') onClose?.(); }}
        />
        <button
          type="submit"
          style={{
            padding: '6px 12px',
            background: C.b || '#2962FF',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            fontFamily: F,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Apply
        </button>
      </form>
      {error && (
        <div style={{ fontSize: 10, color: '#EF5350', marginTop: 4, fontFamily: F }}>
          {error}
        </div>
      )}
      <div style={{ fontSize: 10, color: C.t3, marginTop: 8, fontFamily: F, lineHeight: 1.4 }}>
        Formats: <span style={{ color: C.t2 }}>1m 5m 15m 30m 1h 2h 4h 1D 1W</span>
      </div>
    </div>
  );
}

export default React.memo(CustomTimeframeInput);
