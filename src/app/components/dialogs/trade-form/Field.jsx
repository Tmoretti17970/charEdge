// ═══════════════════════════════════════════════════════════════════
// Field — Labeled form field wrapper with error display
// ═══════════════════════════════════════════════════════════════════

import { C, M } from '@/constants.js';

/**
 * Reusable field wrapper: renders a label with optional error badge
 * and wraps its children in a styled container.
 */
export default function Field({ label, error, children, style = {} }) {
    return (
        <div style={style}>
            <label
                style={{
                    display: 'block',
                    fontSize: 10,
                    fontWeight: 600,
                    color: error ? C.r : C.t3,
                    marginBottom: 3,
                    fontFamily: M,
                }}
            >
                {label} {error && <span style={{ color: C.r }}>· {error}</span>}
            </label>
            {children}
        </div>
    );
}
