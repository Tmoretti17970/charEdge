// ═══════════════════════════════════════════════════════════════════
// charEdge — Privacy AI Controls (Sprint 15: Consolidation)
//
// Extracted from IntelligenceSection PrivacyGroup.
// Shows what AI can access and provides memory/pref clear buttons.
// Lives on the Privacy & Security page.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import { C, F, M } from '../../../constants.js';
import { Card } from '../ui/UIKit.jsx';

function StatusBadge({ ok, label }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 9, fontWeight: 600, fontFamily: F,
      padding: '2px 8px', borderRadius: 999,
      background: ok ? `${C.g}12` : `${C.r}12`,
      color: ok ? C.g : C.r,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
      {label}
    </span>
  );
}

export default function PrivacyAIControls() {
  const [memoryCount, setMemoryCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const { conversationMemory } = await import('../../../ai/ConversationMemory');
        setMemoryCount(conversationMemory.messageCount);
      } catch { /* */ }
    })();
  }, []);

  const handleClearMemory = useCallback(async () => {
    if (!confirm('Clear all AI conversation memory? This cannot be undone.')) return;
    try {
      const { conversationMemory } = await import('../../../ai/ConversationMemory');
      await conversationMemory.reset();
      setMemoryCount(0);
    } catch { /* */ }
  }, []);

  const handleClearPrefs = useCallback(async () => {
    if (!confirm('Reset all learned coaching preferences? The AI will re-learn from scratch.')) return;
    try {
      const { adaptiveCoach } = await import('../../../ai/AdaptiveCoach');
      adaptiveCoach.reset();
    } catch { /* */ }
  }, []);

  return (
    <Card style={{ padding: 20, marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>🧠</span> AI Privacy
      </div>

      {/* Shield banner */}
      <div style={{
        padding: '10px 12px', borderRadius: 8,
        background: `${C.g}08`, border: `1px solid ${C.g}20`,
        fontSize: 11, color: C.t1, fontFamily: F,
        marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 16 }}>🛡️</span>
        <div>
          <div style={{ fontWeight: 700 }}>All AI processing happens locally</div>
          <div style={{ fontSize: 9, color: C.t3, marginTop: 1 }}>
            Models run on-device. No data is sent to external servers unless you add a Cloud AI key.
          </div>
        </div>
      </div>

      {/* Data summary */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.t2, fontFamily: F, marginBottom: 6 }}>
          What the AI can access
        </div>
        <div style={{ fontSize: 10, color: C.t3, fontFamily: F, lineHeight: 1.7, paddingLeft: 4 }}>
          • Journal trades and trade history<br />
          • Chart context (symbol, timeframe, indicators)<br />
          • Trader DNA personality profile<br />
          • Watchlist symbols and alerts<br />
          • Conversation history (current session)
        </div>
      </div>

      {/* Clear buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button
          onClick={handleClearMemory}
          className="tf-btn"
          style={{
            flex: 1, padding: '8px 0', borderRadius: 6,
            border: `1px solid ${C.r}30`, background: `${C.r}06`,
            color: C.r, fontSize: 10, fontWeight: 600, fontFamily: F,
            cursor: 'pointer', transition: 'all 0.15s ease',
          }}
        >
          Clear AI Memory
        </button>
        <button
          onClick={handleClearPrefs}
          className="tf-btn"
          style={{
            flex: 1, padding: '8px 0', borderRadius: 6,
            border: `1px solid ${C.y}30`, background: `${C.y}06`,
            color: C.y, fontSize: 10, fontWeight: 600, fontFamily: F,
            cursor: 'pointer', transition: 'all 0.15s ease',
          }}
        >
          Clear Learned Preferences
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
        <StatusBadge ok label="Local-only processing" />
        {memoryCount > 0 && (
          <span style={{ fontSize: 9, color: C.t3, fontFamily: M }}>
            {memoryCount} messages in memory
          </span>
        )}
      </div>
    </Card>
  );
}
