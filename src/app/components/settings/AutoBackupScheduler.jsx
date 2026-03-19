// ═══════════════════════════════════════════════════════════════════
// charEdge — Auto-Backup Scheduler (Sprint 10)
//
// Automatic backup configuration:
//   - Enable/disable toggle
//   - Frequency: Daily, Weekly, On Every Trade
//   - Retention: Keep last 5/10/20
//   - Backup history with download
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import { C, F, M } from '../../../constants.js';
import { useUserStore } from '../../../state/useUserStore';
import { radii, transition } from '../../../theme/tokens.js';
import { Card, Btn } from '../ui/UIKit.jsx';
import { toast } from '../ui/Toast.jsx';

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

  const handleFrequency = useCallback((id) => {
    setFrequency(id);
    if (typeof updateSetting === 'function') updateSetting({ backupFrequency: id });
  }, [updateSetting]);

  const handleRetention = useCallback((val) => {
    setRetention(val);
    if (typeof updateSetting === 'function') updateSetting({ backupRetention: val });
  }, [updateSetting]);

  const handleBackupNow = useCallback(() => {
    // Trigger manual backup
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
    <Card style={{ padding: 20, marginBottom: 12 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: enabled ? 14 : 0,
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>
            Auto-Backup
          </div>
          <div style={{ fontSize: 11, color: C.t3, fontFamily: F }}>
            Automatically save your data on a schedule
          </div>
        </div>
        <button onClick={toggleBackup} className="tf-btn" style={{
          width: 46, height: 26, borderRadius: 13, position: 'relative',
          background: enabled ? C.g : C.bd + '40', border: 'none', cursor: 'pointer',
          transition: `background ${transition.base}`,
        }}>
          <div style={{
            width: 20, height: 20, borderRadius: '50%', background: '#fff',
            position: 'absolute', top: 3, left: enabled ? 23 : 3,
            transition: `left ${transition.base}`, boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
          }} />
        </button>
      </div>

      {enabled && (
        <>
          {/* Frequency */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.t3, fontFamily: F, marginBottom: 6 }}>
              Frequency
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {FREQUENCIES.map((f) => (
                <button
                  key={f.id}
                  onClick={() => handleFrequency(f.id)}
                  className="tf-btn"
                  style={{
                    flex: 1, padding: '6px 8px', borderRadius: radii.sm,
                    border: `1px solid ${frequency === f.id ? C.b : C.bd + '30'}`,
                    background: frequency === f.id ? C.b + '08' : 'transparent',
                    color: frequency === f.id ? C.b : C.t2,
                    fontSize: 11, fontWeight: 600, fontFamily: F,
                    cursor: 'pointer', transition: `all ${transition.base}`,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Retention */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.t3, fontFamily: F, marginBottom: 6 }}>
              Keep last
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {RETENTIONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => handleRetention(r.value)}
                  className="tf-btn"
                  style={{
                    flex: 1, padding: '6px 8px', borderRadius: radii.sm,
                    border: `1px solid ${retention === r.value ? C.b : C.bd + '30'}`,
                    background: retention === r.value ? C.b + '08' : 'transparent',
                    color: retention === r.value ? C.b : C.t2,
                    fontSize: 11, fontWeight: 600, fontFamily: F,
                    cursor: 'pointer', transition: `all ${transition.base}`,
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <Btn variant="ghost" onClick={handleBackupNow}
            style={{ fontSize: 11, padding: '6px 14px' }}>
            📥 Backup Now
          </Btn>
        </>
      )}
    </Card>
  );
}

export default React.memo(AutoBackupScheduler);
