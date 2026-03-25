// ═══════════════════════════════════════════════════════════════════
// charEdge — Insider Compact
//
// Compact insider trading widget for the Intel Signals section.
// Shows top 5 insider moves with cluster-buy badges.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { C, F } from '../../../constants.js';
import { edgarAdapter } from '../../../data/adapters/EdgarAdapter.js';
import { alpha } from '@/shared/colorUtils';

// ─── Mock Data ──────────────────────────────────────────────────
const MOCK_INSIDERS = [
  {
    id: 1,
    date: '03/24',
    name: 'Jamie Dimon',
    role: 'CEO',
    symbol: 'JPM',
    action: 'Buy',
    value: 8200000,
    cluster: false,
  },
  {
    id: 2,
    date: '03/23',
    name: 'Peter Lynch',
    role: 'Dir',
    symbol: 'MCD',
    action: 'Buy',
    value: 3400000,
    cluster: true,
  },
  {
    id: 3,
    date: '03/22',
    name: 'Jensen Huang',
    role: 'CEO',
    symbol: 'NVDA',
    action: 'Sell',
    value: 106800000,
    cluster: false,
  },
  {
    id: 4,
    date: '03/21',
    name: 'Tim Cook',
    role: 'CEO',
    symbol: 'AAPL',
    action: 'Sell',
    value: 9900000,
    cluster: false,
  },
  { id: 5, date: '03/20', name: 'Mary Barra', role: 'CEO', symbol: 'GM', action: 'Buy', value: 2100000, cluster: true },
];

// ─── Helpers ────────────────────────────────────────────────────
function fmtValue(v) {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

const INSIDER_SYMBOLS = ['AAPL', 'NVDA', 'MSFT', 'JPM', 'TSLA'];

// ─── Component ──────────────────────────────────────────────────
function InsiderCompact() {
  const [insiders, setInsiders] = useState(MOCK_INSIDERS);

  useEffect(() => {
    async function fetchInsiders() {
      try {
        const allResults = await Promise.all(
          INSIDER_SYMBOLS.map((sym) => edgarAdapter.fetchInsiderTransactions(sym, 3)),
        );
        const flat = allResults
          .flat()
          .filter((f) => f && f.filingDate)
          .sort((a, b) => new Date(b.filingDate) - new Date(a.filingDate))
          .slice(0, 5)
          .map((f, i) => ({
            id: i + 1,
            date: f.filingDate ? f.filingDate.slice(5).replace('-', '/') : '',
            name: f.description || 'Insider',
            role: f.form === '4' ? 'Officer' : 'Dir',
            symbol: f.symbol || '',
            action: 'Filing',
            value: 0,
            cluster: false,
          }));
        if (flat.length > 0) setInsiders(flat);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[InsiderCompact] Fetch failed, using fallback:', err.message);
      }
    }
    fetchInsiders();
  }, []);

  return (
    <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {insiders.map((ins) => {
        const isBuy = ins.action === 'Buy';
        const tint = isBuy ? C.g : C.r;

        return (
          <div
            role="listitem"
            aria-label={`${ins.date} ${ins.name} ${ins.role} ${ins.action} ${ins.symbol} ${fmtValue(ins.value)}${ins.cluster ? ' Cluster buy' : ''}`}
            key={ins.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              height: 36,
              padding: '0 10px',
              borderRadius: 8,
              background: alpha(tint, 0.04),
              borderLeft: `2px solid ${alpha(tint, 0.4)}`,
              fontFamily: F,
              fontSize: 12,
              color: C.t1,
              transition: 'background 0.15s ease',
            }}
          >
            {/* Date */}
            <span style={{ color: C.t3, fontSize: 11, minWidth: 38, flexShrink: 0 }}>{ins.date}</span>

            {/* Name (role) */}
            <span
              style={{
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: 600,
                fontSize: 11,
                color: C.t2,
              }}
            >
              {ins.name} <span style={{ color: C.t3, fontWeight: 400 }}>({ins.role})</span>
            </span>

            {/* Symbol */}
            <span style={{ fontWeight: 700, minWidth: 40, color: C.t1, flexShrink: 0 }}>{ins.symbol}</span>

            {/* Action */}
            <span
              style={{
                fontWeight: 600,
                fontSize: 11,
                minWidth: 28,
                color: tint,
                flexShrink: 0,
              }}
            >
              {ins.action}
            </span>

            {/* Value */}
            <span style={{ fontWeight: 600, minWidth: 56, textAlign: 'right', flexShrink: 0 }}>
              {fmtValue(ins.value)}
            </span>

            {/* Cluster badge */}
            {ins.cluster && (
              <span
                style={{
                  padding: '1px 6px',
                  borderRadius: 8,
                  background: alpha(C.b, 0.15),
                  color: C.b,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  lineHeight: '16px',
                  flexShrink: 0,
                }}
              >
                CLUSTER
              </span>
            )}
          </div>
        );
      })}

      {/* Footer link */}
      <div style={{ textAlign: 'right', paddingTop: 6 }}>
        <span
          style={{
            fontSize: 11,
            fontFamily: F,
            fontWeight: 600,
            color: C.b,
            cursor: 'pointer',
            opacity: 0.85,
          }}
        >
          View all insider &rarr;
        </span>
      </div>
    </div>
  );
}

export default React.memo(InsiderCompact);
