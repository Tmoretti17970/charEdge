// ═══════════════════════════════════════════════════════════════════
// charEdge — AI Personality Picker (Sprint 8)
//
// 4 personality presets + custom text field:
//   - Analytical: Data-focused, concise, metrics-heavy
//   - Mentor: Educational, explains reasoning, patient
//   - Coach: Motivational, direct, accountability
//   - Minimalist: Brief, alerts only, no chatter
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import { C, F, M } from '../../../constants.js';
import { useUserStore } from '../../../state/useUserStore';
import { radii, transition } from '../../../theme/tokens.js';
import { Card, Btn, inputStyle } from '../ui/UIKit.jsx';
import { toast } from '../ui/Toast.jsx';

const PERSONALITIES = [
  {
    id: 'analytical',
    emoji: '📊',
    label: 'Analytical',
    desc: 'Data-focused, metrics-heavy responses',
    tone: 'Precise, concise',
    responseLen: 'Short to medium',
    focus: 'Numbers, patterns, statistics',
  },
  {
    id: 'mentor',
    emoji: '🎓',
    label: 'Mentor',
    desc: 'Educational, explains reasoning in depth',
    tone: 'Patient, thorough',
    responseLen: 'Medium to long',
    focus: 'Why + how, teaching moments',
  },
  {
    id: 'coach',
    emoji: '🏆',
    label: 'Coach',
    desc: 'Motivational, direct accountability',
    tone: 'Encouraging, firm',
    responseLen: 'Short to medium',
    focus: 'Action items, discipline',
  },
  {
    id: 'minimalist',
    emoji: '⚡',
    label: 'Minimalist',
    desc: 'Brief alerts, no unnecessary chatter',
    tone: 'Terse, efficient',
    responseLen: 'Very short',
    focus: 'Signals only, key levels',
  },
];

function AIPersonalityPicker() {
  const settings = useUserStore((s) => s.settings) || {};
  const updateSetting = useUserStore((s) => s.updateSettings);
  const [selected, setSelected] = useState(settings.aiPersonality || 'analytical');
  const [customPrompt, setCustomPrompt] = useState(settings.aiCustomPrompt || '');
  const [showCustom, setShowCustom] = useState(selected === 'custom');

  const handleSelect = useCallback((id) => {
    setSelected(id);
    setShowCustom(id === 'custom');
    if (typeof updateSetting === 'function') {
      updateSetting({ aiPersonality: id });
    }
    toast.info(`AI personality: ${PERSONALITIES.find(p => p.id === id)?.label || 'Custom'}`);
  }, [updateSetting]);

  const handleSaveCustom = useCallback(() => {
    if (typeof updateSetting === 'function') {
      updateSetting({ aiPersonality: 'custom', aiCustomPrompt: customPrompt });
    }
    toast.success('Custom personality saved');
  }, [customPrompt, updateSetting]);

  return (
    <Card style={{ padding: 20, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F, marginBottom: 4 }}>
        AI Personality
      </div>
      <div style={{ fontSize: 11, color: C.t3, fontFamily: F, marginBottom: 14 }}>
        Choose how your copilot communicates with you
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        {PERSONALITIES.map((p) => (
          <button
            key={p.id}
            onClick={() => handleSelect(p.id)}
            className="tf-btn"
            style={{
              padding: 12, borderRadius: radii.md, textAlign: 'left',
              border: `2px solid ${selected === p.id ? C.b : C.bd + '25'}`,
              background: selected === p.id ? C.b + '06' : 'transparent',
              cursor: 'pointer',
              transition: `all ${transition.base}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 16 }}>{p.emoji}</span>
              <span style={{
                fontSize: 12, fontWeight: 700,
                color: selected === p.id ? C.b : C.t1,
                fontFamily: F,
              }}>
                {p.label}
              </span>
            </div>
            <div style={{ fontSize: 10, color: C.t3, fontFamily: F, lineHeight: 1.4 }}>
              {p.desc}
            </div>
            {selected === p.id && (
              <div style={{
                marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.bd}20`,
                display: 'flex', flexDirection: 'column', gap: 3,
              }}>
                <div style={{ fontSize: 9, color: C.t3, fontFamily: M }}>
                  <strong>Tone:</strong> {p.tone}
                </div>
                <div style={{ fontSize: 9, color: C.t3, fontFamily: M }}>
                  <strong>Length:</strong> {p.responseLen}
                </div>
                <div style={{ fontSize: 9, color: C.t3, fontFamily: M }}>
                  <strong>Focus:</strong> {p.focus}
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Custom personality */}
      <button
        onClick={() => { setShowCustom(!showCustom); if (!showCustom) handleSelect('custom'); }}
        className="tf-btn"
        style={{
          width: '100%', padding: '8px 12px', borderRadius: radii.sm,
          border: `1px solid ${selected === 'custom' ? C.b : C.bd + '30'}`,
          background: 'transparent', color: C.t2,
          fontSize: 11, fontWeight: 600, fontFamily: F,
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        ✏️ Custom personality prompt
      </button>

      {showCustom && (
        <div style={{ marginTop: 8 }}>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Describe how you want the AI to respond..."
            rows={3}
            style={{
              ...inputStyle, width: '100%', resize: 'vertical',
              fontFamily: F, fontSize: 12, lineHeight: 1.5,
            }}
          />
          <Btn onClick={handleSaveCustom} style={{ fontSize: 11, padding: '6px 14px', marginTop: 6 }}>
            Save Custom
          </Btn>
        </div>
      )}
    </Card>
  );
}

export default React.memo(AIPersonalityPicker);
