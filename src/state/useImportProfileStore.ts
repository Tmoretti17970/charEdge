// ═══════════════════════════════════════════════════════════════════
// charEdge — Import Profile Store (Phase 6 Sprint 6.10)
//
// Save, load, export, and import column mapping profiles.
// Profiles store column mappings, delimiter settings, date formats.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

const STORE_KEY = 'charEdge_import_profiles';

const useImportProfileStore = create((set, get) => ({
  profiles: [],
  loaded: false,

  // ─── Load from localStorage ───────────────────────────────────
  load: () => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      set({ profiles: raw ? JSON.parse(raw) : [], loaded: true });
    } catch {
      set({ profiles: [], loaded: true });
    }
  },

  // ─── Persist ──────────────────────────────────────────────────
  _persist: () => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(get().profiles));
    } catch (e) {
      console.warn('[ImportProfiles] persist failed:', e);
    }
  },

  // ─── Save a new profile ───────────────────────────────────────
  saveProfile: (profile) => {
    const newProfile = {
      id: `prof_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: profile.name || 'Untitled Profile',
      mapping: profile.mapping || {},
      delimiter: profile.delimiter || ',',
      dateFormat: profile.dateFormat || 'auto',
      broker: profile.broker || 'generic',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    set((s) => ({ profiles: [newProfile, ...s.profiles] }));
    get()._persist();
    return newProfile.id;
  },

  // ─── Update an existing profile ───────────────────────────────
  updateProfile: (id, updates) => {
    set((s) => ({
      profiles: s.profiles.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
      ),
    }));
    get()._persist();
  },

  // ─── Delete a profile ─────────────────────────────────────────
  deleteProfile: (id) => {
    set((s) => ({ profiles: s.profiles.filter((p) => p.id !== id) }));
    get()._persist();
  },

  // ─── Export a profile as JSON ─────────────────────────────────
  exportProfile: (id) => {
    const profile = get().profiles.find((p) => p.id === id);
    if (!profile) return null;

    const exportData = {
      _charEdge: 'import_profile',
      _version: 1,
      name: profile.name,
      mapping: profile.mapping,
      delimiter: profile.delimiter,
      dateFormat: profile.dateFormat,
      broker: profile.broker,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `charEdge-profile-${profile.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // ─── Import a profile from JSON ───────────────────────────────
  importProfile: (json) => {
    try {
      const data = typeof json === 'string' ? JSON.parse(json) : json;
      if (data._charEdge !== 'import_profile') {
        throw new Error('Invalid import profile file');
      }
      return get().saveProfile({
        name: data.name || 'Imported Profile',
        mapping: data.mapping || {},
        delimiter: data.delimiter || ',',
        dateFormat: data.dateFormat || 'auto',
        broker: data.broker || 'generic',
      });
    } catch (e) {
      console.warn('[ImportProfiles] import failed:', e);
      return null;
    }
  },

  // ─── Find best matching profile for headers ───────────────────
  findMatchingProfile: (headers) => {
    const profiles = get().profiles;
    if (!headers || headers.length === 0) return null;

    const headerSet = new Set(headers.map((h) => h.toLowerCase()));

    let bestMatch = null;
    let bestScore = 0;

    for (const profile of profiles) {
      const profileHeaders = Object.keys(profile.mapping || {});
      const profileHeaderSet = new Set(profileHeaders.map((h) => h.toLowerCase()));

      let matches = 0;
      for (const h of headerSet) {
        if (profileHeaderSet.has(h)) matches++;
      }

      const score = matches / Math.max(headerSet.size, profileHeaderSet.size);
      if (score > bestScore && score >= 0.6) {
        bestScore = score;
        bestMatch = profile;
      }
    }

    return bestMatch;
  },
}));

export { useImportProfileStore };
export default useImportProfileStore;
