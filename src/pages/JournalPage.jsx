// ═══════════════════════════════════════════════════════════════════
// charEdge — Journal Page (Orchestrator)
//
// Narrative layout:
//   1. Header — title, CTA, insight sub-tabs
//   2. Top pane — Dashboard / Analytics / Notes / Plans
//   3. Bottom pane — Logbook (filters, trade table)
//   4. Inspector — §4.12 Liquid Glass modeless trailing inspector
//
// Mobile: delegates to JournalMobileView.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import { useJournalStore } from '../state/useJournalStore.js';
import { useBreakpoints } from '../utils/useMediaQuery.js';

// Analytics
import { useAnalyticsStore } from '../state/useAnalyticsStore.js';
import { computeAndStore } from '../app/features/analytics/analyticsSingleton.js';

// Split Pane
import SplitPaneLayout from '../app/components/ui/SplitPaneLayout.jsx';
import CooldownOverlay from '../app/components/panels/CooldownOverlay.jsx';
import { useCooldownEnforcer } from '../hooks/useCooldownEnforcer.js';

// Modals
import TradeFormModal from '../app/components/dialogs/TradeFormModal.jsx';
import CSVImportModal from '../app/components/dialogs/CSVImportModal.jsx';
// Wave 0: PublishTradeModal quarantined — social features removed from v1.0 scope

// §4.12: Liquid Glass trailing inspector
import TradingJournalInspector from '../app/components/journal/TradingJournalInspector.jsx';

// Bulk selection
import { useBulkSelection } from '../app/features/journal/journal_ui/BulkOperations.jsx';

// Extracted hooks + components
import {
  useJournalFilters,
  useJournalKeyboardHandler,
  useJournalTradeActions,
  JournalLogbook,
  JournalHeader,
  JournalMobileView,
} from './journal/index.js';

// Extracted top-pane renderer
import JournalTopPane from './journal/JournalTopPane.jsx';

export default function JournalPage() {
  const trades = useJournalStore((s) => s.trades);
  const { isMobile, isTablet } = useBreakpoints();

  // ─── Journal tab state ──────────────────────────────────────
  const [journalTab, setJournalTab] = useState('dashboard');

  // ─── §4.12: Inspector state ─────────────────────────────────
  const [inspectedTrade, setInspectedTrade] = useState(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const openInspector = useCallback((trade) => {
    setInspectedTrade(trade);
    setInspectorOpen(true);
  }, []);

  const closeInspector = useCallback(() => {
    setInspectorOpen(false);
    setInspectedTrade(null);
  }, []);

  // ─── Hooks ──────────────────────────────────────────────────
  const filters = useJournalFilters(trades);
  const actions = useJournalTradeActions(trades);
  const bulk = useBulkSelection(filters.filteredTrades);

  // ─── UI state ───────────────────────────────────────────────
  const [expandedId, setExpandedId] = useState(null);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const [bulkMode, setBulkMode] = useState(false);
  const [showAIGrades, setShowAIGrades] = useState(false);

  // ─── Analytics ──────────────────────────────────────────────
  const result = useAnalyticsStore((s) => s.result);
  const computing = useAnalyticsStore((s) => s.computing);

  useEffect(() => {
    computeAndStore(trades, { mcRuns: 200 });
  }, [trades]);

  // ─── Sprint 3: Cooldown Enforcer ────────────────────────────
  const cooldown = useCooldownEnforcer();

  // ─── Command palette events ─────────────────────────────────
  useEffect(() => {
    const onAddTrade = () => actions.openAddTrade();
    const onImportCSV = () => actions.setCsvModalOpen(true);
    const onJournalTab = (e) => { if (e.detail) setJournalTab(e.detail); };
    // Keyboard handler dispatches these for edit/delete
    const onEditTrade = (e) => { if (e.detail) actions.handleEdit(e.detail); };
    const onDeleteConfirm = (e) => { if (e.detail) actions.setDeleteConfirm(e.detail); };
    // §4.12: Open inspector from chart trade marker click
    const onInspectTrade = (e) => {
      if (e.detail) {
        const trade = trades.find((t) => t.id === e.detail);
        if (trade) openInspector(trade);
      }
    };

    window.addEventListener('charEdge:add-trade', onAddTrade);
    window.addEventListener('charEdge:import-csv', onImportCSV);
    window.addEventListener('charEdge:journal-tab', onJournalTab);
    window.addEventListener('charEdge:edit-trade', onEditTrade);
    window.addEventListener('charEdge:delete-confirm', onDeleteConfirm);
    window.addEventListener('charEdge:inspect-trade', onInspectTrade);
    return () => {
      window.removeEventListener('charEdge:add-trade', onAddTrade);
      window.removeEventListener('charEdge:import-csv', onImportCSV);
      window.removeEventListener('charEdge:journal-tab', onJournalTab);
      window.removeEventListener('charEdge:edit-trade', onEditTrade);
      window.removeEventListener('charEdge:delete-confirm', onDeleteConfirm);
      window.removeEventListener('charEdge:inspect-trade', onInspectTrade);
    };
  }, [actions, trades, openInspector]);

  // ─── Keyboard shortcuts ─────────────────────────────────────
  useJournalKeyboardHandler({
    filteredTrades: filters.filteredTrades,
    storeActions: actions.storeActions,
    expandedId,
    setExpandedId,
    focusedIdx,
    setFocusedIdx,
    bulkMode,
    setBulkMode,
    bulk,
    trades,
    openAddTrade: actions.openAddTrade,
    handleExportCSV: actions.handleExportCSV,
    modalsOpen: actions.tradeFormOpen || actions.csvModalOpen,
  });

  // ═══════════════════════════════════════════════════════════════
  // MOBILE RENDER
  // ═══════════════════════════════════════════════════════════════
  if (isMobile) {
    return (
      <>
        <JournalMobileView
          trades={trades}
          journalTab={journalTab}
          setJournalTab={setJournalTab}
          result={result}
          handleEdit={actions.handleEdit}
          handleDelete={actions.handleDelete}
          openAddTrade={actions.openAddTrade}
          tradeFormOpen={actions.tradeFormOpen}
          closeTradeForm={actions.closeTradeForm}
          editTrade={actions.editTrade}
          csvModalOpen={actions.csvModalOpen}
          setCsvModalOpen={actions.setCsvModalOpen}
        />
        <TradingJournalInspector
          trade={inspectedTrade}
          isOpen={inspectorOpen}
          onClose={closeInspector}
        />
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // DESKTOP RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div role="main" aria-label="Journal" data-container="journal" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <JournalHeader
        journalTab={journalTab}
        setJournalTab={setJournalTab}
        openAddTrade={actions.openAddTrade}
        tradeCount={trades.length}
      />

      {/* Sprint 3: Cooldown Overlay */}
      <CooldownOverlay
        isActive={cooldown.isActive}
        minutesLeft={cooldown.minutesLeft}
        secondsLeft={cooldown.secondsLeft}
        onOverride={cooldown.override}
      />

      {/* ─── Work Area (Split Pane) ──── */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <SplitPaneLayout
          topPane={
            <JournalTopPane
              journalTab={journalTab}
              result={result}
              computing={computing}
              trades={trades}
              filters={filters}
            />
          }
          bottomPane={
            <JournalLogbook
              trades={trades}
              filteredTrades={filters.filteredTrades}
              filters={filters}
              bulk={bulk}
              bulkMode={bulkMode}
              setBulkMode={setBulkMode}
              expandedId={expandedId}
              setExpandedId={setExpandedId}
              deleteConfirm={actions.deleteConfirm}
              isTablet={isTablet}
              handleSort={filters.handleSort}
              handleEdit={actions.handleEdit}
              handleDelete={actions.handleDelete}
              setDeleteConfirm={actions.setDeleteConfirm}
              handleViewOnChart={actions.handleViewOnChart}
              handleReplay={actions.handleReplay}
              handleShare={actions.handleShare}
              handleExportCSV={actions.handleExportCSV}
              handleBulkDelete={actions.handleBulkDelete}
              handleBulkTag={actions.handleBulkTag}
              handleBulkEdit={actions.handleBulkEdit}
              handleBulkExport={actions.handleBulkExport}
              openAddTrade={actions.openAddTrade}
              setCsvModalOpen={actions.setCsvModalOpen}
              showAIGrades={showAIGrades}
              setShowAIGrades={setShowAIGrades}
              onInspectTrade={openInspector}
            />
          }
          defaultTopHeight={typeof window !== 'undefined' ? window.innerHeight * 0.45 : 400}
          minTopHeight={60}
          maxTopHeight={typeof window !== 'undefined' ? window.innerHeight * 0.85 : 800}
          collapsible={true}
          snapThreshold={120}
          startBottomCollapsed={true}
          bottomCollapsedLabel="Logbook"
          bottomCollapsedMeta={`${trades.length} trade${trades.length !== 1 ? 's' : ''}`}
        />
      </div>

      {/* ─── Modals ──── */}
      <TradeFormModal
        isOpen={actions.tradeFormOpen}
        onClose={actions.closeTradeForm}
        editTrade={actions.editTrade}
      />
      <CSVImportModal isOpen={actions.csvModalOpen} onClose={() => actions.setCsvModalOpen(false)} />
      {/* Wave 0: PublishTradeModal quarantined — social features removed from v1.0 scope */}

      {/* §4.12: Liquid Glass Trailing Inspector */}
      <TradingJournalInspector
        trade={inspectedTrade}
        isOpen={inspectorOpen}
        onClose={closeInspector}
      />
    </div>
  );
}

