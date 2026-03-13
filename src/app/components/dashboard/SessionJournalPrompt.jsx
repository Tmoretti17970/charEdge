// ═══════════════════════════════════════════════════════════════════
// charEdge — Session Journal Prompt (Phase 2 B4)
//
// Appears after 3+ trades in a session. Captures mood + one sentence.
// Dismissible for the session via local state.
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import { C, F, M } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore';
import { radii } from '../../../theme/tokens.js';
import { toast } from '../ui/Toast.jsx';
import { Card } from '../ui/UIKit.jsx';

const MOODS = [
  { emoji: '🔥', label: 'Focused', value: 5 },
  { emoji: '😊', label: 'Good', value: 4 },
  { emoji: '😐', label: 'Neutral', value: 3 },
  { emoji: '😤', label: 'Frustrated', value: 2 },
  { emoji: '💀', label: 'Tilted', value: 1 },
];

export default function SessionJournalPrompt({ tradeCount }) {
  const [dismissed, setDismissed] = useState(false);
  const [selectedMood, setSelectedMood] = useState(null);
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const addSessionNote = useJournalStore((s) => s.addSessionNote);

  const handleSubmit = useCallback(() => {
    if (!selectedMood) return;
    // addSessionNote may not exist yet — graceful fallback
    if (typeof addSessionNote === 'function') {
      addSessionNote({ mood: selectedMood, note, date: new Date().toISOString() });
    }
    setSubmitted(true);
    toast.success('Session note saved');
    setTimeout(() => setDismissed(true), 1500);
  }, [selectedMood, note, addSessionNote]);

  if (dismissed || submitted || tradeCount < 3) return null;

  return (
    <Card
      style={{
        padding: '18px 22px',
        background: `linear-gradient(135deg, ${C.sf}, ${C.b}06)`,
        border: `1px solid ${C.b}20`,
        position: 'relative',
      }}
    >
      <button
        onClick={() => setDismissed(true)}
        style={{
          position: 'absolute',
          top: 10,
          right: 12,
          background: 'none',
          border: 'none',
          color: C.t3,
          fontSize: 13,
          cursor: 'pointer',
          padding: '2px 6px',
        }}
        aria-label="Dismiss journal prompt"
      >
        ✕
      </button>

      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: F, color: C.t1, marginBottom: 6 }}>
        📝 How's this session going?
      </div>
      <div style={{ fontSize: 11, color: C.t3, marginBottom: 14 }}>
        {tradeCount} trades so far — capture your mindset.
      </div>

      {/* Mood buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {MOODS.map((m) => (
          <button
            key={m.value}
            onClick={() => setSelectedMood(m.value)}
            title={m.label}
            style={{
              flex: 1,
              padding: '8px 0',
              fontSize: 20,
              background: selectedMood === m.value ? `${C.b}18` : C.bg2,
              border: `1px solid ${selectedMood === m.value ? C.b : C.bd}`,
              borderRadius: radii.sm,
              cursor: 'pointer',
              transition: 'all 0.15s',
              transform: selectedMood === m.value ? 'scale(1.08)' : 'scale(1)',
            }}
          >
            {m.emoji}
          </button>
        ))}
      </div>

      {/* Note input + submit */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="One sentence about this session..."
          maxLength={140}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: 12,
            fontFamily: M,
            background: C.bg2,
            border: `1px solid ${C.bd}`,
            borderRadius: radii.sm,
            color: C.t1,
            outline: 'none',
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={!selectedMood}
          className="tf-btn"
          style={{
            padding: '8px 16px',
            fontSize: 11,
            fontWeight: 700,
            fontFamily: F,
            background: selectedMood ? C.b : C.bg2,
            color: selectedMood ? '#fff' : C.t3,
            border: 'none',
            borderRadius: radii.sm,
            cursor: selectedMood ? 'pointer' : 'default',
            opacity: selectedMood ? 1 : 0.5,
            transition: 'all 0.15s',
          }}
        >
          Save
        </button>
      </div>
    </Card>
  );
}
