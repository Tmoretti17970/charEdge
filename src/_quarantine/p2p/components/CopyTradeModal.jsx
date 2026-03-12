// ═══════════════════════════════════════════════════════════════════
// charEdge — Copy Trade Configuration Modal
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState } from 'react';
import { C, F, M } from '../../../constants.js';
import { useSocialStore } from '../../../state/useSocialStore.js';
import { alpha } from '@/shared/colorUtils';

function CopyTradeModal({ open, onClose, trader }) {
  const [allocation, setAllocation] = useState(10);
  const [riskMultiplier, setRiskMultiplier] = useState(1.0);
  const [maxPositions, setMaxPositions] = useState(3);
  const [stopLossOverride, setStopLossOverride] = useState(false);
  const [step, setStep] = useState(1); // 1 = config, 2 = confirm
  const addCopyTarget = useSocialStore((s) => s.addCopyTarget);

  if (!open || !trader) return null;

  const handleConfirm = () => {
    addCopyTarget({
      userId: trader.userId || trader.id,
      name: trader.name,
      avatar: trader.avatar || '👤',
      allocation,
      riskMultiplier,
      maxPositions,
      stopLossOverride,
    });
    setStep(1);
    onClose();
  };

  const overlay = {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  const modal = {
    background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 18,
    padding: 28, width: 440, maxWidth: '92vw',
    boxShadow: `0 24px 64px rgba(0,0,0,0.5)`,
  };

  const label = {
    fontSize: 12, fontWeight: 600, color: C.t2, fontFamily: F,
    marginBottom: 6, display: 'block',
  };

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 10,
    border: `1px solid ${C.bd}`, background: C.sf, color: C.t1,
    fontSize: 14, fontFamily: M, outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()} className="tf-copy-card">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.t1, fontFamily: F }}>
              📋 Copy {trader.name}
            </div>
            <div style={{ fontSize: 12, color: C.t3, fontFamily: F, marginTop: 2 }}>
              Mirror their trades automatically
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: C.t3, fontSize: 18, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {step === 1 ? (
          <>
            {/* Allocation */}
            <div style={{ marginBottom: 18 }}>
              <label style={label}>Allocation (% of account)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="range"
                  min={1} max={50} value={allocation}
                  onChange={(e) => setAllocation(Number(e.target.value))}
                  style={{ flex: 1, accentColor: C.b }}
                />
                <span style={{ fontSize: 16, fontWeight: 700, color: C.b, fontFamily: M, minWidth: 40, textAlign: 'right' }}>
                  {allocation}%
                </span>
              </div>
            </div>

            {/* Risk Multiplier */}
            <div style={{ marginBottom: 18 }}>
              <label style={label}>Risk Multiplier</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[0.5, 0.75, 1.0, 1.5, 2.0].map((rm) => (
                  <button
                    key={rm}
                    onClick={() => setRiskMultiplier(rm)}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 8,
                      border: `1px solid ${riskMultiplier === rm ? C.b : C.bd}`,
                      background: riskMultiplier === rm ? alpha(C.b, 0.12) : 'transparent',
                      color: riskMultiplier === rm ? C.b : C.t2,
                      fontSize: 13, fontWeight: 700, fontFamily: M, cursor: 'pointer',
                    }}
                  >
                    {rm}×
                  </button>
                ))}
              </div>
            </div>

            {/* Max Positions */}
            <div style={{ marginBottom: 18 }}>
              <label style={label}>Max Simultaneous Positions</label>
              <input
                type="number" min={1} max={10} value={maxPositions}
                onChange={(e) => setMaxPositions(Number(e.target.value))}
                style={inputStyle}
              />
            </div>

            {/* Stop Loss Override */}
            <div style={{ marginBottom: 24 }}>
              <label
                style={{ ...label, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 0 }}
                onClick={() => setStopLossOverride(!stopLossOverride)}
              >
                <div
                  style={{
                    width: 36, height: 20, borderRadius: 10, padding: 2,
                    background: stopLossOverride ? C.g : C.bd,
                    transition: 'background 0.2s', cursor: 'pointer',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 16, height: 16, borderRadius: '50%', background: '#fff',
                      transform: stopLossOverride ? 'translateX(16px)' : 'translateX(0)',
                      transition: 'transform 0.2s',
                    }}
                  />
                </div>
                Use my stop-loss settings instead of trader's
              </label>
            </div>

            {/* Risk Warning */}
            <div
              style={{
                padding: 12, borderRadius: 10, marginBottom: 20,
                background: alpha(C.y, 0.08), border: `1px solid ${alpha(C.y, 0.2)}`,
              }}
            >
              <div style={{ fontSize: 11, color: C.y, fontFamily: F, lineHeight: 1.5 }}>
                ⚠️ <strong>Risk Warning:</strong> Copy trading involves significant risk. Past performance
                does not guarantee future results. You may lose some or all of your allocated capital.
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
                background: `linear-gradient(135deg, ${C.b}, ${C.bH})`,
                color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: F,
                cursor: 'pointer', transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              Review & Confirm →
            </button>
          </>
        ) : (
          <>
            {/* Confirmation Step */}
            <div
              style={{
                padding: 16, borderRadius: 12, background: C.sf,
                border: `1px solid ${C.bd}`, marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 13, color: C.t2, fontFamily: F, lineHeight: 2 }}>
                <div><strong style={{ color: C.t1 }}>Trader:</strong> {trader.name}</div>
                <div><strong style={{ color: C.t1 }}>Allocation:</strong> <span style={{ color: C.b }}>{allocation}%</span> of account</div>
                <div><strong style={{ color: C.t1 }}>Risk Multiplier:</strong> {riskMultiplier}×</div>
                <div><strong style={{ color: C.t1 }}>Max Positions:</strong> {maxPositions}</div>
                <div><strong style={{ color: C.t1 }}>Stop-Loss Override:</strong> {stopLossOverride ? 'Yes (mine)' : 'No (trader\'s)'}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 12,
                  border: `1px solid ${C.bd}`, background: 'transparent',
                  color: C.t2, fontSize: 13, fontWeight: 600, fontFamily: F, cursor: 'pointer',
                }}
              >
                ← Back
              </button>
              <button
                onClick={handleConfirm}
                style={{
                  flex: 2, padding: '12px 0', borderRadius: 12, border: 'none',
                  background: C.g, color: '#fff', fontSize: 14, fontWeight: 700,
                  fontFamily: F, cursor: 'pointer',
                }}
              >
                ✓ Start Copying
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default React.memo(CopyTradeModal);
