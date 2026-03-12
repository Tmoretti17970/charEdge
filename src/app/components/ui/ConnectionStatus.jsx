// ═══════════════════════════════════════════════════════════════════
// charEdge — ConnectionStatus
// Visual indicator for data feed connection state.
// Enhanced with latency tier badges (Task 2.4.16) and RTT (Task 2.4.15).
// ═══════════════════════════════════════════════════════════════════

import { memo } from 'react';
const TIER_CONFIG = {
  realtime: { icon: '🟢', label: 'Real-Time', desc: '<10ms' },
  fast: { icon: '🟡', label: 'Fast', desc: '<50ms' },
  delayed: { icon: '🔴', label: 'Delayed', desc: '>100ms' },
};

/**
 * @param {Object} props
 * @param {string}  props.status     - 'idle'|'loading'|'ready'|'error'|'loading_more'
 * @param {string}  props.feedStatus - 'connected'|'connecting'|'disconnected'|'error'
 * @param {string}  [props.error]    - Error message
 * @param {string}  [props.theme='dark']
 * @param {string}  [props.latencyTier] - 'realtime'|'fast'|'delayed'
 * @param {number}  [props.rttMs]    - Round-trip time in ms
 */
function ConnectionStatus({ status, feedStatus, error, theme = 'dark', latencyTier, rttMs }) {
  const isDark = theme === 'dark';

  const statusConfig = {
    connected: { color: '#26A69A', label: 'Live', dot: true },
    connecting: { color: '#FF9800', label: 'Connecting...', dot: true, pulse: true },
    disconnected: { color: '#787B86', label: 'Offline', dot: true },
    error: { color: '#EF5350', label: 'Error', dot: true },
  };

  const wsConfig = statusConfig[feedStatus] || statusConfig.disconnected;
  const isLoading = status === 'loading' || status === 'loading_more';
  const tierInfo = latencyTier ? TIER_CONFIG[latencyTier] : null;

  // RTT color coding
  const rttColor = rttMs != null
    ? rttMs < 50 ? '#26A69A' : rttMs < 200 ? '#FF9800' : '#EF5350'
    : null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 11,
        color: isDark ? '#787B86' : '#9E9E9E',
      }}
    >
      {/* Loading spinner */}
      {isLoading && (
        <div
          style={{
            width: 12,
            height: 12,
            border: `2px solid ${isDark ? '#363A45' : '#E0E0E0'}`,
            borderTopColor: '#2962FF',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      )}

      {/* WebSocket status dot */}
      {!isLoading && (
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: wsConfig.color,
            animation: wsConfig.pulse ? 'pulse 1.5s ease-in-out infinite' : 'none',
          }}
        />
      )}

      <span>{isLoading ? (status === 'loading_more' ? 'Loading history...' : 'Loading...') : wsConfig.label}</span>

      {/* Latency tier badge */}
      {tierInfo && !isLoading && (
        <span
          title={`${tierInfo.label} (${tierInfo.desc})`}
          style={{
            fontSize: 10,
            opacity: 0.8,
            cursor: 'help',
          }}
        >
          {tierInfo.icon}
        </span>
      )}

      {/* RTT display */}
      {rttMs != null && !isLoading && (
        <span
          title={`Round-trip time: ${rttMs}ms`}
          style={{
            fontSize: 10,
            color: rttColor,
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          {rttMs}ms
        </span>
      )}

      {/* Error tooltip */}
      {error && (
        <span style={{ color: '#EF5350', fontSize: 10 }} title={error}>
          ⚠
        </span>
      )}

    </div>
  );
}

export default memo(ConnectionStatus);
