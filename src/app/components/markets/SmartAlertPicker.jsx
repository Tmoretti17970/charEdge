// ═══════════════════════════════════════════════════════════════════
// charEdge — Unified Alert Panel (Sprint 22 + Sprint 30 merged)
//
// Single slide-over panel with Apple-style segmented control:
//   Tab 1 — "Templates": Smart alert templates per symbol
//   Tab 2 — "Watchlist": Bulk alert creator for all watchlist symbols
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback, memo, useRef, useLayoutEffect } from 'react';
import {
  getAllTemplates,
  getCategories,
  createAlertFromTemplate,
} from '../../../charting_library/ai/SmartAlertTemplates.js';
import { C } from '../../../constants.js';
import { useAlertStore } from '../../../state/useAlertStore';
import { useMarketsPrefsStore } from '../../../state/useMarketsPrefsStore';
import { useWatchlistStore } from '../../../state/useWatchlistStore';
import { radii, transition } from '../../../theme/tokens.js';

// ─── Watchlist Conditions & Templates ───────────────────────────

const WL_CONDITIONS = [
  { id: 'price_above', label: 'Price Above', icon: '📈', unit: '$', type: 'number' },
  { id: 'price_below', label: 'Price Below', icon: '📉', unit: '$', type: 'number' },
  { id: 'pct_up', label: '% Change Up', icon: '🔺', unit: '%', type: 'number' },
  { id: 'pct_down', label: '% Change Down', icon: '🔻', unit: '%', type: 'number' },
  { id: 'rsi_above', label: 'RSI Above', icon: '🔥', unit: '', type: 'number' },
  { id: 'rsi_below', label: 'RSI Below', icon: '❄️', unit: '', type: 'number' },
  { id: 'vol_spike', label: 'Volume Spike', icon: '🌊', unit: '×', type: 'number' },
  { id: '52w_high', label: '52-Week High', icon: '🏔️', unit: '', type: 'flag' },
  { id: '52w_low', label: '52-Week Low', icon: '🕳️', unit: '', type: 'flag' },
];

const WL_TEMPLATES = [
  { name: 'Overbought Alert', icon: '🔥', condition: 'rsi_above', value: 70 },
  { name: '5% Drop Alert', icon: '🔻', condition: 'pct_down', value: 5 },
  { name: '10% Rally Alert', icon: '🚀', condition: 'pct_up', value: 10 },
  { name: '52-Week High', icon: '🏔️', condition: '52w_high', value: 0 },
  { name: '52-Week Low', icon: '🕳️', condition: '52w_low', value: 0 },
  { name: 'Volume 3× Spike', icon: '🌊', condition: 'vol_spike', value: 3 },
];

// ─── Segmented Control ──────────────────────────────────────────

const TABS = [
  { id: 'templates', label: 'Templates', icon: '⚡' },
  { id: 'watchlist', label: 'Watchlist', icon: '📋' },
];

function SegmentedControl({ activeTab, onTabChange }) {
  const containerRef = useRef(null);
  const tabRefs = useRef({});
  const [sliderStyle, setSliderStyle] = useState({ left: 0, width: 0, ready: false });

  useLayoutEffect(() => {
    const container = containerRef.current;
    const activeEl = tabRefs.current[activeTab];
    if (!container || !activeEl) return;
    const cRect = container.getBoundingClientRect();
    const aRect = activeEl.getBoundingClientRect();
    setSliderStyle({ left: aRect.left - cRect.left, width: aRect.width, ready: true });
  }, [activeTab]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        borderRadius: 10,
        padding: 3,
        gap: 2,
        background: `${C.bd}15`,
        border: `1px solid ${C.bd}20`,
      }}
    >
      {sliderStyle.ready && (
        <div
          style={{
            position: 'absolute',
            top: 3,
            height: 'calc(100% - 6px)',
            borderRadius: 8,
            left: sliderStyle.left,
            width: sliderStyle.width,
            background: C.bg,
            boxShadow: `0 1px 3px rgba(0,0,0,0.12), 0 0 0 0.5px ${C.bd}40`,
            transition: 'left 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[tab.id] = el;
            }}
            onClick={() => onTabChange(tab.id)}
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              flex: 1,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: '6px 14px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: isActive ? 700 : 500,
              fontFamily: 'var(--tf-font)',
              color: isActive ? C.t1 : C.t3,
              transition: 'color 0.2s ease',
            }}
          >
            <span style={{ fontSize: 12 }}>{tab.icon}</span>
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Templates Tab Content ──────────────────────────────────────

function TemplatesTab({ symbol, categories, allTemplates, onCreate, created }) {
  const [activeCategory, setActiveCategory] = useState('momentum');
  const filtered = allTemplates.filter((t) => t.category === activeCategory);

  return (
    <>
      {/* Subtitle */}
      <div style={{ padding: '0 18px 6px', fontSize: 10, fontFamily: 'var(--tf-mono)', color: C.t3 }}>
        for <span style={{ color: C.b, fontWeight: 700 }}>{symbol.replace('USDT', '')}</span>
      </div>

      {/* Category chips */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          padding: '6px 16px 10px',
          borderBottom: `1px solid ${C.bd}12`,
        }}
      >
        {Object.entries(categories).map(([key, cat]) => {
          const isActive = activeCategory === key;
          return (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              style={{
                padding: '4px 10px',
                borderRadius: 12,
                fontSize: 9,
                fontWeight: 700,
                fontFamily: 'var(--tf-mono)',
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

      {/* Template Cards */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
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
                <span style={{ fontSize: 12, fontWeight: 800, fontFamily: 'var(--tf-font)', color: C.t1 }}>
                  {tmpl.label}
                </span>
              </div>
              <p
                style={{ fontSize: 10, fontFamily: 'var(--tf-mono)', color: C.t2, margin: '0 0 6px', lineHeight: 1.5 }}
              >
                {tmpl.description}
              </p>
              <p
                style={{
                  fontSize: 9,
                  fontFamily: 'var(--tf-mono)',
                  color: C.t3,
                  fontStyle: 'italic',
                  margin: '0 0 10px',
                  lineHeight: 1.5,
                }}
              >
                💡 {tmpl.explanation}
              </p>
              <button
                onClick={() => onCreate(tmpl.id)}
                disabled={isCreated}
                style={{
                  width: '100%',
                  padding: '6px 0',
                  borderRadius: radii.sm,
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: 'var(--tf-mono)',
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
    </>
  );
}

// ─── Watchlist Tab Content ───────────────────────────────────────

function WatchlistTab() {
  const items = useWatchlistStore((s) => s.items);
  const addAlert = useAlertStore((s) => s.addAlert);

  const [conditionId, setConditionId] = useState('rsi_above');
  const [value, setValue] = useState(70);
  const [created, setCreated] = useState(false);

  const condition = WL_CONDITIONS.find((c) => c.id === conditionId) || WL_CONDITIONS[0];

  const handleApplyTemplate = useCallback((t) => {
    setConditionId(t.condition);
    setValue(t.value);
  }, []);

  const handleCreate = useCallback(() => {
    items.forEach((item) => {
      try {
        addAlert({
          symbol: item.symbol,
          condition: conditionId.includes('above') ? 'above' : 'below',
          price: value,
          note: `Watchlist alert: ${condition.label} ${value}${condition.unit}`,
          repeating: false,
        });
      } catch {
        /* alert store may not support all params */
      }
    });
    setCreated(true);
    setTimeout(() => setCreated(false), 2500);
  }, [items, addAlert, conditionId, condition, value]);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
      {/* Subtitle */}
      <div style={{ fontSize: 10, fontFamily: 'var(--tf-mono)', color: C.t3, marginBottom: 10 }}>
        Apply to all <span style={{ color: C.b, fontWeight: 700 }}>{items.length} symbols</span>
      </div>

      {/* Quick Templates */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: C.t3,
          fontFamily: 'var(--tf-mono)',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        Quick Templates
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 6,
          marginBottom: 16,
        }}
      >
        {WL_TEMPLATES.map((t) => (
          <button
            key={t.name}
            onClick={() => handleApplyTemplate(t)}
            style={{
              padding: '8px 6px',
              borderRadius: radii.md,
              background: conditionId === t.condition ? `${C.b}15` : C.bg2,
              border: `1px solid ${conditionId === t.condition ? C.b : C.bd}`,
              color: C.t1,
              fontSize: 10,
              fontWeight: 600,
              fontFamily: 'var(--tf-font)',
              cursor: 'pointer',
              textAlign: 'center',
              transition: transition.fast,
            }}
          >
            <div style={{ fontSize: 16, marginBottom: 2 }}>{t.icon}</div>
            {t.name}
          </button>
        ))}
      </div>

      {/* Condition Selector */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: C.t3,
          fontFamily: 'var(--tf-mono)',
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        Condition
      </div>
      <select
        value={conditionId}
        onChange={(e) => setConditionId(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: radii.md,
          background: C.bg2,
          border: `1px solid ${C.bd}`,
          color: C.t1,
          fontSize: 12,
          fontFamily: 'var(--tf-font)',
          marginBottom: 12,
          boxSizing: 'border-box',
        }}
      >
        {WL_CONDITIONS.map((c) => (
          <option key={c.id} value={c.id}>
            {c.icon} {c.label}
          </option>
        ))}
      </select>

      {/* Value Input */}
      {condition.type === 'number' && (
        <>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: C.t3,
              fontFamily: 'var(--tf-mono)',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Threshold {condition.unit && `(${condition.unit})`}
          </div>
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: radii.md,
              background: C.bg2,
              border: `1px solid ${C.bd}`,
              color: C.t1,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'var(--tf-mono)',
              textAlign: 'center',
              marginBottom: 14,
              boxSizing: 'border-box',
            }}
          />
        </>
      )}

      {/* Preview */}
      <div
        style={{
          padding: '12px 14px',
          borderRadius: radii.lg,
          background: `${C.b}08`,
          border: `1px solid ${C.b}20`,
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: C.t2, fontFamily: 'var(--tf-font)' }}>
            {condition.icon} {condition.label}
            {condition.type === 'number' && (
              <span style={{ fontWeight: 700, color: C.t1, marginLeft: 6, fontFamily: 'var(--tf-mono)' }}>
                {value}
                {condition.unit}
              </span>
            )}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              fontFamily: 'var(--tf-mono)',
              color: C.b,
              padding: '2px 8px',
              borderRadius: 8,
              background: `${C.b}15`,
            }}
          >
            {items.length} symbols
          </span>
        </div>
        <div style={{ fontSize: 10, color: C.t3, marginTop: 4, lineHeight: 1.4 }}>
          Alert will fire for any watchlist symbol where this condition is met.
        </div>
      </div>

      {/* Symbol Preview */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: C.t3,
          fontFamily: 'var(--tf-mono)',
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        Symbols ({items.length})
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14 }}>
        {items.slice(0, 20).map((item) => (
          <span
            key={item.symbol}
            style={{
              padding: '3px 8px',
              borderRadius: radii.sm,
              background: C.bg2,
              fontSize: 10,
              fontWeight: 600,
              fontFamily: 'var(--tf-mono)',
              color: C.t2,
            }}
          >
            {item.symbol}
          </span>
        ))}
        {items.length > 20 && (
          <span style={{ fontSize: 10, color: C.t3, padding: '3px 4px' }}>+{items.length - 20} more</span>
        )}
      </div>

      {/* Create Button */}
      <button
        onClick={handleCreate}
        disabled={items.length === 0}
        style={{
          width: '100%',
          padding: '12px 0',
          borderRadius: radii.md,
          background: created ? C.g : items.length === 0 ? C.bg2 : `linear-gradient(135deg, ${C.p}, ${C.b})`,
          color: created ? '#fff' : items.length === 0 ? C.t3 : '#fff',
          fontSize: 13,
          fontWeight: 700,
          fontFamily: 'var(--tf-font)',
          border: 'none',
          cursor: 'pointer',
          transition: transition.base,
        }}
      >
        {created ? `✅ Alerts Set for ${items.length} Symbols!` : `🔔 Set Alert on ${items.length} Symbols`}
      </button>
    </div>
  );
}

// ─── Main Unified Panel ─────────────────────────────────────────

function SmartAlertPicker() {
  const alertPickerOpen = useMarketsPrefsStore((s) => s.alertPickerOpen);
  const close = useMarketsPrefsStore((s) => s.setAlertPickerOpen);
  const selectedSymbol = useMarketsPrefsStore((s) => s.selectedSymbol);
  const addCompoundAlert = useAlertStore((s) => s.addCompoundAlert);

  const [activeTab, setActiveTab] = useState('templates');
  const [created, setCreated] = useState(null);

  if (!alertPickerOpen) return null;

  const categories = getCategories();
  const allTemplates = getAllTemplates();
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
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 380,
        zIndex: 900,
        background: C.bg,
        borderLeft: `1px solid ${C.bd}30`,
        display: 'flex',
        flexDirection: 'column',
        animation: 'picker-slide-in 0.25s ease-out',
        boxShadow: '-8px 0 30px rgba(0,0,0,0.25)',
      }}
    >
      {/* ── Header ────────────────────────────────────────── */}
      <div
        style={{
          padding: '16px 18px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${C.bd}20`,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--tf-font)', color: C.t1 }}>🔔 Alerts</div>
        <button
          onClick={() => close(false)}
          style={{
            background: `${C.bd}20`,
            border: 'none',
            borderRadius: radii.sm,
            color: C.t2,
            fontSize: 14,
            fontWeight: 600,
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          ×
        </button>
      </div>

      {/* ── Segmented Control ─────────────────────────────── */}
      <div style={{ padding: '10px 16px 8px' }}>
        <SegmentedControl activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* ── Tab Content ───────────────────────────────────── */}
      {activeTab === 'templates' ? (
        <TemplatesTab
          symbol={symbol}
          categories={categories}
          allTemplates={allTemplates}
          onCreate={handleCreate}
          created={created}
        />
      ) : (
        <WatchlistTab />
      )}

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
