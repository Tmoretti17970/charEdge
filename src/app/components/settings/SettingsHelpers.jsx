// ═══════════════════════════════════════════════════════════════════
// charEdge — Settings Shared Helpers
// Reusable UI components used across all Settings section files.
// ═══════════════════════════════════════════════════════════════════

import { C, F, M } from '../../../constants.js';
import { radii } from '../../../theme/tokens.js';
import TFIcon from '../ui/TFIcon.jsx';
import s from './SettingsHelpers.module.css';

// ─── Section Header ─────────────────────────────────────────────

export function SectionHeader({ icon, title, description }) {
  return (
    <div className={s.sectionWrapper}>
      <div className={s.sectionHeader}>
        <TFIcon name={icon} size="lg" color={C.b} />
        <h2 className={s.sectionTitle} style={{ color: C.t1 }}>
          {title}
        </h2>
      </div>
      {description && <p className={s.sectionDesc} style={{ color: C.t3 }}>{description}</p>}
    </div>
  );
}

// ─── Setting Row Helper ─────────────────────────────────────────

export function SettingRow({ label, hint, children }) {
  return (
    <div className={s.settingRow}>
      <label className={s.settingLabel} style={{ color: C.t2 }}>
        {label}
      </label>
      {children}
      {hint && <div className={s.settingHint} style={{ color: C.t3, fontFamily: M }}>{hint}</div>}
    </div>
  );
}

// ─── Status Badge ───────────────────────────────────────────────

export function StatusBadge({ ok, label }) {
  return (
    <span
      className={s.statusBadge}
      style={{
        background: ok ? C.g + '12' : C.bd + '30',
        border: `1px solid ${ok ? C.g + '40' : C.bd}`,
        fontFamily: M,
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
      className={s.alertBanner}
      style={{
        borderRadius: radii.sm,
        background: ok ? C.g + '12' : C.r + '12',
        borderLeftColor: ok ? C.g : C.r,
        fontFamily: M,
        color: ok ? C.g : C.r,
      }}
    >
      {message}
    </div>
  );
}
