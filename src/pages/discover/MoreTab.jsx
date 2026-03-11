// ═══════════════════════════════════════════════════════════════════
// charEdge — MoreTab Component
// Extracted from CommunityPage.jsx for single-responsibility.
// ═══════════════════════════════════════════════════════════════════

import CopyTradePanel from '../../app/components/social/CopyTradePanel.jsx';
import IndicatorMarketplace from '../../app/components/social/IndicatorMarketplace.jsx';
import LiveRoomPanel from '../../app/components/social/LiveRoomPanel.jsx';
import { C, F } from '../../constants.js';
import { alpha } from '@/shared/colorUtils';

const MORE_FEATURES = [
  { id: 'copytrade', label: 'Copy Trade', icon: '📋', description: 'Mirror top traders\' positions' },
  { id: 'rooms', label: 'Live Rooms', icon: '💬', description: 'Real-time trading chat' },
  { id: 'marketplace', label: 'Marketplace', icon: '🧩', description: 'Community indicators' },
];

export default function MoreTab({ moreActiveFeature, setMoreActiveFeature, onCopyTrader }) {
  return (
    <div role="tabpanel" aria-label="More features" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {!moreActiveFeature ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {MORE_FEATURES.map((feat) => (
            <button
              key={feat.id}
              onClick={() => setMoreActiveFeature(feat.id)}
              className="tf-btn"
              style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '20px 24px',
                background: C.bg2,
                border: `1px solid ${C.bd}`,
                borderRadius: 14, cursor: 'pointer',
                textAlign: 'left', transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.b; e.currentTarget.style.background = alpha(C.b, 0.04); }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.bd; e.currentTarget.style.background = C.bg2; }}
            >
              <span style={{ fontSize: 28 }}>{feat.icon}</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.t1, fontFamily: F }}>{feat.label}</div>
                <div style={{ fontSize: 12, color: C.t3, fontFamily: F, marginTop: 2 }}>{feat.description}</div>
              </div>
              <span style={{ marginLeft: 'auto', color: C.t3, fontSize: 16 }}>›</span>
            </button>
          ))}
        </div>
      ) : (
        <div>
          <button
            onClick={() => setMoreActiveFeature(null)}
            className="tf-btn"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', marginBottom: 16,
              background: 'transparent', border: `1px solid ${C.bd}`,
              borderRadius: 8, cursor: 'pointer',
              color: C.t2, fontSize: 12, fontFamily: F,
              fontWeight: 600, transition: 'all 0.15s',
            }}
          >
            ← Back
          </button>
          {moreActiveFeature === 'copytrade' && <CopyTradePanel onCopyTrader={onCopyTrader} />}
          {moreActiveFeature === 'rooms' && <LiveRoomPanel />}
          {moreActiveFeature === 'marketplace' && <IndicatorMarketplace />}
        </div>
      )}
    </div>
  );
}
