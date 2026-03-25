// Checklist Tab for InsightsPanel
import { useState, useCallback } from 'react';
import { useChecklistStore } from '../../../../state/useChecklistStore.js';
import st from './ChecklistTab.module.css';
import { C } from '@/constants.js';

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
    <div className={st.root}>
      <div className={st.header}>
        <div>
          <div className={st.statusText}>
            {allPassed ? '✅ Ready to trade' : `${passedCount}/${requiredItems.length} required`}
          </div>
          <div className={st.statusHint}>Complete all required items before entering</div>
        </div>
        <div className={st.headerBtns}>
          <button className={`tf-btn ${st.miniBtn}`} onClick={checkAll}>
            All ✓
          </button>
          <button className={`tf-btn ${st.miniBtn}`} onClick={resetChecks}>
            Reset
          </button>
        </div>
      </div>

      <div className={st.progressTrack}>
        <div
          className={st.progressFill}
          style={{
            width: `${requiredItems.length > 0 ? (passedCount / requiredItems.length) * 100 : 0}%`,
            background: allPassed ? C.g : C.b,
          }}
        />
      </div>

      {requiredItems.length > 0 && (
        <div className={st.sectionGroup}>
          <div className={st.sectionLabel}>Required</div>
          {requiredItems.map((item) => (
            <ChecklistItem
              key={item.id}
              item={item}
              checked={!!checked[item.id]}
              onToggle={() => toggleCheck(item.id)}
              onRemove={showCustomize ? () => removeItem(item.id) : null}
            />
          ))}
        </div>
      )}

      {optionalItems.length > 0 && (
        <div className={st.sectionGroup}>
          <div className={st.sectionLabel}>Optional</div>
          {optionalItems.map((item) => (
            <ChecklistItem
              key={item.id}
              item={item}
              checked={!!checked[item.id]}
              onToggle={() => toggleCheck(item.id)}
              onRemove={showCustomize ? () => removeItem(item.id) : null}
            />
          ))}
        </div>
      )}

      <div className={st.customizeArea}>
        <button
          className={`tf-btn ${st.miniBtn} ${st.customizeBtn}`}
          onClick={() => setShowCustomize(!showCustomize)}
          style={{ marginBottom: showCustomize ? 8 : 0 }}
        >
          {showCustomize ? '✓ Done Customizing' : '⚙ Customize Checklist'}
        </button>

        {showCustomize && (
          <div className={st.addRow}>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddItem();
              }}
              placeholder="Add checklist item..."
              className={st.addInput}
            />
            <button
              className={`tf-btn ${st.addBtn} ${!newLabel.trim() ? st.addBtnDisabled : ''}`}
              onClick={handleAddItem}
              disabled={!newLabel.trim()}
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
    <div onClick={onToggle} className={`${st.item} ${checked ? st.itemChecked : ''}`}>
      <div className={`${st.checkbox} ${checked ? st.checkboxOn : st.checkboxOff}`}>{checked ? '✓' : ''}</div>
      <span className={st.itemEmoji}>{item.emoji}</span>
      <span className={`${st.itemLabel} ${checked ? st.itemLabelChecked : st.itemLabelUnchecked}`}>{item.label}</span>
      {item.required && !checked && <span className={st.reqBadge}>REQ</span>}
      {onRemove && (
        <button
          className={`tf-btn ${st.removeItemBtn}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
