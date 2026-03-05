// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Notification Panel
//
// Slide-out panel showing persistent action log.
// Groups by time (Today / Earlier). Color-coded by type.
// Keyboard accessible (Ctrl+. to toggle).
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useRef, useEffect } from 'react';
import { C, F, M } from '../../../constants.js';
import { useNotificationLog } from '../../../state/useNotificationLog.js';
import { useHotkeys } from '../../../utils/useHotkeys.js';

// ─── Type styling ─────────────────────────────────────────────────

const TYPE_STYLES = {
  success: { icon: '✓', color: C.g },
  error: { icon: '✕', color: C.r },
  warning: { icon: '⚠', color: C.y },
  info: { icon: 'ℹ', color: C.b },
  undo: { icon: '↶', color: C.p || '#a78bfa' },
  redo: { icon: '↷', color: C.p || '#a78bfa' },
};

const CATEGORY_LABELS = {
  trade: 'Trade',
  import: 'Import',
  reconcile: 'Reconcile',
  system: 'System',
  undo: 'Undo',
};

// ─── Time formatting ──────────────────────────────────────────────

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function isToday(ts) {
  const d = new Date(ts);
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

// ─── Panel Component ──────────────────────────────────────────────

export default function NotificationPanel() {
  const entries = useNotificationLog((s) => s.entries);
  const panelOpen = useNotificationLog((s) => s.panelOpen);
  const closePanel = useNotificationLog((s) => s.closePanel);
  const clearLog = useNotificationLog((s) => s.clear);
  const panelRef = useRef(null);

  // Close on Escape
  useHotkeys([{ key: 'Escape', handler: closePanel, description: 'Close notification panel', allowInInput: true }], {
    scope: 'panel:notifications',
    enabled: panelOpen,
  });

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (panelOpen && panelRef.current) {
      panelRef.current.scrollTop = panelRef.current.scrollHeight;
    }
  }, [entries.length, panelOpen]);

  // Group entries: Today vs Earlier
  const { today, earlier } = useMemo(() => {
    const t = [];
    const e = [];
    // Reverse to show newest first
    for (let i = entries.length - 1; i >= 0; i--) {
      if (isToday(entries[i].ts)) t.push(entries[i]);
      else e.push(entries[i]);
    }
    return { today: t, earlier: e };
  }, [entries]);

  if (!panelOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closePanel}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,.35)',
          zIndex: 8000,
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: 360,
          maxWidth: '90vw',
          height: '100vh',
          background: C.bg2 || C.sf,
          borderLeft: `1px solid ${C.bd}`,
          zIndex: 8001,
          display: 'flex',
          flexDirection: 'column',
          animation: 'scaleInSm 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 16px 12px',
            borderBottom: `1px solid ${C.bd}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 800, fontFamily: F, color: C.t1 }}>Activity Log</span>
            <span
              style={{
                fontSize: 10,
                fontFamily: M,
                color: C.t3,
                background: C.sf,
                padding: '2px 6px',
                borderRadius: 4,
              }}
            >
              {entries.length}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {entries.length > 0 && (
              <button
                className="tf-btn"
                onClick={clearLog}
                style={{
                  background: 'none',
                  border: `1px solid ${C.bd}`,
                  borderRadius: 4,
                  color: C.t3,
                  fontSize: 10,
                  fontFamily: M,
                  cursor: 'pointer',
                  padding: '3px 8px',
                }}
              >
                Clear
              </button>
            )}
            <button
              className="tf-btn"
              onClick={closePanel}
              style={{
                background: 'none',
                border: 'none',
                color: C.t3,
                fontSize: 18,
                cursor: 'pointer',
                padding: '0 2px',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Entry list */}
        <div
          ref={panelRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 0',
          }}
        >
          {entries.length === 0 ? (
            <div
              style={{
                padding: '48px 16px',
                textAlign: 'center',
                color: C.t3,
                fontSize: 12,
                fontFamily: F,
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.5 }}>🔔</div>
              <div style={{ fontWeight: 600, color: C.t2, marginBottom: 4 }}>No activity yet</div>
              <div style={{ fontSize: 11 }}>Actions like adding, editing, and deleting trades will appear here.</div>
            </div>
          ) : (
            <>
              {today.length > 0 && <SectionGroup label="Today" entries={today} />}
              {earlier.length > 0 && <SectionGroup label="Earlier" entries={earlier} />}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: `1px solid ${C.bd}`,
            fontSize: 10,
            color: C.t3,
            fontFamily: M,
            textAlign: 'center',
          }}
        >
          Ctrl+. to toggle · Esc to close
        </div>

      </div>
    </>
  );
}

// ─── Section Group ────────────────────────────────────────────────

function SectionGroup({ label, entries }) {
  return (
    <div>
      <div
        style={{
          padding: '8px 16px 4px',
          fontSize: 9,
          fontWeight: 700,
          color: C.t3,
          textTransform: 'uppercase',
          fontFamily: M,
          letterSpacing: '0.5px',
        }}
      >
        {label}
      </div>
      {entries.map((entry) => (
        <LogEntry key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

// ─── Individual Log Entry ─────────────────────────────────────────

function LogEntry({ entry }) {
  const style = TYPE_STYLES[entry.type] || TYPE_STYLES.info;
  const catLabel = CATEGORY_LABELS[entry.category] || entry.category;

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        padding: '8px 16px',
        borderBottom: `1px solid ${C.bd}20`,
        transition: 'background 0.1s',
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          background: style.color + '15',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          color: style.color,
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {style.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            color: C.t1,
            fontFamily: F,
            lineHeight: 1.4,
            wordBreak: 'break-word',
          }}
        >
          {entry.message}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 3,
            fontSize: 10,
            color: C.t3,
            fontFamily: M,
          }}
        >
          <span
            style={{
              background: style.color + '12',
              color: style.color,
              padding: '1px 5px',
              borderRadius: 3,
              fontSize: 9,
              fontWeight: 600,
            }}
          >
            {catLabel}
          </span>
          <span>{timeAgo(entry.ts)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Notification Bell (for Sidebar) ──────────────────────────────

export function NotificationBell() {
  const unreadCount = useNotificationLog((s) => s.unreadCount);
  const toggle = useNotificationLog((s) => s.togglePanel);

  return (
    <button
      className="tf-btn"
      onClick={toggle}
      title="Activity Log (Ctrl+.)"
      style={{
        position: 'relative',
        background: 'none',
        border: 'none',
        color: C.t3,
        fontSize: 16,
        cursor: 'pointer',
        padding: 4,
        borderRadius: 6,
        transition: 'color 0.15s',
      }}
    >
      🔔
      {unreadCount > 0 && (
        <span
          style={{
            position: 'absolute',
            top: -2,
            right: -4,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: C.r,
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
            fontFamily: M,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}

export { NotificationPanel };
