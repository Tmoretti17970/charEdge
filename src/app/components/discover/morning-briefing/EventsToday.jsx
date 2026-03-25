// Section 3: Events Today for Morning Briefing
import { C } from '@/constants.js';
import { alpha } from '@/shared/colorUtils';

export default function EventsToday({ events }) {
  const impactColors = { high: C.r, medium: C.y, low: C.g };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {events.map((evt, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 10px',
            background: alpha(C.bg2, 0.5),
            borderRadius: 8,
            borderLeft: `3px solid ${impactColors[evt.impact] || C.t3}`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.t2,
              fontFamily: 'var(--tf-mono)',
              minWidth: 44,
            }}
          >
            {evt.time}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.t1, fontFamily: 'var(--tf-font)' }}>
                {evt.event}
              </span>
              <span
                style={{
                  fontSize: 8,
                  fontWeight: 700,
                  color: impactColors[evt.impact],
                  background: alpha(impactColors[evt.impact] || C.t3, 0.12),
                  padding: '2px 5px',
                  borderRadius: 3,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  fontFamily: 'var(--tf-font)',
                }}
              >
                {evt.impact}
              </span>
              <span style={{ fontSize: 9, color: C.t3, fontFamily: 'var(--tf-mono)' }}>{evt.country}</span>
            </div>
          </div>
          <div
            style={{ display: 'flex', gap: 10, fontSize: 10, fontFamily: 'var(--tf-mono)', color: C.t3, flexShrink: 0 }}
          >
            {evt.previous !== '—' && (
              <span>
                Prev: <span style={{ color: C.t2 }}>{evt.previous}</span>
              </span>
            )}
            {evt.forecast !== '—' && (
              <span>
                Est: <span style={{ color: C.t2 }}>{evt.forecast}</span>
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
