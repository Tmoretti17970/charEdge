// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Workspace Loader
//
// Wrapper that attempts to load WorkspaceLayout (which requires
// flexlayout-react). If the package is not installed, shows a
// helpful fallback message.
//
// Usage in ChartsPage:
//   import React from 'react';
//   import WorkspaceLayout from './WorkspaceLoader.jsx';
// ═══════════════════════════════════════════════════════════════════

import React, { Suspense, lazy } from 'react';
import { C, F, M } from '../../constants.js';
import s from './WorkspaceLoader.module.css';

// Attempt lazy import — will fail gracefully if flexlayout-react not installed
const WorkspaceLayoutLazy = lazy(() =>
  import('./WorkspaceLayout.jsx').catch(() => ({
    default: () => <WorkspaceFallback error="flexlayout-react not installed" />,
  })),
);

function WorkspaceFallback({ error }) {
  return (
    <div className={s.fallback} style={{ fontFamily: F, color: C.t2 }}>
      <div className={s.fallbackIcon}>◧</div>
      <div className={s.fallbackTitle} style={{ color: C.t1 }}>Workspace Mode</div>
      <div className={s.fallbackDesc} style={{ color: C.t3 }}>
        Multi-chart workspace requires the <code style={{ fontFamily: M, color: C.b }}>flexlayout-react</code> package.
      </div>
      <div
        className={s.codeBlock}
        style={{ background: C.sf, border: `1px solid ${C.bd}`, fontFamily: M, color: C.t1 }}
      >
        npm install flexlayout-react
      </div>
      {error && <div className={s.fallbackError} style={{ color: C.t3 }}>{error}</div>}
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className={s.loading} style={{ color: C.t3, fontFamily: F }}>
      Loading workspace...
    </div>
  );
}

function WorkspaceLoader(props) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <WorkspaceLayoutLazy {...props} />
    </Suspense>
  );
}

export default React.memo(WorkspaceLoader);

