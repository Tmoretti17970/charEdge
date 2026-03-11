import { useState, useRef, useEffect, useCallback } from 'react';
import { C, M } from '../../../constants.js';

/**
 * SplitPaneLayout
 * Renders a resizable top pane and a bottom pane taking the remaining vertical space.
 * Includes a draggable handle for resizing.
 *
 * Props:
 *   startBottomCollapsed — if true, starts with bottom pane hidden
 *   bottomCollapsedLabel — label to show on the grab bar when bottom is collapsed
 *   bottomCollapsedMeta  — secondary text (e.g. "41 trades") on the grab bar
 */
export default function SplitPaneLayout({
  topPane,
  bottomPane,
  defaultTopHeight = 400,
  minTopHeight = 100,
  maxTopHeight = 800,
  collapsible = false,
  snapThreshold = 100,
  startBottomCollapsed = false,
  bottomCollapsedLabel = '',
  bottomCollapsedMeta = '',
}) {
  const containerRef = useRef(null);
  const [isResizing, setIsResizing] = useState(false);

  // Compute initial top height: if startBottomCollapsed, use container height (set once on mount)
  const [topHeight, setTopHeight] = useState(() => {
    if (startBottomCollapsed && typeof window !== 'undefined') {
      // Start with bottom collapsed — give all space to top
      return window.innerHeight;
    }
    return defaultTopHeight;
  });

  // Track whether bottom is effectively collapsed
  const isBottomCollapsed = containerRef.current
    ? topHeight >= (containerRef.current.getBoundingClientRect().height - 50)
    : startBottomCollapsed;

  // On mount, if startBottomCollapsed, set topHeight to actual container height
  useEffect(() => {
    if (startBottomCollapsed && containerRef.current) {
      const h = containerRef.current.getBoundingClientRect().height;
      setTopHeight(h - 36); // leave room for the grab bar
    }
  }, [startBottomCollapsed]);

  const startResizingHandler = useCallback((e) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (e) => {
      if (isResizing && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const newHeight = e.clientY - containerRect.top;
        const containerH = containerRect.height;

        // Snap bottom closed if dragged near bottom
        if (collapsible && newHeight > containerH - 50) {
          setTopHeight(containerH - 36);
        } else if (collapsible && newHeight < snapThreshold) {
          setTopHeight(0);
        } else if (newHeight >= minTopHeight && newHeight <= maxTopHeight) {
          setTopHeight(newHeight);
        } else if (newHeight < minTopHeight) {
          setTopHeight(collapsible ? 0 : minTopHeight);
        } else if (newHeight > maxTopHeight) {
          setTopHeight(maxTopHeight);
        }
      }
    },
    [isResizing, minTopHeight, maxTopHeight, collapsible, snapThreshold]
  );

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    }

    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  // Double click resizer to snap open/close
  const handleDoubleClick = () => {
    if (!containerRef.current) return;
    const containerH = containerRef.current.getBoundingClientRect().height;

    if (collapsible) {
      if (topHeight > containerH - 100) {
        // Bottom is collapsed → expand it
        setTopHeight(defaultTopHeight);
      } else if (topHeight > 0) {
        // Collapse bottom (maximize top)
        setTopHeight(containerH - 36);
      } else {
        setTopHeight(defaultTopHeight);
      }
    } else {
      if (topHeight > minTopHeight + 50) {
        setTopHeight(minTopHeight);
      } else {
        setTopHeight(defaultTopHeight);
      }
    }
  };

  // Expand bottom pane from collapsed state
  const expandBottom = () => {
    setTopHeight(defaultTopHeight);
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Top Pane */}
      <div
        style={{
          height: topHeight,
          minHeight: topHeight === 0 ? 0 : minTopHeight,
          flexShrink: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transition: isResizing ? 'none' : 'height 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), min-height 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
          opacity: topHeight === 0 ? 0 : 1,
        }}
      >
        {topPane}
      </div>

      {/* Resizer Handle / Grab Bar */}
      <div
        onMouseDown={startResizingHandler}
        onDoubleClick={handleDoubleClick}
        style={{
          height: isBottomCollapsed ? 36 : 8,
          cursor: 'row-resize',
          background: isResizing ? C.b + '15' : isBottomCollapsed ? C.sf : C.bd + '20',
          borderTop: `1px solid ${C.bd}`,
          borderBottom: isBottomCollapsed ? 'none' : `1px solid ${C.bd}`,
          zIndex: 10,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
          transition: 'all 0.25s ease',
          userSelect: 'none',
        }}
        title="Drag to resize, double-click to collapse/expand"
      >
        {isBottomCollapsed && bottomCollapsedLabel ? (
          <>
            {/* Grab pill */}
            <div style={{
              width: 32, height: 3, background: C.t3, borderRadius: 2, opacity: 0.4,
              position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)',
            }} />
            <button
              onClick={expandBottom}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '0 12px', color: C.t2, fontFamily: M, fontSize: 11,
              }}
            >
              <span style={{ fontSize: 13 }}>📓</span>
              <span style={{ fontWeight: 600 }}>{bottomCollapsedLabel}</span>
              {bottomCollapsedMeta && (
                <span style={{ color: C.t3, fontSize: 10 }}>· {bottomCollapsedMeta}</span>
              )}
              <span style={{ color: C.t3, fontSize: 9, marginLeft: 4 }}>▲ pull up</span>
            </button>
          </>
        ) : (
          <div
            style={{
              width: 32, height: 2,
              background: isResizing ? C.b : C.t3,
              borderRadius: 1, transition: 'background 0.2s',
            }}
          />
        )}
      </div>

      {/* Bottom Pane */}
      <div
        style={{
          flex: isBottomCollapsed ? '0 0 0px' : '1',
          minHeight: 0,
          overflow: isBottomCollapsed ? 'hidden' : 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transition: isResizing ? 'none' : 'flex 0.3s ease',
        }}
      >
        {isResizing && (
          <div
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              zIndex: 9999, cursor: 'row-resize',
            }}
          />
        )}
        {bottomPane}
      </div>
    </div>
  );
}



