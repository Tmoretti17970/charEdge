// ═══════════════════════════════════════════════════════════════════
// charEdge — Widget Suggestion Banner (Sprint 18)
//
// Renders the top smart suggestion as a dismissable card.
// Placed above the dashboard widget grid.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useMemo } from 'react';
import { C, F } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore';
import { useLayoutStore } from '../../../state/useLayoutStore';
import { evaluateSuggestions } from '@/app/features/widgetSuggestionEngine';

function WidgetSuggestionBanner() {
  const trades = useJournalStore((s) => s.trades);
  const activeWidgets = useLayoutStore((s) => s.activeWidgets);
  const dismissedSuggestions = useLayoutStore((s) => s.dismissedSuggestions || []);
  const dismissSuggestion = useLayoutStore((s) => s.dismissSuggestion);
  const toggleWidget = useLayoutStore((s) => s.toggleWidget);

  const [dismissed, setDismissed] = useState(false);

  const suggestions = useMemo(
    () => evaluateSuggestions(trades, activeWidgets, dismissedSuggestions),
    [trades, activeWidgets, dismissedSuggestions],
  );

  const top = suggestions[0];
  if (!top || dismissed) return null;

  const handleAdd = () => {
    toggleWidget(top.widgetId);
    if (dismissSuggestion) dismissSuggestion(top.id);
    setDismissed(true);
  };

  const handleDismiss = () => {
    if (dismissSuggestion) dismissSuggestion(top.id);
    setDismissed(true);
  };

  return (
    <div
      className="tf-fade-in-up"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 16px',
        borderRadius: 10,
        border: `1px solid ${C.b}25`,
        background: `linear-gradient(135deg, ${C.b}08, ${C.b}04)`,
        marginBottom: 12,
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: C.b + '15',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {top.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, marginBottom: 2 }}>
          💡 Suggested: {top.title}
        </div>
        <div style={{ fontSize: 11, color: C.t3, lineHeight: 1.4 }}>{top.reason}</div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          onClick={handleAdd}
          className="tf-btn"
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: 'none',
            background: C.b,
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            fontFamily: F,
            cursor: 'pointer',
          }}
        >
          + Add
        </button>
        <button
          onClick={handleDismiss}
          className="tf-btn"
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: `1px solid ${C.bd}`,
            background: 'transparent',
            color: C.t3,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: F,
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default React.memo(WidgetSuggestionBanner);
