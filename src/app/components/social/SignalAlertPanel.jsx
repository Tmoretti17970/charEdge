// ═══════════════════════════════════════════════════════════════════
// charEdge — Signal Alert Panel (Feed Sidebar Widget)
// ═══════════════════════════════════════════════════════════════════

import { C, F, M } from '../../../constants.js';
import { useSignalStore } from '../../../state/useSignalStore.js';
import { alpha } from '@/shared/colorUtils';

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

const TYPE_ICONS = { idea: '💡', trade: '📊', prediction: '🔮' };

export default function SignalAlertPanel() {
  const signals = useSignalStore((s) => s.signals);
  const markSignalRead = useSignalStore((s) => s.markSignalRead);
  const markAllRead = useSignalStore((s) => s.markAllRead);
  const unreadCount = useSignalStore((s) => s.getUnreadCount());

  return (
    <div style={{
      background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 14,
      padding: 16, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🔔</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>Signal Alerts</span>
          {unreadCount > 0 && (
            <span style={{
              minWidth: 18, height: 18, borderRadius: 9,
              background: C.r, color: '#fff', fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: M, padding: '0 4px',
            }}>
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            style={{
              background: 'none', border: 'none', color: C.t3,
              fontSize: 10, fontFamily: F, cursor: 'pointer',
            }}
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Signal List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {signals.slice(0, 6).map((signal) => (
          <div
            key={signal.id}
            className="tf-signal-card"
            onClick={() => !signal.read && markSignalRead(signal.id)}
            style={{
              padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
              background: signal.read ? 'transparent' : alpha(C.b, 0.04),
              borderLeft: signal.read ? '3px solid transparent' : `3px solid ${C.b}`,
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{signal.avatar}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: F }}>{signal.traderName}</span>
                  <span style={{ fontSize: 9, color: C.t3, fontFamily: F }}>{timeAgo(signal.ts)}</span>
                </div>
                <div style={{ fontSize: 11, color: C.t2, fontFamily: F, lineHeight: 1.4 }}>
                  {TYPE_ICONS[signal.type]} {signal.message}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
