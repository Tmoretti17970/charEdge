// ═══════════════════════════════════════════════════════════════════
// charEdge — Import Hub Page (Phase 6 Sprint 6.1)
//
// Dashboard view for trade imports with:
//  - Hero stats (total imports, trades, broker breakdown)
//  - Quick-import cards (CSV, JSON, Excel, Clipboard, OFX)
//  - Recent import history list
//
// Theme-aware — inherits current light/dark palette.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import CSVImportModal from '../app/components/dialogs/CSVImportModal.jsx';
import BrokerGuides from '../app/components/import/BrokerGuides.jsx';
import { C, F, M } from '../constants.js';
import { useImportHistoryStore } from '../state/useImportHistoryStore.js';
import { useJournalStore } from '../state/useJournalStore.js';
import { fmtD } from '../utils.js';

// Phase 7: Lazy-loaded connector components
const ConnectedAccountsPanel = lazy(() => import('../app/components/import/ConnectedAccountsPanel.jsx'));
const ConnectorWizard = lazy(() => import('../app/components/import/ConnectorWizard.jsx'));
const PropFirmDashboard = lazy(() => import('../app/components/import/PropFirmDashboard.jsx'));

// Use theme-aware palette (matches logbook / add-trade sections)

// ─── Import Format Cards ────────────────────────────────────────

const IMPORT_FORMATS = [
  {
    id: 'csv',
    icon: '📄',
    label: 'CSV / TSV',
    desc: 'Upload CSV files from any broker',
    badge: '15 brokers',
    available: true,
  },
  { id: 'json', icon: '📋', label: 'JSON', desc: 'Import charEdge JSON backups', badge: null, available: true },
  {
    id: 'clipboard',
    icon: '📎',
    label: 'Clipboard Paste',
    desc: 'Paste from spreadsheets or web tables',
    badge: 'NEW',
    available: true,
  },
  {
    id: 'excel',
    icon: '📊',
    label: 'Excel (.xlsx)',
    desc: 'Import Excel workbooks directly',
    badge: 'NEW',
    available: true,
  },
  {
    id: 'ofx',
    icon: '🏦',
    label: 'OFX / QFX / QIF',
    desc: 'Bank & brokerage statement formats',
    badge: 'NEW',
    available: true,
  },
  {
    id: 'html',
    icon: '🌐',
    label: 'HTML Statement',
    desc: 'MT5 & cTrader HTML reports',
    badge: 'NEW',
    available: true,
  },
];

// ─── Stat Card ──────────────────────────────────────────────────

function StatCard({ label, value, sub, color }) {
  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: 10,
        background: C.sf,
        border: `1px solid ${C.bd}30`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        flex: 1,
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: C.t3,
          fontFamily: M,
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          fontFamily: M,
          color: color || C.t1,
          lineHeight: 1.1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: C.t3, fontFamily: M, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ─── Format Card ────────────────────────────────────────────────

function FormatCard({ format, onClick }) {
  const [hovered, setHovered] = useState(false);
  const disabled = !format.available;

  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={disabled}
      style={{
        padding: '12px 14px',
        borderRadius: 10,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        background: hovered && !disabled ? `${C.b}12` : C.sf,
        border: hovered && !disabled ? `1px solid ${C.b}30` : `1px solid ${C.bd}25`,
        transition: 'all 0.18s ease',
        transform: hovered && !disabled ? 'translateY(-1px)' : 'none',
        boxShadow: hovered && !disabled ? `0 4px 12px rgba(0,0,0,0.08), 0 0 0 1px ${C.b}10` : 'none',
        position: 'relative',
        overflow: 'hidden',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        width: '100%',
        color: C.t1,
      }}
    >
      <span
        style={{
          fontSize: 24,
          flexShrink: 0,
          lineHeight: 1,
          filter: hovered ? 'none' : 'saturate(0.85)',
          transition: 'filter 0.15s',
        }}
      >
        {format.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: F, marginBottom: 1 }}>{format.label}</div>
        <div style={{ fontSize: 10, color: C.t3, lineHeight: 1.3, fontFamily: F }}>{format.desc}</div>
      </div>
      {format.badge && (
        <span
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            fontSize: 7,
            fontWeight: 700,
            fontFamily: M,
            padding: '1px 5px',
            borderRadius: 3,
            background: format.badge === 'NEW' ? `${C.g}18` : `${C.b}18`,
            color: format.badge === 'NEW' ? C.g : C.b,
            letterSpacing: '0.04em',
          }}
        >
          {format.badge}
        </span>
      )}
    </button>
  );
}

// ─── History Row ────────────────────────────────────────────────

function HistoryRow({ batch, onRollback }) {
  const [hovered, setHovered] = useState(false);
  const isRolledBack = batch.status === 'rolled_back';
  const dateStr = new Date(batch.timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = new Date(batch.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 14px',
        borderBottom: `1px solid ${C.bd}20`,
        background: hovered ? `${C.sf}80` : 'transparent',
        opacity: isRolledBack ? 0.45 : 1,
        transition: 'background 0.1s',
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>{isRolledBack ? '↩️' : '📥'}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: F }}>
            {batch.brokerLabel || batch.broker}
          </span>
          <span style={{ fontSize: 10, color: C.t3, fontFamily: M }}>{batch.fileName}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, fontSize: 10, color: C.t3, fontFamily: M, marginTop: 1 }}>
          <span>
            {batch.tradeCount} trade{batch.tradeCount !== 1 ? 's' : ''}
          </span>
          {batch.duplicatesSkipped > 0 && <span>· {batch.duplicatesSkipped} dupes skipped</span>}
          <span>
            · {dateStr} {timeStr}
          </span>
          {isRolledBack && <span style={{ color: C.y, fontWeight: 700 }}>Rolled back</span>}
        </div>
      </div>
      <div
        style={{
          fontSize: 12,
          fontFamily: M,
          fontWeight: 700,
          color: (batch.totalPnl || 0) >= 0 ? C.g : C.r,
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
        }}
      >
        {fmtD(batch.totalPnl || 0)}
      </div>
      {!isRolledBack && hovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRollback(batch.id);
          }}
          style={{
            fontSize: 10,
            padding: '2px 7px',
            flexShrink: 0,
            borderRadius: 5,
            border: `1px solid ${C.bd}40`,
            background: 'transparent',
            color: C.t3,
            fontFamily: F,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Rollback
        </button>
      )}
    </div>
  );
}

// ─── Import Hub Page ────────────────────────────────────────────

function ImportPage() {
  const { batches, loaded, load, getStats } = useImportHistoryStore();
  const trades = useJournalStore((s) => s.trades);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [rollbackConfirm, setRollbackConfirm] = useState(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  const stats = getStats();

  const handleFormatClick = useCallback((formatId) => {
    if (formatId === 'csv' || formatId === 'json') {
      setCsvModalOpen(true);
    }
  }, []);

  const handleRollback = useCallback((batchId) => {
    setRollbackConfirm(batchId);
  }, []);

  const confirmRollback = useCallback(() => {
    if (!rollbackConfirm) return;
    useJournalStore.getState().deleteBatch(rollbackConfirm);
    useImportHistoryStore.getState().rollbackBatch(rollbackConfirm);
    setRollbackConfirm(null);
  }, [rollbackConfirm]);

  return (
    <div
      style={{
        padding: '24px 28px',
        maxWidth: 920,
        margin: '0 auto',
        width: '100%',
        color: C.t1,
      }}
    >
      {/* ─── Header ──────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <h1
            style={{
              fontSize: 18,
              fontWeight: 800,
              fontFamily: F,
              color: C.t1,
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            📥 Import Hub
          </h1>
          <p style={{ fontSize: 11, color: C.t3, margin: '3px 0 0', fontFamily: F }}>
            Import trades from any source — CSV, JSON, Excel, or paste from clipboard
          </p>
        </div>
        <button
          onClick={() => setCsvModalOpen(true)}
          style={{
            padding: '7px 16px',
            borderRadius: 8,
            border: 'none',
            background: C.b,
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            fontFamily: F,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: `0 2px 8px ${C.b}40`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = `0 4px 16px ${C.b}50`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = `0 2px 8px ${C.b}40`;
          }}
        >
          + Import Trades
        </button>
      </div>

      {/* ─── Hero Stats ──────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 24 }}>
        <StatCard
          label="Total Imports"
          value={stats.totalImports}
          sub={stats.lastImport ? `Last: ${new Date(stats.lastImport).toLocaleDateString()}` : 'No imports yet'}
        />
        <StatCard
          label="Trades Imported"
          value={stats.totalTrades.toLocaleString()}
          sub={`${trades.length.toLocaleString()} total in journal`}
        />
        <StatCard
          label="Brokers Used"
          value={stats.brokers.length}
          sub={stats.brokers.slice(0, 3).join(', ') || 'None'}
        />
        <StatCard label="Journal Size" value={trades.length.toLocaleString()} sub="total trades" color={C.b} />
      </div>

      {/* ─── Connected Accounts (Phase 7) ──────────────── */}
      <Suspense fallback={null}>
        <ConnectedAccountsPanel onConnectNew={() => setWizardOpen(true)} />
      </Suspense>

      {/* ─── Import Formats ──────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <h2
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: C.t2,
            fontFamily: F,
            marginBottom: 8,
            letterSpacing: '-0.01em',
          }}
        >
          Import Sources
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {IMPORT_FORMATS.map((fmt) => (
            <FormatCard key={fmt.id} format={fmt} onClick={() => handleFormatClick(fmt.id)} />
          ))}
        </div>
      </div>

      {/* ─── Broker Export Guides (Sprint 6.4) ────────────── */}
      <div style={{ marginBottom: 24 }}>
        <BrokerGuides />
      </div>

      {/* ─── Prop Firm Tracker (Phase 7 Sprint 7.10) ──── */}
      <Suspense fallback={null}>
        <PropFirmDashboard />
      </Suspense>

      {/* ─── Import History ──────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: C.t2,
              fontFamily: F,
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            Import History
          </h2>
          {batches.length > 0 && (
            <span style={{ fontSize: 10, color: C.t3, fontFamily: M }}>
              {batches.filter((b) => b.status === 'active').length} active ·{' '}
              {batches.filter((b) => b.status === 'rolled_back').length} rolled back
            </span>
          )}
        </div>

        <div
          style={{
            borderRadius: 10,
            overflow: 'hidden',
            background: C.sf,
            border: `1px solid ${C.bd}25`,
          }}
        >
          {batches.length === 0 ? (
            <div style={{ padding: 36, textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>📥</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.t2, marginBottom: 3, fontFamily: F }}>
                No imports yet
              </div>
              <div style={{ fontSize: 10, color: C.t3, fontFamily: F }}>Import your first trades to get started</div>
            </div>
          ) : (
            batches.slice(0, 20).map((batch) => <HistoryRow key={batch.id} batch={batch} onRollback={handleRollback} />)
          )}
        </div>
      </div>

      {/* ─── CSV Import Modal ────────────────────────────── */}
      <CSVImportModal isOpen={csvModalOpen} onClose={() => setCsvModalOpen(false)} />

      {/* ─── Connector Wizard Modal (Phase 7) ────────────── */}
      <Suspense fallback={null}>{wizardOpen && <ConnectorWizard onClose={() => setWizardOpen(false)} />}</Suspense>

      {/* ─── Rollback Confirmation ────────────────────────── */}
      {rollbackConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setRollbackConfirm(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: 24,
              maxWidth: 380,
              width: '90%',
              borderRadius: 14,
              background: C.bg2,
              border: `1px solid ${C.bd}40`,
              boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
            }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 700, color: C.t1, fontFamily: F, marginBottom: 8 }}>
              Rollback Import?
            </h3>
            <p style={{ fontSize: 12, color: C.t3, marginBottom: 16, lineHeight: 1.4, fontFamily: F }}>
              This will remove all trades from this import batch. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setRollbackConfirm(null)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: `1px solid ${C.bd}40`,
                  background: 'transparent',
                  color: C.t2,
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: F,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmRollback}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: C.r,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: F,
                  cursor: 'pointer',
                }}
              >
                Rollback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(ImportPage);
