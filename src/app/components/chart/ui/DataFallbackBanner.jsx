// ═══════════════════════════════════════════════════════════════════
// charEdge — Data Fallback Banner
//
// Shows when all data providers fail and the chart displays cached/
// stale data or no data at all. Provides:
//   • Which providers were attempted
//   • How old the cached data is (if any)
//   • A Retry button to re-trigger fetch
//   • A dismiss button
//
// Usage:
//   <DataFallbackBanner
//     symbol="BTCUSDT"
//     tfId="1D"
//     dataSource="cached"
//     onRetry={() => fetchOHLC(symbol, tfId)}
//   />
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { cacheManager } from '../../../../data/engine/infra/CacheManager.js';

// ─── Helpers ───────────────────────────────────────────────────

function formatAge(ms) {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${(ms / 3_600_000).toFixed(1)}h`;
  return `${(ms / 86_400_000).toFixed(1)}d`;
}

// ─── Styles ────────────────────────────────────────────────────

const styles = {
  banner: {
    position: 'absolute',
    top: 8,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 16px',
    borderRadius: 8,
    fontSize: 12,
    fontFamily: '"Inter", system-ui, sans-serif',
    backdropFilter: 'blur(12px)',
    maxWidth: '90%',
    animation: 'scaleInSm 0.3s ease-out',
  },
  warning: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    border: '1px solid rgba(249, 115, 22, 0.3)',
    color: '#fb923c',
  },
  error: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#f87171',
  },
  icon: {
    fontSize: 16,
    flexShrink: 0,
  },
  message: {
    flex: 1,
    lineHeight: 1.4,
  },
  ageText: {
    opacity: 0.8,
    fontSize: 11,
  },
  retryBtn: {
    padding: '4px 12px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    color: 'inherit',
    whiteSpace: 'nowrap',
    transition: 'background-color 0.15s',
  },
  dismissBtn: {
    padding: 0,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: 'inherit',
    opacity: 0.6,
    fontSize: 16,
    lineHeight: 1,
    transition: 'opacity 0.15s',
  },
};

// ─── Component ─────────────────────────────────────────────────

export default function DataFallbackBanner({ symbol, tfId, dataSource, onRetry }) {
  const [dismissed, setDismissed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [cacheAge, setCacheAge] = useState(null);

  // Reset dismissed state when symbol or tf changes
  useEffect(() => {
    setDismissed(false);
    setRetrying(false);
  }, [symbol, tfId]);

  // Get cache age
  useEffect(() => {
    const info = cacheManager.getLastUpdate(symbol, tfId);
    setCacheAge(info?.ageMs ?? null);
  }, [symbol, tfId, dataSource]);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    try {
      await onRetry?.();
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      // retry failed — user can try again
    } finally {
      setTimeout(() => setRetrying(false), 2000);
    }
  }, [onRetry]);

  // Don't show if dismissed or data is fresh
  if (dismissed) return null;
  if (!dataSource || (dataSource !== 'cached' && dataSource !== 'no_data' && dataSource !== 'none')) return null;

  const isNoData = dataSource === 'no_data' || dataSource === 'none';
  const bannerStyle = isNoData ? styles.error : styles.warning;

  return (
    <>
      <div style={{ ...styles.banner, ...bannerStyle }}>
        <span style={styles.icon}>{isNoData ? '⚠️' : '📦'}</span>

        <div style={styles.message}>
          {isNoData ? (
            <>
              <strong>No data available</strong> for {symbol}.
              <br />
              <span style={styles.ageText}>All providers failed. Check your connection or API keys.</span>
            </>
          ) : (
            <>
              <strong>Showing cached data</strong> for {symbol}.
              {cacheAge != null && (
                <span style={styles.ageText}> Data is {formatAge(cacheAge)} old.</span>
              )}
            </>
          )}
        </div>

        <button
          style={styles.retryBtn}
          onClick={handleRetry}
          disabled={retrying}
          onMouseOver={(e) => { e.target.style.backgroundColor = 'rgba(255,255,255,0.25)'; }}
          onMouseOut={(e) => { e.target.style.backgroundColor = 'rgba(255,255,255,0.15)'; }}
        >
          {retrying ? '⟳ Retrying…' : '↻ Retry'}
        </button>

        <button
          style={styles.dismissBtn}
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          onMouseOver={(e) => { e.target.style.opacity = '1'; }}
          onMouseOut={(e) => { e.target.style.opacity = '0.6'; }}
        >
          ✕
        </button>
      </div>

    </>
  );
}
