// ═══════════════════════════════════════════════════════════════════
// charEdge — Layout Density Picker (Sprint 7)
//
// 3 density modes: Compact, Default, Comfortable
// Visual wireframe previews for each density mode.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import { C, F, M } from '../../../constants.js';
import { useUserStore } from '../../../state/useUserStore';
import { radii, transition } from '../../../theme/tokens.js';
import { Card } from '../ui/UIKit.jsx';
import { toast } from '../ui/Toast.jsx';

const DENSITIES = [
  {
    id: 'compact',
    label: 'Compact',
    hint: 'More data, less spacing',
    spacing: 4,
    rows: 6,
  },
  {
    id: 'default',
    label: 'Default',
    hint: 'Balanced layout',
    spacing: 8,
    rows: 4,
  },
  {
    id: 'comfortable',
    label: 'Comfortable',
    hint: 'Spacious, easy to read',
    spacing: 12,
    rows: 3,
  },
];

function LayoutDensityPicker() {
  const settings = useUserStore((s) => s.settings) || {};
  const [density, setDensity] = useState(settings.layoutDensity || 'default');
  const updateSetting = useUserStore((s) => s.updateSettings);

  const handleChange = useCallback((id) => {
    setDensity(id);
    if (typeof updateSetting === 'function') {
      updateSetting({ layoutDensity: id });
    }
    toast.info(`Layout: ${DENSITIES.find(d => d.id === id)?.label}`);
  }, [updateSetting]);

  return (
    <Card style={{ padding: 20, marginTop: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F, marginBottom: 4 }}>
        Layout Density
      </div>
      <div style={{ fontSize: 11, color: C.t3, fontFamily: F, marginBottom: 14 }}>
        Controls spacing between elements throughout the app
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        {DENSITIES.map((d) => (
          <button
            key={d.id}
            onClick={() => handleChange(d.id)}
            className="tf-btn"
            style={{
              flex: 1, padding: 12,
              borderRadius: radii.md,
              border: `2px solid ${density === d.id ? C.b : C.bd + '30'}`,
              background: density === d.id ? C.b + '06' : 'transparent',
              cursor: 'pointer',
              transition: `all ${transition.base}`,
              textAlign: 'center',
            }}
          >
            {/* Wireframe preview */}
            <div style={{
              width: '100%', height: 48,
              display: 'flex', flexDirection: 'column',
              gap: d.spacing / 2, justifyContent: 'center',
              marginBottom: 8,
            }}>
              {Array.from({ length: d.rows }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    height: Math.max(2, 6 - d.spacing / 4),
                    borderRadius: 1,
                    background: density === d.id ? C.b + '40' : C.bd + '40',
                    width: i % 2 === 0 ? '100%' : '70%',
                  }}
                />
              ))}
            </div>
            <div style={{
              fontSize: 11, fontWeight: 600,
              color: density === d.id ? C.b : C.t2,
              fontFamily: F, marginBottom: 2,
            }}>
              {d.label}
            </div>
            <div style={{ fontSize: 9, color: C.t3, fontFamily: F }}>
              {d.hint}
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
}

export default React.memo(LayoutDensityPicker);
