// ═══════════════════════════════════════════════════════════════════
// charEdge — Alert Lines Overlay (GPU-smooth, Apple-level tags)
//
// Renders active price alerts as annotated lines on the chart.
// Uses direct DOM mutation in the RAF loop for zero-React-overhead
// position updates (no setState during pan/zoom).
//
// Features:
//   • Frosted-glass capsule tags with Apple-level aesthetics
//   • Hover-reveal × delete button with red glow
//   • Click-and-drag to reposition alert price level
//   • Severity-based color coding (urgent/warning/info)
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { useChartCoreStore } from '../../../../state/chart/useChartCoreStore';
import { useAlertStore } from '../../../../state/useAlertStore';
import Icon from '../../design/Icon.jsx';
import { F, M, GLASS } from '@/constants.js';

// ─── Severity helpers (pure — no DOM) ───────────────────────────

function getSeverity(alertPrice, currentPrice) {
  if (!currentPrice || currentPrice === 0) return 'info';
  const pct = Math.abs((alertPrice - currentPrice) / currentPrice) * 100;
  if (pct <= 0.5) return 'urgent';
  if (pct <= 2.0) return 'warning';
  return 'info';
}

function getSeverityColor(severity, isAbove) {
  if (severity === 'urgent') return isAbove ? '#26A69A' : '#EF5350';
  if (severity === 'warning') return '#FF9800';
  return '#787B86';
}

// ─── Style maps ─────────────────────────────────────────────────

const LINE_BORDER = {
  urgent: (c) => `2px solid ${c}`,
  warning: (c) => `1.5px dashed ${c}A0`,
  info: () => '1px dotted rgba(255,255,255,0.15)',
};
const OPACITY = { urgent: '1', warning: '0.85', info: '0.5' };

// ─── Inline CSS for animations ──────────────────────────────────

const OVERLAY_CSS = `
  @keyframes alertPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(0.97); }
  }
  @keyframes alertTagIn {
    from { opacity: 0; transform: translateX(8px); }
    to { opacity: 1; transform: translateX(0); }
  }
  [data-alert-label]:hover [data-delete-btn] {
    opacity: 1 !important;
  }
  [data-alert-label]:hover {
    border-color: rgba(255,255,255,0.18) !important;
    box-shadow: 0 2px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06) !important;
  }
  [data-delete-btn]:hover {
    background: rgba(239, 83, 80, 0.25) !important;
    color: #EF5350 !important;
  }
  [data-alert-label].dragging {
    cursor: grabbing !important;
    box-shadow: 0 0 20px rgba(100,160,255,0.25), 0 4px 16px rgba(0,0,0,0.3) !important;
    border-color: rgba(100,160,255,0.35) !important;
    z-index: 100 !important;
  }
`;

function AlertLinesOverlay({ symbol, engineRef }) {
  const allAlerts = useAlertStore((s) => s.alerts);

  // Get alerts for the current symbol
  const alerts = useMemo(() => {
    if (!allAlerts) return [];
    if (Array.isArray(allAlerts)) {
      return allAlerts.filter((a) => a.active !== false && (a.symbol || '').toUpperCase() === symbol.toUpperCase());
    }
    const list = allAlerts[symbol] || allAlerts[symbol?.toUpperCase()] || [];
    return Array.isArray(list) ? list.filter((a) => a.active !== false) : [];
  }, [allAlerts, symbol]);

  const lineRefsMap = useRef(new Map());
  const rafRef = useRef(null);
  const dragRef = useRef(null); // { id, startY, startPrice, el }

  // ─── Delete handler ─────────────────────────────────────────
  const handleDelete = useCallback((e, alertId) => {
    e.stopPropagation();
    e.preventDefault();
    useAlertStore.getState().removeAlert(alertId);
  }, []);

  // ─── Drag handlers ─────────────────────────────────────────
  const handleDragStart = useCallback(
    (e, alert) => {
      // Stop propagation at all levels to prevent chart panning
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      e.preventDefault();

      const eng = engineRef?.current;
      if (!eng) return;

      const id = alert.id || `${alert.price}-${alert.condition}`;
      const el = lineRefsMap.current.get(id);
      if (!el) return;

      const container = el.parentElement;
      if (!container) return;

      const labelEl = el.querySelector('[data-alert-label]');
      if (labelEl) labelEl.classList.add('dragging');

      // Use engine's price transform for pixel-perfect conversion
      const yToPrice =
        eng._lastPriceTransform?.yToPrice ||
        ((y) => {
          const R = eng.state?.lastRender;
          if (!R || !R.mainH) return alert.price;
          return R.yMin + ((R.mainH - y) / R.mainH) * (R.yMax - R.yMin);
        });

      dragRef.current = {
        id,
        alertId: alert.id,
        el,
        yToPrice,
        containerRect: container.getBoundingClientRect(),
      };

      // Block chart panning while dragging
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    },
    [engineRef],
  );

  useEffect(() => {
    const handleMouseMove = (e) => {
      const drag = dragRef.current;
      if (!drag) return;

      e.stopPropagation();
      e.stopImmediatePropagation?.();
      e.preventDefault();

      const rect = drag.containerRect;
      if (!rect) return;

      // Compute new Y relative to the overlay container
      const newY = e.clientY - rect.top;
      drag.el.style.top = newY + 'px';
      drag.currentY = newY;

      // Live price preview during drag
      if (drag.yToPrice) {
        const previewPrice = drag.yToPrice(newY);
        const priceEl = drag.el.querySelector('[data-price]');
        if (priceEl && previewPrice > 0 && isFinite(previewPrice)) {
          priceEl.textContent = previewPrice.toLocaleString(undefined, { maximumFractionDigits: 2 });
        }
      }
    };

    const handleMouseUp = (e) => {
      const drag = dragRef.current;
      if (!drag) return;

      e.stopPropagation();
      e.stopImmediatePropagation?.();

      // Remove drag class
      const labelEl = drag.el.querySelector('[data-alert-label]');
      if (labelEl) labelEl.classList.remove('dragging');

      // Compute new price from y position using the captured yToPrice
      if (drag.currentY != null && drag.yToPrice) {
        const newPrice = drag.yToPrice(drag.currentY);
        if (newPrice > 0 && isFinite(newPrice)) {
          useAlertStore.getState().updateAlertPrice(drag.alertId, newPrice);
        }
      }

      // Keep dragRef alive briefly so the RAF tick doesn't snap back
      // before React re-renders with the updated alert price
      const dragId = drag.id;
      setTimeout(() => {
        if (dragRef.current && dragRef.current.id === dragId) {
          dragRef.current = null;
        }
      }, 100);

      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    // Use capture phase so our handlers fire BEFORE the chart's InputManager
    window.addEventListener('mousemove', handleMouseMove, true);
    window.addEventListener('mouseup', handleMouseUp, true);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove, true);
      window.removeEventListener('mouseup', handleMouseUp, true);
    };
  }, []);

  // ─── RAF loop: directly mutate DOM ────────────────────────
  const tick = useCallback(() => {
    const eng = engineRef?.current;
    const R = eng?.state?.lastRender;
    if (!R || !R.mainH || !R.p2y) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    const p2y = R.p2y;
    const currentPrice = useChartCoreStore.getState().aggregatedPrice || 0;

    // Read alerts from store directly to avoid stale closure data
    const freshAlerts = useAlertStore.getState().alerts.filter((a) => a.symbol === symbol);
    for (const alert of freshAlerts) {
      const id = alert.id || `${alert.price}-${alert.condition}`;
      const el = lineRefsMap.current.get(id);
      if (!el) continue;

      // Skip repositioning if this alert is being dragged
      if (dragRef.current && dragRef.current.id === id) continue;

      const price = alert.price;
      if (price == null || isNaN(price)) {
        el.style.display = 'none';
        continue;
      }

      const y = p2y(price);
      if (y < -20 || y > R.mainH + 20) {
        el.style.display = 'none';
        continue;
      }

      const isAbove = price >= currentPrice;
      const severity = getSeverity(price, currentPrice);
      const color = getSeverityColor(severity, isAbove);

      el.style.display = '';
      el.style.top = y + 'px';
      el.style.opacity = OPACITY[severity];

      // Update line style
      const lineEl = el.querySelector('[data-line]');
      if (lineEl) lineEl.style.borderTop = LINE_BORDER[severity](color);

      // Update label colors
      const labelEl = el.querySelector('[data-alert-label]');
      if (labelEl) {
        const bg =
          severity === 'urgent' ? `${color}18` : severity === 'warning' ? `${color}12` : 'rgba(255,255,255,0.04)';
        const bd =
          severity === 'urgent' ? `${color}40` : severity === 'warning' ? `${color}30` : 'rgba(255,255,255,0.08)';

        labelEl.style.background = bg;
        labelEl.style.borderColor = bd;
        labelEl.style.animation = severity === 'urgent' ? 'alertPulse 2.5s ease-in-out infinite' : 'none';

        // Icon color
        const iconEl = labelEl.querySelector('[data-bell]');
        if (iconEl) iconEl.style.color = color;

        // Price color
        const priceEl = labelEl.querySelector('[data-price]');
        if (priceEl) priceEl.style.color = color;
      }

      // Update distance badge
      const distEl = el.querySelector('[data-dist]');
      if (distEl && currentPrice > 0) {
        const distPct = Math.abs(((price - currentPrice) / currentPrice) * 100).toFixed(1);
        distEl.textContent = severity === 'urgent' ? `⚠ ${distPct}%` : `${distPct}%`;
        distEl.style.display = severity === 'info' ? 'none' : '';
        distEl.style.background = `${color}15`;
        distEl.style.color = color;
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [engineRef, symbol]);

  useEffect(() => {
    if (!alerts.length) return;
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [alerts, tick]);

  if (!alerts.length) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 60,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      <style>{OVERLAY_CSS}</style>

      {alerts.map((alert) => {
        const id = alert.id || `${alert.price}-${alert.condition}`;
        return (
          <div
            key={id}
            ref={(el) => {
              if (el) lineRefsMap.current.set(id, el);
              else lineRefsMap.current.delete(id);
            }}
            style={{
              position: 'absolute',
              top: -9999,
              left: 0,
              right: 0,
              height: 0,
              pointerEvents: 'auto',
              willChange: 'top',
            }}
          >
            {/* ── Dashed line ────────────────────────────── */}
            <div
              data-line="1"
              style={{
                width: '100%',
                height: 0,
                borderTop: '1px dotted rgba(255,255,255,0.15)',
              }}
            />

            {/* ── Frosted-glass capsule label ────────────── */}
            <div
              data-alert-label="1"
              onMouseDown={(e) => handleDragStart(e, alert)}
              style={{
                position: 'absolute',
                right: 0,
                top: -13,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 6px 3px 8px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: GLASS.blurSm,
                WebkitBackdropFilter: GLASS.blurSm,
                fontSize: 10,
                fontFamily: F,
                fontWeight: 600,
                color: '#787B86',
                whiteSpace: 'nowrap',
                cursor: 'grab',
                transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
                boxShadow: '0 1px 6px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.04)',
                animation: 'alertTagIn 0.25s ease-out both',
                userSelect: 'none',
              }}
              title={`${alert.note || `Alert: ${alert.condition} ${alert.price}`}\nDrag to reposition`}
            >
              {/* Bell icon */}
              <span data-bell="1" style={{ display: 'flex', alignItems: 'center', color: '#787B86' }}>
                <Icon name="bell" size={10} />
              </span>

              {/* Price */}
              <span
                data-price="1"
                style={{
                  fontFamily: M,
                  fontWeight: 700,
                  fontSize: 10,
                  letterSpacing: '-0.01em',
                  color: '#787B86',
                }}
              >
                {(alert.price || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>

              {/* Distance badge pill */}
              <span
                data-dist="1"
                style={{
                  fontSize: 8,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  padding: '1px 4px',
                  borderRadius: 6,
                  background: 'rgba(255,255,255,0.06)',
                  display: 'none',
                }}
              />

              {/* Note */}
              {alert.note && (
                <span
                  style={{
                    opacity: 0.6,
                    maxWidth: 70,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontSize: 9,
                    fontWeight: 500,
                  }}
                >
                  {alert.note}
                </span>
              )}

              {/* Expiry icon */}
              {alert.expiresAt && (
                <span style={{ fontSize: 8, opacity: 0.45, display: 'flex', alignItems: 'center' }}>⏰</span>
              )}

              {/* ── × Delete button (hover-reveal) ──── */}
              <button
                data-delete-btn="1"
                onMouseDown={(e) => e.stopPropagation()} // prevent drag
                onClick={(e) => handleDelete(e, alert.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.35)',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                  opacity: 0,
                  transition: 'opacity 0.15s, background 0.15s, color 0.15s',
                  padding: 0,
                  marginLeft: 1,
                  flexShrink: 0,
                  lineHeight: 1,
                }}
                title="Delete alert"
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default React.memo(AlertLinesOverlay);
