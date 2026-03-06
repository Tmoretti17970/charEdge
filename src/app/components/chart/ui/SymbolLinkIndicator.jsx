// ═══════════════════════════════════════════════════════════════════
// charEdge — Symbol Link Indicator (Task 1.1.3)
// Color-coded dot in chart header. Click to cycle link groups.
// Charts in the same group auto-sync symbols.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useChartStore } from '../../../../state/useChartStore.js';

const LINK_GROUPS = [null, 'A', 'B', 'C', 'D'];
const LINK_COLORS = { A: '#EF5350', B: '#42A5F5', C: '#66BB6A', D: '#AB47BC' };

export default function SymbolLinkIndicator() {
    const linkGroup = useChartStore((s) => s.linkGroup);
    const setLinkGroup = useChartStore((s) => s.setLinkGroup);

    const handleCycle = () => {
        const idx = LINK_GROUPS.indexOf(linkGroup);
        setLinkGroup(LINK_GROUPS[(idx + 1) % LINK_GROUPS.length]);
    };

    const color = linkGroup ? LINK_COLORS[linkGroup] : null;

    return (
        <button
            onClick={handleCycle}
            title={linkGroup ? `Link Group ${linkGroup} — Click to change` : 'No link group — Click to assign'}
            style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                border: linkGroup ? `2px solid ${color}` : '2px dashed rgba(120,123,134,0.4)',
                background: linkGroup ? `${color}20` : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 8,
                fontWeight: 700,
                color: color || 'rgba(120,123,134,0.6)',
                fontFamily: 'var(--tf-font)',
                flexShrink: 0,
                transition: 'all 0.2s ease',
                padding: 0,
            }}
        >
            {linkGroup || '○'}
        </button>
    );
}
