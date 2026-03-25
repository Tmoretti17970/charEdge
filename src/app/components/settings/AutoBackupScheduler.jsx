// ═══════════════════════════════════════════════════════════════════
// charEdge — Auto-Backup Scheduler (Sprint 10)
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import { C } from '../../../constants.js';
import { useUserStore } from '../../../state/useUserStore';
import { toast } from '../ui/Toast.jsx';
import { Card, Btn } from '../ui/UIKit.jsx';
import st from './AutoBackupScheduler.module.css';

const FREQUENCIES = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'on_trade', label: 'Every Trade' },
];
const RETENTIONS = [
  { value: 5, label: '5 backups' },
  { value: 10, label: '10 backups' },
  { value: 20, label: '20 backups' },
];

function AutoBackupScheduler() {
  const settings = useUserStore((s) => s.settings) || {};
  const updateSetting = useUserStore((s) => s.updateSettings);
  const [enabled, setEnabled] = useState(settings.autoBackup || false);
  const [frequency, setFrequency] = useState(settings.backupFrequency || 'weekly');
  const [retention, setRetention] = useState(settings.backupRetention || 10);

  const toggleBackup = useCallback(() => {
    const next = !enabled;
    setEnabled(next);
    if (typeof updateSetting === 'function') updateSetting({ autoBackup: next });
    toast.info(next ? 'Auto-backup enabled' : 'Auto-backup disabled');
  }, [enabled, updateSetting]);

  const handleFrequency = useCallback(
    (id) => {
      setFrequency(id);
      if (typeof updateSetting === 'function') updateSetting({ backupFrequency: id });
    },
    [updateSetting],
  );
  const handleRetention = useCallback(
    (val) => {
      setRetention(val);
      if (typeof updateSetting === 'function') updateSetting({ backupRetention: val });
    },
    [updateSetting],
  );

  const handleBackupNow = useCallback(() => {
    try {
      const state = useUserStore.getState();
      const data = JSON.stringify({ timestamp: Date.now(), settings: state }, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `charedge-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup downloaded');
    } catch {
      toast.error('Backup failed');
    }
  }, []);

  return (
    <Card className={st.cardPad}>
      <div className={st.header} style={{ marginBottom: enabled ? 14 : 0 }}>
        <div>
          <div className={st.title}>Auto-Backup</div>
          <div className={st.subtitle}>Automatically save your data on a schedule</div>
        </div>
        <button
          onClick={toggleBackup}
          className={`tf-btn ${st.toggleTrack}`}
          style={{ background: enabled ? C.g : C.bd + '40' }}
        >
          <div className={st.toggleKnob} style={{ left: enabled ? 23 : 3 }} />
        </button>
      </div>

      {enabled && (
        <>
          <div className={st.optionBlock}>
            <div className={st.optionLabel}>Frequency</div>
            <div className={st.optionRow}>
              {FREQUENCIES.map((f) => (
                <button
                  key={f.id}
                  onClick={() => handleFrequency(f.id)}
                  className={`tf-btn ${st.optionBtn}`}
                  style={{
                    border: `1px solid ${frequency === f.id ? C.b : C.bd + '30'}`,
                    background: frequency === f.id ? C.b + '08' : 'transparent',
                    color: frequency === f.id ? C.b : C.t2,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className={st.optionBlock} style={{ marginBottom: 14 }}>
            <div className={st.optionLabel}>Keep last</div>
            <div className={st.optionRow}>
              {RETENTIONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => handleRetention(r.value)}
                  className={`tf-btn ${st.optionBtn}`}
                  style={{
                    border: `1px solid ${retention === r.value ? C.b : C.bd + '30'}`,
                    background: retention === r.value ? C.b + '08' : 'transparent',
                    color: retention === r.value ? C.b : C.t2,
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <Btn variant="ghost" onClick={handleBackupNow} style={{ fontSize: 11, padding: '6px 14px' }}>
            📥 Backup Now
          </Btn>
        </>
      )}
    </Card>
  );
}

export default React.memo(AutoBackupScheduler);
