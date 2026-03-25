// ═══════════════════════════════════════════════════════════════════
// charEdge — Compound Alert Builder (Phase B1 + B2)
//
// Multi-condition alert form: "Price > $200 AND RSI < 30"
// Features: condition rows, AND/OR toggle, indicator selector,
// expiration picker, cooldown dropdown.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import { useAlertStore } from '../../../state/useAlertStore';
import st from './CompoundAlertBuilder.module.css';

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

function ConditionRow({ condition, onChange, onRemove, canRemove }) {
  const isIndicator = condition.type === 'indicator';

  return (
    <div className={st.condRow}>
      <select
        value={condition.type}
        onChange={(e) =>
          onChange({
            ...condition,
            type: e.target.value,
            indicator: e.target.value === 'indicator' ? 'RSI' : undefined,
          })
        }
        className={`${st.input} ${st.selectType}`}
      >
        <option value="price">Price</option>
        <option value="indicator">Indicator</option>
      </select>

      {isIndicator && (
        <select
          value={condition.indicator || 'RSI'}
          onChange={(e) => onChange({ ...condition, indicator: e.target.value })}
          className={`${st.input} ${st.selectInd}`}
        >
          {INDICATORS.map((ind) => (
            <option key={ind} value={ind}>
              {ind}
            </option>
          ))}
        </select>
      )}

      <select
        value={condition.condition}
        onChange={(e) => onChange({ ...condition, condition: e.target.value })}
        className={`${st.input} ${st.selectCond}`}
      >
        {CONDITIONS.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>

      <input
        type="number"
        step="any"
        value={condition.price ?? ''}
        onChange={(e) => onChange({ ...condition, price: e.target.value ? parseFloat(e.target.value) : undefined })}
        placeholder={isIndicator ? 'Value' : 'Price'}
        className={`${st.input} ${st.inputPrice}`}
      />

      <input
        type="number"
        min="1"
        step="1"
        value={condition.windowBars ?? ''}
        onChange={(e) => onChange({ ...condition, windowBars: e.target.value ? parseInt(e.target.value) : undefined })}
        placeholder="∞"
        title="Within N bars"
        className={`${st.input} ${st.inputWindow}`}
      />

      {canRemove && (
        <button onClick={onRemove} className={st.removeCondBtn} title="Remove condition">
          ✕
        </button>
      )}
    </div>
  );
}

// ─── Logic Toggle ───────────────────────────────────────────────

function LogicToggle({ value, onChange }) {
  return (
    <div className={st.logicRow}>
      <div className={st.logicBar}>
        {['AND', 'OR'].map((logic) => (
          <button
            key={logic}
            onClick={() => onChange(logic)}
            className={`${st.logicBtn} ${value === logic ? st.logicBtnActive : st.logicBtnInactive}`}
          >
            {logic}
          </button>
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

    setConditions([{ type: 'price', condition: 'above', price: undefined, indicator: undefined }]);
    setNote('');
    setExpiresAt('');
    setCooldownMs(0);
    if (onClose) onClose();
  }, [conditions, logic, note, repeating, expiresAt, cooldownMs, symbol, addCompoundAlert, onClose]);

  const isValid = conditions.some((c) => c.price != null && c.price > 0);

  return (
    <div className={st.root}>
      {/* Header */}
      <div className={st.header}>
        <span className={st.headerTitle}>⚙ Compound Alert</span>
        <span className={st.headerSymbol}>{symbol}</span>
      </div>

      {/* Condition rows */}
      <div className={st.condList}>
        {conditions.map((cond, i) => (
          <React.Fragment key={i}>
            <ConditionRow
              condition={cond}
              onChange={(updated) => updateCondition(i, updated)}
              onRemove={() => removeCondition(i)}
              canRemove={conditions.length > 1}
            />
            {i < conditions.length - 1 && <LogicToggle value={logic} onChange={setLogic} />}
          </React.Fragment>
        ))}
      </div>

      {/* Add condition button */}
      <button onClick={addCondition} className={st.addCondBtn}>
        + Add condition
      </button>

      {/* Expiration + Cooldown */}
      <div className={st.extraRow}>
        <div className={st.extraCol}>
          <label className={st.extraLabel}>Expires</label>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className={`${st.input} ${st.extraInput}`}
          />
        </div>
        <div className={st.extraCol}>
          <label className={st.extraLabel}>Cooldown</label>
          <select
            value={cooldownMs}
            onChange={(e) => setCooldownMs(Number(e.target.value))}
            className={`${st.input} ${st.extraSelect}`}
          >
            {COOLDOWN_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Note + submit */}
      <div className={st.bottomRow}>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className={`${st.input} ${st.noteInput}`}
        />
        <label className={st.repeatLabel}>
          <input
            type="checkbox"
            checked={repeating}
            onChange={(e) => setRepeating(e.target.checked)}
            className={st.checkbox}
          />
          🔁
        </label>
        <button
          onClick={handleSubmit}
          disabled={!isValid}
          className={`${st.submitBtn} ${!isValid ? st.submitBtnDisabled : ''}`}
        >
          Create
        </button>
      </div>
    </div>
  );
}

export { CompoundAlertBuilder };
export default React.memo(CompoundAlertBuilder);
