// ═══════════════════════════════════════════════════════════════════
// charEdge — Drag Reorder Hook (Sprint 49 — Enhanced)
//
// Native HTML5 drag-and-drop for watchlist grid rows with:
//   - Pointer events for mobile/tablet support
//   - Spring animation offset tracking for fluid motion
//   - Folder section drop targets for cross-folder drag
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback, useRef } from 'react';

interface DragReorderOptions {
  onReorder: (fromIdx: number, toIdx: number) => void;
  onMoveToFolder?: (symbol: string, folderId: string | null) => void;
}

interface DragState {
  fromIdx: number;
  startY: number;
  symbol: string;
}

/**
 * Hook for drag-and-drop row reordering with spring animation.
 */
export function useDragReorder({ onReorder, onMoveToFolder }: DragReorderOptions) {
  const [dragIndex, setDragIndex] = useState(-1);
  const [dropIndex, setDropIndex] = useState(-1);
  const [dragOffset, setDragOffset] = useState(0);
  const [dropFolderId, setDropFolderId] = useState<string | null>(null);
  const dragData = useRef<DragState>({ fromIdx: -1, startY: 0, symbol: '' });
  const dropIndexRef = useRef(-1);

  // Keep dropIndex synced in ref for touch handlers
  const updateDropIndex = useCallback((idx: number) => {
    setDropIndex(idx);
    dropIndexRef.current = idx;
  }, []);

  const getDragHandlers = useCallback((idx: number, symbol?: string) => ({
    draggable: true,

    onDragStart: (e: React.DragEvent) => {
      dragData.current.fromIdx = idx;
      dragData.current.startY = e.clientY;
      dragData.current.symbol = symbol || '';
      setDragIndex(idx);
      setDragOffset(0);
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(idx));
      }
    },

    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      updateDropIndex(idx);
      const dy = e.clientY - dragData.current.startY;
      setDragOffset(dy);
    },

    onDragEnter: (e: React.DragEvent) => {
      e.preventDefault();
      updateDropIndex(idx);
    },

    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const from = dragData.current.fromIdx;
      if (from !== -1 && from !== idx) {
        onReorder(from, idx);
      }
      _resetDragState();
    },

    onDragEnd: () => {
      _resetDragState();
    },

    // ── Touch events for mobile/tablet ──
    onTouchStart: (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      dragData.current.fromIdx = idx;
      dragData.current.startY = touch.clientY;
      dragData.current.symbol = symbol || '';
      setTimeout(() => {
        if (dragData.current.fromIdx === idx) {
          setDragIndex(idx);
        }
      }, 150);
    },

    onTouchMove: (e: React.TouchEvent) => {
      if (dragData.current.fromIdx === -1) return;
      const touch = e.touches[0];
      if (!touch) return;
      const dy = touch.clientY - dragData.current.startY;
      setDragOffset(dy);

      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      if (el) {
        const row = el.closest('[data-row-index]') as HTMLElement | null;
        if (row) {
          const targetIdx = parseInt(row.getAttribute('data-row-index') || '-1', 10);
          if (targetIdx >= 0) updateDropIndex(targetIdx);
        }
      }
    },

    onTouchEnd: () => {
      const from = dragData.current.fromIdx;
      const drop = dropIndexRef.current;
      if (from !== -1 && drop >= 0 && from !== drop) {
        onReorder(from, drop);
      }
      _resetDragState();
    },
  }), [onReorder, updateDropIndex]);

  // ── Folder section drop targets (cross-folder drag) ──
  const getFolderDropHandlers = useCallback((folderId: string | null) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      setDropFolderId(folderId);
    },

    onDragEnter: (e: React.DragEvent) => {
      e.preventDefault();
      setDropFolderId(folderId);
    },

    onDragLeave: () => {
      setDropFolderId(null);
    },

    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (onMoveToFolder && dragData.current.symbol) {
        onMoveToFolder(dragData.current.symbol, folderId);
      }
      _resetDragState();
    },
  }), [onMoveToFolder]);

  function _resetDragState() {
    setDragIndex(-1);
    setDropIndex(-1);
    dropIndexRef.current = -1;
    setDragOffset(0);
    setDropFolderId(null);
    dragData.current = { fromIdx: -1, startY: 0, symbol: '' };
  }

  return { dragIndex, dropIndex, dragOffset, getDragHandlers, getFolderDropHandlers, dropFolderId };
}

export default useDragReorder;
