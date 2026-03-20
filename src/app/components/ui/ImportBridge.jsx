// ═══════════════════════════════════════════════════════════════════
// charEdge — Import Bridge
//
// Lightweight component that listens for the 'charEdge:open-import'
// custom event and renders ImportPage as a theme-aware overlay modal.
//
// Uses the same theme-aware pattern as SpotlightLogbook.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { C, F } from '../../../constants.js';

const ImportPage = lazy(() => import('../../../pages/ImportPage.jsx'));

function ImportBridge() {
  const [open, setOpen] = useState(false);
  const overlayRef = useRef(null);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('charEdge:open-import', handler);
    return () => window.removeEventListener('charEdge:open-import', handler);
  }, []);

  // Escape key to close
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Focus trap
  useEffect(() => {
    if (!open || !overlayRef.current) return;
    const trap = (e) => {
      if (e.key !== 'Tab') return;
      const focusable = overlayRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-label="Import Hub"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9990,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '3vh',
        animation: 'fadeIn 0.18s ease-out',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(12px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(12px) saturate(1.8)',
        }}
      />

      {/* Panel — theme-aware, matching SpotlightLogbook */}
      <div
        style={{
          position: 'relative',
          width: '90vw',
          maxWidth: 1100,
          maxHeight: '92vh',
          borderRadius: 18,
          background: C.sf + 'e6',
          backdropFilter: 'blur(25px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(25px) saturate(1.6)',
          border: `0.5px solid ${C.bd}30`,
          boxShadow:
            '0 20px 50px rgba(0,0,0,0.15), ' +
            `0 0 0 1px ${C.bd}15 inset`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'scaleInSm 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          color: C.t1,
        }}
      >
        {/* Close button */}
        <button
          onClick={() => setOpen(false)}
          aria-label="Close import hub"
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            zIndex: 10,
            width: 28,
            height: 28,
            borderRadius: 8,
            border: `1px solid ${C.bd}30`,
            background: C.sf,
            color: C.t3,
            fontSize: 14,
            fontFamily: F,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = C.b + '12';
            e.currentTarget.style.color = C.t1;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = C.sf;
            e.currentTarget.style.color = C.t3;
          }}
        >
          ✕
        </button>

        {/* Footer hint bar */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '8px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          fontSize: 11,
          color: C.t3,
          borderTop: `0.5px solid ${C.bd}30`,
          background: C.sf + 'f2',
          zIndex: 5,
          fontFamily: F,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: 0.5 }}>
            <span style={{
              padding: '1px 5px', borderRadius: 4, fontSize: 10, fontWeight: 600,
              background: C.bd + '30', minWidth: 18, textAlign: 'center',
            }}>ESC</span>
            Close
          </span>
        </div>

        {/* Scrollable Import Hub content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingBottom: 40, /* room for footer */
          }}
        >
          <Suspense
            fallback={
              <div style={{ padding: 60, textAlign: 'center', color: C.t3, fontSize: 13 }}>
                Loading Import Hub…
              </div>
            }
          >
            <ImportPage />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default React.memo(ImportBridge);
