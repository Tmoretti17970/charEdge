// Collapsible Section Wrapper for Morning Briefing
import { C, F, M } from '../../../../constants.js';
import { alpha } from '@/shared/colorUtils';

export default function BriefingSection({ title, icon, count, expanded, onToggle, accent, children }) {
  return (
    <div
      style={{
        background: accent ? alpha(C.b, 0.04) : alpha(C.sf, 0.5),
        borderRadius: 12,
        border: `1px solid ${accent ? alpha(C.b, 0.12) : alpha(C.bd, 0.5)}`,
        overflow: 'hidden',
        transition: 'all 0.2s ease',
      }}
    >
      <button
        onClick={onToggle}
        className="tf-btn"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15 }}>{icon}</span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: C.t1,
              fontFamily: F,
            }}
          >
            {title}
          </span>
          {count !== undefined && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: C.t3,
                background: alpha(C.t3, 0.1),
                padding: '2px 6px',
                borderRadius: 4,
                fontFamily: M,
              }}
            >
              {count}
            </span>
          )}
        </div>
        <span
          style={{
            fontSize: 11,
            color: C.t3,
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          ▾
        </span>
      </button>

      {expanded && (
        <div
          style={{
            padding: '0 16px 14px',
            animation: 'tfSubTabsIn 0.2s ease forwards',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
