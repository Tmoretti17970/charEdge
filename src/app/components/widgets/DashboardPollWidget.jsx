// ═══════════════════════════════════════════════════════════════════
// charEdge — Dashboard Poll Widget
//
// Sprint 9 #68: Extracted from DashboardWidgets.jsx.
// Placeholder for community poll — social features quarantined.
// ═══════════════════════════════════════════════════════════════════

import { memo } from 'react';
import { C } from '../../../constants.js';
import { Card } from '../ui/UIKit.jsx';
import { hdr } from './widgetStyles.js';

// Wave 0: Social features quarantined from v1.0 scope
export const DashboardPollWidget = memo(function DashboardPollWidget() {
    return (
        <Card style={{ padding: 0, overflow: 'hidden', height: '100%' }}>
            <div style={hdr()}>🗳️ Community Poll</div>
            <div style={{ padding: '20px 14px', fontSize: 13, color: C.t3, textAlign: 'center' }}>Coming soon.</div>
        </Card>
    );
});
