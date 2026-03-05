// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Template Bar (Sprint 3)
// Horizontal favorites strip showing saved drawing tool presets.
// Each preset = tool type + color + line width + dash pattern.
// ═══════════════════════════════════════════════════════════════════
import React, { useState, useCallback } from 'react';
import { useChartStore } from '../../../../state/useChartStore.js';

const TEMPLATE_ICONS = {
  trendline: '╱', hline: '━', vline: '┃', fib: '🔢', rect: '▭',
  channel: '⊏', arrow: '→', ray: '╲', measure: '📐', text: 'T',
  ellipse: '○', triangle: '△', pitchfork: '⑂', alertzone: '⚠',
  crossline: '✚', hray: '▸', extendedline: '↔', callout: '💬',
};

// Load saved templates
let _savedTemplates = null;
try {
  const raw = localStorage.getItem('charEdge-drawing-templates');
  if (raw) _savedTemplates = JSON.parse(raw);
} catch (_) { /* storage may be blocked */ }

const DEFAULT_TEMPLATES = [
  { id: 'dt1', tool: 'trendline', color: '#2962FF', lineWidth: 2, dash: [], label: 'Blue Trend' },
  { id: 'dt2', tool: 'hline', color: '#EF5350', lineWidth: 2, dash: [], label: 'Red Support' },
  { id: 'dt3', tool: 'fib', color: '#FF9800', lineWidth: 1.5, dash: [], label: 'Fib Ret.' },
  { id: 'dt4', tool: 'rect', color: '#26A69A', lineWidth: 1, dash: [], label: 'Zone' },
  { id: 'dt5', tool: 'trendline', color: '#AB47BC', lineWidth: 1.5, dash: [6, 3], label: 'Dashed Trend' },
  { id: 'dt6', tool: 'hline', color: '#66BB6A', lineWidth: 2, dash: [], label: 'Green Resist.' },
  { id: 'dt7', tool: 'channel', color: '#42A5F5', lineWidth: 1.5, dash: [], label: 'Channel' },
  { id: 'dt8', tool: 'measure', color: '#78909C', lineWidth: 1, dash: [], label: 'Measure' },
];

export default function DrawingTemplateBar() {
  const [templates, setTemplatesLocal] = useState(_savedTemplates || DEFAULT_TEMPLATES);
  const [showAddModal, setShowAddModal] = useState(false);
  const activeTool = useChartStore((s) => s.activeTool);
  const setActiveTool = useChartStore((s) => s.setActiveTool);
  const setDrawingColor = useChartStore((s) => s.setDrawingColor);

  const persistTemplates = useCallback((t) => {
    setTemplatesLocal(t);
    try { localStorage.setItem('charEdge-drawing-templates', JSON.stringify(t)); } catch (_) { /* storage may be blocked */ }
  }, []);

  const handleSelect = useCallback((tmpl) => {
    setActiveTool(tmpl.tool);
    setDrawingColor(tmpl.color);
  }, [setActiveTool, setDrawingColor]);

  const handleRemove = useCallback((id) => {
    persistTemplates(templates.filter((t) => t.id !== id));
  }, [templates, persistTemplates]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 3,
      padding: '3px 8px',
      background: 'rgba(19, 23, 34, 0.6)',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      overflowX: 'auto',
      overflowY: 'hidden',
      flexShrink: 0,
      scrollbarWidth: 'none',
    }}>
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginRight: 4, whiteSpace: 'nowrap', fontWeight: 600 }}>
        FAVORITES
      </span>
      {templates.map((tmpl) => (
        <button
          key={tmpl.id}
          onClick={() => handleSelect(tmpl)}
          onContextMenu={(e) => { e.preventDefault(); handleRemove(tmpl.id); }}
          title={`${tmpl.label} (right-click to remove)`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            borderRadius: 6,
            border: activeTool === tmpl.tool ? '1px solid rgba(41,98,255,0.5)' : '1px solid transparent',
            background: activeTool === tmpl.tool ? 'rgba(41,98,255,0.15)' : 'rgba(255,255,255,0.04)',
            color: 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            fontSize: 11,
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
        >
          <span style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: tmpl.color,
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 11 }}>{TEMPLATE_ICONS[tmpl.tool] || '·'}</span>
          <span style={{ fontSize: 10, opacity: 0.6 }}>{tmpl.label}</span>
        </button>
      ))}
      <button
        onClick={() => {
          const label = prompt('Template label:', 'Custom');
          if (!label) return;
          const id = `dt_${Date.now()}`;
          persistTemplates([...templates, { id, tool: activeTool || 'trendline', color: '#2962FF', lineWidth: 2, dash: [], label }]);
        }}
        title="Add template from current tool"
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          border: '1px dashed rgba(255,255,255,0.15)',
          background: 'transparent',
          color: 'rgba(255,255,255,0.4)',
          cursor: 'pointer',
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        +
      </button>
    </div>
  );
}
