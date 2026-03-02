// ═══════════════════════════════════════════════════════════════════
// charEdge — Settings Shared Helpers
// Reusable UI components used across all Settings section files.
// ═══════════════════════════════════════════════════════════════════

import { C, F, M } from '../../../constants.js';
import { radii } from '../../../theme/tokens.js';
import TFIcon from '../ui/TFIcon.jsx';

// ─── Section Header ─────────────────────────────────────────────

export function SectionHeader({ icon, title, description }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 4,
        }}
      >
        <TFIcon name={icon} size="lg" color={C.b} />
        <h2
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: C.t1,
            margin: 0,
          }}
        >
          {title}
        </h2>
      </div>
      {description && <p style={{ fontSize: 13, color: C.t3, margin: 0, paddingLeft: 30 }}>{description}</p>}
    </div>
  );
}

// ─── Setting Row Helper ─────────────────────────────────────────

export function SettingRow({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 600,
          color: C.t2,
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      {children}
      {hint && <div style={{ fontSize: 11, color: C.t3, marginTop: 4, fontFamily: M }}>{hint}</div>}
    </div>
  );
}

// ─── Status Badge ───────────────────────────────────────────────

export function StatusBadge({ ok, label }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 10px',
        borderRadius: 12,
        background: ok ? C.g + '12' : C.bd + '30',
        border: `1px solid ${ok ? C.g + '40' : C.bd}`,
        fontSize: 10,
        fontFamily: M,
        fontWeight: 600,
        color: ok ? C.g : C.t3,
      }}
    >
      {ok ? '●' : '○'} {label}
    </span>
  );
}

// ─── Alert Banner ───────────────────────────────────────────────

export function AlertBanner({ ok, message }) {
  if (!message) return null;
  return (
    <div
      style={{
        marginTop: 10,
        padding: '8px 12px',
        borderRadius: radii.sm,
        background: ok ? C.g + '12' : C.r + '12',
        borderLeft: `3px solid ${ok ? C.g : C.r}`,
        fontSize: 12,
        fontFamily: M,
        color: ok ? C.g : C.r,
      }}
    >
      {message}
    </div>
  );
}
