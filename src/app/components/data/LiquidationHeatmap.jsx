// ═══════════════════════════════════════════════════════════════════
// charEdge v15 — Liquidation Heatmap
//
// Chart overlay that visualizes where liquidations are likely to
// cluster based on Open Interest distribution and leverage ratios.
//
// Models liquidation cascade zones:
//   • Estimates leveraged long liquidation prices using common leverage ratios
//   • Estimates leveraged short liquidation prices
//   • Shows real-time liquidation events from Binance + Bybit
//   • Color-coded by estimated liquidation volume
//
// Usage:
//   <LiquidationHeatmap symbol="BTCUSDT" currentPrice={65000} />
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { F, M } from '../../../constants.js';
import { binanceFuturesAdapter } from '../../../data/adapters/BinanceFuturesAdapter.js';
import { bybitFuturesAdapter } from '../../../data/adapters/BybitFuturesAdapter.js';
import { logger } from '@/observability/logger';

// ─── Constants ─────────────────────────────────────────────────

const LEVERAGE_RATIOS = [3, 5, 10, 25, 50, 100]; // Common leverage tiers
const _ZONE_COUNT = 20; // Number of price zones to show

// ─── Helpers ───────────────────────────────────────────────────

function fmtNum(n) {
  if (n == null || isNaN(n)) return '—';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}

function fmtPrice(n) {
  if (n == null) return '—';
  if (n >= 1000) return n.toFixed(0);
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

/**
 * Estimate liquidation zones based on current price, OI, and leverage.
 * At leverage X, a long entry at `price` gets liquidated at:
 *   price * (1 - 1/X)
 * And a short entry gets liquidated at:
 *   price * (1 + 1/X)
 */
function computeLiquidationZones(currentPrice, oiValue) {
  if (!currentPrice || !oiValue) return { longZones: [], shortZones: [] };

  const longZones = [];
  const shortZones = [];

  // Estimate OI distribution across leverage tiers
  // Assume an exponential distribution: most OI is at lower leverage
  const leverageWeights = LEVERAGE_RATIOS.map((lev, i) => ({
    leverage: lev,
    weight: Math.exp(-i * 0.5), // Exponential decay
  }));
  const totalWeight = leverageWeights.reduce((s, w) => s + w.weight, 0);

  for (const { leverage, weight } of leverageWeights) {
    const oiShare = (oiValue * weight) / totalWeight;
    const longLiqPrice = currentPrice * (1 - 1 / leverage);
    const shortLiqPrice = currentPrice * (1 + 1 / leverage);

    // Spread OI across a zone rather than a single price
    const zoneWidth = currentPrice * 0.002; // ±0.2% zone

    longZones.push({
      price: longLiqPrice,
      priceHigh: longLiqPrice + zoneWidth,
      priceLow: longLiqPrice - zoneWidth,
      leverage,
      estimatedLiquidations: oiShare / 2, // Half the OI is long
      type: 'long',
      distancePct: ((currentPrice - longLiqPrice) / currentPrice * 100).toFixed(1),
    });

    shortZones.push({
      price: shortLiqPrice,
      priceHigh: shortLiqPrice + zoneWidth,
      priceLow: shortLiqPrice - zoneWidth,
      leverage,
      estimatedLiquidations: oiShare / 2, // Half the OI is short
      type: 'short',
      distancePct: ((shortLiqPrice - currentPrice) / currentPrice * 100).toFixed(1),
    });
  }

  return { longZones, shortZones };
}

// ─── Heatmap Bar ───────────────────────────────────────────────

function HeatmapBar({ zone, maxValue, side }) {
  const pct = maxValue > 0 ? (zone.estimatedLiquidations / maxValue) : 0;
  const isLong = side === 'long';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '3px 0',
    }}>
      <span style={{
        fontSize: 9, fontFamily: M, color: 'var(--tf-t3, #888)',
        width: 24, textAlign: 'right',
      }}>
        {zone.leverage}×
      </span>
      <span style={{
        fontSize: 10, fontFamily: M, color: 'var(--tf-t1, #fff)',
        width: 60, fontWeight: 600,
      }}>
        ${fmtPrice(zone.price)}
      </span>
      <div style={{
        flex: 1, height: 12, borderRadius: 3,
        background: 'var(--tf-bd, #2a2d36)', overflow: 'hidden',
        position: 'relative',
      }}>
        <div style={{
          width: `${Math.max(2, pct * 100)}%`,
          height: '100%',
          borderRadius: 3,
          background: isLong
            ? `linear-gradient(90deg, #ef444420, #ef4444${Math.round(30 + pct * 70).toString(16).padStart(2, '0')})`
            : `linear-gradient(90deg, #22c55e20, #22c55e${Math.round(30 + pct * 70).toString(16).padStart(2, '0')})`,
          transition: 'width 0.5s ease',
        }} />
      </div>
      <span style={{
        fontSize: 9, fontFamily: M,
        color: isLong ? '#ef4444' : '#22c55e',
        width: 45, textAlign: 'right',
      }}>
        ${fmtNum(zone.estimatedLiquidations)}
      </span>
      <span style={{
        fontSize: 8, fontFamily: M, color: 'var(--tf-t3, #888)',
        width: 30, textAlign: 'right',
      }}>
        {zone.distancePct}%
      </span>
    </div>
  );
}

// ─── Recent Liquidation Flash ──────────────────────────────────

function LiquidationFlash({ events }) {
  if (!events?.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 70, overflowY: 'auto' }}>
      {events.slice(0, 5).map((ev, i) => {
        const isLong = ev.side === 'sell' || ev.type === 'long_liquidation';
        const value = (ev.price || 0) * (ev.quantity || ev.qty || 0);
        return (
          <div key={`${ev.time || ev.timestamp}-${i}`} style={{
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontFamily: M,
            padding: '2px 6px', borderRadius: 4,
            background: `${isLong ? '#ef4444' : '#22c55e'}08`,
            animation: i === 0 ? 'fadeIn 0.3s ease' : undefined,
          }}>
            <span style={{ fontSize: 10 }}>{isLong ? '🔴' : '🟢'}</span>
            <span style={{ color: 'var(--tf-t1, #fff)', fontWeight: 600 }}>${fmtNum(value)}</span>
            <span style={{ color: 'var(--tf-t3, #888)' }}>@{fmtPrice(ev.price)}</span>
            <span style={{ color: 'var(--tf-t3, #888)', marginLeft: 'auto', fontSize: 8 }}>
              {ev.exchange === 'bybit' ? 'BY' : 'BN'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────

function LiquidationHeatmap({ symbol = 'BTCUSDT', currentPrice }) {
  const [oiData, setOiData] = useState(null);
  const [liquidationEvents, setLiquidationEvents] = useState([]);
  const [price, setPrice] = useState(currentPrice);
  const unsubs = useRef([]);

  // Fetch OI data
  const fetchOI = useCallback(async () => {
    try {
      const [binOI, bybitOI] = await Promise.allSettled([
        binanceFuturesAdapter.fetchOpenInterest(symbol),
        bybitFuturesAdapter.getOpenInterest(symbol),
      ]);

      const binValue = binOI.status === 'fulfilled' ? (binOI.value?.openInterest || 0) * (currentPrice || price || 1) : 0;
      const bybitValue = bybitOI.status === 'fulfilled' ? (bybitOI.value?.openInterest || 0) * (currentPrice || price || 1) : 0;

      setOiData({
        binance: binOI.value,
        bybit: bybitOI.value,
        totalOIValue: binValue + bybitValue,
      });
    } catch (e) { logger.ui.warn('Operation failed', e); }
  }, [symbol, currentPrice, price]);

  useEffect(() => {
    setPrice(currentPrice);
    fetchOI();
    const timer = setInterval(fetchOI, 30000);

    // Subscribe to liquidation feeds
    const binUnsub = binanceFuturesAdapter.subscribeLiquidations((liq) => {
      if (liq.symbol?.toUpperCase().includes(symbol.replace('USDT', ''))) {
        setLiquidationEvents(prev => [{ ...liq, exchange: 'binance' }, ...prev].slice(0, 20));
      }
    });
    unsubs.current.push(binUnsub);

    const bybitUnsub = bybitFuturesAdapter.subscribeLiquidations(symbol, (liq) => {
      setLiquidationEvents(prev => [{ ...liq, exchange: 'bybit' }, ...prev].slice(0, 20));
    });
    unsubs.current.push(bybitUnsub);

    return () => {
      clearInterval(timer);
      for (const u of unsubs.current) { try { u(); } catch (e) { logger.ui.warn('Operation failed', e); } }
      unsubs.current = [];
    };
  }, [symbol, currentPrice, fetchOI]);

  const effectivePrice = currentPrice || price || 0;
  const zones = computeLiquidationZones(effectivePrice, oiData?.totalOIValue || 0);
  const maxLiq = Math.max(
    ...zones.longZones.map(z => z.estimatedLiquidations),
    ...zones.shortZones.map(z => z.estimatedLiquidations),
    1,
  );

  return (
    <div style={{
      padding: 14, fontFamily: F,
      display: 'flex', flexDirection: 'column', gap: 10,
      height: '100%', overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--tf-t1, #fff)' }}>
            🔥 Liquidation Map — {symbol.replace('USDT', '')}
          </div>
          <div style={{ fontSize: 10, color: 'var(--tf-t3, #888)', marginTop: 1 }}>
            Current: ${fmtPrice(effectivePrice)} · Total OI: ${fmtNum(oiData?.totalOIValue || 0)}
          </div>
        </div>
      </div>

      {/* Short Liquidation Zones (above current price) */}
      <div style={{
        background: 'var(--tf-sf, #1a1d26)', border: '1px solid var(--tf-bd, #2a2d36)',
        borderRadius: 10, padding: '10px 12px',
      }}>
        <div style={{
          fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
          color: '#22c55e', marginBottom: 6, letterSpacing: '0.5px',
        }}>
          ▲ Short Liquidation Zones (above price)
        </div>
        {zones.shortZones.length > 0 ? (
          zones.shortZones.slice().reverse().map((z, i) => (
            <HeatmapBar key={`short-${i}`} zone={z} maxValue={maxLiq} side="short" />
          ))
        ) : (
          <div style={{ fontSize: 10, color: 'var(--tf-t3, #888)', textAlign: 'center', padding: 8 }}>
            No data yet
          </div>
        )}
      </div>

      {/* Current Price Marker */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', borderRadius: 8,
        background: 'linear-gradient(90deg, #6366f120, transparent)',
        border: '1px solid #6366f140',
      }}>
        <span style={{ fontSize: 12 }}>📍</span>
        <span style={{ fontSize: 12, fontFamily: M, fontWeight: 800, color: '#6366f1' }}>
          ${fmtPrice(effectivePrice)}
        </span>
        <span style={{ fontSize: 10, color: 'var(--tf-t3, #888)' }}>Current Price</span>
      </div>

      {/* Long Liquidation Zones (below current price) */}
      <div style={{
        background: 'var(--tf-sf, #1a1d26)', border: '1px solid var(--tf-bd, #2a2d36)',
        borderRadius: 10, padding: '10px 12px',
      }}>
        <div style={{
          fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
          color: '#ef4444', marginBottom: 6, letterSpacing: '0.5px',
        }}>
          ▼ Long Liquidation Zones (below price)
        </div>
        {zones.longZones.length > 0 ? (
          zones.longZones.map((z, i) => (
            <HeatmapBar key={`long-${i}`} zone={z} maxValue={maxLiq} side="long" />
          ))
        ) : (
          <div style={{ fontSize: 10, color: 'var(--tf-t3, #888)', textAlign: 'center', padding: 8 }}>
            No data yet
          </div>
        )}
      </div>

      {/* Recent Liquidation Events */}
      {liquidationEvents.length > 0 && (
        <div style={{
          background: 'var(--tf-sf, #1a1d26)', border: '1px solid var(--tf-bd, #2a2d36)',
          borderRadius: 10, padding: '10px 12px',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
            color: 'var(--tf-t3, #888)', marginBottom: 6,
          }}>
            ⚡ Recent Liquidations
          </div>
          <LiquidationFlash events={liquidationEvents} />
        </div>
      )}
    </div>
  );
}

export default React.memo(LiquidationHeatmap);
