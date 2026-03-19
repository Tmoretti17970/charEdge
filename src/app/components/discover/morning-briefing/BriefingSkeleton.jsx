// Skeleton Loader for Morning Briefing
import { C } from '@/constants.js';
import { alpha } from '@/shared/colorUtils';

export default function BriefingSkeleton() {
  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${alpha(C.b, 0.04)}, ${alpha(C.p, 0.03)})`,
        border: `1px solid ${alpha(C.b, 0.12)}`,
        borderRadius: 18,
        padding: 24,
        marginBottom: 24,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div
          className="tf-skeleton-pulse"
          style={{ width: 24, height: 24, borderRadius: 6, background: alpha(C.t3, 0.1) }}
        />
        <div
          className="tf-skeleton-pulse"
          style={{ width: 200, height: 20, borderRadius: 6, background: alpha(C.t3, 0.1) }}
        />
      </div>
      <div
        className="tf-skeleton-pulse"
        style={{ width: '80%', height: 14, borderRadius: 4, background: alpha(C.t3, 0.08), marginBottom: 20 }}
      />
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="tf-skeleton-pulse"
          style={{
            width: '100%',
            height: 48,
            borderRadius: 10,
            background: alpha(C.t3, 0.06),
            marginBottom: 8,
          }}
        />
      ))}
    </div>
  );
}
