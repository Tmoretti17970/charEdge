// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Workspace Loader
//
// Wrapper that attempts to load WorkspaceLayout (which requires
// flexlayout-react). If the package is not installed, shows a
// helpful fallback message.
//
// Usage in ChartsPage:
//   import WorkspaceLayout from './WorkspaceLoader.jsx';
// ═══════════════════════════════════════════════════════════════════

import { Suspense, lazy } from 'react';
import { C, F, M } from '../../constants.js';

// Attempt lazy import — will fail gracefully if flexlayout-react not installed
const WorkspaceLayoutLazy = lazy(() =>
  import('./WorkspaceLayout.jsx').catch(() => ({
    default: () => <WorkspaceFallback error="flexlayout-react not installed" />,
  })),
);

function WorkspaceFallback({ error }) {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        fontFamily: F,
        color: C.t2,
        padding: 40,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 32 }}>◧</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: C.t1 }}>Workspace Mode</div>
      <div style={{ fontSize: 12, color: C.t3, maxWidth: 400, lineHeight: 1.6 }}>
        Multi-chart workspace requires the <code style={{ fontFamily: M, color: C.b }}>flexlayout-react</code> package.
      </div>
      <div
        style={{
          background: C.sf,
          border: `1px solid ${C.bd}`,
          borderRadius: 6,
          padding: '10px 16px',
          fontFamily: M,
          fontSize: 12,
          color: C.t1,
          userSelect: 'all',
        }}
      >
        npm install flexlayout-react
      </div>
      {error && <div style={{ fontSize: 10, color: C.t3, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

function LoadingFallback() {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: C.t3,
        fontFamily: F,
        fontSize: 13,
      }}
    >
      Loading workspace...
    </div>
  );
}

export default function WorkspaceLoader(props) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <WorkspaceLayoutLazy {...props} />
    </Suspense>
  );
}
