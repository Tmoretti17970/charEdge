// ═══════════════════════════════════════════════════════════════════
// charEdge — Intel Page
//
// Dedicated market intelligence page — Apple-caliber redesign.
// Sector rotation, options flow, insider tracking, earnings,
// volatility, prediction markets, and more.
// ═══════════════════════════════════════════════════════════════════

import { Info, X } from 'lucide-react';
import React, { useState } from 'react';
import IntelSection from '../app/components/discover/IntelSection.jsx';
import styles from './IntelPage.module.css';

function IntelPage() {
  const [showDemo, setShowDemo] = useState(true);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Market Intelligence</h1>
        <p className={styles.subtitle}>Sector rotation, options flow, technicals, earnings, and more</p>
      </div>
      {showDemo && (
        <div className={styles.demoBanner}>
          <Info size={14} className={styles.demoIcon} />
          <span>Showing sample data for preview — live data available when connected</span>
          <button className={styles.demoDismiss} onClick={() => setShowDemo(false)} aria-label="Dismiss notice">
            <X size={12} />
          </button>
        </div>
      )}
      <IntelSection inline={false} />
    </div>
  );
}

export default React.memo(IntelPage);
