// ═══════════════════════════════════════════════════════════════════
// charEdge — RoleGate Component
//
// Conditional renderer that shows children only when the user has
// sufficient role level. Optionally shows a fallback for locked
// features (upgrade prompt, disabled state, etc.).
//
// Usage:
//   <RoleGate minRole="trader">
//     <PaperTradeWidget />           {/* Only visible to traders+ */}
//   </RoleGate>
//
//   <RoleGate minRole="admin" fallback={<UpgradePrompt />}>
//     <AdminPanel />
//   </RoleGate>
//
//   <RoleGate minRole="pro" mode="disable">
//     <AdvancedChart />              {/* Rendered but disabled */}
//   </RoleGate>
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C, F } from '../../../constants.js';
import { useRole } from '../../../hooks/useRole.js';

/**
 * @param {Object} props
 * @param {'free'|'viewer'|'trader'|'pro'|'admin'} props.minRole - Minimum role required
 * @param {'hide'|'disable'|'blur'} [props.mode='hide'] - What to do when access is denied
 * @param {React.ReactNode} [props.fallback] - Custom fallback when mode='hide' and access denied
 * @param {React.ReactNode} props.children
 */
export default function RoleGate({ minRole, mode = 'hide', fallback = null, children }) {
    const { hasRole, _role } = useRole();

    if (hasRole(minRole)) {
        return <>{children}</>;
    }

    // ─── Access Denied Modes ─────────────────────────────────────

    if (mode === 'disable') {
        return (
            <div
                style={{
                    position: 'relative',
                    opacity: 0.5,
                    pointerEvents: 'none',
                    filter: 'grayscale(30%)',
                    userSelect: 'none',
                }}
                aria-disabled="true"
                title={`Requires ${minRole} role`}
            >
                {children}
                <div
                    style={{
                        position: 'absolute',
                        bottom: 8,
                        right: 8,
                        padding: '4px 10px',
                        borderRadius: 6,
                        background: C.sf,
                        border: `1px solid ${C.bd}`,
                        fontSize: 10,
                        fontWeight: 600,
                        fontFamily: F,
                        color: C.t3,
                        pointerEvents: 'auto',
                        cursor: 'default',
                    }}
                >
                    🔒 {minRole}+
                </div>
            </div>
        );
    }

    if (mode === 'blur') {
        return (
            <div
                style={{
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                <div
                    style={{
                        filter: 'blur(6px)',
                        pointerEvents: 'none',
                        userSelect: 'none',
                    }}
                >
                    {children}
                </div>
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(0,0,0,0.3)',
                        backdropFilter: 'blur(2px)',
                    }}
                >
                    <div
                        style={{
                            padding: '12px 20px',
                            borderRadius: 10,
                            background: C.sf,
                            border: `1px solid ${C.bd}`,
                            fontSize: 13,
                            fontWeight: 600,
                            fontFamily: F,
                            color: C.t1,
                            textAlign: 'center',
                        }}
                    >
                        🔒 Upgrade to <span style={{ color: C.b, textTransform: 'capitalize' }}>{minRole}</span> to unlock
                    </div>
                </div>
            </div>
        );
    }

    // mode === 'hide' (default)
    return fallback ? <>{fallback}</> : null;
}

export { RoleGate };
