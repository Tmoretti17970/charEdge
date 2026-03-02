import React, { useState, useRef, useEffect, useCallback } from 'react';
import { C } from '../../../constants.js';

/**
 * SplitPaneLayout
 * Renders a resizable top pane and a bottom pane taking the remaining vertical space.
 * Includes a draggable handle for resizing.
 */
export default function SplitPaneLayout({
  topPane,
  bottomPane,
  defaultTopHeight = 400,
  minTopHeight = 100,
  maxTopHeight = 800,
  collapsible = false,
  snapThreshold = 100,
}) {
  const [topHeight, setTopHeight] = useState(defaultTopHeight);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef(null);

  const startResizing = useCallback((e) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (e) => {
      if (isResizing && containerRef.current) {
        // Calculate new height based on mouse Y relative to the container top
        const containerRect = containerRef.current.getBoundingClientRect();
        // ClientY represents the mouse position. The new height is roughly the distance from the top of the container to the mouse.
        const newHeight = e.clientY - containerRect.top;

        // Constrain height
        if (collapsible && newHeight < snapThreshold) {
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
    if (collapsible) {
      if (topHeight > 0) {
        setTopHeight(0); // Collapse
      } else {
        setTopHeight(defaultTopHeight); // Expand
      }
    } else {
      if (topHeight > minTopHeight + 50) {
        setTopHeight(minTopHeight); // Collapse
      } else {
        setTopHeight(defaultTopHeight); // Expand
      }
    }
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

      {/* Resizer Handle */}
      <div
        onMouseDown={startResizing}
        onDoubleClick={handleDoubleClick}
        style={{
          height: 8,
          cursor: 'row-resize',
          background: isResizing ? C.b + '40' : C.bd + '20',
          borderTop: `1px solid ${C.bd}`,
          borderBottom: `1px solid ${C.bd}`,
          zIndex: 10,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          transition: 'background 0.2s',
        }}
        title="Drag to resize, double-click to collapse/expand"
      >
        {/* Visual grip indicator */}
        <div
          style={{
            width: 32,
            height: 2,
            background: isResizing ? C.b : C.t3,
            borderRadius: 1,
            transition: 'background 0.2s',
          }}
        />
      </div>

      {/* Bottom Pane */}
      <div
        style={{
          flex: 1, // Take remaining space
          minHeight: 0, // CRITICAL for nested flexbox scrolling behavior
          overflow: 'hidden', // Let children handle their own scrolling
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Overlay to prevent iframe/child pointer events from interfering with drag */}
        {isResizing && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9999,
              cursor: 'row-resize',
            }}
          />
        )}
        {bottomPane}
      </div>
    </div>
  );
}
