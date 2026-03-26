// ═══════════════════════════════════════════════════════════════════
// charEdge — Prediction URL State Sync
//
// Syncs prediction filter state to URL hash params for deep-linking.
// Enables shareable URLs like: #/predictions?category=crypto&sort=trending
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import usePredictionStore from '../../../state/usePredictionStore.js';

/**
 * Hook that syncs prediction filters to/from URL search params.
 * Call once in PredictionsPage.
 */
export default function usePredictionURLSync() {
  const initialized = useRef(false);
  const setCategory = usePredictionStore((s) => s.setCategory);
  const setSubcategory = usePredictionStore((s) => s.setSubcategory);
  const setTimeFilter = usePredictionStore((s) => s.setTimeFilter);
  const setSortBy = usePredictionStore((s) => s.setSortBy);
  const setSearchQuery = usePredictionStore((s) => s.setSearchQuery);

  const activeCategory = usePredictionStore((s) => s.activeCategory);
  const activeSubcategory = usePredictionStore((s) => s.activeSubcategory);
  const activeTimeFilter = usePredictionStore((s) => s.activeTimeFilter);
  const sortBy = usePredictionStore((s) => s.sortBy);
  const searchQuery = usePredictionStore((s) => s.searchQuery);

  // Read URL params on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const hash = window.location.hash;
    const qIndex = hash.indexOf('?');
    if (qIndex === -1) return;

    const params = new URLSearchParams(hash.slice(qIndex + 1));

    if (params.has('category')) setCategory(params.get('category'));
    if (params.has('sub')) setSubcategory(params.get('sub'));
    if (params.has('time')) setTimeFilter(params.get('time'));
    if (params.has('sort')) setSortBy(params.get('sort'));
    if (params.has('q')) setSearchQuery(params.get('q'));
  }, [setCategory, setSubcategory, setTimeFilter, setSortBy, setSearchQuery]);

  // Write URL params when filters change
  useEffect(() => {
    if (!initialized.current) return;

    const params = new URLSearchParams();
    if (activeCategory !== 'all') params.set('category', activeCategory);
    if (activeSubcategory) params.set('sub', activeSubcategory);
    if (activeTimeFilter !== 'all') params.set('time', activeTimeFilter);
    if (sortBy !== 'volume') params.set('sort', sortBy);
    if (searchQuery) params.set('q', searchQuery);

    const base = '#/markets';
    // Always include tab=predictions, then append any filter params
    params.set('tab', 'predictions');
    const newHash = `${base}?${params.toString()}`;

    // Only update if different (avoid infinite loops)
    if (window.location.hash !== newHash) {
      window.history.replaceState(null, '', newHash);
    }
  }, [activeCategory, activeSubcategory, activeTimeFilter, sortBy, searchQuery]);
}
