// ═══════════════════════════════════════════════════════════════════
// charEdge — Privacy AI Controls (Sprint 15: Consolidation)
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { C } from '../../../constants.js';
import { Card } from '../ui/UIKit.jsx';
import st from './PrivacyAIControls.module.css';

function StatusBadge({ ok, label }) {
  return (
    <span className={st.statusBadge} style={{ background: ok ? `${C.g}12` : `${C.r}12`, color: ok ? C.g : C.r }}>
      <span className={st.statusDot} />
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
      } catch {
        /* */
      }
    })();
  }, []);

  const handleClearMemory = useCallback(async () => {
    if (!confirm('Clear all AI conversation memory? This cannot be undone.')) return;
    try {
      const { conversationMemory } = await import('../../../ai/ConversationMemory');
      await conversationMemory.reset();
      setMemoryCount(0);
    } catch {
      /* */
    }
  }, []);

  const handleClearPrefs = useCallback(async () => {
    if (!confirm('Reset all learned coaching preferences? The AI will re-learn from scratch.')) return;
    try {
      const { adaptiveCoach } = await import('../../../ai/AdaptiveCoach');
      adaptiveCoach.reset();
    } catch {
      /* */
    }
  }, []);

  return (
    <Card className={st.cardPad}>
      <div className={st.headerRow}>
        <span>🧠</span> AI Privacy
      </div>

      <div className={st.shieldBanner} style={{ background: `${C.g}08`, border: `1px solid ${C.g}20` }}>
        <span className={st.shieldIcon}>🛡️</span>
        <div>
          <div className={st.shieldTitle}>All AI processing happens locally</div>
          <div className={st.shieldHint}>
            Models run on-device. No data is sent to external servers unless you add a Cloud AI key.
          </div>
        </div>
      </div>

      <div className={st.accessBlock}>
        <div className={st.accessLabel}>What the AI can access</div>
        <div className={st.accessList}>
          • Journal trades and trade history
          <br />
          • Chart context (symbol, timeframe, indicators)
          <br />
          • Trader DNA personality profile
          <br />
          • Watchlist symbols and alerts
          <br />• Conversation history (current session)
        </div>
      </div>

      <div className={st.clearRow}>
        <button
          onClick={handleClearMemory}
          className={`tf-btn ${st.clearBtn}`}
          style={{ border: `1px solid ${C.r}30`, background: `${C.r}06`, color: C.r }}
        >
          Clear AI Memory
        </button>
        <button
          onClick={handleClearPrefs}
          className={`tf-btn ${st.clearBtn}`}
          style={{ border: `1px solid ${C.y}30`, background: `${C.y}06`, color: C.y }}
        >
          Clear Learned Preferences
        </button>
      </div>

      <div className={st.statusRow}>
        <StatusBadge ok label="Local-only processing" />
        {memoryCount > 0 && <span className={st.memoryCount}>{memoryCount} messages in memory</span>}
      </div>
    </Card>
  );
}
