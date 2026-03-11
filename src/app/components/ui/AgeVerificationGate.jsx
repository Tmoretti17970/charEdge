// ═══════════════════════════════════════════════════════════════════
// charEdge — Age Verification Gate
//
// Phase 1 Task 1.1.8: Age verification for financial products.
// Modal that blocks app usage until user confirms they are 18+.
// Stores acknowledgment in localStorage (survives data resets).
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { C, F } from '../../../constants.js';
import { DEPTH } from '../../../constants.js';

const STORAGE_KEY = 'charedge-age-verified';

function isVerified() {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; }
    // eslint-disable-next-line unused-imports/no-unused-vars
    catch (_) { return false; }
}

function setVerified() {
    try { localStorage.setItem(STORAGE_KEY, 'true'); }
    // eslint-disable-next-line unused-imports/no-unused-vars
    catch (_) { /* localStorage blocked */ }
}

export default function AgeVerificationGate({ children }) {
    const [verified, setVerifiedState] = useState(isVerified);

    useEffect(() => {
        // Re-check on mount (in case another tab set the value)
        setVerifiedState(isVerified());
    }, []);

    if (verified) return children;

    return (
        <>
            {/* Backdrop */}
            <div
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 99999,
                    background: 'rgba(0,0,0,0.85)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 24,
                }}
            >
                {/* Modal */}
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Age verification required"
                    style={{
                        background: C.sf,
                        border: `1px solid ${C.bd}`,
                        borderRadius: 20,
                        padding: '40px 32px',
                        maxWidth: 420,
                        width: '100%',
                        textAlign: 'center',
                        boxShadow: DEPTH[4],
                    }}
                >
                    <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
                    <h2 style={{
                        fontSize: 22, fontWeight: 800, fontFamily: F, color: C.t1,
                        margin: '0 0 8px',
                    }}>
                        Age Verification Required
                    </h2>
                    <p style={{
                        fontSize: 13, fontFamily: F, color: C.t2, lineHeight: 1.6,
                        margin: '0 0 24px',
                    }}>
                        charEdge provides financial market data and analytics tools.
                        You must be <strong style={{ color: C.t1 }}>18 years or older</strong> to
                        access this application.
                    </p>
                    <p style={{
                        fontSize: 11, color: C.t3, fontFamily: F, lineHeight: 1.5,
                        margin: '0 0 24px',
                    }}>
                        By proceeding, you confirm that you are at least 18 years of age
                        and agree to our Terms of Service and Privacy Policy.
                    </p>

                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                        <button
                            onClick={() => {
                                setVerified();
                                setVerifiedState(true);
                            }}
                            style={{
                                padding: '12px 32px',
                                borderRadius: 12,
                                border: 'none',
                                background: `linear-gradient(135deg, ${C.b}, ${C.bH || C.b})`,
                                color: '#fff',
                                fontSize: 14,
                                fontWeight: 700,
                                fontFamily: F,
                                cursor: 'pointer',
                                boxShadow: `0 4px 16px ${C.b}30`,
                                transition: 'transform 0.15s, box-shadow 0.15s',
                            }}
                            onMouseEnter={(e) => { e.target.style.transform = 'translateY(-1px)'; }}
                            onMouseLeave={(e) => { e.target.style.transform = 'none'; }}
                        >
                            I am 18 or older
                        </button>
                        <a
                            href="https://www.google.com"
                            style={{
                                padding: '12px 24px',
                                borderRadius: 12,
                                border: `1px solid ${C.bd}`,
                                background: 'transparent',
                                color: C.t3,
                                fontSize: 13,
                                fontWeight: 600,
                                fontFamily: F,
                                cursor: 'pointer',
                                textDecoration: 'none',
                                display: 'flex',
                                alignItems: 'center',
                            }}
                        >
                            Exit
                        </a>
                    </div>
                </div>
            </div>
        </>
    );
}
