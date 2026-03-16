// ═══════════════════════════════════════════════════════════════════
// charEdge — Smart Alert Picker (Sprint 22)
//
// Slide-over panel that lets users browse 20+ alert templates,
// organized by category. Creates compound alerts via useAlertStore.
// ═══════════════════════════════════════════════════════════════════

import { useState, memo } from 'react';
import { C, F, M } from '../../../constants.js';
import { radii, transition } from '../../../theme/tokens.js';
import { useMarketsPrefsStore } from '../../../state/useMarketsPrefsStore';
import { useAlertStore } from '../../../state/useAlertStore';
import {
  getAllTemplates,
  getCategories,
  createAlertFromTemplate,
} from '../../../charting_library/ai/SmartAlertTemplates.js';

// ─── Component ──────────────────────────────────────────────────

function SmartAlertPicker() {
  const alertPickerOpen = useMarketsPrefsStore((s) => s.alertPickerOpen);
  const close = useMarketsPrefsStore((s) => s.setAlertPickerOpen);
  const selectedSymbol = useMarketsPrefsStore((s) => s.selectedSymbol);
  const addCompoundAlert = useAlertStore((s) => s.addCompoundAlert);

  const [activeCategory, setActiveCategory] = useState('momentum');
  const [created, setCreated] = useState(null);

  if (!alertPickerOpen) return null;

  const categories = getCategories();
  const allTemplates = getAllTemplates();
  const filtered = allTemplates.filter((t) => t.category === activeCategory);
  const symbol = selectedSymbol || 'BTCUSDT';

  const handleCreate = (templateId) => {
    const params = createAlertFromTemplate(templateId, symbol);
    if (!params) return;
    addCompoundAlert(params);
    setCreated(templateId);
    setTimeout(() => setCreated(null), 2000);
  };

  return (
    <div
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 360, zIndex: 900,
        background: C.bg,
        borderLeft: `1px solid ${C.bd}30`,
        display: 'flex', flexDirection: 'column',
        animation: 'picker-slide-in 0.25s ease-out',
        boxShadow: '-8px 0 30px rgba(0,0,0,0.25)',
      }}
    >
      {/* ── Header ────────────────────────────────────────── */}
      <div style={{
        padding: '16px 20px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${C.bd}20`,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, fontFamily: F, color: C.t1 }}>
            🔔 Smart Alerts
          </div>
          <div style={{ fontSize: 10, fontFamily: M, color: C.t3, marginTop: 2 }}>
            for <span style={{ color: C.b, fontWeight: 700 }}>{symbol.replace('USDT', '')}</span>
          </div>
        </div>
        <button
          onClick={() => close(false)}
          style={{
            background: `${C.bd}20`, border: 'none', borderRadius: radii.sm,
            color: C.t2, fontSize: 14, fontWeight: 600,
            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >×</button>
      </div>

      {/* ── Category Tabs ─────────────────────────────────── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 4,
        padding: '10px 16px 8px',
        borderBottom: `1px solid ${C.bd}12`,
      }}>
        {Object.entries(categories).map(([key, cat]) => {
          const isActive = activeCategory === key;
          return (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              style={{
                padding: '4px 10px', borderRadius: 12,
                fontSize: 9, fontWeight: 700, fontFamily: M,
                border: isActive ? `1px solid ${cat.color}40` : `1px solid ${C.bd}20`,
                background: isActive ? `${cat.color}12` : 'transparent',
                color: isActive ? cat.color : C.t3,
                cursor: 'pointer',
                transition: `all ${transition.fast}`,
              }}
            >
              {cat.icon} {cat.label}
            </button>
          );
        })}
      </div>

      {/* ── Template Cards ────────────────────────────────── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '12px 16px',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {filtered.map((tmpl) => {
          const isCreated = created === tmpl.id;
          return (
            <div
              key={tmpl.id}
              style={{
                background: `${C.bd}08`,
                borderRadius: radii.md,
                border: `1px solid ${C.bd}15`,
                padding: '12px 14px',
                transition: `all ${transition.fast}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 16 }}>{tmpl.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 800, fontFamily: F, color: C.t1 }}>
                  {tmpl.label}
                </span>
              </div>
              <p style={{ fontSize: 10, fontFamily: M, color: C.t2, margin: '0 0 6px', lineHeight: 1.5 }}>
                {tmpl.description}
              </p>
              <p style={{ fontSize: 9, fontFamily: M, color: C.t3, fontStyle: 'italic', margin: '0 0 10px', lineHeight: 1.5 }}>
                💡 {tmpl.explanation}
              </p>
              <button
                onClick={() => handleCreate(tmpl.id)}
                disabled={isCreated}
                style={{
                  width: '100%',
                  padding: '6px 0',
                  borderRadius: radii.sm,
                  fontSize: 10, fontWeight: 700, fontFamily: M,
                  border: 'none',
                  background: isCreated ? '#34c75930' : categories[tmpl.category]?.color || C.b,
                  color: isCreated ? '#34c759' : '#fff',
                  cursor: isCreated ? 'default' : 'pointer',
                  transition: `all ${transition.fast}`,
                }}
              >
                {isCreated ? '✓ Alert Created' : `Create for ${symbol.replace('USDT', '')}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Slide animation ───────────────────────────────── */}
      <style>{`
        @keyframes picker-slide-in {
          from { transform: translateX(100%); opacity: 0.5; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export { SmartAlertPicker };
export default memo(SmartAlertPicker);
