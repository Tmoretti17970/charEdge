// ═══════════════════════════════════════════════════════════════════
// charEdge v10.4 — Widget Customizer Modal
// Sprint 8 C8.10: Add/remove widgets, apply presets, toggle edit mode.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useCallback } from 'react';
import { C, F, M } from '../../../constants.js';
import { WIDGET_REGISTRY, DASHBOARD_PRESETS } from './DashboardWidgets.jsx';

/**
 * @param {boolean} isOpen
 * @param {Function} onClose
 * @param {string[]} activeWidgets - Currently visible widget IDs
 * @param {Function} onUpdateWidgets - Callback with new widget ID array
 * @param {Function} onApplyPreset - Callback with preset key
 */
function WidgetCustomizer({ isOpen, onClose, activeWidgets, onUpdateWidgets, onApplyPreset }) {
  const [tab, setTab] = useState('widgets'); // 'widgets' | 'presets'

  const toggleWidget = useCallback(
    (id) => {
      const next = activeWidgets.includes(id) ? activeWidgets.filter((w) => w !== id) : [...activeWidgets, id];
      onUpdateWidgets(next);
    },
    [activeWidgets, onUpdateWidgets],
  );

  if (!isOpen) return null;

  const categories = [...new Set(Object.values(WIDGET_REGISTRY).map((w) => w.category))];

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)' }} />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10000,
          background: C.bg,
          borderRadius: 12,
          border: `1px solid ${C.bd}`,
          width: 460,
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 18px',
            borderBottom: `1px solid ${C.bd}`,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: F }}>⚙️ Customize Dashboard</div>
          <button
            className="tf-btn"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: C.t3,
              fontSize: 16,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: `1px solid ${C.bd}`,
          }}
        >
          {[
            { id: 'widgets', label: 'Widgets' },
            { id: 'presets', label: 'Presets' },
          ].map((t) => (
            <button
              className="tf-btn"
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                padding: '10px 0',
                background: 'none',
                border: 'none',
                borderBottom: tab === t.id ? `2px solid ${C.b}` : '2px solid transparent',
                color: tab === t.id ? C.b : C.t3,
                fontSize: 12,
                fontWeight: 700,
                fontFamily: F,
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
          {tab === 'widgets' ? (
            <>
              {/* Active count */}
              <div
                style={{
                  padding: '0 18px 8px',
                  fontSize: 10,
                  color: C.t3,
                  fontFamily: M,
                }}
              >
                {activeWidgets.length} of {Object.keys(WIDGET_REGISTRY).length} widgets active
              </div>

              {categories.map((cat) => (
                <div key={cat}>
                  <div
                    style={{
                      padding: '8px 18px 4px',
                      fontSize: 9,
                      fontWeight: 700,
                      color: C.t3,
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                      fontFamily: M,
                    }}
                  >
                    {cat}
                  </div>

                  {Object.values(WIDGET_REGISTRY)
                    .filter((w) => w.category === cat)
                    .map((widget) => {
                      const isActive = activeWidgets.includes(widget.id);
                      return (
                        <div
                          key={widget.id}
                          onClick={() => toggleWidget(widget.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 18px',
                            cursor: 'pointer',
                            background: isActive ? C.b + '08' : 'transparent',
                            transition: 'background 0.1s',
                          }}
                        >
                          {/* Toggle */}
                          <div
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 4,
                              border: `2px solid ${isActive ? C.b : C.bd}`,
                              background: isActive ? C.b : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {isActive && <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>✓</span>}
                          </div>

                          <span style={{ fontSize: 16 }}>{widget.icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: C.t1 }}>{widget.label}</div>
                            <div style={{ fontSize: 9, color: C.t3, fontFamily: M }}>
                              {widget.span > 1 ? 'Full width' : 'Half width'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ))}
            </>
          ) : (
            /* Presets tab */
            <div style={{ padding: '0 18px' }}>
              {Object.entries(DASHBOARD_PRESETS).map(([key, preset]) => (
                <div
                  key={key}
                  onClick={() => {
                    onApplyPreset(key);
                    onClose();
                  }}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 8,
                    border: `1px solid ${C.bd}`,
                    marginBottom: 8,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.b)}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.bd)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 18 }}>{preset.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{preset.label}</span>
                    <span
                      style={{
                        fontSize: 9,
                        fontFamily: M,
                        color: C.t3,
                        marginLeft: 'auto',
                      }}
                    >
                      {preset.widgets.length} widgets
                    </span>
                  </div>
                  {preset.description && (
                    <div style={{ fontSize: 10, color: C.t3, lineHeight: 1.4, paddingLeft: 26 }}>
                      {preset.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '10px 18px',
            borderTop: `1px solid ${C.bd}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            className="tf-btn"
            onClick={() => {
              const defaults = Object.values(WIDGET_REGISTRY)
                .filter((w) => w.default)
                .map((w) => w.id);
              onUpdateWidgets(defaults);
            }}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: `1px solid ${C.bd}`,
              background: C.sf,
              color: C.t2,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reset to Default
          </button>
          <button
            className="tf-btn"
            onClick={onClose}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              background: C.b,
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
}

export { WidgetCustomizer };

export default React.memo(WidgetCustomizer);
