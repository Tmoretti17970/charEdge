// ═══════════════════════════════════════════════════════════════════
// charEdge — Intel Skeleton Components
//
// Shimmer loading placeholders for Intel page sections.
// Apple-style with subtle pulse animation.
// ═══════════════════════════════════════════════════════════════════

import s from './IntelSkeleton.module.css';

/** Generic shimmer bar */
function Shimmer({ width = '100%', height = 14, radius = 6, style }) {
  return <div className={s.shimmer} style={{ width, height, borderRadius: radius, ...style }} />;
}

/** Pulse Hero skeleton */
export function PulseSkeleton() {
  return (
    <div className={s.pulseWrap}>
      <div className={s.pulseMetrics}>
        <div className={s.pulseCard}>
          <Shimmer width={90} height={11} />
          <Shimmer width={120} height={22} style={{ marginTop: 8 }} />
          <Shimmer width={160} height={11} style={{ marginTop: 6 }} />
        </div>
        <div className={s.pulseCard} style={{ alignItems: 'center' }}>
          <Shimmer width={90} height={11} />
          <div className={s.pulseRing} />
          <Shimmer width={50} height={11} />
        </div>
        <div className={s.pulseCard}>
          <Shimmer width={70} height={11} />
          <Shimmer width={80} height={28} style={{ marginTop: 8 }} />
          <Shimmer width={50} height={13} style={{ marginTop: 6 }} />
        </div>
      </div>
      <Shimmer width="100%" height={38} radius={10} style={{ marginTop: 16 }} />
    </div>
  );
}

/** Prediction card skeleton */
export function PredictionCardSkeleton() {
  return (
    <div className={s.predCard}>
      <div className={s.predRing} />
      <div className={s.predContent}>
        <Shimmer width="85%" height={14} />
        <div className={s.predMeta}>
          <Shimmer width={40} height={11} />
          <Shimmer width={45} height={11} />
          <Shimmer width={40} height={11} />
        </div>
      </div>
    </div>
  );
}

/** Prediction section skeleton (multiple cards) */
export function PredictionsSkeleton() {
  return (
    <div className={s.predList}>
      {[1, 2, 3, 4].map((i) => (
        <PredictionCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Generic row skeleton for feed-like sections */
export function FeedRowSkeleton({ count = 4 }) {
  return (
    <div className={s.feedList}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={s.feedRow}>
          <Shimmer width={50} height={14} />
          <Shimmer width="60%" height={14} />
          <Shimmer width={60} height={14} />
        </div>
      ))}
    </div>
  );
}

export { Shimmer };
