// ═══════════════════════════════════════════════════════════════════
// charEdge — useSemanticSearch Hook (Sprint 80)
//
// React hook for semantic journal search. Auto-indexes new entries
// and provides meaning-based search.
//
// Usage:
//   const { search, results, indexEntry, isSearching } = useSemanticSearch();
//   await search("revenge trading");
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import type { SearchResult } from '../ai/EmbeddingService';

interface SemanticSearchState {
  results: SearchResult[];
  isSearching: boolean;
  isIndexing: boolean;
  error: string | null;
  lastQuery: string;
}

export function useSemanticSearch() {
  const [state, setState] = useState<SemanticSearchState>({
    results: [],
    isSearching: false,
    isIndexing: false,
    error: null,
    lastQuery: '',
  });

  const search = useCallback(async (query: string, topK = 5) => {
    if (!query.trim()) return;

    setState(s => ({ ...s, isSearching: true, error: null, lastQuery: query }));

    try {
      const { embeddingService } = await import('../ai/EmbeddingService');
      const results = await embeddingService.search(query, topK);
      setState(s => ({ ...s, results, isSearching: false }));
    } catch (err: unknown) {
      setState(s => ({
        ...s,
        isSearching: false,
        error: err instanceof Error ? err.message : 'Search failed',
      }));
    }
  }, []);

  const indexEntry = useCallback(async (id: string, text: string, metadata: Record<string, unknown> = {}) => {
    setState(s => ({ ...s, isIndexing: true }));

    try {
      const { embeddingService } = await import('../ai/EmbeddingService');
      const alreadyIndexed = await embeddingService.isIndexed(id);
      if (!alreadyIndexed) {
        await embeddingService.index(id, text, metadata);
      }
    } catch {
      // Indexing failures are non-critical
    } finally {
      setState(s => ({ ...s, isIndexing: false }));
    }
  }, []);

  const indexBatch = useCallback(async (entries: { id: string; text: string; metadata?: Record<string, unknown> }[]) => {
    setState(s => ({ ...s, isIndexing: true }));

    try {
      const { embeddingService } = await import('../ai/EmbeddingService');
      for (const entry of entries) {
        const alreadyIndexed = await embeddingService.isIndexed(entry.id);
        if (!alreadyIndexed && entry.text.length >= 10) {
          await embeddingService.index(entry.id, entry.text, entry.metadata || {});
          // Small delay to respect rate limits
          await new Promise(r => setTimeout(r, 200));
        }
      }
    } catch {
      // Batch indexing failures are non-critical
    } finally {
      setState(s => ({ ...s, isIndexing: false }));
    }
  }, []);

  return {
    ...state,
    search,
    indexEntry,
    indexBatch,
  };
}

export default useSemanticSearch;
