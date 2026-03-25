// ═══════════════════════════════════════════════════════════════════
// charEdge — Column Mapper UI (Phase 6 Sprint 6.3)
//
// Interactive drag-and-drop column mapping for CSV imports.
// Shows CSV headers on the left, charEdge fields on the right.
// Users click to assign/unassign mappings when auto-detection fails.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useMemo } from 'react';
import { C } from '../../../constants.js';
import { autoMapColumns, getTargetFields } from '../../data/importExport/columnMatcher.js';
import { alpha } from '@/shared/colorUtils';

// ─── Confidence Badge ───────────────────────────────────────────

function ConfBadge({ score }) {
  const p = Math.round((score || 0) * 100);
  const color = p >= 80 ? C.g : p >= 50 ? C.y : C.r;
  return (
    <span
      style={{
        fontSize: 8,
        fontWeight: 700,
        fontFamily: 'var(--tf-mono)',
        padding: '1px 5px',
        borderRadius: 4,
        background: alpha(color, 0.12),
        color,
      }}
    >
      {p}%
    </span>
  );
}

// ─── Source Column Button ───────────────────────────────────────

function SourceColumn({ header, mapped, active, onClick, confidence }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '6px 10px',
        borderRadius: 6,
        border: active ? `2px solid ${C.b}` : mapped ? `1px solid ${alpha(C.g, 0.3)}` : `1px solid ${alpha(C.bd, 0.3)}`,
        background: active ? alpha(C.b, 0.08) : mapped ? alpha(C.g, 0.04) : alpha(C.sf, 0.5),
        cursor: 'pointer',
        transition: 'all 0.1s ease',
        textAlign: 'left',
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--tf-mono)', color: C.t1 }}>{header}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {mapped && <span style={{ fontSize: 10, color: C.g }}>✓</span>}
        {confidence > 0 && <ConfBadge score={confidence} />}
      </div>
    </button>
  );
}

// ─── Target Field Button ────────────────────────────────────────

function TargetField({ field, mappedFrom, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '6px 10px',
        borderRadius: 6,
        border: active
          ? `2px solid ${C.b}`
          : mappedFrom
            ? `1px solid ${alpha(C.g, 0.3)}`
            : `1px solid ${alpha(C.bd, 0.3)}`,
        background: active ? alpha(C.b, 0.08) : mappedFrom ? alpha(C.g, 0.04) : alpha(C.sf, 0.5),
        cursor: 'pointer',
        transition: 'all 0.1s ease',
        textAlign: 'left',
      }}
    >
      <div>
        <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--tf-font)', color: C.t1 }}>{field.label}</span>
        {field.required && <span style={{ fontSize: 8, color: C.r, marginLeft: 4, fontWeight: 700 }}>REQ</span>}
      </div>
      {mappedFrom && (
        <span
          style={{
            fontSize: 9,
            fontFamily: 'var(--tf-mono)',
            color: C.t3,
            maxWidth: 80,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          ← {mappedFrom}
        </span>
      )}
    </button>
  );
}

// ─── Column Mapper Component ────────────────────────────────────

function ColumnMapper({ headers, onMappingComplete, initialMapping }) {
  const targetFields = useMemo(() => getTargetFields(), []);
  const [mapping, setMapping] = useState(() => {
    if (initialMapping) return initialMapping;
    const { mapping: auto } = autoMapColumns(headers || []);
    return auto;
  });
  const [confidence, setConfidence] = useState(() => {
    if (initialMapping) return {};
    const { confidence: conf } = autoMapColumns(headers || []);
    return conf;
  });
  const [selectedSource, setSelectedSource] = useState(null);

  // Build reverse mapping: field → header
  const reverseMap = useMemo(() => {
    const rev = {};
    for (const [h, f] of Object.entries(mapping)) {
      if (f) rev[f] = h;
    }
    return rev;
  }, [mapping]);

  // Check required fields
  const requiredMet = useMemo(() => {
    return targetFields.filter((f) => f.required).every((f) => reverseMap[f.key]);
  }, [targetFields, reverseMap]);

  // Handle source column click
  const handleSourceClick = useCallback(
    (header) => {
      if (selectedSource === header) {
        // Deselect
        setSelectedSource(null);
      } else {
        setSelectedSource(header);
      }
    },
    [selectedSource],
  );

  // Handle target field click
  const handleTargetClick = useCallback(
    (fieldKey) => {
      if (!selectedSource) return;

      setMapping((prev) => {
        const next = { ...prev };
        // Unmap any header previously mapped to this field
        for (const [h, f] of Object.entries(next)) {
          if (f === fieldKey) next[h] = null;
        }
        // Map selected source to this field
        next[selectedSource] = fieldKey;
        return next;
      });
      setSelectedSource(null);
    },
    [selectedSource],
  );

  // Apply mapping
  const handleApply = useCallback(() => {
    if (onMappingComplete) onMappingComplete(mapping);
  }, [mapping, onMappingComplete]);

  // Auto-map button
  const handleAutoMap = useCallback(() => {
    const { mapping: auto, confidence: conf } = autoMapColumns(headers || []);
    setMapping(auto);
    setConfidence(conf);
    setSelectedSource(null);
  }, [headers]);

  const mappedCount = Object.values(mapping).filter(Boolean).length;

  return (
    <div style={{ padding: '12px 0' }}>
      {/* ─── Header ──────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--tf-font)', color: C.t1 }}>Column Mapping</div>
          <div style={{ fontSize: 10, color: C.t3, fontFamily: 'var(--tf-mono)', marginTop: 2 }}>
            {mappedCount} of {(headers || []).length} columns mapped
            {selectedSource && (
              <span style={{ color: C.b, marginLeft: 6 }}>→ Select a target field for "{selectedSource}"</span>
            )}
          </div>
        </div>
        <button
          onClick={handleAutoMap}
          style={{
            fontSize: 10,
            fontWeight: 600,
            fontFamily: 'var(--tf-font)',
            padding: '4px 10px',
            borderRadius: 6,
            border: `1px solid ${alpha(C.b, 0.2)}`,
            background: alpha(C.b, 0.06),
            color: C.b,
            cursor: 'pointer',
          }}
        >
          Auto-Map
        </button>
      </div>

      {/* ─── Two-Column Layout ───────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Source Columns */}
        <div>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: C.t3,
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom: 6,
            }}
          >
            CSV Columns
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(headers || []).map((h) => (
              <SourceColumn
                key={h}
                header={h}
                mapped={!!mapping[h]}
                active={selectedSource === h}
                onClick={() => handleSourceClick(h)}
                confidence={confidence[h] || 0}
              />
            ))}
          </div>
        </div>

        {/* Target Fields */}
        <div>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: C.t3,
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom: 6,
            }}
          >
            charEdge Fields
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {targetFields.map((field) => (
              <TargetField
                key={field.key}
                field={field}
                mappedFrom={reverseMap[field.key] || null}
                active={!!selectedSource}
                onClick={() => handleTargetClick(field.key)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ─── Apply Button ────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
        {!requiredMet && (
          <span style={{ fontSize: 10, color: C.y, alignSelf: 'center', marginRight: 'auto' }}>
            ⚠ Map required fields (Date, Symbol) to continue
          </span>
        )}
        <button
          onClick={handleApply}
          disabled={!requiredMet}
          style={{
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'var(--tf-font)',
            padding: '6px 16px',
            borderRadius: 8,
            border: 'none',
            background: requiredMet ? C.b : alpha(C.bd, 0.3),
            color: requiredMet ? '#fff' : C.t3,
            cursor: requiredMet ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s ease',
          }}
        >
          Apply Mapping
        </button>
      </div>
    </div>
  );
}

export default React.memo(ColumnMapper);
