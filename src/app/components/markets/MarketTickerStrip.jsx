// ═══════════════════════════════════════════════════════════════════
// charEdge — Market Ticker Strip
//
// Apple-style glass-morphism header showing key market indices,
// futures, commodities, and market status at a glance.
//
// Auto-switches between indices (market hours) and futures (off hours).
// Uses existing QuoteService + marketHours.ts infrastructure.
// ═══════════════════════════════════════════════════════════════════

import { memo, useEffect, useState, useCallback, useRef } from 'react';
import { C, F, M } from '../../../constants.js';
import { isMarketOpen, isExtendedHours, getMarketStatus } from '../../../shared/marketHours.ts';
import styles from './MarketTickerStrip.module.css';

// ─── Ticker definitions ──────────────────────────────────────────

const INDICES = [
  { symbol: '^GSPC', label: 'S&P 500', short: 'SPX' },
  { symbol: '^IXIC', label: 'NASDAQ', short: 'NDX' },
  { symbol: '^DJI', label: 'DOW', short: 'DOW' },
  { symbol: '^RUT', label: 'Russell 2K', short: 'RUT' },
];

const FUTURES = [
  { symbol: 'ES=F', label: 'S&P Futures', short: 'ES' },
  { symbol: 'NQ=F', label: 'NQ Futures', short: 'NQ' },
  { symbol: 'YM=F', label: 'Dow Futures', short: 'YM' },
  { symbol: 'RTY=F', label: 'Russell Futures', short: 'RTY' },
];

const MACRO = [
  { symbol: '^VIX', label: 'VIX', short: 'VIX', isFear: true },
  { symbol: '^TNX', label: '10Y Yield', short: '10Y', isBond: true },
  { symbol: 'GC=F', label: 'Gold', short: 'GOLD' },
  { symbol: 'CL=F', label: 'Crude Oil', short: 'OIL' },
  { symbol: 'BTCUSDT', label: 'Bitcoin', short: 'BTC' },
];

// ─── Fetch quotes via QuoteService ──────────────────────────────

async function fetchStripQuotes(symbols) {
  try {
    const { batchGetQuotes } = await import('../../../data/QuoteService.js');
    const quotes = await batchGetQuotes(symbols);
    return quotes || {};
  } catch {
    return {};
  }
}

// ─── Mini Sparkline (tiny inline SVG) ───────────────────────────

function TinySparkline({ data, isUp }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 40, h = 16;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 2) - 1;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={styles.sparkline}>
      <polyline
        points={points}
        fill="none"
        stroke={isUp ? 'var(--tf-green, #34C759)' : 'var(--tf-red, #FF3B30)'}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Single Ticker Item ─────────────────────────────────────────

const TickerItem = memo(function TickerItem({ label, short, price, change, sparkData, isFear, isBond }) {
  const isUp = (change || 0) >= 0;
  // VIX: high = fear (red), low = calm (green) — inverted
  const changeColor = isFear
    ? (change >= 0 ? 'var(--tf-red, #FF3B30)' : 'var(--tf-green, #34C759)')
    : (isUp ? 'var(--tf-green, #34C759)' : 'var(--tf-red, #FF3B30)');

  const fmtPrice = (p) => {
    if (p == null) return '—';
    if (isBond) return p.toFixed(3) + '%';
    if (p >= 10000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (p >= 100) return p.toLocaleString('en-US', { maximumFractionDigits: 1 });
    if (p >= 1) return '$' + p.toFixed(2);
    return '$' + p.toFixed(4);
  };

  const fmtChange = (c) => {
    if (c == null) return '';
    const sign = c >= 0 ? '+' : '';
    return `${sign}${c.toFixed(2)}%`;
  };

  return (
    <div className={styles.tickerItem}>
      <span className={styles.tickerLabel}>{short}</span>
      <div className={styles.tickerData}>
        <span className={styles.tickerPrice}>{fmtPrice(price)}</span>
        {change != null && (
          <span className={styles.tickerChange} style={{ color: changeColor }}>
            {isUp && !isFear ? '▲' : (!isUp && !isFear) ? '▼' : ''}
            {' '}{fmtChange(change)}
          </span>
        )}
      </div>
      <TinySparkline data={sparkData} isUp={isFear ? !isUp : isUp} />
    </div>
  );
});

// ─── Market Status Badge ────────────────────────────────────────

function MarketStatusBadge() {
  const [status, setStatus] = useState(() => getMarketStatus());
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    const tick = () => {
      setStatus(getMarketStatus());
      // Simple countdown logic
      if (isMarketOpen()) {
        // Time until 4:00 PM ET close
        const now = new Date();
        const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit' });
        const [h, m] = etStr.split(':').map(Number);
        const minsLeft = (16 * 60) - (h * 60 + m);
        if (minsLeft > 0) {
          const hrs = Math.floor(minsLeft / 60);
          const mins = minsLeft % 60;
          setCountdown(hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`);
        }
      } else {
        setCountdown('');
      }
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  const dotColor = status === 'Market Open'
    ? 'var(--tf-green, #34C759)'
    : status === 'Extended Hours'
      ? 'var(--tf-yellow, #f0b64e)'
      : 'var(--tf-t3, #4e5266)';

  return (
    <div className={styles.statusBadge}>
      <span className={styles.statusDotPulse} style={{ '--dot-color': dotColor }} />
      <span className={styles.statusLabel}>{status}</span>
      {countdown && <span className={styles.statusCountdown}>· Closes in {countdown}</span>}
    </div>
  );
}

// ─── Main Strip ─────────────────────────────────────────────────

export default memo(function MarketTickerStrip() {
  const [quotes, setQuotes] = useState({});
  const [isOpen, setIsOpen] = useState(() => isMarketOpen());
  const timerRef = useRef(null);

  const refresh = useCallback(async () => {
    const open = isMarketOpen();
    setIsOpen(open);

    // Pick primary tickers based on market status
    const primary = open ? INDICES : FUTURES;
    const allSymbols = [...primary, ...MACRO].map(t => t.symbol);

    const q = await fetchStripQuotes(allSymbols);
    setQuotes(q);
  }, []);

  useEffect(() => {
    refresh();
    timerRef.current = setInterval(refresh, 60_000); // Refresh every 60s
    return () => clearInterval(timerRef.current);
  }, [refresh]);

  const primary = isOpen ? INDICES : FUTURES;

  return (
    <div className={styles.strip}>
      {/* Market Status */}
      <MarketStatusBadge />

      {/* Divider */}
      <div className={styles.divider} />

      {/* Primary indices or futures */}
      <div className={styles.tickerGroup}>
        <span className={styles.groupLabel}>{isOpen ? 'Indices' : 'Futures'}</span>
        <div className={styles.tickers}>
          {primary.map(t => {
            const q = quotes[t.symbol];
            return (
              <TickerItem
                key={t.symbol}
                label={t.label}
                short={t.short}
                price={q?.price || q?.lastPrice}
                change={q?.changePct ?? q?.priceChangePercent}
              />
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className={styles.divider} />

      {/* Macro indicators */}
      <div className={styles.tickerGroup}>
        <span className={styles.groupLabel}>Macro</span>
        <div className={styles.tickers}>
          {MACRO.map(t => {
            const q = quotes[t.symbol];
            return (
              <TickerItem
                key={t.symbol}
                label={t.label}
                short={t.short}
                price={q?.price || q?.lastPrice}
                change={q?.changePct ?? q?.priceChangePercent}
                isFear={t.isFear}
                isBond={t.isBond}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
});
