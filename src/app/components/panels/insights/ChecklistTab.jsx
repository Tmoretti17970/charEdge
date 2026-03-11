// Checklist Tab for InsightsPanel
import { useState, useCallback } from 'react';
import { C, F } from '../../../../constants.js';
import { useChecklistStore } from '../../../../state/useChecklistStore.js';

const miniBtn = {
  padding: '3px 8px',
  background: C.sf,
  border: `1px solid ${C.bd}`,
  borderRadius: 4,
  color: C.t3,
  fontSize: 10,
  cursor: 'pointer',
  fontFamily: F,
};

export default function ChecklistTab() {
  const items = useChecklistStore((s) => s.items);
  const checked = useChecklistStore((s) => s.checked);
  const toggleCheck = useChecklistStore((s) => s.toggleCheck);
  const resetChecks = useChecklistStore((s) => s.resetChecks);
  const checkAll = useChecklistStore((s) => s.checkAll);
  const addItem = useChecklistStore((s) => s.addItem);
  const removeItem = useChecklistStore((s) => s.removeItem);

  const [newLabel, setNewLabel] = useState('');
  const [showCustomize, setShowCustomize] = useState(false);

  const requiredItems = items.filter((i) => i.required);
  const optionalItems = items.filter((i) => !i.required);
  const passedCount = requiredItems.filter((i) => checked[i.id]).length;
  const allPassed = passedCount === requiredItems.length;

  const handleAddItem = useCallback(() => {
    if (!newLabel.trim()) return;
    addItem(newLabel.trim());
    setNewLabel('');
  }, [newLabel, addItem]);

  return (
    <div style={{ padding: 10 }}>
      {/* Header + progress */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>
            {allPassed ? '✅ Ready to trade' : `${passedCount}/${requiredItems.length} required`}
          </div>
          <div style={{ fontSize: 10, color: C.t3 }}>Complete all required items before entering</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="tf-btn" onClick={checkAll} style={miniBtn}>All ✓</button>
          <button className="tf-btn" onClick={resetChecks} style={miniBtn}>Reset</button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: C.bd, borderRadius: 2, marginBottom: 12, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${requiredItems.length > 0 ? (passedCount / requiredItems.length) * 100 : 0}%`,
            background: allPassed ? C.g : C.b,
            borderRadius: 2,
            transition: 'width 0.3s, background 0.3s',
          }}
        />
      </div>

      {/* Required items */}
      {requiredItems.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
            Required
          </div>
          {requiredItems.map((item) => (
            <ChecklistItem key={item.id} item={item} checked={!!checked[item.id]} onToggle={() => toggleCheck(item.id)} onRemove={showCustomize ? () => removeItem(item.id) : null} />
          ))}
        </div>
      )}

      {/* Optional items */}
      {optionalItems.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
            Optional
          </div>
          {optionalItems.map((item) => (
            <ChecklistItem key={item.id} item={item} checked={!!checked[item.id]} onToggle={() => toggleCheck(item.id)} onRemove={showCustomize ? () => removeItem(item.id) : null} />
          ))}
        </div>
      )}

      {/* Customize toggle */}
      <div style={{ borderTop: `1px solid ${C.bd}`, paddingTop: 8 }}>
        <button
          className="tf-btn"
          onClick={() => setShowCustomize(!showCustomize)}
          style={{ ...miniBtn, width: '100%', fontSize: 11, padding: '6px 0', marginBottom: showCustomize ? 8 : 0 }}
        >
          {showCustomize ? '✓ Done Customizing' : '⚙ Customize Checklist'}
        </button>

        {showCustomize && (
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(); }}
              placeholder="Add checklist item..."
              style={{
                flex: 1, padding: '5px 8px', background: C.sf, border: `1px solid ${C.bd}`,
                borderRadius: 4, color: C.t1, fontFamily: F, fontSize: 11, outline: 'none',
              }}
            />
            <button
              className="tf-btn"
              onClick={handleAddItem}
              disabled={!newLabel.trim()}
              style={{
                padding: '5px 12px', background: C.b, border: 'none', borderRadius: 4,
                color: '#fff', fontSize: 11, fontWeight: 600,
                cursor: newLabel.trim() ? 'pointer' : 'default',
                opacity: newLabel.trim() ? 1 : 0.4,
              }}
            >
              Add
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ChecklistItem({ item, checked, onToggle, onRemove }) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px',
        cursor: 'pointer', background: checked ? C.g + '08' : 'transparent',
        borderRadius: 5, marginBottom: 2, transition: 'background 0.15s',
      }}
    >
      <div
        style={{
          width: 18, height: 18, borderRadius: 4, flexShrink: 0,
          border: `2px solid ${checked ? C.g : C.bd}`,
          background: checked ? C.g : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, color: '#fff', fontWeight: 700, transition: 'all 0.15s',
        }}
      >
        {checked ? '✓' : ''}
      </div>
      <span style={{ fontSize: 10, flexShrink: 0 }}>{item.emoji}</span>
      <span
        style={{
          fontSize: 12, color: checked ? C.t3 : C.t1, flex: 1,
          textDecoration: checked ? 'line-through' : 'none', transition: 'all 0.15s',
        }}
      >
        {item.label}
      </span>
      {item.required && !checked && <span style={{ fontSize: 8, color: C.r, fontWeight: 700 }}>REQ</span>}
      {onRemove && (
        <button
          className="tf-btn"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{ background: 'none', border: 'none', color: C.t3, fontSize: 12, cursor: 'pointer', padding: '0 2px' }}
        >
          ×
        </button>
      )}
    </div>
  );
}
