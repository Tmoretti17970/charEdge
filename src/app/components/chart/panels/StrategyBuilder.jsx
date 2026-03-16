// ═══════════════════════════════════════════════════════════════════
// charEdge — Visual Strategy Builder
// No-code drag-and-drop condition builder for creating trading
// strategies without writing any code.
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import { useBacktestStore } from '../../../../state/useBacktestStore.js';
import {
  useStrategyBuilderStore,
  CONDITION_SOURCES,
  COMPARISONS,
  EXIT_TYPES,
} from '../../../../state/useStrategyBuilderStore';
import StrategyAISuggestions from '../../strategy/StrategyAISuggestions.jsx';

export default function StrategyBuilder({ bars, onClose }) {
  const store = useStrategyBuilderStore();
  const { name, entryLong, entryShort, exitRules, logicMode } = store;
  const [activeTab, setActiveTab] = useState('long');
  const [showExits, setShowExits] = useState(false);

  const handleBacktest = useCallback(() => {
    const strategy = store.generateStrategy();
    if (!strategy || !bars?.length) return;
    useBacktestStore.getState().runBacktest(bars, strategy);
  }, [bars, store]);

  return (
    <div className="tf-strategy-builder tf-fade-scale">
      {/* Header */}
      <div className="tf-sb-header">
        <div className="tf-sb-header__title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
          </svg>
          Strategy Builder
        </div>
        <button className="tf-sb-header__close" onClick={onClose}>✕</button>
      </div>

      {/* Strategy Name */}
      <div className="tf-sb-name">
        <input
          className="tf-sb-name__input"
          value={name}
          onChange={e => store.setName(e.target.value)}
          placeholder="Strategy Name"
        />
      </div>

      {/* Entry Tabs */}
      <div className="tf-sb-tabs">
        <button
          className={`tf-sb-tab ${activeTab === 'long' ? 'tf-sb-tab--active tf-sb-tab--long' : ''}`}
          onClick={() => setActiveTab('long')}
        >
          ▲ Long Entry ({entryLong.length})
        </button>
        <button
          className={`tf-sb-tab ${activeTab === 'short' ? 'tf-sb-tab--active tf-sb-tab--short' : ''}`}
          onClick={() => setActiveTab('short')}
        >
          ▼ Short Entry ({entryShort.length})
        </button>
      </div>

      {/* Logic Mode */}
      <div className="tf-sb-logic">
        <span style={{ fontSize: 10, color: 'var(--tf-t3)' }}>Combine conditions with:</span>
        <div className="tf-sb-logic-toggle">
          <button
            className={`tf-sb-logic-btn ${logicMode === 'AND' ? 'tf-sb-logic-btn--active' : ''}`}
            onClick={() => store.setLogicMode('AND')}
          >AND</button>
          <button
            className={`tf-sb-logic-btn ${logicMode === 'OR' ? 'tf-sb-logic-btn--active' : ''}`}
            onClick={() => store.setLogicMode('OR')}
          >OR</button>
        </div>
      </div>

      {/* Condition Blocks */}
      <div className="tf-sb-conditions">
        {(activeTab === 'long' ? entryLong : entryShort).map((cond, idx) => (
          <ConditionBlock
            key={cond.id}
            condition={cond}
            index={idx}
            side={activeTab}
            onUpdate={(updates) => store.updateCondition(activeTab, cond.id, updates)}
            onRemove={() => store.removeCondition(activeTab, cond.id)}
            logicMode={logicMode}
            isLast={idx === (activeTab === 'long' ? entryLong : entryShort).length - 1}
          />
        ))}

        <button
          className="tf-sb-add-btn"
          onClick={() => store.addCondition(activeTab)}
        >
          + Add Condition
        </button>
      </div>

      {/* Exit Rules */}
      <button
        className="tf-sb-exits-toggle"
        onClick={() => setShowExits(!showExits)}
      >
        {showExits ? '▾' : '▸'} Exit Rules ({exitRules.length})
      </button>

      {showExits && (
        <div className="tf-sb-exits">
          {EXIT_TYPES.map(et => {
            const active = exitRules.some(r => r.type === et.id);
            return (
              <label key={et.id} className={`tf-sb-exit-option ${active ? 'tf-sb-exit-option--active' : ''}`}>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => {
                    if (e.target.checked) {
                      store.setExitRules([...exitRules, { type: et.id, params: Object.fromEntries((et.params || []).map(p => [p.name, p.default])) }]);
                    } else {
                      store.setExitRules(exitRules.filter(r => r.type !== et.id));
                    }
                  }}
                />
                {et.label}
              </label>
            );
          })}
        </div>
      )}

      {/* Action Buttons */}
      <div className="tf-sb-actions">
        <button className="tf-sb-backtest-btn" onClick={handleBacktest} disabled={!bars?.length}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 19,12 5,21" />
          </svg>
          Backtest Strategy
        </button>
        <button className="tf-sb-reset-btn" onClick={store.reset}>Reset</button>
      </div>

      {/* Data info */}
      <div className="tf-sb-data-info">
        📊 {bars?.length || 0} bars loaded
      </div>

      {/* Sprint 25: AI Strategy Suggestions */}
      <StrategyAISuggestions
        strategyConfig={{ name, entryLong, entryShort, exitRules, logicMode }}
        backtestResults={useBacktestStore.getState().results}
      />
    </div>
  );
}

// ─── Condition Block ─────────────────────────────────────────────

function ConditionBlock({ condition, index, _side, onUpdate, onRemove, logicMode, isLast }) {
  const updateSide = (sideKey, updates) => {
    onUpdate({ [sideKey]: { ...condition[sideKey], ...updates } });
  };

  return (
    <div className="tf-sb-block">
      <div className="tf-sb-block__header">
        <span className="tf-sb-block__num">{index + 1}</span>
        <button className="tf-sb-block__remove" onClick={onRemove} title="Remove">✕</button>
      </div>

      <div className="tf-sb-block__row">
        {/* Left Source */}
        <SourcePicker
          value={condition.left}
          onChange={(v) => updateSide('left', v)}
          label="When"
        />

        {/* Comparison */}
        <select
          className="tf-sb-comparison"
          value={condition.comparison}
          onChange={e => onUpdate({ comparison: e.target.value })}
        >
          {COMPARISONS.map(c => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>

        {/* Right Source */}
        <SourcePicker
          value={condition.right}
          onChange={(v) => updateSide('right', v)}
          label="Value"
        />
      </div>

      {!isLast && (
        <div className="tf-sb-block__joiner">
          <span className={`tf-sb-joiner-pill tf-sb-joiner-pill--${logicMode.toLowerCase()}`}>
            {logicMode}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Source Picker ────────────────────────────────────────────────

function SourcePicker({ value, onChange, _label }) {
  const sourceDef = CONDITION_SOURCES.find(s => s.id === value.source);
  const hasParams = sourceDef?.params?.length > 0 || value.source === 'number';

  return (
    <div className="tf-sb-source">
      <select
        className="tf-sb-source__select"
        value={value.source}
        onChange={e => {
          const newSource = CONDITION_SOURCES.find(s => s.id === e.target.value);
          const params = {};
          (newSource?.params || []).forEach(p => { params[p.name] = p.default; });
          onChange({ source: e.target.value, params });
        }}
      >
        <optgroup label="Price">
          {CONDITION_SOURCES.filter(s => s.type === 'price').map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </optgroup>
        <optgroup label="Indicators">
          {CONDITION_SOURCES.filter(s => s.type === 'indicator').map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </optgroup>
        <optgroup label="Constants">
          {CONDITION_SOURCES.filter(s => s.type === 'constant').map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </optgroup>
      </select>

      {hasParams && (
        <div className="tf-sb-source__params">
          {(sourceDef?.params || []).map(p => (
            <input
              key={p.name}
              type="number"
              className="tf-sb-source__param-input"
              value={value.params?.[p.name] ?? p.default}
              onChange={e => onChange({ params: { ...value.params, [p.name]: parseFloat(e.target.value) || p.default } })}
              min={p.min}
              max={p.max}
              title={p.name}
            />
          ))}
        </div>
      )}
    </div>
  );
}
