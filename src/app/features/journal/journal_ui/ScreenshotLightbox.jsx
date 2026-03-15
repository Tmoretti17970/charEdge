// ═══════════════════════════════════════════════════════════════════
// charEdge — Screenshot Lightbox (Apple Quick Look-inspired)
// Fullscreen image viewer with zoom, pan, and multi-image navigation.
// No createPortal — uses position:fixed inline to avoid React init issues.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { C, M } from '../../../../constants.js';

const SPRING_IN = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';

function ScreenshotLightbox({ screenshots = [], initialIndex = 0, onClose }) {
  const [index, setIndex] = useState(initialIndex);
  const [animating, setAnimating] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const shot = screenshots[index];
  const hasMultiple = screenshots.length > 1;

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setAnimating(true)));
  }, []);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index > 0) { setIndex(index - 1); setZoom(1); setPan({ x: 0, y: 0 }); }
      if (e.key === 'ArrowRight' && index < screenshots.length - 1) { setIndex(index + 1); setZoom(1); setPan({ x: 0, y: 0 }); }
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(z * 1.3, 5));
      if (e.key === '-') setZoom((z) => Math.max(z / 1.3, 0.5));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [index, screenshots.length, onClose]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.5, Math.min(5, z * (e.deltaY > 0 ? 0.9 : 1.1))));
  }, []);

  const handleMouseDown = useCallback((e) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [zoom, pan]);

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return;
    setPan({ x: dragStart.current.panX + (e.clientX - dragStart.current.x), y: dragStart.current.panY + (e.clientY - dragStart.current.y) });
  }, [dragging]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  const goNext = useCallback(() => {
    if (index < screenshots.length - 1) { setIndex(index + 1); setZoom(1); setPan({ x: 0, y: 0 }); }
  }, [index, screenshots.length]);

  const goPrev = useCallback(() => {
    if (index > 0) { setIndex(index - 1); setZoom(1); setPan({ x: 0, y: 0 }); }
  }, [index]);

  const handleClose = useCallback(() => {
    setAnimating(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  const getLabel = (i) => {
    const name = screenshots[i]?.name || '';
    if (name.includes('close') || name.includes('Close')) return 'Close Snapshot';
    if (i === 0) return 'Entry Snapshot';
    return `Snapshot ${i + 1}`;
  };

  if (!shot) return null;

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: dragging ? 'grabbing' : zoom > 1 ? 'grab' : 'default',
      }}
    >
      {/* Backdrop */}
      <div onClick={handleClose} style={{
        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        opacity: animating ? 1 : 0, transition: `opacity 200ms ${EASE_OUT}`,
      }} />

      {/* Header */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, padding: '16px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%)',
        zIndex: 2, opacity: animating ? 1 : 0, transition: `opacity 300ms ${EASE_OUT}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: M }}>📸 {getLabel(index)}</span>
          {hasMultiple && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: M }}>{index + 1} / {screenshots.length}</span>}
        </div>
        <button onClick={handleClose} style={{
          width: 32, height: 32, borderRadius: 16, border: 'none',
          background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)',
          color: '#fff', fontSize: 16, fontWeight: 300, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s ease',
        }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.22)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
        >✕</button>
      </div>

      {/* Image */}
      <div onWheel={handleWheel} onMouseDown={handleMouseDown} onDoubleClick={() => {
        if (zoom > 1) { setZoom(1); setPan({ x: 0, y: 0 }); } else { setZoom(2); }
      }} style={{
        position: 'relative', zIndex: 1, maxWidth: '85vw', maxHeight: '80vh',
        opacity: animating ? 1 : 0,
        transform: animating ? `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)` : 'scale(0.85)',
        transition: dragging ? 'none' : `opacity 250ms ${SPRING_IN}, transform 350ms ${SPRING_IN}`,
        borderRadius: 12, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', userSelect: 'none',
      }}>
        <img src={shot.data} alt={getLabel(index)} draggable={false} style={{
          display: 'block', maxWidth: '85vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 12,
        }} />
      </div>

      {/* Nav arrows */}
      {hasMultiple && index > 0 && (
        <button onClick={(e) => { e.stopPropagation(); goPrev(); }} style={{
          position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', zIndex: 3,
          width: 44, height: 44, borderRadius: 22, border: 'none',
          background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)',
          color: '#fff', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: animating ? 1 : 0, transition: `opacity 300ms ${EASE_OUT}, background 0.15s ease`,
        }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
        >‹</button>
      )}
      {hasMultiple && index < screenshots.length - 1 && (
        <button onClick={(e) => { e.stopPropagation(); goNext(); }} style={{
          position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', zIndex: 3,
          width: 44, height: 44, borderRadius: 22, border: 'none',
          background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)',
          color: '#fff', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: animating ? 1 : 0, transition: `opacity 300ms ${EASE_OUT}, background 0.15s ease`,
        }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
        >›</button>
      )}

      {/* Pagination dots */}
      {hasMultiple && (
        <div style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 3,
          display: 'flex', gap: 8, padding: '8px 16px', borderRadius: 20,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)',
          opacity: animating ? 1 : 0, transition: `opacity 300ms ${EASE_OUT}`,
        }}>
          {screenshots.map((_, i) => (
            <button key={i} onClick={(e) => { e.stopPropagation(); setIndex(i); setZoom(1); setPan({ x: 0, y: 0 }); }} style={{
              width: i === index ? 20 : 8, height: 8, borderRadius: 4, border: 'none',
              background: i === index ? '#fff' : 'rgba(255,255,255,0.35)', cursor: 'pointer', padding: 0,
              transition: 'all 0.2s ease',
            }} />
          ))}
        </div>
      )}

      {/* Zoom indicator */}
      {zoom !== 1 && (
        <div style={{
          position: 'absolute', bottom: hasMultiple ? 64 : 24, right: 24, zIndex: 3,
          padding: '4px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.5)',
          color: 'rgba(255,255,255,0.7)', fontSize: 11, fontFamily: M, fontWeight: 600,
        }}>{Math.round(zoom * 100)}%</div>
      )}
    </div>
  );
}

export default React.memo(ScreenshotLightbox);
