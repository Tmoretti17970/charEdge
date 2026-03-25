// ═══════════════════════════════════════════════════════════════════
// charEdge — Smart Folder Manager (Sprint 28)
//
// UI for creating/editing smart folders with auto-population rules.
// Rules: RSI, Change%, Volume Ratio, Price, Asset Class.
// Evaluates against live ticker data every 30s.
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback, memo } from 'react';
import { C } from '../../../constants.js';
import { useWatchlistStore } from '../../../state/useWatchlistStore';
import { radii, transition } from '../../../theme/tokens.js';

// ─── Available Fields ────────────────────────────────────────────

const FIELDS = [
  { id: 'rsi', label: 'RSI (14)', type: 'number', icon: '📊' },
  { id: 'changePercent', label: 'Change %', type: 'number', icon: '📈' },
  { id: 'volumeRatio', label: 'Volume Ratio', type: 'number', icon: '🔊' },
  { id: 'lastPrice', label: 'Price', type: 'number', icon: '💰' },
  { id: 'assetClass', label: 'Asset Class', type: 'text', icon: '🏷️' },
];

const OPERATORS = [
  { id: 'gt', label: '>', numOnly: true },
  { id: 'lt', label: '<', numOnly: true },
  { id: 'gte', label: '≥', numOnly: true },
  { id: 'lte', label: '≤', numOnly: true },
  { id: 'eq', label: '=', numOnly: false },
  { id: 'contains', label: 'contains', numOnly: false },
];

// ─── Templates ──────────────────────────────────────────────────

const TEMPLATES = [
  { name: 'Overbought', icon: '🔥', rules: [{ field: 'rsi', op: 'gt', value: 70 }] },
  { name: 'Oversold', icon: '❄️', rules: [{ field: 'rsi', op: 'lt', value: 30 }] },
  { name: 'Volume Surge', icon: '🌊', rules: [{ field: 'volumeRatio', op: 'gt', value: 2 }] },
  { name: 'Biggest Losers', icon: '📉', rules: [{ field: 'changePercent', op: 'lt', value: -5 }] },
  {
    name: 'Momentum',
    icon: '🚀',
    rules: [
      { field: 'changePercent', op: 'gt', value: 3 },
      { field: 'rsi', op: 'gt', value: 55 },
    ],
  },
  { name: 'Crypto Only', icon: '₿', rules: [{ field: 'assetClass', op: 'eq', value: 'crypto' }] },
];

// ─── Rule Row ────────────────────────────────────────────────────

function RuleRow({ rule, index, onChange, onRemove }) {
  const fieldDef = FIELDS.find((f) => f.id === rule.field) || FIELDS[0];
  const isText = fieldDef.type === 'text';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 8px',
        borderRadius: radii.md,
        background: C.bg2,
        marginBottom: 6,
      }}
    >
      <span style={{ fontSize: 12 }}>{fieldDef.icon}</span>

      {/* Field */}
      <select
        value={rule.field}
        onChange={(e) => onChange(index, { ...rule, field: e.target.value })}
        style={{
          flex: 1,
          padding: '4px 6px',
          borderRadius: radii.sm,
          background: C.sf,
          border: `1px solid ${C.bd}`,
          color: C.t1,
          fontSize: 11,
          fontFamily: 'var(--tf-font)',
        }}
      >
        {FIELDS.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>

      {/* Operator */}
      <select
        value={rule.op}
        onChange={(e) => onChange(index, { ...rule, op: e.target.value })}
        style={{
          width: 60,
          padding: '4px 4px',
          borderRadius: radii.sm,
          background: C.sf,
          border: `1px solid ${C.bd}`,
          color: C.t1,
          fontSize: 11,
          fontFamily: 'var(--tf-mono)',
          textAlign: 'center',
        }}
      >
        {OPERATORS.filter((o) => !o.numOnly || !isText).map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Value */}
      <input
        type={isText ? 'text' : 'number'}
        value={rule.value}
        onChange={(e) => onChange(index, { ...rule, value: isText ? e.target.value : parseFloat(e.target.value) || 0 })}
        style={{
          width: 70,
          padding: '4px 6px',
          borderRadius: radii.sm,
          background: C.sf,
          border: `1px solid ${C.bd}`,
          color: C.t1,
          fontSize: 11,
          fontFamily: 'var(--tf-mono)',
          textAlign: 'center',
        }}
      />

      <button
        onClick={() => onRemove(index)}
        style={{
          background: 'none',
          border: 'none',
          color: C.t3,
          cursor: 'pointer',
          fontSize: 12,
          padding: 2,
        }}
      >
        ✕
      </button>
    </div>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────

function SmartFolderManager({ open, onClose }) {
  const [folderName, setFolderName] = useState('');
  const [rules, setRules] = useState([{ field: 'rsi', op: 'gt', value: 70 }]);
  const [created, setCreated] = useState(false);

  const folders = useWatchlistStore((s) => s.folders);

  const handleAddRule = useCallback(() => {
    setRules((prev) => [...prev, { field: 'changePercent', op: 'gt', value: 0 }]);
  }, []);

  const handleChangeRule = useCallback((index, updated) => {
    setRules((prev) => prev.map((r, i) => (i === index ? updated : r)));
  }, []);

  const handleRemoveRule = useCallback((index) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleApplyTemplate = useCallback((template) => {
    setFolderName(template.name);
    setRules([...template.rules]);
  }, []);

  const handleCreate = useCallback(() => {
    if (!folderName.trim() || rules.length === 0) return;
    // Create smart folder in store
    const store = useWatchlistStore.getState();
    if (store.createFolder) {
      store.createFolder(folderName, { smart: true, rules });
    }
    setCreated(true);
    setTimeout(() => setCreated(false), 2000);
  }, [folderName, rules]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 380,
        zIndex: 1200,
        background: C.bg,
        borderLeft: `1px solid ${C.bd}`,
        boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        animation: 'tf-slide-left 0.25s ease-out',
        fontFamily: 'var(--tf-font)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 18px',
          borderBottom: `1px solid ${C.bd}`,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 800, color: C.t1 }}>⚡ Smart Folders</div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: C.t3,
            fontSize: 18,
            cursor: 'pointer',
            padding: 4,
            borderRadius: radii.sm,
            transition: transition.fast,
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
        {/* Templates */}
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: C.t3,
            fontFamily: 'var(--tf-mono)',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Quick Templates
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 6,
            marginBottom: 16,
          }}
        >
          {TEMPLATES.map((t) => (
            <button
              key={t.name}
              onClick={() => handleApplyTemplate(t)}
              style={{
                padding: '8px 6px',
                borderRadius: radii.md,
                background: C.bg2,
                border: `1px solid ${C.bd}`,
                color: C.t1,
                fontSize: 10,
                fontWeight: 600,
                fontFamily: 'var(--tf-font)',
                cursor: 'pointer',
                textAlign: 'center',
                transition: transition.fast,
              }}
            >
              <div style={{ fontSize: 16, marginBottom: 2 }}>{t.icon}</div>
              {t.name}
            </button>
          ))}
        </div>

        {/* Folder Name */}
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: C.t3,
            fontFamily: 'var(--tf-mono)',
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          Folder Name
        </div>
        <input
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          placeholder="e.g. Overbought"
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: radii.md,
            background: C.bg2,
            border: `1px solid ${C.bd}`,
            color: C.t1,
            fontSize: 12,
            fontFamily: 'var(--tf-font)',
            marginBottom: 14,
            boxSizing: 'border-box',
          }}
        />

        {/* Rules */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: C.t3,
              fontFamily: 'var(--tf-mono)',
              textTransform: 'uppercase',
            }}
          >
            Rules ({rules.length})
          </span>
          <button
            onClick={handleAddRule}
            style={{
              fontSize: 10,
              color: C.b,
              background: `${C.b}12`,
              border: 'none',
              borderRadius: radii.sm,
              padding: '3px 8px',
              cursor: 'pointer',
              fontFamily: 'var(--tf-font)',
              fontWeight: 600,
            }}
          >
            + Add Rule
          </button>
        </div>

        {rules.map((rule, i) => (
          <RuleRow key={i} rule={rule} index={i} onChange={handleChangeRule} onRemove={handleRemoveRule} />
        ))}

        {rules.length > 1 && (
          <div
            style={{
              fontSize: 10,
              color: C.t3,
              fontFamily: 'var(--tf-mono)',
              textAlign: 'center',
              margin: '4px 0 10px',
            }}
          >
            All rules must match (AND logic)
          </div>
        )}

        {/* Existing Smart Folders */}
        {folders && folders.filter((f) => f.smart).length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: C.t3,
                fontFamily: 'var(--tf-mono)',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Active Smart Folders
            </div>
            {folders
              .filter((f) => f.smart)
              .map((f) => (
                <div
                  key={f.id}
                  style={{
                    padding: '8px 10px',
                    borderRadius: radii.md,
                    background: C.bg2,
                    marginBottom: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.t1 }}>⚡ {f.name}</span>
                  <span style={{ fontSize: 10, color: C.t3, fontFamily: 'var(--tf-mono)' }}>
                    {(f.rules || []).length} rules
                  </span>
                </div>
              ))}
          </div>
        )}

        {/* Create Button */}
        <button
          onClick={handleCreate}
          disabled={!folderName.trim() || rules.length === 0}
          style={{
            width: '100%',
            padding: '12px 0',
            marginTop: 14,
            borderRadius: radii.md,
            background: created
              ? C.g
              : !folderName.trim() || rules.length === 0
                ? C.bg2
                : `linear-gradient(135deg, ${C.p}, ${C.b})`,
            color: created ? '#fff' : !folderName.trim() ? C.t3 : '#fff',
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'var(--tf-font)',
            border: 'none',
            cursor: 'pointer',
            transition: transition.base,
          }}
        >
          {created ? '✅ Created!' : '⚡ Create Smart Folder'}
        </button>
      </div>
    </div>
  );
}

export default memo(SmartFolderManager);
