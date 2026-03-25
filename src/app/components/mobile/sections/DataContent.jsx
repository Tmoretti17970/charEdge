// ═══════════════════════════════════════════════════════════════════
// Mobile Settings — Data Section
// Import/export trades, performance reports.
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef } from 'react';
import { exportCSV, exportJSON, downloadFile, importFile } from '../../../../data/ImportExport.js';
import { useJournalStore } from '../../../../state/useJournalStore';
import { radii } from '../../../../theme/tokens.js';
import { computeFast } from '../../../features/analytics/analyticsFast.js';
import { generateReport, downloadReport } from '../../../features/analytics/ReportGenerator.js';
import { MobileRow, MobileBtn, MobileAlert } from '../MobilePrimitives.jsx';
import { C, M } from '@/constants.js';

export default function DataContent() {
  const trades = useJournalStore((s) => s.trades);
  const setTrades = useJournalStore((s) => s.setTrades);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [dedupMode, setDedupMode] = useState('skip');
  const lastFileRef = useRef(null);

  const handleExportCSV = () => {
    const csv = exportCSV(trades);
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(csv, `charEdge-export-${date}.csv`, 'text/csv');
  };

  const handleExportJSON = () => {
    const json = exportJSON(trades);
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(json, `charEdge-export-${date}.json`, 'application/json');
  };

  const handleExportReport = () => {
    const analytics = computeFast(trades);
    const md = generateReport(trades, analytics, { title: 'charEdge Performance Report' });
    downloadReport(md);
  };

  const runImport = async (file, mode) => {
    setImporting(true);
    setImportResult(null);
    const opts = mode === 'skip' ? { existingTrades: trades } : {};
    const result = await importFile(file, opts);
    setImporting(false);
    if (!result.ok) {
      setImportResult({ ok: false, message: result.error });
      return;
    }
    const parts = [`${result.brokerLabel || result.broker}: ${result.count} trade${result.count !== 1 ? 's' : ''}`];
    if (result.duplicates > 0) parts.push(`${result.duplicates} dup${result.duplicates !== 1 ? 's' : ''} skipped`);
    if (result.skipped > 0) parts.push(`${result.skipped} skipped`);
    setImportResult({
      ok: true,
      message: parts[0] + (parts.length > 1 ? ` (${parts.slice(1).join(', ')})` : ''),
      trades: result.trades,
      duplicates: result.duplicates || 0,
    });
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    lastFileRef.current = file;
    setDedupMode('skip');
    await runImport(file, 'skip');
  };

  const handleDedupChange = async (mode) => {
    setDedupMode(mode);
    if (lastFileRef.current) {
      await runImport(lastFileRef.current, mode);
    }
  };

  const confirmImport = () => {
    if (!importResult?.trades?.length) return;
    const merged = [...trades, ...importResult.trades];
    setTrades(merged);
    setImportResult({
      ok: true,
      message: `✅ Imported ${importResult.trades.length} trades. Total: ${merged.length}.`,
      trades: null,
    });
    lastFileRef.current = null;
  };

  return (
    <div>
      {/* Trade count badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px',
          background: C.sf2,
          borderRadius: radii.md,
          marginBottom: 16,
        }}
      >
        <span style={{ fontSize: 22 }}>📊</span>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: M, color: C.t1 }}>{trades.length}</div>
          <div style={{ fontSize: 12, color: C.t3 }}>trade{trades.length !== 1 ? 's' : ''} stored</div>
        </div>
      </div>

      {/* Export */}
      <div style={{ fontSize: 12, fontWeight: 600, color: C.t2, marginBottom: 8 }}>Export</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        <MobileBtn onClick={handleExportCSV}>📥 Export CSV</MobileBtn>
        <MobileBtn onClick={handleExportJSON}>📥 Export JSON</MobileBtn>
        <MobileBtn onClick={handleExportReport}>📊 Performance Report</MobileBtn>
      </div>

      {/* Import */}
      <div style={{ paddingTop: 16, borderTop: `1px solid ${C.bd}` }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.t2, marginBottom: 4 }}>Import</div>
        <div style={{ fontSize: 11, color: C.t3, marginBottom: 10 }}>
          Tradovate, NinjaTrader, ThinkorSwim, TradeStation, IBKR, Robinhood, Webull, MT5, Binance, Coinbase, Kraken,
          Bybit, Fidelity, or CSV/JSON
        </div>

        <MobileRow label="Choose file">
          <input
            type="file"
            accept=".csv,.json,.txt"
            onChange={handleImport}
            disabled={importing}
            style={{
              fontSize: 14,
              fontFamily: 'var(--font-primary, Inter, sans-serif)',
              color: C.t2,
              padding: '10px 0',
              minHeight: 44,
            }}
          />
        </MobileRow>

        {importing && <div style={{ fontSize: 13, color: C.b, fontFamily: M, marginBottom: 8 }}>Parsing...</div>}

        <MobileAlert ok={importResult?.ok} message={importResult?.message} />

        {importResult?.trades?.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {/* Dedup toggle */}
            <div style={{ fontSize: 11, fontWeight: 600, color: C.t3, marginBottom: 6 }}>Duplicate handling</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {[
                { id: 'skip', label: '🛡️ Skip dupes' },
                { id: 'all', label: '📥 Import all' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleDedupChange(opt.id)}
                  disabled={importing}
                  className="tf-btn"
                  style={{
                    fontSize: 12,
                    padding: '8px 14px',
                    minHeight: 36,
                    borderRadius: radii.md,
                    border: `1px solid ${dedupMode === opt.id ? C.b : C.bd}`,
                    background: dedupMode === opt.id ? C.b + '15' : 'transparent',
                    color: dedupMode === opt.id ? C.b : C.t2,
                    fontWeight: 600,
                    fontFamily: 'var(--font-primary, Inter, sans-serif)',
                    cursor: importing ? 'wait' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {importResult.duplicates > 0 && (
              <div style={{ fontSize: 12, color: C.w, fontFamily: M, marginBottom: 8 }}>
                ⚠️ {importResult.duplicates} duplicate{importResult.duplicates !== 1 ? 's' : ''} detected
              </div>
            )}
            <MobileBtn onClick={confirmImport}>✅ Confirm ({importResult.trades.length} trades)</MobileBtn>
          </div>
        )}
      </div>
    </div>
  );
}
