// ═══════════════════════════════════════════════════════════════════
// charEdge — Markets URL State Sync
//
// Syncs the active top-level tab to URL hash params.
// Enables deep-linking:
//   #/markets?tab=top
//   #/markets?tab=predictions&category=crypto
//   #/markets?tab=watchlist&folder=abc123
//
// Also handles backward-compat redirect from old #/predictions URLs.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { useMarketsPrefsStore } from '../../../state/useMarketsPrefsStore';

const VALID_TABS = ['top', 'predictions', 'watchlist'];

/**
 * Hook that syncs the active Markets tab to/from URL hash params.
 * Call once in MarketsPage.
 */
export default function useMarketsURLSync() {
  const initialized = useRef(false);
  const activeTopTab = useMarketsPrefsStore((s) => s.activeTopTab);
  const setActiveTopTab = useMarketsPrefsStore((s) => s.setActiveTopTab);

  // Read URL params on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const hash = window.location.hash;

    // Backward compat: old #/predictions URLs → redirect to tab=predictions
    if (hash.startsWith('#/predictions')) {
      setActiveTopTab('predictions');
      // Rewrite the URL to #/markets?tab=predictions + any existing params
      const qIndex = hash.indexOf('?');
      const params = qIndex >= 0 ? new URLSearchParams(hash.slice(qIndex + 1)) : new URLSearchParams();
      params.set('tab', 'predictions');
      window.history.replaceState(null, '', `#/markets?${params.toString()}`);
      return;
    }

    const qIndex = hash.indexOf('?');
    if (qIndex === -1) return;

    const params = new URLSearchParams(hash.slice(qIndex + 1));
    const tab = params.get('tab');
    if (tab && VALID_TABS.includes(tab)) {
      setActiveTopTab(tab);
    }
  }, [setActiveTopTab]);

  // Write URL params when tab changes
  useEffect(() => {
    if (!initialized.current) return;

    // Don't overwrite prediction sub-params when on predictions tab
    // (usePredictionURLSync handles that)
    if (activeTopTab === 'predictions') return;

    const params = new URLSearchParams();
    if (activeTopTab !== 'top') {
      params.set('tab', activeTopTab);
    }

    const paramStr = params.toString();
    const base = '#/markets';
    const newHash = paramStr ? `${base}?${paramStr}` : base;

    if (window.location.hash !== newHash) {
      window.history.replaceState(null, '', newHash);
    }
  }, [activeTopTab]);
}
