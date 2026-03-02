// ═══════════════════════════════════════════════════════════════════
// charEdge — Widget Error Boundary
// Lightweight error boundary for individual widgets/cards/charts.
// Shows a compact inline fallback instead of crashing the page.
// Usage: <WidgetBoundary name="Equity Curve"><EquityCurveChart /></WidgetBoundary>
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C, F, M } from '../../../constants.js';
import { reportError } from '../../../utils/globalErrorHandler.js';

class WidgetBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, _errorInfo) {
    reportError(error, {
      source: 'WidgetBoundary',
      component: this.props.name || 'Unknown Widget',
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Compact inline fallback
      const { name, height, fallback } = this.props;

      // Custom fallback component
      if (fallback) {
        return typeof fallback === 'function'
          ? fallback({ error: this.state.error, retry: this.handleRetry })
          : fallback;
      }

      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: 16,
            minHeight: height || 100,
            background: C.sf,
            border: `1px solid ${C.bd}`,
            borderRadius: 8,
            fontFamily: F,
          }}
        >
          <div style={{ fontSize: 20, opacity: 0.5 }}>⚠️</div>
          <div style={{ fontSize: 11, color: C.t3, textAlign: 'center' }}>
            {name ? `${name} failed to load` : 'Widget error'}
          </div>
          <button
            className="tf-btn"
            onClick={this.handleRetry}
            style={{
              padding: '4px 12px',
              borderRadius: 4,
              border: `1px solid ${C.bd}`,
              background: 'transparent',
              color: C.t2,
              fontSize: 10,
              fontFamily: M,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default WidgetBoundary;
export { WidgetBoundary };
