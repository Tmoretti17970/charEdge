import { useUserStore } from '../../../state/useUserStore.js';
import { C } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore.js';
import { Card, Btn } from '../ui/UIKit.jsx';
import { SectionHeader } from './SettingsHelpers.jsx';

export default function DangerZoneSection() {
  const tradeCount = useJournalStore((s) => s.trades.length);

  const handleReset = async () => {
    if (window.confirm('Reset all data to demo trades? This cannot be undone.')) {
      const { genDemoData } = await import('../../../data/demoData.js');
      const demo = genDemoData();
      useJournalStore.getState().reset(demo.trades, demo.playbooks);
      useUserStore.getState().resetSettings();
    }
  };

  return (
    <section style={{ marginBottom: 40 }}>
      <SectionHeader icon="warning" title="Danger Zone" description="Irreversible actions — proceed with caution" />
      <Card style={{ padding: 20, border: `1px solid ${C.r}30`, background: C.r + '04' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, marginBottom: 16, borderBottom: `1px solid ${C.bd}` }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>Reset to Demo Data</div>
            <div style={{ fontSize: 12, color: C.t3, marginTop: 2 }}>Replace all {tradeCount} trades with demo data. Cannot be undone.</div>
          </div>
          <Btn variant="danger" onClick={handleReset} style={{ fontSize: 12, padding: '8px 14px', flexShrink: 0 }}>Reset Data</Btn>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>Replay Onboarding</div>
            <div style={{ fontSize: 12, color: C.t3, marginTop: 2 }}>Re-run the setup wizard and reset all dismissed tips.</div>
          </div>
          <Btn variant="ghost" onClick={() => { useUserStore.getState().resetWizard(); useUserStore.getState().resetTips(); useUserStore.getState().resetTour(); useUserStore.getState().startTour(); }}
            style={{ fontSize: 12, padding: '8px 14px', flexShrink: 0 }}>Replay Setup</Btn>
        </div>
      </Card>
    </section>
  );
}
