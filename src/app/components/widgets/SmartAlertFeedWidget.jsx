// ═══════════════════════════════════════════════════════════════════
// charEdge — Smart Alert Feed Widget (C8.6)
//
// Sprint 9 #68: Extracted from DashboardWidgets.jsx.
// Displays top 5 smart alerts with severity indicators.
// ═══════════════════════════════════════════════════════════════════

import { memo } from 'react';
import { C, M } from '../../../constants.js';
import { Card } from '../ui/UIKit.jsx';
import { hdr } from './widgetStyles.js';

export const SmartAlertFeedWidget = memo(function SmartAlertFeedWidget({ alerts = [] }) {
    const top = alerts.slice(0, 5);

    return (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={hdr()}>🔔 Smart Alerts</div>

            {top.length === 0 ? (
                <div style={{ padding: '12px 14px', fontSize: 11, color: C.t3, textAlign: 'center' }}>
                    No active alerts — open a chart to detect signals
                </div>
            ) : (
                top.map((alert, i) => {
                    const sevColor = alert.severity === 'high' ? C.r : alert.severity === 'medium' ? C.y : C.t3;
                    return (
                        <div
                            key={i}
                            style={{
                                padding: '8px 14px',
                                borderBottom: `1px solid ${C.bd}15`,
                                borderLeft: `3px solid ${sevColor}`,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: C.t1,
                                    marginBottom: 2,
                                }}
                            >
                                {alert.title}
                            </div>
                            <div style={{ fontSize: 9, color: C.t3, lineHeight: 1.4 }}>{alert.body?.slice(0, 100)}</div>
                            <div
                                style={{
                                    fontSize: 8,
                                    color: sevColor,
                                    fontWeight: 700,
                                    fontFamily: M,
                                    marginTop: 3,
                                    textTransform: 'uppercase',
                                }}
                            >
                                {alert.severity} · {Math.round((alert.confidence || 0) * 100)}% confidence
                            </div>
                        </div>
                    );
                })
            )}
        </Card>
    );
});
