// ═══════════════════════════════════════════════════════════════════
// charEdge — Danger Zone Section (Sprint 11 — Enhanced)
//
// Previously 44 lines. Now full danger zone with 5 actions:
//   1. Reset to Demo Data
//   2. Clear AI Data (Trader DNA only)
//   3. Reset Preferences Only (settings without trades)
//   4. Export & Delete (one-click export-then-delete)
//   5. Delete Account (cloud users — sign out + full wipe)
//   6. Replay Onboarding
// ═══════════════════════════════════════════════════════════════════

import React, { useCallback } from 'react';
import { C, F, M } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore';
import { useUserStore } from '../../../state/useUserStore';
import { radii, transition } from '../../../theme/tokens.js';
import { Card, Btn } from '../ui/UIKit.jsx';
import { SectionHeader } from './SettingsHelpers.jsx';
import { toast } from '../ui/Toast.jsx';

function DangerAction({ title, description, buttonLabel, onClick, variant = 'danger', icon }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 0',
    }}>
      <div style={{ flex: 1, marginRight: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>{icon}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.t1, fontFamily: F }}>{title}</span>
        </div>
        <div style={{ fontSize: 11, color: C.t3, fontFamily: F, marginTop: 2, paddingLeft: 20 }}>
          {description}
        </div>
      </div>
      <Btn variant={variant} onClick={onClick}
        style={{ fontSize: 11, padding: '6px 14px', flexShrink: 0 }}>
        {buttonLabel}
      </Btn>
    </div>
  );
}

function DangerZoneSection() {
  const tradeCount = useJournalStore((s) => s.trades.length);
  const provider = useUserStore((s) => s.provider);
  const isCloud = provider && provider !== 'local';

  const handleReset = useCallback(async () => {
    if (window.confirm(`Reset all data to demo trades? This will replace ${tradeCount} trades. Cannot be undone.`)) {
      const { genDemoData } = await import('../../../data/demoData.js');
      const demo = genDemoData();
      useJournalStore.getState().reset(demo.trades, demo.playbooks);
      useUserStore.getState().resetSettings();
      toast.success('Reset to demo data');
    }
  }, [tradeCount]);

  const handleClearAI = useCallback(() => {
    if (window.confirm('Clear all AI learned data? This resets Trader DNA, conversation memory, and personalization. Your trades are preserved.')) {
      try {
        // Clear AI-related localStorage keys
        const aiKeys = Object.keys(localStorage).filter(k =>
          k.includes('ai_') || k.includes('dna') || k.includes('memory') || k.includes('copilot')
        );
        aiKeys.forEach(k => localStorage.removeItem(k));
        toast.success(`Cleared AI data (${aiKeys.length} items)`);
      } catch {
        toast.error('Failed to clear AI data');
      }
    }
  }, []);

  const handleResetPrefs = useCallback(() => {
    if (window.confirm('Reset all preferences to defaults? Your trades and AI data will be kept.')) {
      useUserStore.getState().resetSettings();
      toast.success('Preferences reset to defaults');
    }
  }, []);

  const handleExportDelete = useCallback(async () => {
    if (!window.confirm('This will export all your data as JSON, then delete everything. Continue?')) return;

    // Export first
    try {
      const data = {
        exportedAt: new Date().toISOString(),
        trades: useJournalStore.getState().trades,
        settings: useUserStore.getState(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `charedge-final-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed — aborting delete');
      return;
    }

    // Then delete
    if (window.confirm('Export complete. Now delete ALL data? This cannot be undone.')) {
      localStorage.clear();
      sessionStorage.clear();
      try {
        const dbs = await indexedDB.databases?.() || [];
        for (const db of dbs) if (db.name) indexedDB.deleteDatabase(db.name);
      } catch { /* */ }
      window.location.reload();
    }
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    const confirmed = window.confirm(
      'Delete your account and ALL data?\n\n' +
      '• Sign out from cloud\n' +
      '• Delete all local data\n' +
      '• Clear all browser storage\n\n' +
      'This CANNOT be undone.'
    );
    if (!confirmed) return;
    if (!window.confirm('Final confirmation: Click OK to permanently delete everything.')) return;

    try {
      const { signOut } = await import('../../../data/StorageAdapter.js');
      signOut();
    } catch { /* local only */ }

    localStorage.clear();
    sessionStorage.clear();
    try {
      const dbs = await indexedDB.databases?.() || [];
      for (const db of dbs) if (db.name) indexedDB.deleteDatabase(db.name);
    } catch { /* */ }
    window.location.reload();
  }, []);

  const handleReplayOnboarding = useCallback(() => {
    useUserStore.getState().resetWizard();
    useUserStore.getState().resetTips();
    useUserStore.getState().resetTour();
    useUserStore.getState().startTour();
    toast.info('Onboarding restarted');
  }, []);

  return (
    <section style={{ marginBottom: 40 }}>
      <SectionHeader icon="warning" title="Danger Zone" description="Irreversible actions — proceed with caution" />

      <Card style={{ padding: 20, border: `1px solid ${C.r}20`, background: C.r + '03' }}>
        <DangerAction
          icon="🔄" title="Reset to Demo Data"
          description={`Replace all ${tradeCount} trades with demo data`}
          buttonLabel="Reset" onClick={handleReset}
        />
        <div style={{ borderTop: `1px solid ${C.bd}20` }} />

        <DangerAction
          icon="🧠" title="Clear AI Data"
          description="Remove Trader DNA, conversation memory, and learned patterns"
          buttonLabel="Clear AI" onClick={handleClearAI}
        />
        <div style={{ borderTop: `1px solid ${C.bd}20` }} />

        <DangerAction
          icon="⚙️" title="Reset Preferences"
          description="Reset settings to defaults — trades and AI data preserved"
          buttonLabel="Reset" onClick={handleResetPrefs}
          variant="ghost"
        />
        <div style={{ borderTop: `1px solid ${C.bd}20` }} />

        <DangerAction
          icon="📥" title="Export & Delete"
          description="Download all data as JSON, then wipe everything"
          buttonLabel="Export + Delete" onClick={handleExportDelete}
        />
        <div style={{ borderTop: `1px solid ${C.bd}20` }} />

        {isCloud && (
          <>
            <DangerAction
              icon="💀" title="Delete Account"
              description="Sign out, delete all data, and clear all browser storage"
              buttonLabel="Delete Account" onClick={handleDeleteAccount}
            />
            <div style={{ borderTop: `1px solid ${C.bd}20` }} />
          </>
        )}

        <DangerAction
          icon="🎓" title="Replay Onboarding"
          description="Re-run the setup wizard and reset all dismissed tips"
          buttonLabel="Replay" onClick={handleReplayOnboarding}
          variant="ghost"
        />
      </Card>
    </section>
  );
}

export default React.memo(DangerZoneSection);
