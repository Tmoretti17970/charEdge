// ═══════════════════════════════════════════════════════════════════
// charEdge — Labs Badge (Task 1C.1)
//
// Small "Labs" pill badge to mark experimental features that use
// mock/simulated data. Lets users know data is not live.
//
// Usage:
//   <LabsBadge />
//   <LabsBadge label="Beta" />
// ═══════════════════════════════════════════════════════════════════

import React from 'react';

const BADGE_STYLE = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 9,
    fontWeight: 700,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#f59e0b',
    background: 'rgba(245, 158, 11, 0.12)',
    border: '1px solid rgba(245, 158, 11, 0.25)',
    borderRadius: 4,
    padding: '2px 7px',
    lineHeight: 1.2,
    userSelect: 'none',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
};

/**
 * Labs/Beta badge — marks experimental features with mock data.
 * @param {{ label?: string, style?: React.CSSProperties }} props
 */
function LabsBadge({ label = 'Labs', style }) {
    return (
        <span style={{ ...BADGE_STYLE, ...style }} title="This feature uses simulated data">
            🧪 {label}
        </span>
    );
}

export { LabsBadge };

export default React.memo(LabsBadge);
