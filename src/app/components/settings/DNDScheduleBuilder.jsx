// ═══════════════════════════════════════════════════════════════════
// charEdge — DND Schedule Builder (Sprint 9)
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import { C } from '../../../constants.js';
import { useUserStore } from '../../../state/useUserStore';
import { Card } from '../ui/UIKit.jsx';
import { toast } from '../ui/Toast.jsx';
import st from './DNDScheduleBuilder.module.css';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIME_BLOCKS = [
  { id: 'morning', label: '6a–12p', hours: '6:00 AM – 12:00 PM' },
  { id: 'afternoon', label: '12p–6p', hours: '12:00 PM – 6:00 PM' },
  { id: 'evening', label: '6p–10p', hours: '6:00 PM – 10:00 PM' },
  { id: 'night', label: '10p–6a', hours: '10:00 PM – 6:00 AM' },
];

const PRESETS = [
  {
    id: 'trading', label: '📈 Trading Hours', desc: 'Alerts during market hours only',
    schedule: () => { const s = {}; DAYS.forEach((d, i) => { s[d] = i < 5 ? { morning: false, afternoon: false, evening: true, night: true } : { morning: true, afternoon: true, evening: true, night: true }; }); return s; },
  },
  {
    id: 'weekdays', label: '🏢 Weekdays Only', desc: 'Silent on weekends',
    schedule: () => { const s = {}; DAYS.forEach((d, i) => { s[d] = i < 5 ? { morning: false, afternoon: false, evening: false, night: true } : { morning: true, afternoon: true, evening: true, night: true }; }); return s; },
  },
  {
    id: 'always', label: '🔔 Always On', desc: 'Never silent',
    schedule: () => { const s = {}; DAYS.forEach(d => { s[d] = { morning: false, afternoon: false, evening: false, night: false }; }); return s; },
  },
];

function getDefaultSchedule() {
  const s = {};
  DAYS.forEach(d => { s[d] = { morning: false, afternoon: false, evening: false, night: false }; });
  return s;
}

function DNDScheduleBuilder() {
  const settings = useUserStore((s) => s.settings) || {};
  const updateSetting = useUserStore((s) => s.updateSettings);
  const [schedule, setSchedule] = useState(settings.dndSchedule || getDefaultSchedule());
  const [dndEnabled, setDndEnabled] = useState(settings.dndEnabled || false);

  const toggleBlock = useCallback((day, block) => {
    setSchedule(prev => {
      const next = { ...prev, [day]: { ...prev[day], [block]: !prev[day]?.[block] } };
      if (typeof updateSetting === 'function') updateSetting({ dndSchedule: next });
      return next;
    });
  }, [updateSetting]);

  const applyPreset = useCallback((preset) => {
    const s = preset.schedule(); setSchedule(s);
    if (typeof updateSetting === 'function') updateSetting({ dndSchedule: s });
    toast.info(`DND: ${preset.label}`);
  }, [updateSetting]);

  const toggleDND = useCallback(() => {
    setDndEnabled(!dndEnabled);
    if (typeof updateSetting === 'function') updateSetting({ dndEnabled: !dndEnabled });
    toast.info(dndEnabled ? 'Do Not Disturb off' : 'Do Not Disturb on');
  }, [dndEnabled, updateSetting]);

  const silentCount = Object.values(schedule).reduce((acc, day) => acc + Object.values(day).filter(Boolean).length, 0);

  return (
    <Card className={st.cardPad}>
      <div className={st.header}>
        <div>
          <div className={st.title}>Do Not Disturb Schedule</div>
          <div className={st.subtitle}>{silentCount > 0 ? `${silentCount} silent blocks set` : 'All alerts active'}</div>
        </div>
        <button onClick={toggleDND} className={`tf-btn ${st.toggleTrack}`}
          style={{ background: dndEnabled ? C.b : C.bd + '40' }}>
          <div className={st.toggleKnob} style={{ left: dndEnabled ? 23 : 3 }} />
        </button>
      </div>

      {dndEnabled && (
        <>
          <div className={st.presetRow}>
            {PRESETS.map((preset) => (
              <button key={preset.id} onClick={() => applyPreset(preset)}
                className={`tf-btn ${st.presetBtn}`} title={preset.desc}>
                {preset.label}
              </button>
            ))}
          </div>

          <div className={st.gridScroll}>
            <div className={st.grid}>
              <div />
              {DAYS.map(d => <div key={d} className={st.dayHeader}>{d}</div>)}
              {TIME_BLOCKS.map((block) => (
                <React.Fragment key={block.id}>
                  <div className={st.blockLabel}>{block.label}</div>
                  {DAYS.map(day => {
                    const isSilent = schedule[day]?.[block.id];
                    return (
                      <button key={`${day}-${block.id}`} onClick={() => toggleBlock(day, block.id)}
                        className={`tf-btn ${st.blockCell}`}
                        title={`${day} ${block.hours}: ${isSilent ? 'Silent' : 'Active'}`}
                        style={{ background: isSilent ? C.r + '25' : C.g + '15' }} />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className={st.legend}>
            <div className={st.legendItem}>
              <div className={st.legendDot} style={{ background: C.g + '30' }} />
              <span className={st.legendLabel}>Active</span>
            </div>
            <div className={st.legendItem}>
              <div className={st.legendDot} style={{ background: C.r + '30' }} />
              <span className={st.legendLabel}>Silent</span>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

export default React.memo(DNDScheduleBuilder);
