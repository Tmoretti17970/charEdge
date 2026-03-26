// ═══════════════════════════════════════════════════════════════════
// charEdge — Prediction Error Boundary
//
// Granular error boundary for prediction sub-components.
// If one section fails, others keep working.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import styles from './PredictionErrorBoundary.module.css';

export default class PredictionErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error(`[Predictions] ${this.props.name || 'Component'} error:`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.errorCard}>
          <span className={styles.icon}>⚠️</span>
          <span className={styles.message}>{this.props.name || 'This section'} is temporarily unavailable</span>
          <button className={styles.retryBtn} onClick={() => this.setState({ hasError: false, error: null })}>
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
