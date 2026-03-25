// ═══════════════════════════════════════════════════════════════════
// charEdge — Recently Changed Pill
//
// Compact banner showing the most recent settings change with an
// undo button. Only visible when there's change history.
// ═══════════════════════════════════════════════════════════════════

import { memo } from 'react';
import { C, F, M } from '../../../constants.js';
import { useSettingsHistory } from '../../../state/useSettingsHistory.js';
import { radii } from '../../../theme/tokens.js';

const RecentlyChanged = memo(function RecentlyChanged() {
  const changes = useSettingsHistory((s) => s.changes);
  const undo = useSettingsHistory((s) => s.undo);
  const clear = useSettingsHistory((s) => s.clear);

  if (!changes.length) return null;

  const latest = changes[0];
  const age = Date.now() - latest.timestamp;
  const isRecent = age < 30 * 60 * 1000; // 30 minutes
  if (!isRecent) return null;

  // Relative time
  const mins = Math.floor(age / 60000);
  const timeAgo = mins < 1 ? 'just now' : `${mins}m ago`;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        marginBottom: 16,
        background: `${C.b}08`,
        border: `1px solid ${C.b}20`,
        borderRadius: radii.md,
        fontSize: 12,
        fontFamily: F,
        animation: 'settingsFadeIn 0.25s ease',
      }}
    >
      {/* Icon */}
      <span style={{ fontSize: 13, flexShrink: 0 }}>↩️</span>

      {/* Change label */}
      <span
        style={{
          color: C.t2,
          fontWeight: 500,
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {latest.label}
      </span>

      {/* Time ago */}
      <span style={{ fontSize: 10, color: C.t3, fontFamily: M, flexShrink: 0 }}>{timeAgo}</span>

      {/* Undo button */}
      <button
        onClick={() => undo(latest.id)}
        className="tf-btn"
        style={{
          padding: '3px 10px',
          borderRadius: radii.sm,
          border: `1px solid ${C.b}30`,
          background: C.b + '12',
          color: C.b,
          fontSize: 11,
          fontWeight: 700,
          fontFamily: F,
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all 0.15s',
        }}
      >
        Undo
      </button>

      {/* Dismiss */}
      <button
        onClick={clear}
        className="tf-btn"
        style={{
          background: 'none',
          border: 'none',
          color: C.t3,
          cursor: 'pointer',
          fontSize: 11,
          padding: '0 2px',
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
});

export default RecentlyChanged;
