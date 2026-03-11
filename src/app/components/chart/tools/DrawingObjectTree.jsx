// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Object Tree (Sprint 13.4)
// Sidebar panel listing all drawings with visibility toggles,
// lock switches, layer ordering, labels, and sync controls.
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback, useRef, useEffect } from 'react';
import Icon from '../../design/Icon.jsx';

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
function IconBtn({ onClick, title, active, children, style: extraStyle }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={title}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '2px 4px', borderRadius: 3, fontSize: 12,
        color: active ? '#2962FF' : '#787B86',
        opacity: active ? 1 : 0.6,
        transition: 'all 0.15s',
        ...extraStyle,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = active ? 1 : 0.6; }}
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
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 8px', borderRadius: 4,
        background: isSelected ? 'rgba(41,98,255,0.12)' : 'transparent',
        borderLeft: `3px solid ${color}`,
        cursor: 'pointer',
        transition: 'background 0.15s',
        fontSize: 12,
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'transparent';
      }}
    >
      {/* Icon */}
      <span style={{ fontSize: 14, opacity: 0.7, fontFamily: 'monospace', width: 18, textAlign: 'center' }}>
        {icon}
      </span>

      {/* Label / editable */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <input
            ref={inputRef}
            defaultValue={drawing.meta?.label || ''}
            placeholder={drawing.type}
            onBlur={handleLabelSave}
            onKeyDown={(e) => { if (e.key === 'Enter') handleLabelSave(e); if (e.key === 'Escape') setEditing(false); }}
            style={{
              background: '#1E222D', border: '1px solid #363A45', borderRadius: 3,
              color: '#D1D4DC', fontSize: 11, padding: '1px 4px', width: '100%',
              outline: 'none',
            }}
          />
        ) : (
          <span
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
            style={{
              color: '#D1D4DC', overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', display: 'block',
            }}
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
        style={{ color: '#EF5350' }}
      >
        ✕
      </IconBtn>
    </div>
  );
}

// ─── Group header ─────────────────────────────────────────────
function GroupHeader({ name, count, expanded, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 8px', cursor: 'pointer',
        color: '#787B86', fontSize: 11, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.5px',
        borderBottom: '1px solid rgba(54,58,69,0.3)',
      }}
    >
      <span style={{ fontSize: 10, transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
        ▶
      </span>
      <span>{name}</span>
      <span style={{ marginLeft: 'auto', color: '#363A45', fontSize: 10 }}>{count}</span>
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
    <div style={{
      position: 'absolute', right: 0, top: 42, bottom: 0,
      width: 260, background: 'rgba(19,23,34,0.97)',
      borderLeft: '1px solid rgba(54,58,69,0.5)',
      backdropFilter: 'blur(10px)', zIndex: 30,
      display: 'flex', flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      transition: 'transform 0.2s ease',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', borderBottom: '1px solid rgba(54,58,69,0.5)',
      }}>
        <span style={{ color: '#D1D4DC', fontSize: 13, fontWeight: 600 }}>
          Drawings <span style={{ color: '#787B86', fontWeight: 400 }}>({totalCount})</span>
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <IconBtn onClick={() => drawingEngine?.selectAll()} title="Select All">☑</IconBtn>
          <IconBtn onClick={() => drawingEngine?.clearAll()} title="Clear All" style={{ color: '#EF5350' }}>🗑</IconBtn>
          {onClose && <IconBtn onClick={onClose} title="Close">✕</IconBtn>}
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '6px 12px' }}>
        <input
          type="text"
          placeholder="Filter drawings..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          style={{
            width: '100%', background: '#1E222D', border: '1px solid #363A45',
            borderRadius: 4, color: '#D1D4DC', fontSize: 11, padding: '5px 8px',
            outline: 'none',
          }}
        />
      </div>

      {/* Drawing list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
        {totalCount === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#787B86', fontSize: 12 }}>
            No drawings on this chart.
            <br /><span style={{ fontSize: 11, opacity: 0.7 }}>Use the toolbar to add drawings.</span>
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
                <div style={{ padding: '2px 4px' }}>
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

      {/* Footer: batch actions */}
      {drawingEngine?.selectedDrawingIds?.size > 0 && (
        <div style={{
          padding: '8px 12px', borderTop: '1px solid rgba(54,58,69,0.5)',
          display: 'flex', gap: 6, alignItems: 'center',
        }}>
          <span style={{ color: '#787B86', fontSize: 11 }}>
            {drawingEngine.selectedDrawingIds.size} selected
          </span>
          <button
            onClick={() => drawingEngine.deleteSelected()}
            style={{
              marginLeft: 'auto', background: 'rgba(239,83,80,0.15)',
              border: '1px solid rgba(239,83,80,0.3)', borderRadius: 4,
              color: '#EF5350', fontSize: 11, padding: '3px 10px',
              cursor: 'pointer',
            }}
          >
            Delete Selected
          </button>
        </div>
      )}
    </div>
  );
}
