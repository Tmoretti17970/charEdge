// ═══════════════════════════════════════════════════════════════════
// Mobile Settings — Danger Zone Section
// Reset data, replay onboarding.
// ═══════════════════════════════════════════════════════════════════

import { C } from '../../../../constants.js';
import { genDemoData } from '../../../../data/demoData.js';
import { useJournalStore } from '../../../../state/useJournalStore';
import { useUserStore } from '../../../../state/useUserStore';
import { MobileBtn } from '../MobilePrimitives.jsx';

export default function DangerContent() {
    const tradeCount = useJournalStore((s) => s.trades.length);

    const handleReset = () => {
        if (window.confirm('Reset all data to demo trades? This cannot be undone.')) {
            const demo = genDemoData();
            useJournalStore.getState().reset(demo.trades, demo.playbooks);
            useUserStore.getState().resetSettings();
        }
    };

    return (
        <div>
            {/* Reset to Demo */}
            <div
                style={{
                    padding: '16px 0',
                    borderBottom: `1px solid ${C.bd}`,
                    marginBottom: 16,
                }}
            >
                <div style={{ fontSize: 14, fontWeight: 600, color: C.t1, marginBottom: 4 }}>Reset to Demo Data</div>
                <div style={{ fontSize: 12, color: C.t3, marginBottom: 12 }}>
                    Replace all {tradeCount} trades with demo data. This cannot be undone.
                </div>
                <MobileBtn variant="danger" onClick={handleReset}>
                    Reset Data
                </MobileBtn>
            </div>

            {/* Replay Onboarding */}
            <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.t1, marginBottom: 4 }}>Replay Onboarding</div>
                <div style={{ fontSize: 12, color: C.t3, marginBottom: 12 }}>
                    Re-run the setup wizard and reset dismissed tips.
                </div>
                <MobileBtn
                    variant="ghost"
                    onClick={() => {
                        useUserStore.getState().resetWizard();
                        useUserStore.getState().resetTips();
                    }}
                >
                    Replay Setup
                </MobileBtn>
            </div>
        </div>
    );
}
