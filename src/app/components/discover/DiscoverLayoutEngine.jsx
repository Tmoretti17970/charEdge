// ═══════════════════════════════════════════════════════════════════
// charEdge — Discover Layout Engine
//
// Sprint 18: Customizable widget layout controls.
// ═══════════════════════════════════════════════════════════════════

import { useLayoutStore } from '../../../state/useLayoutStore.js';
import { useState } from 'react';
import { C, F, M } from '../../../constants.js';
import { alpha } from '../../../utils/colorUtils.js';
import { DISCOVER_PRESETS as PRESETS } from '../../../state/layout/discoverLayoutSlice.js';

export default function DiscoverLayoutEngine() {
  const [open, setOpen] = useState(false);
  const { discoverPreset, applyDiscoverPreset, resetDiscoverLayout } = useLayoutStore();

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(!open)} className="tf-btn"
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.bd}`, background: open ? alpha(C.b, 0.08) : 'transparent', color: open ? C.b : C.t3, cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: F }}>
        ⚙️ Layout
      </button>

      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, width: 280, background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 12, padding: 16, zIndex: 100, boxShadow: `0 8px 24px ${alpha('#000', 0.3)}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F, marginBottom: 12 }}>Layout Presets</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {Object.entries(PRESETS).map(([id, preset]) => (
              <button key={id} onClick={() => applyDiscoverPreset(id)} className="tf-btn"
                style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: `1px solid ${discoverPreset === id ? C.b : alpha(C.bd, 0.5)}`, background: discoverPreset === id ? alpha(C.b, 0.06) : alpha(C.sf, 0.4), cursor: 'pointer' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: discoverPreset === id ? C.b : C.t1, fontFamily: F }}>{preset.label}</div>
                <div style={{ fontSize: 9, color: C.t3, fontFamily: F, marginTop: 2 }}>{preset.description}</div>
              </button>
            ))}
          </div>

          <button onClick={() => { resetDiscoverLayout(); setOpen(false); }} className="tf-btn"
            style={{ width: '100%', padding: '8px', borderRadius: 8, border: `1px solid ${C.bd}`, background: 'transparent', color: C.t3, cursor: 'pointer', fontSize: 10, fontWeight: 600, fontFamily: F }}>
            ↻ Reset to Default
          </button>
        </div>
      )}
    </div>
  );
}

export { DiscoverLayoutEngine };
