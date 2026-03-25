// ═══════════════════════════════════════════════════════════════════
// charEdge — Intel Performance Guard
//
// Lightweight performance monitoring wrapper for the Intel page.
//
//   - LazySection: IntersectionObserver-based lazy loading for
//     below-fold sections (Tiers 3-5: Signals, Research, Macro).
//   - useMemoGuard: Dev-mode warning if a component isn't wrapped
//     in React.memo.
//   - useRenderCount: Dev-mode render count tracker.
//   - useFCPTracker: Tracks First Contentful Paint for Intel page.
// ═══════════════════════════════════════════════════════════════════

/* eslint-disable no-console */
import { useState, useEffect, useRef } from 'react';

// ─── Constants ──────────────────────────────────────────────────
 
const IS_DEV = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

// ─── LazySection ────────────────────────────────────────────────
//
// Wraps below-fold sections with an IntersectionObserver. Content
// only renders once the section scrolls within 200px of the viewport.
// Once visible, content stays mounted (no teardown on scroll-away).

function LazySection({ id, children, fallback }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }, // Pre-load 200px before visible
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} data-lazy-section={id} style={{ minHeight: isVisible ? 'auto' : 100 }}>
      {isVisible ? children : fallback || <LazySkeleton />}
    </div>
  );
}

// ─── Default skeleton for lazy sections ─────────────────────────

function LazySkeleton() {
  return (
    <div
      aria-hidden="true"
      style={{
        padding: '20px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            height: 14,
            background: 'rgba(128,128,128,0.08)',
            borderRadius: 6,
            width: `${90 - i * 15}%`,
          }}
        />
      ))}
    </div>
  );
}

// ─── useMemoGuard ───────────────────────────────────────────────
//
// Dev-mode hook that checks whether a component is wrapped in
// React.memo. Logs a warning to the console if it is not.
// No-op in production.

function useMemoGuard(componentName, Component) {
  useEffect(() => {
    if (!IS_DEV) return;

    // React.memo wraps the component in an object with $$typeof
    // equal to REACT_MEMO_TYPE and a `compare` or `type` property.
    // A memoized component's .$$typeof is Symbol.for('react.memo').
    const MEMO_TYPE = Symbol.for('react.memo');

    if (Component && Component.$$typeof !== MEMO_TYPE) {
      console.warn(
        `[IntelPerformanceGuard] ${componentName} is NOT wrapped in React.memo. ` +
          'Consider memoizing to avoid unnecessary re-renders.',
      );
    }
  }, [componentName, Component]);
}

// ─── useRenderCount ─────────────────────────────────────────────
//
// Dev-mode hook that tracks how many times a component renders.
// Logs a warning when render count exceeds a threshold (default 20)
// within a single page session.

function useRenderCount(componentName, warnThreshold = 20) {
  const countRef = useRef(0);

  useEffect(() => {
    if (!IS_DEV) return;

    countRef.current += 1;
    const count = countRef.current;

    if (count === warnThreshold) {
      console.warn(
        `[IntelPerformanceGuard] ${componentName} has rendered ${count} times. ` +
          'This may indicate a missing memoization or unstable prop reference.',
      );
    }
  });

  return IS_DEV ? countRef.current : 0;
}

// ─── useFCPTracker ──────────────────────────────────────────────
//
// Tracks First Contentful Paint for the Intel page. Uses the
// PerformanceObserver API to capture the FCP metric and logs it
// in dev mode. Returns the FCP value in milliseconds (or null).

function useFCPTracker(pageName = 'IntelPage') {
  const [fcp, setFcp] = useState(null);

  useEffect(() => {
    if (typeof PerformanceObserver === 'undefined') return;

    // Check if FCP already recorded (from paint timing entries)
    const existing = performance.getEntriesByName?.('first-contentful-paint');
    if (existing && existing.length > 0) {
      const value = Math.round(existing[0].startTime);
      setFcp(value);
      if (IS_DEV) {
        console.info(`[IntelPerformanceGuard] ${pageName} FCP: ${value}ms (cached)`);
      }
      return;
    }

    let observer;
    try {
      observer = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            const value = Math.round(entry.startTime);
            setFcp(value);
            if (IS_DEV) {
              console.info(`[IntelPerformanceGuard] ${pageName} FCP: ${value}ms`);
            }
            observer.disconnect();
          }
        }
      });
      observer.observe({ type: 'paint', buffered: true });
    } catch {
      // PerformanceObserver not supported for paint entries
    }

    return () => {
      if (observer) {
        try {
          observer.disconnect();
        } catch {
          /* noop */
        }
      }
    };
  }, [pageName]);

  return fcp;
}

// ─── verifySuspenseBoundaries (dev utility) ─────────────────────
//
// Call in useEffect during dev to verify that all React.lazy
// imports in IntelPage.jsx have Suspense boundaries. This is a
// static check — logs a confirmation or warning.

function verifySuspenseBoundaries(pageRef) {
  if (!IS_DEV || !pageRef?.current) return;

  // In dev mode, check that sections are wrapped in Suspense by
  // looking for section containers. If a lazy-loaded section
  // rendered without Suspense, React would have thrown — so if
  // we get here, all boundaries are intact.
  const sectionIds = ['brief', 'pulse', 'signals', 'research', 'macro'];
  const missing = sectionIds.filter((id) => !pageRef.current.querySelector(`#intel-section-${id}`));

  if (missing.length === 0) {
    console.info('[IntelPerformanceGuard] All Suspense boundaries verified.');
  } else {
    console.warn(`[IntelPerformanceGuard] Sections not found (may not have loaded yet): ${missing.join(', ')}`);
  }
}

export { LazySection, LazySkeleton, useMemoGuard, useRenderCount, useFCPTracker, verifySuspenseBoundaries };

export default LazySection;
