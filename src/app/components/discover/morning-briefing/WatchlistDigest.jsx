// Section 1: Watchlist Digest for Morning Briefing
import { C, F, M } from '../../../../constants.js';
import { formatDisplayPrice as formatPrice } from '../../../../shared/formatting';
import { SignalDot, NewsSentimentDot } from './briefingHelpers.jsx';
import { alpha } from '@/shared/colorUtils';

export default function WatchlistDigest({ items }) {
  if (!items || items.length === 0) {
    return (
      <div style={{ padding: '12px 0', textAlign: 'center', color: C.t3, fontSize: 12, fontFamily: F }}>
        Add symbols to your watchlist to see personalized insights here
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item) => (
        <WatchlistCard key={item.symbol} item={item} />
      ))}
    </div>
  );
}

function WatchlistCard({ item }) {
  const isUp = item.change >= 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 12px',
        background: alpha(C.bg2, 0.6),
        borderRadius: 10,
        border: `1px solid ${alpha(C.bd, 0.3)}`,
        transition: 'all 0.15s ease',
      }}
    >
      {/* Symbol + Price */}
      <div style={{ minWidth: 90 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>
            {item.symbol}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: isUp ? C.g : C.r,
              fontFamily: M,
            }}
          >
            {isUp ? '▲' : '▼'} {Math.abs(item.change).toFixed(1)}%
          </span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.t1, fontFamily: M }}>
          {formatPrice(item.price)}
        </div>
      </div>

      {/* Pattern / Signal */}
      {item.pattern && (
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <SignalDot signal={item.pattern.signal} />
            <span style={{ fontSize: 11, fontWeight: 600, color: C.t2, fontFamily: F }}>
              {item.pattern.pattern}
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: C.t3,
              fontFamily: F,
              lineHeight: 1.4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.pattern.description}
          </div>
        </div>
      )}

      {/* Key Levels */}
      {item.keyLevels && !item.pattern && (
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 12, fontSize: 10, fontFamily: M, color: C.t3 }}>
            <span>
              S: <span style={{ color: C.r }}>{formatPrice(item.keyLevels.support[0])}</span>
            </span>
            <span>
              R: <span style={{ color: C.g }}>{formatPrice(item.keyLevels.resistance[0])}</span>
            </span>
          </div>
        </div>
      )}

      {/* News headline (if any) */}
      {item.news.length > 0 && (
        <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
          <div
            style={{
              fontSize: 10,
              color: C.t3,
              fontFamily: F,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <NewsSentimentDot sentiment={item.news[0].sentiment} />
            {' '}{item.news[0].headline}
          </div>
          <div style={{ fontSize: 9, color: C.t3, fontFamily: M, marginTop: 2 }}>
            {item.news[0].source}
          </div>
        </div>
      )}
    </div>
  );
}
