// ═══════════════════════════════════════════════════════════════════
// charEdge — Journal Page (Orchestrator)
//
// Narrative layout:
//   1. Header — title, CTA, search pill, insight sub-tabs
//   2. Full pane — Dashboard / Analytics / Notes / Plans
//   3. Inspector — §4.12 Liquid Glass modeless trailing inspector
//
// Logbook is accessed via the header segmented button (📓 Logbook | + Add Trade)
// Mobile: delegates to JournalMobileView.
// ═══════════════════════════════════════════════════════════════════

// eslint-disable-next-line import/order
import { useState, useEffect, useCallback } from 'react';

// Analytics
import CSVImportModal from '../app/components/dialogs/CSVImportModal.jsx';
import TradeFormModal from '../app/components/dialogs/TradeFormModal.jsx';
import TradingJournalInspector from '../app/components/journal/TradingJournalInspector.jsx';
import CooldownOverlay from '../app/components/panels/CooldownOverlay.jsx';
// eslint-disable-next-line import/order
import { computeAndStore } from '../app/features/analytics/analyticsSingleton.js';

// Cooldown
// eslint-disable-next-line import/order
import { useCooldownEnforcer } from '../hooks/useCooldownEnforcer.js';

// Modals

// §4.12: Liquid Glass trailing inspector
import { useAnalyticsStore } from '../state/useAnalyticsStore';
// eslint-disable-next-line import/order
import { useJournalStore } from '../state/useJournalStore';
import { useAccountStore } from '../state/useAccountStore';

// Extracted hooks + components
// eslint-disable-next-line import/order
import {
  useJournalFilters,
  useJournalKeyboardHandler,
  useJournalTradeActions,
  JournalHeader,
  JournalMobileView,
} from './journal/index.js';

// Extracted top-pane renderer
import JournalTopPane from './journal/JournalTopPane.jsx';
import { useBreakpoints } from '@/hooks/useMediaQuery';

export default function JournalPage() {
  const trades = useJournalStore((s) => s.trades);
  const switching = useAccountStore((s) => s.switching);
  const isDemo = useAccountStore((s) => s.activeAccountId === 'demo');
  const { isMobile } = useBreakpoints();

  // ─── Fallback: seed demo data if demo account is empty ────
  useEffect(() => {
    if (!isDemo || trades.length > 0 || switching) return;
    let cancelled = false;
    (async () => {
      try {
        const { genDemoData } = await import('../data/demoData.js');
        const demo = genDemoData();
        if (cancelled || !demo.trades?.length) return;
        console.info(`[JournalPage] Fallback seeding ${demo.trades.length} demo trades`);
        useJournalStore.getState().hydrate({
          trades: demo.trades,
          playbooks: demo.playbooks,
          notes: [],
          tradePlans: [],
        });
      } catch (err) {
        console.warn('[JournalPage] Fallback demo seed failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [isDemo, trades.length, switching]);

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
    const onJournalTab = (e) => {
      if (e.detail) setJournalTab(e.detail);
    };
    // Keyboard handler dispatches these for edit/delete
    const onEditTrade = (e) => {
      if (e.detail) actions.handleEdit(e.detail);
    };
    const onDeleteConfirm = (e) => {
      if (e.detail) actions.setDeleteConfirm(e.detail);
    };
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
    expandedId: null,
    setExpandedId: () => {},
    focusedIdx: -1,
    setFocusedIdx: () => {},
    bulkMode: false,
    setBulkMode: () => {},
    bulk: {
      selectNone: () => {},
      toggle: () => {},
      isSelected: () => false,
      selectAll: () => {},
      invertSelection: () => {},
      count: 0,
      allSelected: false,
    },
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
        <TradingJournalInspector trade={inspectedTrade} isOpen={inspectorOpen} onClose={closeInspector} />
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // DESKTOP RENDER — Full-height single pane (logbook in ⌘K)
  // ═══════════════════════════════════════════════════════════════
  return (
    <div
      role="main"
      aria-label="Journal"
      data-container="journal"
      style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}
    >
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

      {/* ─── Full-Height Work Area (crossfade during account switch) ──── */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        opacity: switching ? 0.6 : 1,
        transition: 'opacity 0.15s ease-out',
        willChange: switching ? 'opacity' : 'auto',
      }}>
        <JournalTopPane
          journalTab={journalTab}
          result={result}
          computing={computing}
          trades={trades}
          filters={filters}
        />
      </div>

      {/* ─── Modals ──── */}
      <TradeFormModal isOpen={actions.tradeFormOpen} onClose={actions.closeTradeForm} editTrade={actions.editTrade} />
      <CSVImportModal isOpen={actions.csvModalOpen} onClose={() => actions.setCsvModalOpen(false)} />
      {/* Wave 0: PublishTradeModal quarantined — social features removed from v1.0 scope */}

      {/* §4.12: Liquid Glass Trailing Inspector */}
      <TradingJournalInspector trade={inspectedTrade} isOpen={inspectorOpen} onClose={closeInspector} />
    </div>
  );
}
