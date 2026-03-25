// ═══════════════════════════════════════════════════════════════════
// charEdge — Markets Keyboard Navigation (Sprint 50)
//
// Full keyboard navigation for the Markets watchlist grid:
//   ↑/↓  — Move focused row
//   Enter — Open detail panel for focused row
//   Escape — Close detail panel, or clear focus
//   /     — Focus search bar
//   A     — Open add-symbol search
//   R     — Remove focused symbol
//   Space — Toggle favorite (placeholder)
//   Home/End — Jump to first/last row
//   PageUp/PageDown — Move 10 rows at a time
//
// Usage:
//   const { focusedIndex, setFocusedIndex } = useMarketsKeyboard({
//     items, onSelect, onRemove, onDoubleClick, searchRef,
//   });
// ═══════════════════════════════════════════════════════════════════

import type React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';

interface UseMarketsKeyboardOptions {
  /** Filtered/sorted items array (must match displayed order) */
  items: Array<{ symbol: string }>;
  /** Called when Enter is pressed — opens detail panel */
  onSelect: (symbol: string) => void;
  /** Called when R is pressed — removes focused symbol */
  onRemove: (symbol: string) => void;
  /** Called when double-Enter — navigate to chart */
  onDoubleClick: (symbol: string) => void;
  /** Ref to search input — focused on "/" press */
  searchRef?: React.RefObject<HTMLInputElement | null>;
  /** Whether the detail panel is currently open */
  detailOpen?: boolean;
  /** Close the detail panel */
  closeDetail?: () => void;
}

export function useMarketsKeyboard({
  items,
  onSelect,
  onRemove,
  onDoubleClick,
  searchRef,
  detailOpen,
  closeDetail,
}: UseMarketsKeyboardOptions) {
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const lastEnterRef = useRef<number>(0);

  // Clamp focus when items change
  useEffect(() => {
    if (focusedIndex >= items.length) {
      setFocusedIndex(Math.max(0, items.length - 1));
    }
  }, [items.length, focusedIndex]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Skip if typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      // Skip if modifier keys (except Shift for some combos)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const len = items.length;
      if (len === 0) return;

      switch (e.key) {
        case 'ArrowDown':
        case 'j': {
          e.preventDefault();
          setFocusedIndex((prev) => {
            const next = prev < 0 ? 0 : Math.min(prev + 1, len - 1);
            return next;
          });
          break;
        }

        case 'ArrowUp':
        case 'k': {
          e.preventDefault();
          setFocusedIndex((prev) => {
            const next = prev <= 0 ? 0 : prev - 1;
            return next;
          });
          break;
        }

        case 'Home': {
          e.preventDefault();
          setFocusedIndex(0);
          break;
        }

        case 'End': {
          e.preventDefault();
          setFocusedIndex(len - 1);
          break;
        }

        case 'PageDown': {
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 10, len - 1));
          break;
        }

        case 'PageUp': {
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 10, 0));
          break;
        }

        case 'Enter': {
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < len) {
            const sym = items[focusedIndex]?.symbol;
            if (!sym) break;
            const now = Date.now();
            // Double-enter → navigate to chart (within 400ms)
            if (now - lastEnterRef.current < 400) {
              onDoubleClick(sym);
            } else {
              onSelect(sym);
            }
            lastEnterRef.current = now;
          }
          break;
        }

        case 'Escape': {
          e.preventDefault();
          if (detailOpen && closeDetail) {
            closeDetail();
          } else {
            setFocusedIndex(-1);
          }
          break;
        }

        case '/': {
          e.preventDefault();
          searchRef?.current?.focus();
          break;
        }

        case 'a':
        case 'A': {
          e.preventDefault();
          searchRef?.current?.focus();
          break;
        }

        case 'r':
        case 'R': {
          if (focusedIndex >= 0 && focusedIndex < len) {
            e.preventDefault();
            const sym = items[focusedIndex]?.symbol;
            if (!sym) break;
            onRemove(sym);
            // Move focus up if at end
            if (focusedIndex >= len - 1) {
              setFocusedIndex(Math.max(0, len - 2));
            }
          }
          break;
        }

        default:
          break;
      }
    },
    [items, focusedIndex, onSelect, onRemove, onDoubleClick, searchRef, detailOpen, closeDetail],
  );

  // Attach global listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { focusedIndex, setFocusedIndex };
}

export default useMarketsKeyboard;
