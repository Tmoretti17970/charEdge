// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Template Selector
//
// Compact dropdown for chart toolbar: apply, save, and manage templates.
// Renders as a small "📋" button that expands to a dropdown list.
//
// Usage:
//   <TemplateSelector
//     indicators={currentIndicators}
//     chartType={currentChartType}
//     onApply={(template) => { setIndicators(template.indicators); setChartType(template.chartType); }}
//   />
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback } from 'react';
import { C, F, M } from '../../constants.js';
import { useTemplateStore } from '../../state/useTemplateStore';

export default function TemplateSelector({ indicators, chartType, onApply }) {
  const templates = useTemplateStore((s) => s.templates);
  const saveTemplate = useTemplateStore((s) => s.saveTemplate);
  const deleteTemplate = useTemplateStore((s) => s.deleteTemplate);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const containerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSaving(false);
        setConfirmDelete(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleApply = useCallback(
    (template) => {
      if (onApply) onApply(template);
      setOpen(false);
    },
    [onApply],
  );

  const handleSave = useCallback(() => {
    if (!saveName.trim()) return;
    saveTemplate(saveName.trim(), indicators, chartType);
    setSaveName('');
    setSaving(false);
  }, [saveName, indicators, chartType, saveTemplate]);

  const handleDelete = useCallback(
    (id) => {
      if (confirmDelete === id) {
        deleteTemplate(id);
        setConfirmDelete(null);
      } else {
        setConfirmDelete(id);
      }
    },
    [confirmDelete, deleteTemplate],
  );

  const builtIn = templates.filter((t) => t.builtIn);
  const userTemplates = templates.filter((t) => !t.builtIn);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger button */}
      <button
        className="tf-btn"
        onClick={() => {
          setOpen(!open);
          setSaving(false);
          setConfirmDelete(null);
        }}
        title="Chart Templates"
        style={{
          background: open ? C.b + '20' : 'transparent',
          border: `1px solid ${open ? C.b : 'transparent'}`,
          borderRadius: 4,
          padding: '4px 8px',
          color: open ? C.b : C.t2,
          fontSize: 12,
          cursor: 'pointer',
          fontFamily: F,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          transition: 'all 0.1s',
        }}
      >
        📋 Templates
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: 260,
            zIndex: 9999,
            background: C.sf,
            border: `1px solid ${C.bd}`,
            borderRadius: 8,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          }}
        >
          {/* Built-in templates */}
          <div
            style={{
              padding: '8px 10px 4px',
              fontSize: 9,
              fontWeight: 700,
              color: C.t3,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Presets
          </div>
          {builtIn.map((tpl) => (
            <TemplateRow key={tpl.id} template={tpl} onApply={handleApply} />
          ))}

          {/* User templates */}
          {userTemplates.length > 0 && (
            <>
              <div style={{ height: 1, background: C.bd, margin: '4px 10px' }} />
              <div
                style={{
                  padding: '6px 10px 4px',
                  fontSize: 9,
                  fontWeight: 700,
                  color: C.t3,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Saved ({userTemplates.length})
              </div>
              {userTemplates.map((tpl) => (
                <TemplateRow
                  key={tpl.id}
                  template={tpl}
                  onApply={handleApply}
                  onDelete={handleDelete}
                  isDeleting={confirmDelete === tpl.id}
                />
              ))}
            </>
          )}

          {/* Save current */}
          <div style={{ borderTop: `1px solid ${C.bd}`, padding: 8 }}>
            {!saving ? (
              <button
                className="tf-btn"
                onClick={() => setSaving(true)}
                disabled={!indicators || indicators.length === 0}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  background: C.b + '15',
                  border: `1px solid ${C.b}30`,
                  borderRadius: 5,
                  color: C.b,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: indicators?.length > 0 ? 'pointer' : 'default',
                  opacity: indicators?.length > 0 ? 1 : 0.4,
                  fontFamily: F,
                }}
              >
                + Save Current as Template
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  autoFocus
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                    if (e.key === 'Escape') setSaving(false);
                  }}
                  placeholder="Template name..."
                  style={{
                    flex: 1,
                    padding: '5px 8px',
                    background: C.bg,
                    border: `1px solid ${C.bd}`,
                    borderRadius: 4,
                    color: C.t1,
                    fontFamily: M,
                    fontSize: 11,
                    outline: 'none',
                  }}
                />
                <button
                  className="tf-btn"
                  onClick={handleSave}
                  disabled={!saveName.trim()}
                  style={{
                    padding: '5px 12px',
                    background: C.b,
                    border: 'none',
                    borderRadius: 4,
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: saveName.trim() ? 'pointer' : 'default',
                    opacity: saveName.trim() ? 1 : 0.4,
                  }}
                >
                  Save
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Template Row ───────────────────────────────────────────────

function TemplateRow({ template, onApply, onDelete, isDeleting }) {
  const indCount = template.indicators?.length || 0;
  const indSummary = template.indicators?.map((i) => i.type.toUpperCase()).join(', ') || 'No indicators';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 10px',
        gap: 6,
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = C.bg + '80';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
      onClick={() => onApply(template)}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.t1 }}>{template.name}</span>
          {template.builtIn && (
            <span
              style={{
                fontSize: 7,
                padding: '1px 4px',
                borderRadius: 2,
                background: C.b + '15',
                color: C.b,
                fontWeight: 700,
              }}
            >
              PRESET
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 9,
            color: C.t3,
            fontFamily: M,
            marginTop: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {indCount} indicator{indCount !== 1 ? 's' : ''}: {indSummary}
        </div>
        {/* Color dots for each indicator */}
        <div style={{ display: 'flex', gap: 2, marginTop: 3 }}>
          {(template.indicators || []).map((ind, i) => (
            <div
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: ind.color || C.b,
              }}
            />
          ))}
        </div>
      </div>

      {/* Delete button (user templates only) */}
      {onDelete && (
        <button
          className="tf-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(template.id);
          }}
          title={isDeleting ? 'Click again to confirm' : 'Delete template'}
          style={{
            background: 'none',
            border: 'none',
            color: isDeleting ? C.r : C.t3,
            fontSize: isDeleting ? 10 : 11,
            cursor: 'pointer',
            padding: '2px 4px',
            fontWeight: isDeleting ? 700 : 400,
            flexShrink: 0,
          }}
        >
          {isDeleting ? 'Confirm?' : '×'}
        </button>
      )}
    </div>
  );
}

export { TemplateSelector };
