// ═══════════════════════════════════════════════════════════════════
// charEdge — Layout Density Picker (Sprint 7)
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import { C } from '../../../constants.js';
import { useUserStore } from '../../../state/useUserStore';
import { toast } from '../ui/Toast.jsx';
import { Card } from '../ui/UIKit.jsx';
import st from './LayoutDensityPicker.module.css';

const DENSITIES = [
  { id: 'compact', label: 'Compact', hint: 'More data, less spacing', spacing: 4, rows: 6 },
  { id: 'default', label: 'Default', hint: 'Balanced layout', spacing: 8, rows: 4 },
  { id: 'comfortable', label: 'Comfortable', hint: 'Spacious, easy to read', spacing: 12, rows: 3 },
];

function LayoutDensityPicker() {
  const settings = useUserStore((s) => s.settings) || {};
  const [density, setDensity] = useState(settings.layoutDensity || 'default');
  const updateSetting = useUserStore((s) => s.updateSettings);

  const handleChange = useCallback(
    (id) => {
      setDensity(id);
      if (typeof updateSetting === 'function') updateSetting({ layoutDensity: id });
      toast.info(`Layout: ${DENSITIES.find((d) => d.id === id)?.label}`);
    },
    [updateSetting],
  );

  return (
    <Card className={st.cardPad}>
      <div className={st.title}>Layout Density</div>
      <div className={st.hint}>Controls spacing between elements throughout the app</div>

      <div className={st.row}>
        {DENSITIES.map((d) => (
          <button
            key={d.id}
            onClick={() => handleChange(d.id)}
            className={`tf-btn ${st.densityBtn}`}
            style={{
              border: `2px solid ${density === d.id ? C.b : C.bd + '30'}`,
              background: density === d.id ? C.b + '06' : 'transparent',
            }}
          >
            <div className={st.preview} style={{ gap: d.spacing / 2 }}>
              {Array.from({ length: d.rows }).map((_, i) => (
                <div
                  key={i}
                  className={st.previewLine}
                  style={{
                    height: Math.max(2, 6 - d.spacing / 4),
                    background: density === d.id ? C.b + '40' : C.bd + '40',
                    width: i % 2 === 0 ? '100%' : '70%',
                  }}
                />
              ))}
            </div>
            <div className={st.densityLabel} style={{ color: density === d.id ? C.b : C.t2 }}>
              {d.label}
            </div>
            <div className={st.densityHint}>{d.hint}</div>
          </button>
        ))}
      </div>
    </Card>
  );
}

export default React.memo(LayoutDensityPicker);
