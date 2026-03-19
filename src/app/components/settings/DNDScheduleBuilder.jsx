// ═══════════════════════════════════════════════════════════════════
// charEdge — DND Schedule Builder (Sprint 9)
//
// Weekly Do Not Disturb schedule with time blocks:
//   - 7-day grid with AM/PM blocks
//   - Quick presets (Trading Hours, Weekdays, Always On)
//   - Active schedule summary
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import { C, F, M } from '../../../constants.js';
import { useUserStore } from '../../../state/useUserStore';
import { radii, transition } from '../../../theme/tokens.js';
import { Card, Btn } from '../ui/UIKit.jsx';
import { toast } from '../ui/Toast.jsx';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIME_BLOCKS = [
  { id: 'morning', label: '6a–12p', hours: '6:00 AM – 12:00 PM' },
  { id: 'afternoon', label: '12p–6p', hours: '12:00 PM – 6:00 PM' },
  { id: 'evening', label: '6p–10p', hours: '6:00 PM – 10:00 PM' },
  { id: 'night', label: '10p–6a', hours: '10:00 PM – 6:00 AM' },
];

const PRESETS = [
  {
    id: 'trading',
    label: '📈 Trading Hours',
    desc: 'Alerts during market hours only',
    schedule: () => {
      const s = {};
      DAYS.forEach((d, i) => {
        s[d] = i < 5 ? { morning: false, afternoon: false, evening: true, night: true }
                     : { morning: true, afternoon: true, evening: true, night: true };
      });
      return s;
    },
  },
  {
    id: 'weekdays',
    label: '🏢 Weekdays Only',
    desc: 'Silent on weekends',
    schedule: () => {
      const s = {};
      DAYS.forEach((d, i) => {
        s[d] = i < 5 ? { morning: false, afternoon: false, evening: false, night: true }
                     : { morning: true, afternoon: true, evening: true, night: true };
      });
      return s;
    },
  },
  {
    id: 'always',
    label: '🔔 Always On',
    desc: 'Never silent',
    schedule: () => {
      const s = {};
      DAYS.forEach(d => { s[d] = { morning: false, afternoon: false, evening: false, night: false }; });
      return s;
    },
  },
];

function getDefaultSchedule() {
  const s = {};
  DAYS.forEach(d => {
    s[d] = { morning: false, afternoon: false, evening: false, night: false };
  });
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
    const s = preset.schedule();
    setSchedule(s);
    if (typeof updateSetting === 'function') updateSetting({ dndSchedule: s });
    toast.info(`DND: ${preset.label}`);
  }, [updateSetting]);

  const toggleDND = useCallback(() => {
    setDndEnabled(!dndEnabled);
    if (typeof updateSetting === 'function') updateSetting({ dndEnabled: !dndEnabled });
    toast.info(dndEnabled ? 'Do Not Disturb off' : 'Do Not Disturb on');
  }, [dndEnabled, updateSetting]);

  const silentCount = Object.values(schedule).reduce((acc, day) =>
    acc + Object.values(day).filter(Boolean).length, 0);

  return (
    <Card style={{ padding: 20, marginTop: 16 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 14,
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>
            Do Not Disturb Schedule
          </div>
          <div style={{ fontSize: 11, color: C.t3, fontFamily: F }}>
            {silentCount > 0 ? `${silentCount} silent blocks set` : 'All alerts active'}
          </div>
        </div>
        {/* DND toggle */}
        <button onClick={toggleDND} className="tf-btn" style={{
          width: 46, height: 26, borderRadius: 13, position: 'relative',
          background: dndEnabled ? C.b : C.bd + '40', border: 'none', cursor: 'pointer',
          transition: `background ${transition.base}`,
        }}>
          <div style={{
            width: 20, height: 20, borderRadius: '50%', background: '#fff',
            position: 'absolute', top: 3, left: dndEnabled ? 23 : 3,
            transition: `left ${transition.base}`, boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
          }} />
        </button>
      </div>

      {dndEnabled && (
        <>
          {/* Presets */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                className="tf-btn"
                title={preset.desc}
                style={{
                  flex: 1, padding: '6px 4px', borderRadius: radii.sm,
                  border: `1px solid ${C.bd}30`, background: 'transparent',
                  color: C.t2, fontSize: 10, fontWeight: 600, fontFamily: F,
                  cursor: 'pointer',
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Schedule Grid */}
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '50px repeat(7, 1fr)', gap: 3 }}>
              {/* Header */}
              <div />
              {DAYS.map(d => (
                <div key={d} style={{
                  textAlign: 'center', fontSize: 10, fontWeight: 700,
                  color: C.t3, fontFamily: M, padding: '4px 0',
                }}>
                  {d}
                </div>
              ))}

              {/* Time blocks */}
              {TIME_BLOCKS.map((block) => (
                <React.Fragment key={block.id}>
                  <div style={{
                    fontSize: 9, fontWeight: 600, color: C.t3, fontFamily: M,
                    display: 'flex', alignItems: 'center', paddingRight: 4,
                  }}>
                    {block.label}
                  </div>
                  {DAYS.map(day => {
                    const isSilent = schedule[day]?.[block.id];
                    return (
                      <button
                        key={`${day}-${block.id}`}
                        onClick={() => toggleBlock(day, block.id)}
                        className="tf-btn"
                        title={`${day} ${block.hours}: ${isSilent ? 'Silent' : 'Active'}`}
                        style={{
                          height: 24, borderRadius: 4, border: 'none',
                          background: isSilent ? C.r + '25' : C.g + '15',
                          cursor: 'pointer',
                          transition: `background ${transition.base}`,
                        }}
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: C.g + '30' }} />
              <span style={{ fontSize: 9, color: C.t3, fontFamily: F }}>Active</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: C.r + '30' }} />
              <span style={{ fontSize: 9, color: C.t3, fontFamily: F }}>Silent</span>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

export default React.memo(DNDScheduleBuilder);
