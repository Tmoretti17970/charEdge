// ═══════════════════════════════════════════════════════════════════
// charEdge — AI Personality Picker (Sprint 8)
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import { C } from '../../../constants.js';
import { useUserStore } from '../../../state/useUserStore';
import { Card, Btn, inputStyle } from '../ui/UIKit.jsx';
import { toast } from '../ui/Toast.jsx';
import st from './AIPersonalityPicker.module.css';

const PERSONALITIES = [
  { id: 'analytical', emoji: '📊', label: 'Analytical', desc: 'Data-focused, metrics-heavy responses', tone: 'Precise, concise', responseLen: 'Short to medium', focus: 'Numbers, patterns, statistics' },
  { id: 'mentor', emoji: '🎓', label: 'Mentor', desc: 'Educational, explains reasoning in depth', tone: 'Patient, thorough', responseLen: 'Medium to long', focus: 'Why + how, teaching moments' },
  { id: 'coach', emoji: '🏆', label: 'Coach', desc: 'Motivational, direct accountability', tone: 'Encouraging, firm', responseLen: 'Short to medium', focus: 'Action items, discipline' },
  { id: 'minimalist', emoji: '⚡', label: 'Minimalist', desc: 'Brief alerts, no unnecessary chatter', tone: 'Terse, efficient', responseLen: 'Very short', focus: 'Signals only, key levels' },
];

function AIPersonalityPicker() {
  const settings = useUserStore((s) => s.settings) || {};
  const updateSetting = useUserStore((s) => s.updateSettings);
  const [selected, setSelected] = useState(settings.aiPersonality || 'analytical');
  const [customPrompt, setCustomPrompt] = useState(settings.aiCustomPrompt || '');
  const [showCustom, setShowCustom] = useState(selected === 'custom');

  const handleSelect = useCallback((id) => {
    setSelected(id); setShowCustom(id === 'custom');
    if (typeof updateSetting === 'function') updateSetting({ aiPersonality: id });
    toast.info(`AI personality: ${PERSONALITIES.find(p => p.id === id)?.label || 'Custom'}`);
  }, [updateSetting]);

  const handleSaveCustom = useCallback(() => {
    if (typeof updateSetting === 'function') updateSetting({ aiPersonality: 'custom', aiCustomPrompt: customPrompt });
    toast.success('Custom personality saved');
  }, [customPrompt, updateSetting]);

  return (
    <Card className={st.cardPad}>
      <div className={st.title}>AI Personality</div>
      <div className={st.hint}>Choose how your copilot communicates with you</div>

      <div className={st.grid}>
        {PERSONALITIES.map((p) => (
          <button key={p.id} onClick={() => handleSelect(p.id)} className={`tf-btn ${st.personaBtn}`}
            style={{
              border: `2px solid ${selected === p.id ? C.b : C.bd + '25'}`,
              background: selected === p.id ? C.b + '06' : 'transparent',
            }}>
            <div className={st.personaHeader}>
              <span className={st.personaEmoji}>{p.emoji}</span>
              <span className={st.personaLabel} style={{ color: selected === p.id ? C.b : C.t1 }}>{p.label}</span>
            </div>
            <div className={st.personaDesc}>{p.desc}</div>
            {selected === p.id && (
              <div className={st.personaMeta} style={{ borderTop: `1px solid ${C.bd}20` }}>
                <div className={st.metaLine}><strong>Tone:</strong> {p.tone}</div>
                <div className={st.metaLine}><strong>Length:</strong> {p.responseLen}</div>
                <div className={st.metaLine}><strong>Focus:</strong> {p.focus}</div>
              </div>
            )}
          </button>
        ))}
      </div>

      <button onClick={() => { setShowCustom(!showCustom); if (!showCustom) handleSelect('custom'); }}
        className={`tf-btn ${st.customBtn}`}
        style={{ border: `1px solid ${selected === 'custom' ? C.b : C.bd + '30'}` }}>
        ✏️ Custom personality prompt
      </button>

      {showCustom && (
        <div className={st.customArea}>
          <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Describe how you want the AI to respond..." rows={3}
            style={{ ...inputStyle, width: '100%', resize: 'vertical', fontSize: 12, lineHeight: 1.5 }} />
          <Btn onClick={handleSaveCustom} style={{ fontSize: 11, padding: '6px 14px', marginTop: 6 }}>Save Custom</Btn>
        </div>
      )}
    </Card>
  );
}

export default React.memo(AIPersonalityPicker);
