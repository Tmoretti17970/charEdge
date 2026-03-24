// ═══════════════════════════════════════════════════════════════════
// charEdge — Trade Heatmap Overlay (Phase 10)
//
// Renders community trade density as a heatmap alongside the chart.
// Color gradient (cool → hot) based on peer entry/exit concentration.
// Toggle layers for entries vs exits.
//
// Currently local-only — P2P broadcasting planned for Horizon 3.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useEffect } from 'react';
import { C } from '../../../constants.js';
import { getTradeHeatmapEngine } from '../../../data/engine/orderflow/TradeHeatmapEngine.js';
import st from './TradeHeatmap.module.css';

// ─── Color Gradient ─────────────────────────────────────────────

const HEATMAP_COLORS = [
  'rgba(30, 40, 80, 0.05)',   // cool (no activity)
  'rgba(50, 100, 200, 0.15)', // low
  'rgba(80, 180, 200, 0.30)', // medium-low
  'rgba(120, 220, 100, 0.45)', // medium
  'rgba(240, 200, 50, 0.55)', // medium-high
  'rgba(240, 120, 40, 0.70)', // high
  'rgba(240, 50, 50, 0.85)',  // very high
  'rgba(255, 30, 60, 0.95)',  // extreme
];

function densityColor(normalized) {
  const idx = Math.min(HEATMAP_COLORS.length - 1, Math.floor(normalized * HEATMAP_COLORS.length));
  return HEATMAP_COLORS[idx];
}

// ═══════════════════════════════════════════════════════════════════

/**
 * @param {{ symbol: string, priceMin?: number, priceMax?: number, height?: number }} props
 */
function TradeHeatmap({ symbol, priceMin, priceMax, _height = 400 }) {
  const [profile, setProfile] = useState(null);
  const [showEntries, setShowEntries] = useState(true);
  const [showExits, setShowExits] = useState(true);
  const [enabled, setEnabled] = useState(() => {
    // eslint-disable-next-line unused-imports/no-unused-vars
    try { return localStorage.getItem('tf-heatmap-enabled') === 'true'; } catch (_) { return false; }
  });

  const engine = getTradeHeatmapEngine();

  // Enable/disable engine opt-in
  useEffect(() => {
    engine.setOptIn(enabled);
    // eslint-disable-next-line unused-imports/no-unused-vars
    try { localStorage.setItem('tf-heatmap-enabled', String(enabled)); } catch (_) { /* storage may be blocked */ }
  }, [enabled, engine]);

  // Listen for heatmap updates
  useEffect(() => {
    const onUpdate = (e) => {
      if (e.detail?.symbol === symbol) {
        setProfile(engine.getProfile(symbol, priceMin, priceMax));
      }
    };
    engine.addEventListener('heatmap-update', onUpdate);

    // Load initial profile
    setProfile(engine.getProfile(symbol, priceMin, priceMax));

    return () => {
      engine.removeEventListener('heatmap-update', onUpdate);
    };
  }, [symbol, priceMin, priceMax, engine]);

  // If not enabled, show toggle
  if (!enabled) {
    return (
      <div style={{
        padding: '8px 12px', borderRadius: 8,
        background: C.sf, border: `1px solid ${C.bd}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, lineHeight: 1 }}>🔥</span>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--tf-font)', color: C.t1 }}>
              Trade Heatmap
            </div>
            <div style={{ fontSize: 9, fontFamily: 'var(--tf-mono)', color: C.t3, marginTop: 1 }}>
              See where traders are entering and exiting
            </div>
          </div>
        </div>
        <button
          className="tf-btn"
          onClick={() => setEnabled(true)}
          style={{
            padding: '4px 10px', borderRadius: 5,
            border: `1px solid ${C.b}30`, background: C.b + '12',
            color: C.b, fontSize: 9, fontWeight: 700, fontFamily: 'var(--tf-mono)',
            cursor: 'pointer',
          }}
        >
          Enable
        </button>
      </div>
    );
  }

  const bins = profile?.bins || [];

  return (
    <div style={{
      padding: '8px 12px', borderRadius: 8,
      background: C.sf, border: `1px solid ${C.bd}`,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, lineHeight: 1 }}>🔥</span>
          <span style={{
            fontSize: 8, fontWeight: 700, fontFamily: 'var(--tf-mono)', color: C.t3,
            letterSpacing: '0.05em', textTransform: 'uppercase',
          }}>
            Trade Heatmap
          </span>
          {profile?.totalEvents > 0 && (
            <span style={{ fontSize: 8, fontFamily: 'var(--tf-mono)', color: C.t3 }}>
              {profile.totalEvents} trades
            </span>
          )}
        </div>

        {/* Layer toggles */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setShowEntries(!showEntries)}
            style={{
              padding: '2px 6px', borderRadius: 3,
              border: `1px solid ${showEntries ? C.g + '60' : C.bd}`,
              background: showEntries ? C.g + '15' : 'transparent',
              color: showEntries ? C.g : C.t3,
              fontSize: 8, fontWeight: 600, fontFamily: 'var(--tf-mono)',
              cursor: 'pointer',
            }}
          >
            Entries
          </button>
          <button
            onClick={() => setShowExits(!showExits)}
            style={{
              padding: '2px 6px', borderRadius: 3,
              border: `1px solid ${showExits ? C.r + '60' : C.bd}`,
              background: showExits ? C.r + '15' : 'transparent',
              color: showExits ? C.r : C.t3,
              fontSize: 8, fontWeight: 600, fontFamily: 'var(--tf-mono)',
              cursor: 'pointer',
            }}
          >
            Exits
          </button>
          <button
            onClick={() => setEnabled(false)}
            title="Disable"
            style={{
              padding: '2px 4px', borderRadius: 3,
              border: 'none', background: 'transparent',
              color: C.t3, fontSize: 8, cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Heatmap bars */}
      {bins.length === 0 ? (
        <div style={{
          padding: '16px 0', textAlign: 'center',
          fontSize: 9, fontFamily: 'var(--tf-mono)', color: C.t3,
        }}>
          Waiting for trade data…
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {bins.slice().reverse().map((bin, i) => {
            const entryW = showEntries && bin.entries > 0 ? (bin.entries / (bin.total || 1)) * bin.normalized * 100 : 0;
            const exitW = showExits && bin.exits > 0 ? (bin.exits / (bin.total || 1)) * bin.normalized * 100 : 0;

            return (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  height: 10,
                }}
                title={`$${bin.priceMid.toFixed(2)} — ${bin.entries} entries, ${bin.exits} exits`}
              >
                {/* Price label */}
                <span style={{
                  width: 50, fontSize: 7, fontFamily: 'var(--tf-mono)', color: C.t3,
                  textAlign: 'right', flexShrink: 0,
                }}>
                  {bin.priceMid.toFixed(2)}
                </span>
                {/* Density bar */}
                <div style={{
                  flex: 1, height: 8, borderRadius: 2,
                  background: C.bg2 + '40', overflow: 'hidden',
                  display: 'flex',
                }}>
                  {showEntries && entryW > 0 && (
                    <div style={{
                      width: `${entryW}%`, height: '100%',
                      background: densityColor(bin.normalized),
                      borderRight: `1px solid ${C.g}40`,
                    }} />
                  )}
                  {showExits && exitW > 0 && (
                    <div style={{
                      width: `${exitW}%`, height: '100%',
                      background: C.r + '60',
                    }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Hot zone callout */}
      {profile?.hotZone && profile.hotZone.density > 0.5 && (
        <div style={{
          marginTop: 6, padding: '4px 8px', borderRadius: 4,
          background: C.y + '12', border: `1px solid ${C.y}30`,
          fontSize: 9, fontFamily: 'var(--tf-mono)', color: C.y,
          textAlign: 'center',
        }}>
          🎯 Hot zone: ${profile.hotZone.price.toFixed(2)}
        </div>
      )}
    </div>
  );
}

export default React.memo(TradeHeatmap);
