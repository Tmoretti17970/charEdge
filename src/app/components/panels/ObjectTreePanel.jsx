// ═══════════════════════════════════════════════════════════════════
// charEdge — Object Tree Panel
// Lists all active drawings on the chart.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState } from 'react';
import { useChartToolsStore } from '../../../state/chart/useChartToolsStore';
import st from './ObjectTreePanel.module.css';

function ObjectTreePanel({ isOpen, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');

  const drawings = useChartToolsStore((s) => s.drawings);
  const setDrawings = useChartToolsStore((s) => s.setDrawings);
  const selectedDrawingId = useChartToolsStore((s) => s.selectedDrawingId);
  const setSelectedDrawing = useChartToolsStore((s) => s.setSelectedDrawing);

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
    <div className={st.root}>
      <div className={st.header}>
        <span className={st.title}>Object Tree</span>
        <button onClick={onClose} className={st.closeBtn}>✕</button>
      </div>

      <div className={st.searchWrap}>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search objects..."
          className={st.searchInput}
        />
      </div>

      <div className={st.list}>
        {filteredDrawings.length === 0 ? (
          <div className={st.empty}>No drawings found.</div>
        ) : (
          filteredDrawings.map((drawing) => (
            <div key={drawing.id} className={st.drawingRow}>
              <div className={st.drawingInfo}>
                <span className={st.drawingType}>{drawing.type}</span>
                <span className={st.drawingId}>{drawing.id.substring(0, 8)}</span>
              </div>

              <button
                onClick={() => onToggleVisibility(drawing.id)}
                title={drawing.visible !== false ? 'Hide' : 'Show'}
                className={`${st.actionBtn} ${drawing.visible !== false ? st.actionBtnVis : st.actionBtnVisOff}`}
              >👁</button>

              <button
                onClick={() => onToggleLock(drawing.id)}
                title={drawing.locked ? 'Unlock' : 'Lock'}
                className={`${st.actionBtn} ${drawing.locked ? st.actionBtnLock : st.actionBtnLockOff}`}
              >🔒</button>

              <button
                onClick={() => onDelete(drawing.id)}
                title="Delete"
                className={`${st.actionBtn} ${st.actionBtnDelete}`}
              >✕</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default React.memo(ObjectTreePanel);
