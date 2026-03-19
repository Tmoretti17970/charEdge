// ═══════════════════════════════════════════════════════════════════
// charEdge — Compound Alert Builder (Phase B1 + B2)
//
// Multi-condition alert form: "Price > $200 AND RSI < 30"
// Features: condition rows, AND/OR toggle, indicator selector,
// expiration picker, cooldown dropdown.
//
// Usage: <CompoundAlertBuilder symbol="AAPL" onClose={() => {}} />
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import { C, M } from '../../../constants.js';
import { useAlertStore } from '../../../state/useAlertStore';

const CONDITIONS = [
  { id: 'above', label: '↑ Above' },
  { id: 'below', label: '↓ Below' },
  { id: 'cross_above', label: '↗ Cross Above' },
  { id: 'cross_below', label: '↘ Cross Below' },
];

const INDICATORS = ['RSI', 'MACD', 'VOLUME', 'ATR'];

const COOLDOWN_OPTIONS = [
  { value: 0, label: 'None' },
  { value: 30000, label: '30s' },
  { value: 60000, label: '1 min' },
  { value: 300000, label: '5 min' },
  { value: 900000, label: '15 min' },
  { value: 3600000, label: '1 hour' },
];

// ─── Condition Row ──────────────────────────────────────────────

function ConditionRow({ condition, onChange, onRemove, canRemove, inputStyle }) {
  const isIndicator = condition.type === 'indicator';

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {/* Type selector */}
      <select
        value={condition.type}
        onChange={(e) => onChange({ ...condition, type: e.target.value, indicator: e.target.value === 'indicator' ? 'RSI' : undefined })}
        style={{ ...inputStyle, width: 70, cursor: 'pointer', appearance: 'none' }}
      >
        <option value="price">Price</option>
        <option value="indicator">Indicator</option>
      </select>

      {/* B2: Indicator selector (only when type=indicator) */}
      {isIndicator && (
        <select
          value={condition.indicator || 'RSI'}
          onChange={(e) => onChange({ ...condition, indicator: e.target.value })}
          style={{ ...inputStyle, width: 65, cursor: 'pointer', appearance: 'none', fontWeight: 700 }}
        >
          {INDICATORS.map((ind) => (
            <option key={ind} value={ind}>{ind}</option>
          ))}
        </select>
      )}

      {/* Condition dropdown */}
      <select
        value={condition.condition}
        onChange={(e) => onChange({ ...condition, condition: e.target.value })}
        style={{ ...inputStyle, flex: 1, cursor: 'pointer', appearance: 'none' }}
      >
        {CONDITIONS.map((c) => (
          <option key={c.id} value={c.id}>{c.label}</option>
        ))}
      </select>

      {/* Value input */}
      <input
        type="number"
        step="any"
        value={condition.price ?? ''}
        onChange={(e) => onChange({ ...condition, price: e.target.value ? parseFloat(e.target.value) : undefined })}
        placeholder={isIndicator ? 'Value' : 'Price'}
        style={{ ...inputStyle, width: 62, textAlign: 'right' }}
      />

      {/* D5: Temporal window */}
      <input
        type="number"
        min="1"
        step="1"
        value={condition.windowBars ?? ''}
        onChange={(e) => onChange({ ...condition, windowBars: e.target.value ? parseInt(e.target.value) : undefined })}
        placeholder="∞"
        title="Within N bars"
        style={{ ...inputStyle, width: 32, textAlign: 'center', fontSize: 10 }}
      />

      {/* Remove button */}
      {canRemove && (
        <button
          onClick={onRemove}
          style={{
            background: 'none',
            border: 'none',
            color: C.r + '80',
            fontSize: 12,
            cursor: 'pointer',
            padding: '2px 4px',
            flexShrink: 0,
          }}
          title="Remove condition"
        >✕</button>
      )}
    </div>
  );
}

// ─── Logic Toggle ───────────────────────────────────────────────

function LogicToggle({ value, onChange }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '2px 0' }}>
      <div
        style={{
          display: 'flex',
          borderRadius: 4,
          overflow: 'hidden',
          border: `1px solid ${C.bd}`,
        }}
      >
        {['AND', 'OR'].map((logic) => (
          <button
            key={logic}
            onClick={() => onChange(logic)}
            style={{
              background: value === logic ? C.b + '30' : 'transparent',
              border: 'none',
              color: value === logic ? C.b : C.t3,
              fontSize: 9,
              fontWeight: 700,
              padding: '2px 12px',
              cursor: 'pointer',
              fontFamily: M,
              letterSpacing: '0.05em',
              transition: 'all 0.15s',
            }}
          >{logic}</button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Builder ───────────────────────────────────────────────

function CompoundAlertBuilder({ symbol = '', onClose }) {
  const addCompoundAlert = useAlertStore((s) => s.addCompoundAlert);

  const [conditions, setConditions] = useState([
    { type: 'price', condition: 'above', price: undefined, indicator: undefined, windowBars: undefined },
  ]);
  const [logic, setLogic] = useState('AND');
  const [note, setNote] = useState('');
  const [repeating, setRepeating] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [cooldownMs, setCooldownMs] = useState(0);

  const inputStyle = {
    background: C.sf,
    border: `1px solid ${C.bd}`,
    color: C.t1,
    borderRadius: 4,
    padding: '4px 6px',
    fontFamily: M,
    fontSize: 11,
    outline: 'none',
  };

  const addCondition = useCallback(() => {
    setConditions((prev) => [
      ...prev,
      { type: 'price', condition: 'above', price: undefined, indicator: undefined, windowBars: undefined },
    ]);
  }, []);

  const updateCondition = useCallback((index, updated) => {
    setConditions((prev) => prev.map((c, i) => (i === index ? updated : c)));
  }, []);

  const removeCondition = useCallback((index) => {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(() => {
    // Validate: at least 1 condition with a value
    const validConditions = conditions.filter((c) => c.price != null && c.price > 0);
    if (validConditions.length === 0) return;

    const subConditions = validConditions.map((c) => ({
      type: c.type,
      condition: c.condition,
      price: c.price,
      indicator: c.type === 'indicator' ? c.indicator : undefined,
      windowBars: c.windowBars || undefined,
    }));

    addCompoundAlert({
      symbol: symbol.toUpperCase(),
      logic,
      conditions: subConditions,
      note,
      repeating,
      expiresAt: expiresAt || null,
      cooldownMs: cooldownMs || null,
    });

    // Reset
    setConditions([{ type: 'price', condition: 'above', price: undefined, indicator: undefined }]);
    setNote('');
    setExpiresAt('');
    setCooldownMs(0);
    if (onClose) onClose();
  }, [conditions, logic, note, repeating, expiresAt, cooldownMs, symbol, addCompoundAlert, onClose]);

  const isValid = conditions.some((c) => c.price != null && c.price > 0);

  return (
    <div
      style={{
        padding: 8,
        background: C.sf,
        borderRadius: 8,
        border: `1px solid ${C.bd}`,
        marginBottom: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.t1 }}>⚙ Compound Alert</span>
        <span style={{ fontSize: 10, color: C.t3, fontFamily: M }}>{symbol}</span>
      </div>

      {/* Condition rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {conditions.map((cond, i) => (
          <React.Fragment key={i}>
            <ConditionRow
              condition={cond}
              onChange={(updated) => updateCondition(i, updated)}
              onRemove={() => removeCondition(i)}
              canRemove={conditions.length > 1}
              inputStyle={inputStyle}
            />
            {i < conditions.length - 1 && (
              <LogicToggle value={logic} onChange={setLogic} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Add condition button */}
      <button
        onClick={addCondition}
        style={{
          width: '100%',
          background: 'none',
          border: `1px dashed ${C.bd}`,
          borderRadius: 4,
          color: C.t3,
          fontSize: 10,
          padding: '4px 0',
          cursor: 'pointer',
          marginTop: 6,
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = C.b; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = C.t3; }}
      >+ Add condition</button>

      {/* Expiration + Cooldown */}
      <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 9, color: C.t3, display: 'block', marginBottom: 2 }}>Expires</label>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            style={{ ...inputStyle, width: '100%', fontSize: 10 }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 9, color: C.t3, display: 'block', marginBottom: 2 }}>Cooldown</label>
          <select
            value={cooldownMs}
            onChange={(e) => setCooldownMs(Number(e.target.value))}
            style={{ ...inputStyle, width: '100%', cursor: 'pointer', appearance: 'none' }}
          >
            {COOLDOWN_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Note + submit */}
      <div style={{ display: 'flex', gap: 4, marginTop: 6, alignItems: 'center' }}>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          style={{ ...inputStyle, flex: 1, fontSize: 10 }}
        />
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            fontSize: 10,
            color: C.t3,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <input
            type="checkbox"
            checked={repeating}
            onChange={(e) => setRepeating(e.target.checked)}
            style={{ width: 12, height: 12 }}
          />
          🔁
        </label>
        <button
          onClick={handleSubmit}
          disabled={!isValid}
          style={{
            background: C.b,
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '4px 12px',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            opacity: isValid ? 1 : 0.4,
            transition: 'opacity 0.15s',
          }}
        >Create</button>
      </div>
    </div>
  );
}

export { CompoundAlertBuilder };
export default React.memo(CompoundAlertBuilder);
