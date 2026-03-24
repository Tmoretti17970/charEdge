// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Object Tree (Sprint 13.4)
// Sidebar panel listing all drawings with visibility toggles,
// lock switches, layer ordering, labels, and sync controls.
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback, useRef, useEffect } from 'react';
import Icon from '../../design/Icon.jsx';
import s from './DrawingObjectTree.module.css';

const TOOL_ICONS = {
  trendline: '╱', hline: '─', vline: '│', ray: '↗', arrow: '→',
  channel: '⊟', fib: '⊞', fibext: '⊞', rect: '□', ellipse: '○',
  triangle: '△', alertzone: '⚠', text: 'T', callout: '💬',
  measure: '📏', hray: '→', pitchfork: 'Ψ', gannfan: '⟟',
  andrewspitchfork: 'Ψ', regression: '~', cycle: '◎',
  longtrade: '▲', shorttrade: '▼',
};

const TOOL_GROUPS = {
  lines: ['trendline', 'hline', 'vline', 'ray', 'arrow', 'hray'],
  shapes: ['rect', 'ellipse', 'triangle', 'channel'],
  fib: ['fib', 'fibext'],
  text: ['text', 'callout'],
  other: [],
};

function getGroupForTool(type) {
  for (const [group, tools] of Object.entries(TOOL_GROUPS)) {
    if (tools.includes(type)) return group;
  }
  return 'other';
}

// ─── Reusable icon button ─────────────────────────────────────
function IconBtn({ onClick, title, active, children, danger }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={title}
      className={`${s.iconBtn} ${danger ? s.iconBtnDanger : ''}`}
      data-active={active ? 'true' : undefined}
    >
      {children}
    </button>
  );
}

// ─── Single drawing row ───────────────────────────────────────
function DrawingRow({ drawing, drawingEngine, isSelected, onSelect }) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleLabelSave = (e) => {
    drawingEngine.setDrawingLabel(drawing.id, e.target.value);
    setEditing(false);
  };

  const label = drawing.meta?.label || drawing.type;
  const icon = TOOL_ICONS[drawing.type] || '•';
  const color = drawing.style?.color || '#2962FF';

  return (
    <div
      onClick={() => onSelect(drawing.id)}
      className={s.drawingRow}
      data-selected={isSelected || undefined}
      style={{ '--row-color': color }}
    >
      <span className={s.rowIcon}>{icon}</span>

      <div className={s.rowContent}>
        {editing ? (
          <input
            ref={inputRef}
            defaultValue={drawing.meta?.label || ''}
            placeholder={drawing.type}
            onBlur={handleLabelSave}
            onKeyDown={(e) => { if (e.key === 'Enter') handleLabelSave(e); if (e.key === 'Escape') setEditing(false); }}
            className={s.rowInput}
          />
        ) : (
          <span
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
            className={s.rowLabel}
          >
            {label}
          </span>
        )}
      </div>

      {/* Sync badge */}
      {drawing.syncAcrossTimeframes && (
        <Icon name="link" size={10} color="#F59E0B" />
      )}

      {/* Actions */}
      <IconBtn
        onClick={() => drawingEngine.toggleVisibility(drawing.id)}
        title={drawing.visible ? 'Hide' : 'Show'}
        active={drawing.visible !== false}
      >
        <Icon name={drawing.visible !== false ? 'eye' : 'eye-off'} size={13} />
      </IconBtn>

      <IconBtn
        onClick={() => drawingEngine.toggleLock(drawing.id)}
        title={drawing.locked ? 'Unlock' : 'Lock'}
        active={drawing.locked}
      >
        <Icon name={drawing.locked ? 'lock' : 'unlock'} size={13} />
      </IconBtn>

      <IconBtn
        onClick={() => drawingEngine.removeDrawing(drawing.id)}
        title="Delete"
        danger
      >
        ✕
      </IconBtn>
    </div>
  );
}

// ─── Group header ─────────────────────────────────────────────
function GroupHeader({ name, count, expanded, onToggle }) {
  return (
    <div onClick={onToggle} className={s.groupHeader}>
      <span className={s.groupArrow} data-expanded={expanded || undefined}>▶</span>
      <span>{name}</span>
      <span className={s.groupCount}>{count}</span>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────
export default function DrawingObjectTree({ drawingEngine, drawings, selectedDrawingId, onClose }) {
  const [expandedGroups, setExpandedGroups] = useState({ lines: true, shapes: true, fib: true, text: true, other: true });
  const [searchFilter, setSearchFilter] = useState('');

  const toggleGroup = useCallback((group) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  }, []);

  const handleSelect = useCallback((id) => {
    // Find and select the drawing
    if (drawingEngine) {
      const d = drawingEngine.drawings.find(d => d.id === id);
      if (d) {
        // Deselect all first
        for (const dd of drawingEngine.drawings) {
          if (dd.state === 'selected') dd.state = 'idle';
        }
        d.state = 'selected';
        // Fire internal select
        window.dispatchEvent(new CustomEvent('drawing-selected', { detail: { id } }));
      }
    }
  }, [drawingEngine]);

  // Group drawings
  const grouped = {};
  const filteredDrawings = (drawings || []).filter(d => {
    if (!searchFilter) return true;
    const label = d.meta?.label || d.type || '';
    return label.toLowerCase().includes(searchFilter.toLowerCase());
  });

  for (const d of filteredDrawings) {
    const group = getGroupForTool(d.type);
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(d);
  }

  const totalCount = filteredDrawings.length;

  return (
    <div className={s.panel}>
      <div className={s.header}>
        <span className={s.headerTitle}>
          Drawings <span className={s.headerCount}>({totalCount})</span>
        </span>
        <div className={s.headerActions}>
          <IconBtn onClick={() => drawingEngine?.selectAll()} title="Select All">☑</IconBtn>
          <IconBtn onClick={() => drawingEngine?.clearAll()} title="Clear All" danger>🗑</IconBtn>
          {onClose && <IconBtn onClick={onClose} title="Close">✕</IconBtn>}
        </div>
      </div>

      <div className={s.searchWrap}>
        <input
          type="text"
          placeholder="Filter drawings..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className={s.searchInput}
        />
      </div>

      <div className={s.list}>
        {totalCount === 0 ? (
          <div className={s.emptyState}>
            No drawings on this chart.
            <br /><span className={s.emptyHint}>Use the toolbar to add drawings.</span>
          </div>
        ) : (
          Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <GroupHeader
                name={group}
                count={items.length}
                expanded={expandedGroups[group]}
                onToggle={() => toggleGroup(group)}
              />
              {expandedGroups[group] && (
                <div className={s.groupItems}>
                  {items.map(d => (
                    <DrawingRow
                      key={d.id}
                      drawing={d}
                      drawingEngine={drawingEngine}
                      isSelected={d.id === selectedDrawingId || drawingEngine?.selectedDrawingIds?.has(d.id)}
                      onSelect={handleSelect}
                    />
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {drawingEngine?.selectedDrawingIds?.size > 0 && (
        <div className={s.footer}>
          <span className={s.footerCount}>
            {drawingEngine.selectedDrawingIds.size} selected
          </span>
          <button
            onClick={() => drawingEngine.deleteSelected()}
            className={s.deleteSelectedBtn}
          >
            Delete Selected
          </button>
        </div>
      )}
    </div>
  );
}
