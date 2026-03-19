// ═══════════════════════════════════════════════════════════════════
// charEdge — Broker Guides UI (Phase 6 Sprint 6.4)
//
// Card grid with step-by-step export instructions for each broker.
// Displayed on the Import Hub page.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import { C, F, M } from '../../../constants.js';
import { alpha } from '@/shared/colorUtils';
import BROKER_GUIDES from '../../../data/importExport/brokerGuideData.js';

function BrokerGuideCard({ guide, onClick, expanded }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: expanded ? '14px 16px' : '10px 14px',
        borderRadius: 10,
        border: expanded
          ? `1px solid ${alpha(C.b, 0.3)}`
          : `1px solid ${alpha(C.bd, 0.3)}`,
        background: expanded
          ? `${C.b}08`
          : hovered
            ? C.sf
            : C.sf,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: expanded ? 10 : 0 }}>
        <span style={{ fontSize: 20 }}>{guide.logo}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: F }}>{guide.name}</div>
          <div style={{ fontSize: 9, color: C.t3, fontFamily: M }}>{guide.format}</div>
        </div>
        <span style={{ fontSize: 10, color: C.t3, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
      </div>

      {/* Expanded Steps */}
      {expanded && (
        <div style={{ marginTop: 8 }}>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: C.t2, lineHeight: 1.6 }}>
            {guide.steps.map((step, i) => (
              <li key={i} style={{ marginBottom: 2 }}>{step}</li>
            ))}
          </ol>
          {guide.tips && guide.tips.length > 0 && (
            <div style={{ marginTop: 8, padding: '6px 8px', borderRadius: 6, background: alpha(C.y, 0.06), fontSize: 10, color: C.y }}>
              💡 {guide.tips[0]}
            </div>
          )}
          {guide.url && (
            <a
              href={guide.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{ fontSize: 10, color: C.b, textDecoration: 'none', display: 'inline-block', marginTop: 6 }}
            >
              Open {guide.name} →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function BrokerGuides({ searchFilter = '' }) {
  const [expandedBroker, setExpandedBroker] = useState(null);

  const guideEntries = Object.entries(BROKER_GUIDES);
  const filtered = searchFilter
    ? guideEntries.filter(([, g]) =>
        g.name.toLowerCase().includes(searchFilter.toLowerCase())
      )
    : guideEntries;

  const handleToggle = useCallback((key) => {
    setExpandedBroker((prev) => (prev === key ? null : key));
  }, []);

  return (
    <div>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: F, marginBottom: 10 }}>
        Export Guides
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {filtered.map(([key, guide]) => (
          <BrokerGuideCard
            key={key}
            guide={guide}
            expanded={expandedBroker === key}
            onClick={() => handleToggle(key)}
          />
        ))}
      </div>
    </div>
  );
}

export default React.memo(BrokerGuides);
