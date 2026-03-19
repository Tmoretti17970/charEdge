// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Journal Quick-Add Row (J1.1)
// Inline trade entry: symbol, side, P&L, entry price, asset class
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { C, M } from '@/constants.js';

function JournalQuickAdd({ onSave, onCancel }) {
  const [sym, setSym] = useState('');
  const [side, setSide] = useState('long');
  const [pnl, setPnl] = useState('');
  const [entry, setEntry] = useState('');
  const [assetClass, setAssetClass] = useState('');
  const symRef = useRef(null);

  useEffect(() => {
    symRef.current?.focus();
  }, []);

  const handleSave = () => {
    if (!sym.trim()) return;
    onSave({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      date: new Date().toISOString(),
      symbol: sym.trim().toUpperCase(),
      side,
      pnl: pnl !== '' ? Number(pnl) : 0,
      entry: entry !== '' ? Number(entry) : null,
      assetClass: assetClass || null,
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') onCancel();
  };

  const inputStyle = {
    padding: '7px 10px',
    borderRadius: 6,
    border: `1px solid ${C.bd2}`,
    background: C.bg,
    color: C.t1,
    fontSize: 12,
    fontFamily: M,
    outline: 'none',
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        marginBottom: 8,
        padding: '12px 16px',
        borderRadius: 10,
        border: `1px solid ${C.bd}`,
        background: C.sf2,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontSize: 10, fontWeight: 700, color: C.t2, fontFamily: M, letterSpacing: '0.05em' }}>
        QUICK ADD
      </span>
      <input
        aria-label="Quick add trade"
        ref={symRef}
        value={sym}
        onChange={(e) => setSym(e.target.value.toUpperCase())}
        onKeyDown={handleKeyDown}
        placeholder="SYM"
        style={{ ...inputStyle, width: 70, fontWeight: 700, textAlign: 'center' }}
      />
      <div style={{ display: 'flex', gap: 2 }}>
        {['long', 'short'].map((s) => (
          <button
            className="tf-btn"
            key={s}
            onClick={() => setSide(s)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: side === s ? `1px solid ${s === 'long' ? C.g : C.r}` : `1px solid ${C.bd}`,
              background: side === s ? (s === 'long' ? C.g : C.r) + '20' : C.bg,
              color: side === s ? (s === 'long' ? C.g : C.r) : C.t2,
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            {s === 'long' ? '▲' : '▼'} {s}
          </button>
        ))}
      </div>
      <input
        value={pnl}
        onChange={(e) => setPnl(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="P&L"
        type="number"
        style={{ ...inputStyle, width: 80 }}
      />
      <input
        value={entry}
        onChange={(e) => setEntry(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Entry $"
        type="number"
        step="0.01"
        style={{ ...inputStyle, width: 90 }}
      />
      <select
        value={assetClass}
        onChange={(e) => setAssetClass(e.target.value)}
        style={{ ...inputStyle, width: 90, cursor: 'pointer' }}
      >
        <option value="">Asset</option>
        <option value="crypto">Crypto</option>
        <option value="equities">Equities</option>
        <option value="futures">Futures</option>
        <option value="options">Options</option>
        <option value="forex">Forex</option>
      </select>
      <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
        <button
          className="tf-btn"
          onClick={handleSave}
          disabled={!sym.trim()}
          style={{
            padding: '7px 16px',
            borderRadius: 6,
            border: 'none',
            background: C.b,
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            cursor: sym.trim() ? 'pointer' : 'default',
            opacity: sym.trim() ? 1 : 0.35,
          }}
        >
          Save
        </button>
        <button
          className="tf-btn"
          onClick={onCancel}
          style={{
            padding: '7px 10px',
            borderRadius: 6,
            border: `1px solid ${C.bd2}`,
            background: C.bg,
            color: C.t1,
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default React.memo(JournalQuickAdd);
