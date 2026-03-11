// ═══════════════════════════════════════════════════════════════════
// charEdge — useChartKeyboardHandler
// Extracts the keyboard shortcut handler from ChartsPage.
// Registers a global keydown listener for chart-related shortcuts.
// ═══════════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { useChartStore } from '../../state/useChartStore';

/**
 * Hook that registers all chart keyboard shortcuts.
 *
 * @param {Object} callbacks - Setter functions from the parent component
 * @param {Function} callbacks.setShowSnapshotPublisher
 * @param {Function} callbacks.setShowCopilot
 * @param {Function} callbacks.setShowShortcuts
 * @param {Function} callbacks.setShowInsights
 * @param {Function} callbacks.setShowIndicators
 * @param {Function} callbacks.setDrawSidebarOpen
 * @param {Function} callbacks.setFocusMode
 * @param {Function} callbacks.setTf
 */
export default function useChartKeyboardHandler({
  setShowSnapshotPublisher,
  setShowCopilot,
  setShowShortcuts,
  setShowInsights,
  setShowIndicators,
  setDrawSidebarOpen,
  setFocusMode,
  setTf,
}) {
  useEffect(() => {
    const handler = (e) => {
      // Drawing Undo: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useChartStore.getState().undoDrawing();
        return;
      }
      // Drawing Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault();
        useChartStore.getState().redoDrawing();
        return;
      }
      // Escape: deselect active drawing tool
      if (e.key === 'Escape') {
        useChartStore.getState().setActiveTool(null);
      }
      // Ctrl+S → open snapshot publisher
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        setShowSnapshotPublisher(true);
      }
      // Cmd+K / Ctrl+K → open AI Copilot
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowCopilot((prev) => !prev);
      }
      // Keyboard shortcuts overlay: ? key
      if (
        (e.key === '?' || (e.shiftKey && e.key === '/')) &&
        e.target.tagName !== 'INPUT' &&
        e.target.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }
      // Number keys 1-6 for TF switching
      if (
        !e.ctrlKey && !e.metaKey && !e.altKey &&
        e.target.tagName !== 'INPUT' &&
        e.target.tagName !== 'TEXTAREA'
      ) {
        const tfMap = { '1': '1m', '2': '5m', '3': '15m', '4': '1h', '5': '4h', '6': '1D' };
        if (tfMap[e.key]) {
          e.preventDefault();
          setTf(tfMap[e.key]);
        }
      }
      // I key → toggle insights panel
      if (
        e.key === 'i' &&
        !e.ctrlKey && !e.metaKey && !e.altKey &&
        e.target.tagName !== 'INPUT' &&
        e.target.tagName !== 'TEXTAREA'
      ) {
        setShowInsights((prev) => !prev);
      }
      // Ctrl+I → toggle indicator panel
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        setShowIndicators((prev) => !prev);
      }
      // Drawing tool shortcuts (L, R, T, H)
      if (
        !e.ctrlKey && !e.metaKey && !e.altKey &&
        e.target.tagName !== 'INPUT' &&
        e.target.tagName !== 'TEXTAREA'
      ) {
        const toolMap = { l: 'line', r: 'rectangle', t: 'trendline', h: 'horizontal' };
        if (toolMap[e.key]) {
          e.preventDefault();
          const store = useChartStore.getState();
          store.setActiveTool(store.activeTool === toolMap[e.key] ? null : toolMap[e.key]);
        }
      }
      // D → toggle drawing sidebar
      if (
        e.key === 'd' &&
        !e.ctrlKey && !e.metaKey && !e.altKey &&
        e.target.tagName !== 'INPUT' &&
        e.target.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        setDrawSidebarOpen((prev) => !prev);
      }
      // F → toggle focus mode
      if (
        e.key === 'f' &&
        !e.ctrlKey && !e.metaKey && !e.altKey &&
        e.target.tagName !== 'INPUT' &&
        e.target.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        setFocusMode((prev) => !prev);
      }
      // + / = → zoom in, - → zoom out
      if (
        (e.key === '+' || e.key === '=' || e.key === '-') &&
        !e.ctrlKey && !e.metaKey &&
        e.target.tagName !== 'INPUT' &&
        e.target.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('charEdge:chart-zoom', {
          detail: { direction: e.key === '-' ? 'out' : 'in' },
        }));
      }
      // / → open symbol search
      if (
        e.key === '/' &&
        !e.shiftKey && !e.ctrlKey && !e.metaKey &&
        e.target.tagName !== 'INPUT' &&
        e.target.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        const searchInput = document.querySelector('.tf-chart-toolbar-btn input, .tf-symbol-search-input');
        if (searchInput) {
          searchInput.focus();
          searchInput.select?.();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
