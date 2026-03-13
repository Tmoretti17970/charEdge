// ═══════════════════════════════════════════════════════════════════
// charEdge v10.5 — Journal Trade Row (Sprint 9 update)
// Added: selection checkbox, context badge, replay button
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C, M } from '../../../../constants.js';
import { fmtD } from '../../../../utils.js';
import { Btn } from '../../../components/ui/UIKit.jsx';
import { gradeTrade } from '../../analytics/analyticsFast.js';
import { ContextBadge } from './JournalEvolution.jsx';
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

  return (
    <div
      className="tf-expand-enter"
      style={{
        padding: '14px 16px 16px',
        background: `linear-gradient(180deg, ${C.sf}, ${C.bg2})`,
        borderBottom: `1px solid ${C.bd}`,
        borderTop: `2px solid ${pnlColor}30`,
        position: 'relative',
      }}
    >
      {/* Detail grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isTablet ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: 10,
          marginBottom: 12,
        }}
      >
        <DetailItem label="Entry" value={t.entry != null ? `$${t.entry}` : '—'} />
        <DetailItem label="Exit" value={t.exit != null ? `$${t.exit}` : '—'} />
        <DetailItem label="Qty" value={t.qty ?? '—'} />
        <DetailItem label="Fees" value={t.fees != null ? `$${t.fees}` : '—'} />
        <DetailItem label="R-Multiple" value={t.rMultiple != null ? `${t.rMultiple}R` : '—'} />
        <DetailItem label="Asset Class" value={t.assetClass || '—'} />
        <DetailItem label="Rule Break" value={t.ruleBreak ? '⚠ Yes' : 'No'} color={t.ruleBreak ? C.r : C.t3} />
        <DetailItem
          label="Time"
          value={t.date ? new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
        />
      </div>

      {/* Context from Intelligence Layer */}
      {t.context && (
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: C.t3,
              marginBottom: 4,
              fontFamily: M,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Context
          </div>
          <div className={s.contextTags}>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                fontFamily: M,
                padding: '2px 6px',
                borderRadius: 4,
                background: (t.context.confluenceScore ?? 0) >= 60 ? C.g + '15' : C.y + '15',
                color: (t.context.confluenceScore ?? 0) >= 60 ? C.g : C.y,
              }}
            >
              Confluence: {t.context.confluenceScore ?? 0}
            </span>
            {t.context.summary && <span style={{ fontSize: 9, color: C.t3 }}>{t.context.summary}</span>}
          </div>
        </div>
      )}

      {/* Checklist results */}
      {t.checklist && Object.keys(t.checklist).length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: C.t3,
              marginBottom: 4,
              fontFamily: M,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Checklist
          </div>
          <div className={s.checklistTags}>
            {Object.entries(t.checklist).map(([key, val]) => (
              <span
                key={key}
                style={{
                  fontSize: 8,
                  fontFamily: M,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: val ? C.g + '10' : C.r + '10',
                  color: val ? C.g : C.r,
                }}
              >
                {val ? '✓' : '✗'} {key}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {t.tags?.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: C.t3,
              marginBottom: 4,
              fontFamily: M,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Tags
          </div>
          <div className={s.tagList}>
            {t.tags.map((tag, i) => (
              <span
                key={i}
                style={{
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: C.b + '15',
                  color: C.b,
                  fontSize: 10,
                  fontWeight: 600,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {t.notes && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: C.t3,
              marginBottom: 4,
              fontFamily: M,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Notes
          </div>
          <div
            style={{
              fontSize: 12,
              color: C.t2,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              padding: '8px 10px',
              background: C.bg2,
              borderRadius: 6,
              border: `1px solid ${C.bd}40`,
            }}
          >
            {t.notes}
          </div>
        </div>
      )}

      {/* Screenshots */}
      {t.screenshots?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: C.t3,
              marginBottom: 4,
              fontFamily: M,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Screenshots ({t.screenshots.length})
          </div>
          <div className={s.screenshotGrid}>
            {t.screenshots.map((shot, i) => (
              <a
                key={i}
                href={shot.data}
                target="_blank"
                rel="noopener noreferrer"
                className={s.screenshotThumb}
                style={{
                  display: 'block',
                  width: 120,
                  height: 80,
                  borderRadius: 6,
                  overflow: 'hidden',
                  border: `1px solid ${C.bd}`,
                  cursor: 'zoom-in',
                }}
              >
                <img src={shot.data} alt={shot.name || `Screenshot ${i + 1}`} className={s.screenshotImg} />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Actions — refined bar */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
          paddingTop: 8,
          borderTop: `1px solid ${C.bd}30`,
        }}
      >
        {deleteConfirm === t.id ? (
          <>
            <span style={{ fontSize: 11, color: C.r, alignSelf: 'center', marginRight: 4 }}>Delete this trade?</span>
            <Btn variant="ghost" onClick={onCancelDelete} className={s.cancelBtn}>
              Cancel
            </Btn>
            <Btn variant="danger" onClick={() => onDelete(t.id)} className={s.deleteBtn}>
              Confirm Delete
            </Btn>
          </>
        ) : (
          <>
            {onShare && (
              <Btn variant="ghost" onClick={() => onShare(t)} className={s.shareBtn}>
                📤 Share
              </Btn>
            )}
            {onReplay && (
              <Btn variant="ghost" onClick={() => onReplay(t)} className={s.replayBtn}>
                ⏪ Replay
              </Btn>
            )}
            <Btn variant="ghost" onClick={() => onViewChart(t)} className={s.chartBtn}>
              📈 Chart
            </Btn>
            <Btn variant="ghost" onClick={() => onDeleteConfirm(t.id)} className={s.deleteTriggerBtn}>
              Delete
            </Btn>
            <Btn onClick={() => onEdit(t)} className={s.editBtn}>
              Edit
            </Btn>
          </>
        )}
      </div>
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
