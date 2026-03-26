// ═══════════════════════════════════════════════════════════════════
// charEdge — Prediction Keyboard Shortcuts
//
// / — Focus search
// 1-9 — Switch category tabs
// Escape — Clear search/close detail panel
// G — Toggle grid/list view
// ═══════════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import usePredictionDetailStore from '../../../state/usePredictionDetailStore.js';
import usePredictionStore from '../../../state/usePredictionStore.js';

const CATEGORY_KEYS = ['all', 'trending', 'finance', 'economy', 'crypto', 'politics', 'tech', 'sports', 'geopolitics'];

export default function usePredictionKeyboard() {
  useEffect(() => {
    function handleKeyDown(e) {
      // Ignore when typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        // Escape blurs the input
        if (e.key === 'Escape') {
          e.target.blur();
          e.preventDefault();
        }
        return;
      }

      const store = usePredictionStore.getState();
      const detailStore = usePredictionDetailStore.getState();

      switch (e.key) {
        case '/': {
          e.preventDefault();
          const searchInput = document.querySelector('[class*="searchInput"]');
          if (searchInput) searchInput.focus();
          break;
        }

        case 'Escape': {
          if (detailStore.isOpen) {
            detailStore.closeMarket();
          } else if (store.searchQuery) {
            store.setSearchQuery('');
          } else {
            store.clearAllFilters();
          }
          break;
        }

        case 'g':
        case 'G': {
          store.setViewMode(store.viewMode === 'grid' ? 'list' : 'grid');
          break;
        }

        default: {
          // Number keys 1-9 for categories
          const num = parseInt(e.key, 10);
          if (num >= 1 && num <= CATEGORY_KEYS.length) {
            store.setCategory(CATEGORY_KEYS[num - 1]);
          }
          break;
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
