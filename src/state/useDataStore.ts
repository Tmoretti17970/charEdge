// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — Data Store (Zustand, Consolidated)
//
// Phase 0.3: Absorbs data-related stores via slices.
// Absorbs: useDiscoverStore, useDiscoverCache, useDiscoverTelemetry
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

import { createDiscoverSlice } from './data/discoverSlice.js';
import { createDiscoverCacheSlice } from './data/discoverCacheSlice.js';
import { createDiscoverTelemetrySlice } from './data/discoverTelemetrySlice.js';

const useDataStore = create((...a) => ({
  ...createDiscoverSlice(...a),
  ...createDiscoverCacheSlice(...a),
  ...createDiscoverTelemetrySlice(...a),
}));

export { useDataStore };
export default useDataStore;
