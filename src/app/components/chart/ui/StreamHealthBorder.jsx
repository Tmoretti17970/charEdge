// ═══════════════════════════════════════════════════════════════════
// charEdge — Stream Health Border (Task G1.4)
//
// Ambient WebSocket quality glow around the chart container.
// Subscribes to PipelineHealthMonitor and maps health status to
// a colored box-shadow + latency badge. Transitions are smooth
// CSS animations for a non-distracting yet informative indicator.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useMemo } from 'react';

// ─── Health Status → Visual Mapping ────────────────────────────

const STATUS_CONFIG = {
  healthy: {
    color: 'rgba(0, 255, 100, 0.15)',
    glowColor: 'rgba(0, 255, 100, 0.08)',
    badgeColor: '#00c853',
    badgeBg: 'rgba(0, 200, 83, 0.12)',
    label: 'Live',
  },
  degraded: {
    color: 'rgba(255, 193, 7, 0.25)',
    glowColor: 'rgba(255, 193, 7, 0.12)',
    badgeColor: '#ffc107',
    badgeBg: 'rgba(255, 193, 7, 0.12)',
    label: 'Slow',
  },
  critical: {
    color: 'rgba(255, 61, 0, 0.3)',
    glowColor: 'rgba(255, 61, 0, 0.15)',
    badgeColor: '#ff3d00',
    badgeBg: 'rgba(255, 61, 0, 0.12)',
    label: 'Down',
  },
  unknown: {
    color: 'rgba(128, 128, 128, 0.1)',
    glowColor: 'rgba(128, 128, 128, 0.05)',
    badgeColor: '#888',
    badgeBg: 'rgba(128, 128, 128, 0.1)',
    label: '—',
  },
};

// ─── Component ─────────────────────────────────────────────────

export default function StreamHealthBorder({ children }) {
  const [health, setHealth] = useState(null);

  // Subscribe to pipeline health monitor
  useEffect(() => {
    let unsubscribe = null;
    let mounted = true;

    // Dynamic import to avoid circular deps and allow tree-shaking
    import('../../../../data/engine/infra/PipelineHealthMonitor.js')
      .then((mod) => {
        if (!mounted) return;
        const monitor = mod.pipelineHealth || mod.default;
        if (!monitor) return;

        // Start monitoring if not already started
        if (typeof monitor.start === 'function') {
          monitor.start();
        }

        // Get initial health
        if (typeof monitor.getHealth === 'function') {
          setHealth(monitor.getHealth());
        }

        // Subscribe to changes
        if (typeof monitor.onHealthChange === 'function') {
          unsubscribe = monitor.onHealthChange((h) => {
            if (mounted) setHealth(h);
          });
        }
      })
      .catch(() => {
        // PipelineHealthMonitor not available — degrade gracefully
      });

    return () => {
      mounted = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Derive visual config from health status
  const status = health?.status || 'unknown';
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
  const latencyMs = health?.latency?.ws ?? health?.latency?.api ?? null;

  const containerStyle = useMemo(() => ({
    position: 'relative',
    borderRadius: 'var(--tf-radius-lg, 8px)',
    boxShadow: `inset 0 0 0 1px ${config.color}, 0 0 12px ${config.glowColor}`,
    transition: 'box-shadow 0.6s ease',
    animation: status === 'degraded' ? 'tf-health-pulse 2s ease infinite' : 'none',
  }), [config, status]);

  const badgeStyle = useMemo(() => ({
    position: 'absolute',
    top: 6,
    right: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderRadius: 10,
    background: config.badgeBg,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    fontSize: 10,
    fontWeight: 600,
    fontFamily: 'var(--tf-font-mono, "JetBrains Mono", monospace)',
    color: config.badgeColor,
    letterSpacing: '0.02em',
    lineHeight: 1,
    zIndex: 10,
    pointerEvents: 'none',
    transition: 'color 0.4s ease, background 0.4s ease',
    userSelect: 'none',
  }), [config]);

  const dotStyle = useMemo(() => ({
    width: 5,
    height: 5,
    borderRadius: '50%',
    backgroundColor: config.badgeColor,
    transition: 'background-color 0.4s ease',
    animation: status === 'healthy' ? 'tf-health-dot-pulse 2s ease infinite' : 'none',
  }), [config, status]);

  return (
    <div style={containerStyle} className="tf-stream-health-border">
      {/* Inject keyframes once */}
      <style>{`
        @keyframes tf-health-pulse {
          0%, 100% { box-shadow: inset 0 0 0 1px ${config.color}, 0 0 12px ${config.glowColor}; }
          50% { box-shadow: inset 0 0 0 1.5px ${config.color}, 0 0 20px ${config.glowColor}; }
        }
        @keyframes tf-health-dot-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {/* Latency badge */}
      <div style={badgeStyle} aria-label={`Stream status: ${config.label}`}>
        <span style={dotStyle} />
        <span>{latencyMs !== null ? `${Math.round(latencyMs)}ms` : config.label}</span>
      </div>

      {children}
    </div>
  );
}
