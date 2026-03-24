// ═══════════════════════════════════════════════════════════════════
// charEdge — Alert Sound Picker (Sprint 9)
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useRef } from 'react';
import { C } from '../../../constants.js';
import { useUserStore } from '../../../state/useUserStore';
import { Card } from '../ui/UIKit.jsx';
import st from './AlertSoundPicker.module.css';

const SOUNDS = [
  { id: 'none',   label: 'Silent',  emoji: '🔇', freq: 0,    dur: 0 },
  { id: 'ping',   label: 'Ping',    emoji: '🔔', freq: 880,  dur: 0.15 },
  { id: 'chime',  label: 'Chime',   emoji: '🎵', freq: 523,  dur: 0.3 },
  { id: 'alert',  label: 'Alert',   emoji: '⚠️', freq: 1200, dur: 0.1 },
  { id: 'soft',   label: 'Soft',    emoji: '🌊', freq: 392,  dur: 0.4 },
  { id: 'pulse',  label: 'Pulse',   emoji: '💫', freq: 660,  dur: 0.2 },
  { id: 'click',  label: 'Click',   emoji: '👆', freq: 1600, dur: 0.05 },
];

function AlertSoundPicker() {
  const settings = useUserStore((s) => s.settings) || {};
  const updateSetting = useUserStore((s) => s.updateSettings);
  const [selected, setSelected] = useState(settings.alertSound || 'ping');
  const [volume, setVolume] = useState(settings.alertVolume ?? 0.7);
  const ctxRef = useRef(null);

  const playSound = useCallback((sound) => {
    if (sound.freq === 0) return;
    try {
      if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = ctxRef.current; const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = sound.id === 'soft' ? 'sine' : sound.id === 'alert' ? 'square' : 'triangle';
      osc.frequency.value = sound.freq; gain.gain.value = volume;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + sound.dur);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + sound.dur + 0.05);
    } catch { /* Web Audio not available */ }
  }, [volume]);

  const handleSelect = useCallback((id) => {
    setSelected(id);
    if (typeof updateSetting === 'function') updateSetting({ alertSound: id });
    const sound = SOUNDS.find(s => s.id === id); if (sound) playSound(sound);
  }, [updateSetting, playSound]);

  const handleVolume = useCallback((v) => {
    setVolume(v); if (typeof updateSetting === 'function') updateSetting({ alertVolume: v });
  }, [updateSetting]);

  return (
    <Card className={st.cardPad}>
      <div className={st.title}>Alert Sound</div>
      <div className={st.hint}>Notification tone for price alerts and triggers</div>

      <div className={st.soundGrid}>
        {SOUNDS.map((sound) => (
          <button key={sound.id} onClick={() => handleSelect(sound.id)} className={`tf-btn ${st.soundBtn}`}
            style={{
              border: `2px solid ${selected === sound.id ? C.b : C.bd + '25'}`,
              background: selected === sound.id ? C.b + '08' : 'transparent',
            }}>
            <div className={st.soundEmoji}>{sound.emoji}</div>
            <div className={st.soundLabel} style={{ color: selected === sound.id ? C.b : C.t2 }}>{sound.label}</div>
          </button>
        ))}
      </div>

      {selected !== 'none' && (
        <div className={st.volumeRow}>
          <span className={st.volumeIcon}>🔈</span>
          <input type="range" min="0" max="1" step="0.05" value={volume}
            onChange={(e) => handleVolume(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: C.b }} />
          <span className={st.volumeIcon}>🔊</span>
          <span className={st.volumePercent}>{Math.round(volume * 100)}%</span>
        </div>
      )}
    </Card>
  );
}

export default React.memo(AlertSoundPicker);
