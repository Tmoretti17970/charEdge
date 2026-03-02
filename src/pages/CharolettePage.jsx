// ═══════════════════════════════════════════════════════════════════
// charEdge — Charolette's Memorial Page
//
// A warm, respectful dedication page honoring Charolette.
// Accessible via the ✦ star in the sidebar footer.
// ═══════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { C, F, M } from '../constants.js';

const SUPPORT_LINKS = [
  {
    name: 'Now I Lay Me Down to Sleep',
    url: 'https://www.nowilaymedowntosleep.org',
    description: 'Remembrance photography for families experiencing loss',
  },
  {
    name: 'PAIL Network',
    url: 'https://pailnetwork.org',
    description: 'Pregnancy and Infant Loss support community',
  },
  {
    name: 'March of Dimes',
    url: 'https://www.marchofdimes.org',
    description: 'Fighting for the health of all moms and babies',
  },
];

export default function CharolettePage() {
  const [hoveredLink, setHoveredLink] = useState(null);
  const rose = C.rose || '#e8a0b0';

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: `linear-gradient(180deg, ${rose}12 0%, ${C.bg} 40%)`,
        fontFamily: F,
      }}
    >
      {/* ─── Hero Section ─────────────────────────────────── */}
      <div
        style={{
          maxWidth: 600,
          width: '100%',
          padding: '64px 24px 48px',
          textAlign: 'center',
        }}
      >
        {/* Star glyph */}
        <div
          style={{
            fontSize: 48,
            color: rose,
            marginBottom: 16,
            textShadow: `0 0 24px ${rose}50`,
            animation: 'tfStarPulse 3s ease-in-out infinite',
          }}
          aria-hidden="true"
        >
          ✦
        </div>

        {/* Name */}
        <h1
          style={{
            fontSize: 36,
            fontWeight: 300,
            fontFamily: F,
            color: C.t1,
            letterSpacing: '0.08em',
            margin: '0 0 8px',
          }}
        >
          Charolette
        </h1>

        {/* Soft divider */}
        <div
          style={{
            width: 60,
            height: 1,
            background: `linear-gradient(90deg, transparent, ${rose}, transparent)`,
            margin: '16px auto 24px',
          }}
        />

        {/* Message */}
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.8,
            color: C.t2,
            maxWidth: 480,
            margin: '0 auto 12px',
          }}
        >
          charEdge was built in honor of Charolette — a little life that changed everything.
          Though her time with us was brief, her light continues to shape every line of
          code in this project.
        </p>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.7,
            color: C.t3,
            maxWidth: 480,
            margin: '0 auto 40px',
          }}
        >
          We believe in building something meaningful — not just software, but a community
          that cares. A portion of charEdge's revenue supports organizations helping
          families through loss and healing.
        </p>

        {/* Quote */}
        <div
          style={{
            background: `${rose}08`,
            border: `1px solid ${rose}20`,
            borderRadius: 12,
            padding: '20px 24px',
            marginBottom: 48,
          }}
        >
          <p
            style={{
              fontSize: 16,
              fontStyle: 'italic',
              color: rose,
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            "Still burning." ✦
          </p>
        </div>
      </div>

      {/* ─── Support Section ──────────────────────────────── */}
      <div
        style={{
          maxWidth: 600,
          width: '100%',
          padding: '0 24px 64px',
        }}
      >
        <h2
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: C.t3,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 16,
            textAlign: 'center',
          }}
        >
          Organizations We Support
        </h2>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {SUPPORT_LINKS.map((link, i) => (
            <a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onMouseEnter={() => setHoveredLink(i)}
              onMouseLeave={() => setHoveredLink(null)}
              style={{
                display: 'block',
                padding: '16px 20px',
                borderRadius: 10,
                background: hoveredLink === i ? `${C.sf2}` : C.sf,
                border: `1px solid ${hoveredLink === i ? rose + '40' : C.bd}`,
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                transform: hoveredLink === i ? 'translateY(-1px)' : 'none',
                boxShadow: hoveredLink === i
                  ? `0 4px 16px ${rose}15`
                  : 'none',
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: hoveredLink === i ? rose : C.t1,
                  marginBottom: 4,
                  transition: 'color 0.2s',
                }}
              >
                {link.name}
                <span
                  style={{
                    fontSize: 11,
                    marginLeft: 6,
                    opacity: 0.5,
                  }}
                >
                  ↗
                </span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: C.t3,
                  lineHeight: 1.4,
                }}
              >
                {link.description}
              </div>
            </a>
          ))}
        </div>

        {/* ─── Footer ─────────────────────────────────────── */}
        <div
          style={{
            textAlign: 'center',
            marginTop: 48,
            paddingTop: 24,
            borderTop: `1px solid ${C.bd}`,
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: C.t3,
              fontFamily: M,
              letterSpacing: '0.06em',
            }}
          >
            Charolette's Light ✦ charEdge
          </span>
        </div>
      </div>

      <style>{`
        @keyframes tfStarPulse {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0s !important; }
        }
      `}</style>
    </div>
  );
}
