// ═══════════════════════════════════════════════════════════════════
// charEdge — Object Tree Panel
// Lists all active drawings on the chart. Allows toggling visibility,
// locking, and deletion of individual drawings.
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { C, F } from '../../../constants.js';
import { useChartStore } from '../../../state/useChartStore';

/**
 * ObjectTreePanel — Manage drawings on the chart.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen     - Panel visibility
 * @param {Function} props.onClose   - Close handler
 * @param {Array} props.drawings     - List of drawing objects
 * @param {Function} props.onToggleVisibility
 * @param {Function} props.onToggleLock
 * @param {Function} props.onDelete
 */
export default function ObjectTreePanel({ isOpen, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');

  const drawings = useChartStore((s) => s.drawings);
  const setDrawings = useChartStore((s) => s.setDrawings);
  const selectedDrawingId = useChartStore((s) => s.selectedDrawingId);
  const setSelectedDrawing = useChartStore((s) => s.setSelectedDrawing);

  const onToggleVisibility = (id) => {
    setDrawings(drawings.map((d) => (d.id === id ? { ...d, visible: d.visible === false ? true : false } : d)));
  };

  const onToggleLock = (id) => {
    setDrawings(drawings.map((d) => (d.id === id ? { ...d, locked: !d.locked } : d)));
  };

  const onDelete = (id) => {
    setDrawings(drawings.filter((d) => d.id !== id));
    if (selectedDrawingId === id) setSelectedDrawing(null);
  };

  if (!isOpen) return null;

  const filteredDrawings = drawings.filter(
    (d) =>
      !searchTerm ||
      d.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.id.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        width: 300,
        maxHeight: 'calc(100vh - 80px)',
        background: C.sf,
        border: `1px solid ${C.bd}`,
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: F,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: `1px solid ${C.bd}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ color: C.t1, fontSize: 13, fontWeight: 600 }}>Object Tree</span>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: C.t3,
            cursor: 'pointer',
            fontSize: 16,
            padding: '0 4px',
          }}
        >
          ✕
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '8px 12px' }}>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search objects..."
          style={{
            width: '100%',
            padding: '6px 10px',
            background: C.bg2,
            border: `1px solid ${C.bd}`,
            borderRadius: 6,
            color: C.t1,
            fontSize: 12,
            outline: 'none',
            fontFamily: F,
          }}
        />
      </div>

      {/* Drawing List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 8px' }}>
        {filteredDrawings.length === 0 ? (
          <div style={{ padding: '16px 12px', textAlign: 'center', color: C.t3, fontSize: 12 }}>No drawings found.</div>
        ) : (
          filteredDrawings.map((drawing) => (
            <div
              key={drawing.id}
              style={{
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                borderBottom: `1px solid ${C.bd}33`,
              }}
            >
              {/* Type and ID */}
              <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ color: C.t1, fontSize: 12, textTransform: 'capitalize' }}>{drawing.type}</span>
                <span style={{ color: C.t3, fontSize: 10, marginLeft: 6 }}>{drawing.id.substring(0, 8)}</span>
              </div>

              {/* Actions */}
              <button
                onClick={() => onToggleVisibility(drawing.id)}
                title={drawing.visible !== false ? 'Hide' : 'Show'}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: drawing.visible !== false ? C.t2 : C.t3,
                  cursor: 'pointer',
                  fontSize: 12,
                  padding: '0 4px',
                  opacity: drawing.visible !== false ? 1 : 0.4,
                }}
              >
                👁
              </button>

              <button
                onClick={() => onToggleLock(drawing.id)}
                title={drawing.locked ? 'Unlock' : 'Lock'}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: drawing.locked ? C.y : C.t3,
                  cursor: 'pointer',
                  fontSize: 12,
                  padding: '0 4px',
                  opacity: drawing.locked ? 1 : 0.4,
                }}
              >
                🔒
              </button>

              <button
                onClick={() => onDelete(drawing.id)}
                title="Delete"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: C.r,
                  cursor: 'pointer',
                  fontSize: 12,
                  padding: '0 4px',
                  opacity: 0.6,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.6)}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
