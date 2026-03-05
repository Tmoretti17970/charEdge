// ═══════════════════════════════════════════════════════════════════
// charEdge — Bento Customizer Toolbar (Sprint 17)
//
// Floating toolbar that appears when user enters "Customize" mode.
// Shows all bento cards with controls to pin, hide, reorder, and
// resize. Minimalist, non-intrusive design.
// ═══════════════════════════════════════════════════════════════════

import { useLayoutStore } from '../../../state/useLayoutStore.js';
import React from 'react';
import { C, M, F } from '../../../constants.js';
import { DEFAULT_CARDS } from '../../../state/layout/bentoSlice.js';
import { useBreakpoints } from '../../../utils/useMediaQuery.js';

export default function BentoCustomizer() {
  const customizing = useLayoutStore((s) => s.customizing);
  const toggleCustomizing = useLayoutStore((s) => s.toggleCustomizing);
  const cardOrder = useLayoutStore((s) => s.cardOrder);
  const pinned = useLayoutStore((s) => s.pinned);
  const hidden = useLayoutStore((s) => s.hidden);
  const spans = useLayoutStore((s) => s.spans);
  const togglePin = useLayoutStore((s) => s.togglePin);
  const toggleHide = useLayoutStore((s) => s.toggleHide);
  const setSpan = useLayoutStore((s) => s.setSpan);
  const moveUp = useLayoutStore((s) => s.moveUp);
  const moveDown = useLayoutStore((s) => s.moveDown);
  const resetBento = useLayoutStore((s) => s.resetBento);
  const { isMobile } = useBreakpoints();

  if (!customizing) return null;

  return (
    <div className="tf-container" style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: isMobile ? '95%' : 420,
        maxHeight: '80vh',
        borderRadius: 12,
        background: C.sf,
        border: `1px solid ${C.bd}`,
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 18px',
          borderBottom: `1px solid ${C.bd}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>🎨</span>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: F, color: C.t1 }}>
              Customize Dashboard
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="tf-btn"
              onClick={resetBento}
              style={{
                padding: '4px 10px', borderRadius: 4,
                border: `1px solid ${C.bd}`, background: 'transparent',
                color: C.t3, fontSize: 10, fontFamily: M, cursor: 'pointer',
              }}
            >
              Reset
            </button>
            <button
              className="tf-btn"
              onClick={toggleCustomizing}
              style={{
                padding: '4px 10px', borderRadius: 4,
                border: `1px solid ${C.b}30`, background: C.b + '12',
                color: C.b, fontSize: 10, fontWeight: 700, fontFamily: M, cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        </div>

        {/* Card list */}
        <div style={{
          padding: '10px 18px',
          overflowY: 'auto',
          maxHeight: 'calc(80vh - 60px)',
        }}>
          {cardOrder.map((cardId, idx) => {
            const def = DEFAULT_CARDS.find((c) => c.id === cardId);
            if (!def) return null;
            const isPinned = pinned.has(cardId);
            const isHidden = hidden.has(cardId);
            const span = spans[cardId] || def.defaultSpan;

            return (
              <div
                key={cardId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 0',
                  borderBottom: `1px solid ${C.bd}30`,
                  opacity: isHidden ? 0.4 : 1,
                }}
              >
                {/* Reorder buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <button
                    className="tf-btn"
                    onClick={() => moveUp(cardId)}
                    disabled={idx === 0}
                    style={{
                      background: 'none', border: 'none', color: idx === 0 ? C.t3 + '30' : C.t3,
                      fontSize: 8, cursor: idx === 0 ? 'default' : 'pointer', padding: '0 2px',
                    }}
                  >▲</button>
                  <button
                    className="tf-btn"
                    onClick={() => moveDown(cardId)}
                    disabled={idx === cardOrder.length - 1}
                    style={{
                      background: 'none', border: 'none',
                      color: idx === cardOrder.length - 1 ? C.t3 + '30' : C.t3,
                      fontSize: 8, cursor: idx === cardOrder.length - 1 ? 'default' : 'pointer', padding: '0 2px',
                    }}
                  >▼</button>
                </div>

                {/* Card info */}
                <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{def.emoji}</span>
                <span style={{
                  flex: 1, fontSize: 11, fontFamily: M,
                  color: isHidden ? C.t3 : C.t1,
                  textDecoration: isHidden ? 'line-through' : 'none',
                }}>
                  {def.label}
                </span>

                {/* Pin button */}
                <button
                  className="tf-btn"
                  onClick={() => togglePin(cardId)}
                  title="Pin to top"
                  style={{
                    padding: '2px 6px', borderRadius: 3,
                    border: `1px solid ${isPinned ? C.y + '40' : C.bd}`,
                    background: isPinned ? C.y + '12' : 'transparent',
                    color: isPinned ? C.y : C.t3,
                    fontSize: 10, cursor: 'pointer',
                  }}
                >📌</button>

                {/* Span toggle */}
                <button
                  className="tf-btn"
                  onClick={() => setSpan(cardId, span === 1 ? 2 : 1)}
                  title={span === 2 ? 'Make narrow' : 'Make wide'}
                  style={{
                    padding: '2px 6px', borderRadius: 3,
                    border: `1px solid ${C.bd}`,
                    background: 'transparent',
                    color: C.t3, fontSize: 9, fontFamily: M, cursor: 'pointer',
                  }}
                >
                  {span === 2 ? '▬' : '▮'}
                </button>

                {/* Hide/show */}
                <button
                  className="tf-btn"
                  onClick={() => toggleHide(cardId)}
                  title={isHidden ? 'Show' : 'Hide'}
                  style={{
                    padding: '2px 6px', borderRadius: 3,
                    border: `1px solid ${isHidden ? C.g + '30' : C.r + '30'}`,
                    background: 'transparent',
                    color: isHidden ? C.g : C.r,
                    fontSize: 9, cursor: 'pointer',
                  }}
                >
                  {isHidden ? '👁' : '✕'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
