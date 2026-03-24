// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — CSV Import Modal
// Upload → Parse → Preview → Confirm → Import
// Uses csv.js importCSV() for parsing
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useRef, useCallback } from 'react';
import { importCSV } from '../../../charting_library/datafeed/csv.js';
import { safeSum } from '../../../charting_library/model/Money.js';
import { reconcile } from '../../../charting_library/model/reconcile.js';
import { C, F, M } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore';
import { fmtD } from '../../../utils.js';
import { brokerBadge } from '../../features/trading/BrokerProfiles.js';
import toast from '../ui/Toast.jsx';
import { ModalOverlay, Btn } from '../ui/UIKit.jsx';
import s from './CSVImportModal.module.css';

function CSVImportModal({ isOpen, onClose }) {
  const addTrades = useJournalStore((s) => s.addTrades);
  const existingTrades = useJournalStore((s) => s.trades);

  const [stage, setStage] = useState('upload'); // 'upload' | 'preview' | 'done'
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState(null);
  const [recon, setRecon] = useState(null);
  const [reconOpen, setReconOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  // ─── Reset on close ───────────────────────────────────────
  const handleClose = () => {
    setStage('upload');
    setResult(null);
    setRecon(null);
    setReconOpen(false);
    setFileName('');
    onClose();
  };

  // ─── Parse file ───────────────────────────────────────────
  const processFile = useCallback(
    (file) => {
      if (!file) return;
      setFileName(file.name);

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const parsed = importCSV(text, existingTrades);
        setResult(parsed);

        // Run reconciliation on parsed trades
        if (parsed.trades.length > 0) {
          const reconResult = reconcile(parsed.trades);
          setRecon(reconResult);
          // Auto-expand panel if there are errors or warnings
          if (reconResult.summary.errors > 0 || reconResult.summary.warnings > 0) {
            setReconOpen(true);
          }
        } else {
          setRecon(null);
        }

        setStage('preview');
      };
      reader.readAsText(file);
    },
    [existingTrades],
  );

  // ─── Drag & Drop ──────────────────────────────────────────
  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.tsv') || file.name.endsWith('.txt'))) {
      processFile(file);
    }
  };

  // ─── Import confirmed trades ──────────────────────────────
  const handleImport = () => {
    if (result && result.trades.length > 0) {
      addTrades(result.trades);
      toast.success(`Imported ${result.trades.length} trades (${fmtD(totalPnl)})`);
    }
    setStage('done');
  };

  const totalPnl = result ? safeSum(result.trades.map((t) => t.pnl)) : 0;
  const importCount = result ? result.trades.length : 0;

  return (
    <ModalOverlay isOpen={isOpen} onClose={handleClose} width={640}>
      {/* Header */}
      <div className={s.s0}>
        <h2 className={s.headerTitle}>Import CSV</h2>
        <button className={`tf-btn ${s.closeBtn}`} onClick={handleClose}>
          ✕
        </button>
      </div>

      {/* ─── Stage: Upload ───────────────────────────── */}
      {stage === 'upload' && (
        <div>
          {/* Sprint 20: Connection Status Indicators */}
          <div className={s.connRow}>
            {[
              { label: 'CSV File', status: 'ready', icon: '⚙️', hint: 'Drop or browse' },
              { label: 'Auto-Detect', status: 'ready', icon: '✅', hint: 'Headers & delimiters' },
              { label: 'Dedup Engine', status: 'ready', icon: '✅', hint: 'Active' },
              { label: 'Reconciliation', status: 'ready', icon: '✅', hint: 'Quality grading' },
            ].map((conn, i) => (
              <div key={i} className={s.connCard}>
                <div className={s.connHeader}>
                  <span className={s.connIcon}>{conn.icon}</span>
                  <span className={s.connLabel}>{conn.label}</span>
                </div>
                <div className={s.connHint}>{conn.hint}</div>
              </div>
            ))}
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={s.dropZone}
            data-active={dragOver ? 'true' : undefined}
          >
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" style={{ display: 'none' }}
              onChange={(e) => processFile(e.target.files[0])} />
            <div className={s.s1}>📁</div>
            <div className={s.dropInstruction}>Drop CSV file here or click to browse</div>
            <div className={s.dropHint}>Supports .csv, .tsv, .txt · Auto-detects delimiters and headers</div>
          </div>
        </div>
      )}

      {/* ─── Stage: Preview ──────────────────────────── */}
      {stage === 'preview' && result && (
        <div>
          {/* File info bar */}
          <div className={s.fileBar}>
            <span className={s.fileName}>{fileName}</span>
            <div className={s.s2}>
              <span className={s.countGreen}>{result.valid} valid</span>
              {result.warnings > 0 && <span className={s.countYellow}>{result.warnings} warnings</span>}
              {result.errors > 0 && <span className={s.countRed}>{result.errors} errors</span>}
              {result.duplicates > 0 && <span className={s.countMuted}>{result.duplicates} dupes</span>}
              <span className={s.pnlValue} style={{ color: totalPnl >= 0 ? C.g : C.r }}>{fmtD(totalPnl)}</span>
            </div>
          </div>

          {/* Broker detection badge */}
          {result.broker && (
            <div
              className={s.brokerBadge}
              style={{
                background: result.broker.broker ? C.b + '10' : C.sf,
                border: `1px solid ${result.broker.broker ? C.b + '30' : C.bd}`,
              }}
            >
              {(() => {
                const badge = brokerBadge(result.broker);
                return (
                  <>
                    <span className={s.badgeIcon}>{badge.icon}</span>
                    <span className={s.badgeLabel}>{badge.label}</span>
                    <span className={s.badgeDetail}>{badge.detail}</span>
                  </>
                );
              })()}
            </div>
          )}

          {/* Preview table */}
          <div className={s.tableWrap}>
            <div className={s.tableHeader}>
              <div>#</div>
              <div>Symbol</div>
              <div>Side</div>
              <div>Strategy</div>
              <div style={{ textAlign: 'right' }}>P&L</div>
              <div>Date</div>
            </div>

            {result.trades.map((t, i) => (
              <div key={i} className={s.tableRow}>
                <div className={s.cellNum}>{i + 1}</div>
                <div className={s.cellSymbol}>{t.symbol || '—'}</div>
                <div className={s.cellSide} style={{ color: t.side === 'long' ? C.g : C.r }}>
                  {t.side || '—'}
                </div>
                <div className={s.cellStrategy}>{t.playbook || '—'}</div>
                <div className={s.cellPnl} style={{ color: (t.pnl || 0) >= 0 ? C.g : C.r }}>
                  {fmtD(t.pnl)}
                </div>
                <div className={s.cellDate}>
                  {t.date ? new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
                </div>
              </div>
            ))}

            {result.trades.length === 0 && (
              <div className={s.emptyState}>No valid trades found in this file.</div>
            )}
          </div>

          {/* Row-level issues (from csv.js) */}
          {result.issues.length > 0 && (
            <div className={s.s3}>
              {result.issues.slice(0, 10).map((issue, i) => (
                <div key={i} className={s.issueLine}>⚠ {issue}</div>
              ))}
              {result.issues.length > 10 && (
                <div className={s.issueMore}>...and {result.issues.length - 10} more</div>
              )}
            </div>
          )}

          {/* ─── Reconciliation Panel ──────────────────── */}
          {recon && recon.summary.total > 0 && (
            <div className={s.reconWrap}>
              <div
                onClick={() => setReconOpen(!reconOpen)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background:
                    recon.summary.errors > 0 ? C.r + '15' : recon.summary.warnings > 0 ? C.y + '15' : C.b + '10',
                  border: `1px solid ${recon.summary.errors > 0 ? C.r + '40' : recon.summary.warnings > 0 ? C.y + '40' : C.b + '25'}`,
                  borderRadius: reconOpen ? '8px 8px 0 0' : 8,
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'border-radius 0.15s',
                }}
              >
                <div className={s.s4}>
                  <span className={s.reconIcon}>
                    {recon.summary.errors > 0 ? '🔴' : recon.summary.warnings > 0 ? '🟡' : '🔵'}
                  </span>
                  <span className={s.reconTitle}>Data Quality: Grade {recon.summary.grade}</span>
                  <span className={s.reconPct}>{recon.summary.completeness}% complete</span>
                </div>
                <div className={s.s5}>
                  {recon.summary.errors > 0 && (
                    <span className={s.reconCount} style={{ color: C.r }}>
                      {recon.summary.errors} error{recon.summary.errors !== 1 ? 's' : ''}
                    </span>
                  )}
                  {recon.summary.warnings > 0 && (
                    <span className={s.reconCount} style={{ color: C.y }}>
                      {recon.summary.warnings} warning{recon.summary.warnings !== 1 ? 's' : ''}
                    </span>
                  )}
                  {recon.summary.infos > 0 && (
                    <span className={s.reconCountInfo} style={{ color: C.b }}>{recon.summary.infos} info</span>
                  )}
                  <span className={s.reconChevron} data-open={reconOpen ? 'true' : undefined}>▼</span>
                </div>
              </div>

              {reconOpen && (
                <div className={s.reconIssueList}>
                  {recon.issues.map((issue, i) => (
                    <div
                      key={i}
                      className={s.reconIssueRow}
                      style={{ borderBottom: i < recon.issues.length - 1 ? `1px solid ${C.bd}50` : 'none' }}
                    >
                      <span className={s.s6}>
                        {issue.severity === 'error' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵'}
                      </span>
                      <div>
                        <div className={s.reconIssueMsg}>{issue.message}</div>
                        <div className={s.reconIssueCode}>
                          {issue.code.replace(/_/g, ' ').toLowerCase()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reconciliation: clean badge (no issues) */}
          {recon && recon.summary.total === 0 && (
            <div className={s.cleanBadge}>
              <span className={s.cleanIcon}>✅</span>
              <span className={s.cleanLabel}>Data quality check passed — no issues detected</span>
            </div>
          )}

          {/* Actions */}
          <div className={s.s7}>
            <Btn
              variant="ghost"
              onClick={() => {
                setStage('upload');
                setResult(null);
                setRecon(null);
                setReconOpen(false);
              }}
            >
              Back
            </Btn>
            <Btn onClick={handleImport} disabled={importCount === 0}>
              Import {importCount} Trade{importCount !== 1 ? 's' : ''}
            </Btn>
          </div>
        </div>
      )}

      {/* ─── Stage: Done ─────────────────────────────── */}
      {stage === 'done' && (
        <div className={s.s8}>
          <div className={s.s9}>✅</div>
          <div className={s.doneTitle}>
            Imported {importCount} trade{importCount !== 1 ? 's' : ''}
          </div>
          <div className={s.doneSummary}>
            Total P&L: <span className={s.donePnl} style={{ color: totalPnl >= 0 ? C.g : C.r }}>{fmtD(totalPnl)}</span>
            {result && result.duplicates > 0 && <span> · {result.duplicates} duplicates skipped</span>}
            {result && result.errors > 0 && <span> · {result.errors} errors skipped</span>}
            {recon && <span> · Data quality: Grade {recon.summary.grade}</span>}
          </div>
          <Btn onClick={handleClose}>Done</Btn>
        </div>
      )}
    </ModalOverlay>
  );
}

export { CSVImportModal };

export default React.memo(CSVImportModal);
