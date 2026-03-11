// ═══════════════════════════════════════════════════════════════════
// charEdge — Discover Layout Engine
//
// Sprint 18: Customizable widget layout controls.
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { C, F } from '../../../constants.js';
import { DISCOVER_PRESETS as PRESETS } from '../../../state/layout/discoverLayoutSlice.js';
import { useLayoutStore } from '../../../state/useLayoutStore';
import Icon from '../design/Icon.jsx';
import s from './DiscoverLayoutEngine.module.css';
import { alpha } from '@/shared/colorUtils';

export default function DiscoverLayoutEngine() {
  const [open, setOpen] = useState(false);
  const { discoverPreset, applyDiscoverPreset, resetDiscoverLayout } = useLayoutStore();

  return (
    <div className={s.wrapper}>
      <button onClick={() => setOpen(!open)} className={`tf-btn ${s.trigger}`}
        style={{ border: `1px solid ${C.bd}`, background: open ? alpha(C.b, 0.08) : 'transparent', color: open ? C.b : C.t3, fontFamily: F }}>
        <Icon name="settings" size={11} /> Layout
      </button>

      {open && (
        <div className={s.dropdown} style={{ background: C.bg2, border: `1px solid ${C.bd}`, boxShadow: `0 8px 24px ${alpha('#000', 0.3)}` }}>
          <div className={s.dropdownTitle} style={{ color: C.t1, fontFamily: F }}>Layout Presets</div>

          <div className={s.presetList}>
            {Object.entries(PRESETS).map(([id, preset]) => (
              <button key={id} onClick={() => applyDiscoverPreset(id)} className={`tf-btn ${s.presetBtn}`}
                style={{ border: `1px solid ${discoverPreset === id ? C.b : alpha(C.bd, 0.5)}`, background: discoverPreset === id ? alpha(C.b, 0.06) : alpha(C.sf, 0.4) }}>
                <div className={s.presetName} style={{ color: discoverPreset === id ? C.b : C.t1, fontFamily: F }}>{preset.label}</div>
                <div className={s.presetDesc} style={{ color: C.t3, fontFamily: F }}>{preset.description}</div>
              </button>
            ))}
          </div>

          <button onClick={() => { resetDiscoverLayout(); setOpen(false); }} className={`tf-btn ${s.resetBtn}`}
            style={{ border: `1px solid ${C.bd}`, color: C.t3, fontFamily: F }}>
            ↻ Reset to Default
          </button>
        </div>
      )}
    </div>
  );
}

export { DiscoverLayoutEngine };
