// Section 2: Overnight Movers for Morning Briefing
import { C, F, M } from '@/constants.js';
import { formatDisplayPrice as formatPrice } from '../../../../shared/formatting';
import { alpha } from '@/shared/colorUtils';

export default function OvernightMovers({ movers }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {movers.map((m) => {
        const isUp = m.direction === 'up';
        return (
          <div
            key={m.symbol}
            style={{
              flex: '1 1 auto',
              minWidth: 100,
              padding: '10px 12px',
              background: alpha(isUp ? C.g : C.r, 0.06),
              border: `1px solid ${alpha(isUp ? C.g : C.r, 0.15)}`,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: F }}>
                {m.symbol}
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, color: isUp ? C.g : C.r, fontFamily: M }}>
                {isUp ? '+' : ''}{m.change.toFixed(1)}%
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.t3, fontFamily: M }}>
              {formatPrice(m.price)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
