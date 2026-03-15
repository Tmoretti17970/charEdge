// ═══════════════════════════════════════════════════════════════════
// charEdge v10.5 — Journal Trade Row (Sprint 9 update)
// Added: selection checkbox, context badge, replay button
// ═══════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { C, M } from '../../../../constants.js';
import { fmtD } from '../../../../utils.js';
import { Btn } from '../../../components/ui/UIKit.jsx';
import { gradeTrade } from '../../analytics/analyticsFast.js';
import { ContextBadge } from './JournalEvolution.jsx';
import ScreenshotLightbox from './ScreenshotLightbox.jsx';
import s from './JournalTradeRow.module.css';

const GRID_COLS = '28px 100px 80px 55px 1fr 80px 100px';
const GRID_COLS_NO_CHECK = '100px 80px 55px 1fr 80px 100px';

// ─── Desktop Grid Row ──────────────────────────────────────────

function DesktopRow({ trade: t, isExpanded, onClick, bulkMode, isSelected, onToggleSelect, showAIGrades }) {
  const aiGrade = showAIGrades ? gradeTrade(t) : null;
  const pnlColor = (t.pnl || 0) >= 0 ? C.g : C.r;

  return (
    <div
      className={s.desktopRow}
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: bulkMode ? GRID_COLS : GRID_COLS_NO_CHECK,
        padding: '10px 16px',
        borderBottom: `1px solid ${isExpanded ? 'transparent' : C.bd}40`,
        fontSize: 12,
        color: C.t1,
        cursor: 'pointer',
        background: isSelected ? C.b + '08' : isExpanded ? C.sf : 'transparent',
        borderLeft: isExpanded ? `3px solid ${C.b}` : `3px solid ${pnlColor}20`,
        position: 'relative',
      }}
    >
      {bulkMode && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(t.id);
          }}
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            border: `2px solid ${isSelected ? C.b : C.bd}`,
            background: isSelected ? C.b : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            alignSelf: 'center',
          }}
        >
          {isSelected && <span className={s.checkmark}>✓</span>}
        </div>
      )}
      <div style={{ fontFamily: M, fontSize: 11, color: C.t3, fontVariantNumeric: 'tabular-nums' }}>
        {t.date ? new Date(t.date).toLocaleDateString() : '—'}
      </div>
      <div className={s.symbolCell}>
        {t.symbol}
        {aiGrade && (
          <div
            style={{
              fontSize: 9,
              padding: '1px 5px',
              borderRadius: 4,
              fontFamily: M,
              background:
                aiGrade.score >= 4
                  ? C.g + '15'
                  : aiGrade.score >= 3
                    ? C.b + '15'
                    : aiGrade.score >= 2
                      ? C.y + '15'
                      : C.r + '15',
              color: aiGrade.score >= 4 ? C.g : aiGrade.score >= 3 ? C.b : aiGrade.score >= 2 ? C.y : C.r,
            }}
          >
            {aiGrade.grade}
          </div>
        )}
      </div>
      <div>
        <span
          style={{
            color: t.side === 'long' ? C.g : C.r,
            background: (t.side === 'long' ? C.g : C.r) + '12',
            padding: '2px 6px',
            borderRadius: 4,
            fontWeight: 700,
            fontSize: 9,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}
        >
          {t.side}
        </span>
      </div>
      <div style={{ color: C.t2, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
        {t.playbook || '—'}
        {t.context?.tags?.length > 0 && <ContextBadge context={t.context} />}
      </div>
      <div style={{ fontSize: 11, color: C.t2 }}>{t.emotion || '—'}</div>
      <div
        style={{
          textAlign: 'right',
          fontFamily: M,
          fontWeight: 700,
          color: pnlColor,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.3px',
        }}
      >
        {fmtD(t.pnl)}
      </div>
    </div>
  );
}

// ─── Mobile/Tablet Card Row ────────────────────────────────────

function MobileRow({ trade: t, isExpanded, onClick, bulkMode, isSelected, onToggleSelect, showAIGrades }) {
  const aiGrade = showAIGrades ? gradeTrade(t) : null;
  const pnlColor = (t.pnl || 0) >= 0 ? C.g : C.r;

  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 12px',
        borderBottom: `1px solid ${C.bd}40`,
        cursor: 'pointer',
        background: isSelected ? C.b + '08' : isExpanded ? C.sf : 'transparent',
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
        borderLeft: isExpanded ? `3px solid ${C.b}` : `3px solid ${pnlColor}20`,
        transition: 'all 0.15s ease',
      }}
    >
      {bulkMode && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(t.id);
          }}
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            border: `2px solid ${isSelected ? C.b : C.bd}`,
            background: isSelected ? C.b : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          {isSelected && <span className={s.mobileCheckmark}>✓</span>}
        </div>
      )}
      <div style={{ flex: 1 }}>
        <div className={s.mobileHeader}>
          <div className={s.mobileSymbolGroup}>
            <span style={{ fontWeight: 700, color: C.t1, fontSize: 13 }}>{t.symbol}</span>
            <span
              style={{
                color: t.side === 'long' ? C.g : C.r,
                background: (t.side === 'long' ? C.g : C.r) + '12',
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: 9,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              {t.side}
            </span>
            {aiGrade && (
              <div
                style={{
                  fontSize: 9,
                  padding: '1px 5px',
                  borderRadius: 4,
                  fontFamily: M,
                  background:
                    aiGrade.score >= 4
                      ? C.g + '15'
                      : aiGrade.score >= 3
                        ? C.b + '15'
                        : aiGrade.score >= 2
                          ? C.y + '15'
                          : C.r + '15',
                  color: aiGrade.score >= 4 ? C.g : aiGrade.score >= 3 ? C.b : aiGrade.score >= 2 ? C.y : C.r,
                }}
              >
                {aiGrade.grade}
              </div>
            )}
          </div>
          <span
            style={{
              fontFamily: M,
              fontWeight: 700,
              fontSize: 13,
              color: pnlColor,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fmtD(t.pnl)}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, fontSize: 10, color: C.t3, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontFamily: M, fontVariantNumeric: 'tabular-nums' }}>
            {t.date ? new Date(t.date).toLocaleDateString() : '—'}
          </span>
          {t.playbook && <span>· {t.playbook}</span>}
          {t.emotion && <span>· {t.emotion}</span>}
          {t.context?.tags?.length > 0 && <ContextBadge context={t.context} />}
        </div>
      </div>
    </div>
  );
}

// ─── Expanded Detail Panel ─────────────────────────────────────

function ExpandedDetail({
  trade: t,
  isTablet,
  deleteConfirm,
  onEdit,
  onDelete,
  onDeleteConfirm,
  onCancelDelete,
  onViewChart,
  onReplay,
  onShare,
}) {
  const pnlColor = (t.pnl || 0) >= 0 ? C.g : C.r;
  const [lightboxIdx, setLightboxIdx] = useState(null);

  // Collect all screenshots into one array for the lightbox
  const allScreenshots = [
    ...(t.screenshots || []),
    ...(t.chartScreenshot ? [{ data: t.chartScreenshot, name: 'Trade Close' }] : []),
  ];
  const hasScreenshots = allScreenshots.length > 0;

  // Label helper
  const shotLabel = (shot, i) => {
    const n = (shot.name || '').toLowerCase();
    if (n.includes('close')) return 'Close';
    if (i === 0 && allScreenshots.length > 1) return 'Entry';
    if (i === 0) return 'Snapshot';
    return `Snapshot ${i + 1}`;
  };

  // Format price helper
  const fmtPrice = (v) => v != null ? `$${Number(v).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '—';

  // Format duration helper
  const fmtDuration = () => {
    const d = t.holdDuration || (t.entryTime && t.exitTime ? t.exitTime - t.entryTime : null);
    if (!d) return '—';
    if (d < 60000) return `${Math.round(d / 1000)}s`;
    if (d < 3600000) return `${Math.round(d / 60000)}m`;
    return `${Math.floor(d / 3600000)}h ${Math.round((d % 3600000) / 60000)}m`;
  };

  // Format time helper
  const fmtTime = (ts) => ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

  return (
    <div
      className={`tf-expand-enter ${s.expandedPanel}`}
      style={{
        borderTop: `2px solid ${pnlColor}30`,
        background: `linear-gradient(180deg, ${C.sf}, ${C.bg2})`,
      }}
    >
      {/* ═══ Two-Column Layout ═══ */}
      <div className={s.twoColumnLayout}>
        {/* ── LEFT: Trade Data ── */}
        <div className={s.leftColumn}>
          {/* iOS-style grouped detail grid */}
          <div className={s.detailGrid}>
            <div className={s.detailCell}>
              <div className={s.detailLabel} style={{ color: C.t3, fontFamily: M }}>Entry</div>
              <div className={s.detailValue} style={{ color: C.t1, fontFamily: M }}>{fmtPrice(t.entry)}</div>
            </div>
            <div className={s.detailCell}>
              <div className={s.detailLabel} style={{ color: C.t3, fontFamily: M }}>Exit</div>
              <div className={s.detailValue} style={{ color: C.t1, fontFamily: M }}>{fmtPrice(t.exit)}</div>
            </div>
            <div className={s.detailCell}>
              <div className={s.detailLabel} style={{ color: C.t3, fontFamily: M }}>Stop Loss</div>
              <div className={s.detailValue} style={{ color: C.t1, fontFamily: M }}>{fmtPrice(t.stopLoss)}</div>
            </div>
            <div className={s.detailCell}>
              <div className={s.detailLabel} style={{ color: C.t3, fontFamily: M }}>Size</div>
              <div className={s.detailValue} style={{ color: C.t1, fontFamily: M }}>
                {t.qty != null
                  ? (t.dollarAmount != null
                      ? `${t.qty} ($${t.dollarAmount >= 1000 ? t.dollarAmount.toLocaleString(undefined, { maximumFractionDigits: 0 }) : t.dollarAmount})`
                      : t.qty)
                  : '—'}
              </div>
            </div>
            <div className={s.detailCell}>
              <div className={s.detailLabel} style={{ color: C.t3, fontFamily: M }}>R-Multiple</div>
              <div className={s.detailValue} style={{ color: t.rMultiple != null ? (t.rMultiple >= 0 ? C.g : C.r) : C.t1, fontFamily: M }}>
                {t.rMultiple != null ? `${t.rMultiple > 0 ? '+' : ''}${t.rMultiple}R` : '—'}
              </div>
            </div>
            <div className={s.detailCell}>
              <div className={s.detailLabel} style={{ color: C.t3, fontFamily: M }}>Duration</div>
              <div className={s.detailValue} style={{ color: C.t1, fontFamily: M }}>{fmtDuration()}</div>
            </div>
            <div className={s.detailCell}>
              <div className={s.detailLabel} style={{ color: C.t3, fontFamily: M }}>Entry Time</div>
              <div className={s.detailValue} style={{ color: C.t1, fontFamily: M }}>
                {fmtTime(t.entryTime || t.date)}
              </div>
            </div>
            <div className={s.detailCell}>
              <div className={s.detailLabel} style={{ color: C.t3, fontFamily: M }}>Exit Time</div>
              <div className={s.detailValue} style={{ color: C.t1, fontFamily: M }}>{fmtTime(t.exitTime)}</div>
            </div>
            <div className={s.detailCell}>
              <div className={s.detailLabel} style={{ color: C.t3, fontFamily: M }}>Fees</div>
              <div className={s.detailValue} style={{ color: C.t1, fontFamily: M }}>{t.fees != null ? `$${t.fees}` : '—'}</div>
            </div>
          </div>

          {/* Exit Reason */}
          {t.exitReason && (
            <div style={{ marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span
                className={s.exitPill}
                style={{
                  background: t.exitReason === 'take_profit' ? C.g + '18' : t.exitReason === 'stop_loss' ? C.r + '18' : C.b + '18',
                  color: t.exitReason === 'take_profit' ? C.g : t.exitReason === 'stop_loss' ? C.r : C.b,
                  fontFamily: M,
                }}
              >
                {t.exitReason === 'take_profit' ? '🎯 Take Profit' : t.exitReason === 'stop_loss' ? '🛑 Stop Loss' : '✋ Manual Close'}
              </span>
              {t.emotion && (
                <span style={{ fontSize: 10, color: C.t2, fontFamily: M, padding: '2px 8px', borderRadius: 6, background: C.b + '10', border: `1px solid ${C.b}15` }}>
                  {t.emotion}
                </span>
              )}
              {t.assetClass && (
                <span style={{ fontSize: 10, color: C.t3, fontFamily: M }}>
                  {t.assetClass}
                </span>
              )}
            </div>
          )}

          {/* Context */}
          {t.context && (
            <div style={{ marginBottom: 10 }}>
              <div className={s.sectionLabel} style={{ color: C.t3, fontFamily: M }}>Context</div>
              <div className={s.contextTags}>
                <span style={{ fontSize: 9, fontWeight: 700, fontFamily: M, padding: '2px 6px', borderRadius: 4, background: (t.context.confluenceScore ?? 0) >= 60 ? C.g + '15' : C.y + '15', color: (t.context.confluenceScore ?? 0) >= 60 ? C.g : C.y }}>
                  Confluence: {t.context.confluenceScore ?? 0}
                </span>
                {t.context.summary && <span style={{ fontSize: 9, color: C.t3 }}>{t.context.summary}</span>}
              </div>
            </div>
          )}

          {/* Checklist */}
          {t.checklist && Object.keys(t.checklist).length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div className={s.sectionLabel} style={{ color: C.t3, fontFamily: M }}>Checklist</div>
              <div className={s.checklistTags}>
                {Object.entries(t.checklist).map(([key, val]) => (
                  <span key={key} style={{ fontSize: 8, fontFamily: M, padding: '2px 6px', borderRadius: 4, background: val ? C.g + '10' : C.r + '10', color: val ? C.g : C.r }}>
                    {val ? '✓' : '✗'} {key}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {t.tags?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div className={s.sectionLabel} style={{ color: C.t3, fontFamily: M }}>Tags</div>
              <div className={s.tagList}>
                {t.tags.map((tag, i) => (
                  <span key={i} style={{ padding: '2px 8px', borderRadius: 6, background: C.b + '12', color: C.b, fontSize: 10, fontWeight: 600 }}>{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {t.notes && (
            <div className={s.notesBlock} style={{ color: C.t2, border: `1px solid ${C.bd}20`, background: `${C.bg2}` }}>
              {t.notes}
            </div>
          )}
        </div>

        {/* ── RIGHT: Chart Snapshots ── */}
        <div className={s.rightColumn}>
          <div className={s.snapshotHeader} style={{ color: C.t3, fontFamily: M }}>
            📸 Chart Snapshots {hasScreenshots && `(${allScreenshots.length})`}
          </div>

          {hasScreenshots ? (
            allScreenshots.map((shot, i) => (
              <div
                key={i}
                className={s.snapshotCard}
                onClick={() => setLightboxIdx(i)}
              >
                <img
                  src={shot.data}
                  alt={shotLabel(shot, i)}
                  draggable={false}
                />
                <div className={s.snapshotLabel}>
                  {shotLabel(shot, i)}
                </div>
              </div>
            ))
          ) : (
            <div className={s.noScreenshots} style={{ color: C.t3 }}>
              <span>📷</span>
              <span>No snapshots captured</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions — refined bar */}
      <div className={s.actionBar}>
        {deleteConfirm === t.id ? (
          <>
            <span style={{ fontSize: 11, color: C.r, alignSelf: 'center', marginRight: 4 }}>Delete this trade?</span>
            <Btn variant="ghost" onClick={onCancelDelete} className={s.cancelBtn}>Cancel</Btn>
            <Btn variant="danger" onClick={() => onDelete(t.id)} className={s.deleteBtn}>Confirm Delete</Btn>
          </>
        ) : (
          <>
            {onShare && <Btn variant="ghost" onClick={() => onShare(t)} className={s.shareBtn}>📤 Share</Btn>}
            {onReplay && <Btn variant="ghost" onClick={() => onReplay(t)} className={s.replayBtn}>⏪ Replay</Btn>}
            <Btn variant="ghost" onClick={() => onViewChart(t)} className={s.chartBtn}>📈 Chart</Btn>
            <Btn variant="ghost" onClick={() => onDeleteConfirm(t.id)} className={s.deleteTriggerBtn}>Delete</Btn>
            <Btn onClick={() => onEdit(t)} className={s.editBtn}>Edit</Btn>
          </>
        )}
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <ScreenshotLightbox
          screenshots={allScreenshots}
          initialIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </div>
  );
}

// ─── Detail Item ───────────────────────────────────────────────

function DetailItem({ label, value, color }) {
  return (
    <div style={{ padding: '6px 8px', background: C.bg2, borderRadius: 6, border: `1px solid ${C.bd}30` }}>
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: C.t3,
          marginBottom: 2,
          fontFamily: M,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: color || C.t1, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  );
}

// ─── Composed Trade Row ────────────────────────────────────────

function JournalTradeRow({
  trade,
  isExpanded,
  isTablet,
  deleteConfirm,
  onToggleExpand,
  onEdit,
  onDelete,
  onDeleteConfirm,
  onCancelDelete,
  onViewChart,
  onReplay,
  onShare,
  bulkMode = false,
  isSelected = false,
  onToggleSelect,
  showAIGrades,
}) {
  const RowComp = isTablet ? MobileRow : DesktopRow;

  return (
    <React.Fragment>
      <RowComp
        trade={trade}
        isExpanded={isExpanded}
        onClick={() => onToggleExpand(trade.id)}
        bulkMode={bulkMode}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
        showAIGrades={showAIGrades}
      />
      {isExpanded && (
        <ExpandedDetail
          trade={trade}
          isTablet={isTablet}
          deleteConfirm={deleteConfirm}
          onEdit={onEdit}
          onDelete={onDelete}
          onDeleteConfirm={onDeleteConfirm}
          onCancelDelete={onCancelDelete}
          onViewChart={onViewChart}
          onReplay={onReplay}
          onShare={onShare}
        />
      )}
    </React.Fragment>
  );
}

export { GRID_COLS, GRID_COLS_NO_CHECK, DetailItem };
export default React.memo(JournalTradeRow);
