// ═══════════════════════════════════════════════════════════════════
// charEdge v11 — Redesigned Onboarding Wizard
//
// "Aha moment in 30 seconds" — user sees a live chart within
// the first step, not config forms.
//
// 3-step flow (condensed from 5):
//   0: Live Chart Hero — animated chart background + value prop
//   1: Quick Setup — account size, risk, broker (all optional, skip OK)
//   2: Ready — personalize + quick-start
//
// Shows on first boot when wizardComplete === false.
// Can be re-triggered from Settings.
// ═══════════════════════════════════════════════════════════════════

import { useUserStore } from '../../state/useUserStore.js';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { C, F, M } from '../../constants.js';
import { space, radii, text, transition, preset } from '../../theme/tokens.js';
import { Btn } from '../components/ui/UIKit.jsx';

const STEPS = [
  { title: 'See Your Edge', icon: '📈', subtitle: 'Live markets. Real-time charts. Right now.' },
  { title: 'Quick Setup', icon: '⚙️', subtitle: 'Optional — you can change everything later' },
  { title: "You're All Set!", icon: '🚀', subtitle: 'Start tracking your edge' },
];

// ─── Animated Price Line (Hero Background) ──────────────────────

function AnimatedPriceLine({ width = 460, height = 200 }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Generate realistic-looking price data
    let points = [];
    let price = 100;
    for (let i = 0; i < 120; i++) {
      price += (Math.random() - 0.47) * 2.5; // Slight upward bias
      price = Math.max(80, Math.min(130, price));
      points.push(price);
    }

    let offset = 0;
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      offset += 0.3;

      // Add a new point and remove the oldest
      if (offset >= 1) {
        offset = 0;
        price += (Math.random() - 0.47) * 2.5;
        price = Math.max(80, Math.min(130, price));
        points.push(price);
        if (points.length > 120) points = points.slice(1);
      }

      const min = Math.min(...points) - 5;
      const max = Math.max(...points) + 5;
      const scaleY = (v) => height - ((v - min) / (max - min)) * height;

      // Area fill gradient
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, 'rgba(239,176,51,0.15)');
      grad.addColorStop(1, 'rgba(239,176,51,0)');

      ctx.beginPath();
      ctx.moveTo(0, scaleY(points[0]));
      for (let i = 1; i < points.length; i++) {
        const x = (i / (points.length - 1)) * width;
        ctx.lineTo(x, scaleY(points[i]));
      }
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Price line
      ctx.beginPath();
      ctx.moveTo(0, scaleY(points[0]));
      for (let i = 1; i < points.length; i++) {
        const x = (i / (points.length - 1)) * width;
        ctx.lineTo(x, scaleY(points[i]));
      }
      ctx.strokeStyle = '#efb033';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Live dot at end
      const lastX = width;
      const lastY = scaleY(points[points.length - 1]);
      ctx.beginPath();
      ctx.arc(lastX - 2, lastY, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#efb033';
      ctx.fill();

      // Pulsing ring
      const pulseRadius = 8 + Math.sin(Date.now() / 300) * 3;
      ctx.beginPath();
      ctx.arc(lastX - 2, lastY, pulseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(239,176,51,0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, borderRadius: radii.md, display: 'block' }}
    />
  );
}

// ─── Stats ticker (simulated) ────────────────────────────────────

function LiveStatsTicker() {
  const [stats, setStats] = useState({ price: 97243, change: 2.34 });

  useEffect(() => {
    const iv = setInterval(() => {
      setStats((s) => {
        const delta = (Math.random() - 0.48) * 50;
        const newPrice = Math.round(s.price + delta);
        const newChange = +(s.change + delta / 1000).toFixed(2);
        return { price: newPrice, change: newChange };
      });
    }, 1200);
    return () => clearInterval(iv);
  }, []);

  const isUp = stats.change >= 0;
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: space[3] }}>
      <span style={{ fontFamily: M, fontSize: 28, fontWeight: 700, color: C.t1, letterSpacing: '-0.5px' }}>
        BTC-USD
      </span>
      <span style={{ fontFamily: M, fontSize: 22, fontWeight: 600, color: isUp ? '#22c55e' : '#ef4444' }}>
        ${stats.price.toLocaleString()}
      </span>
      <span style={{
        fontFamily: M, fontSize: 13, fontWeight: 500,
        color: isUp ? '#22c55e' : '#ef4444',
        padding: '2px 8px', borderRadius: 6,
        background: isUp ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
      }}>
        {isUp ? '▲' : '▼'} {Math.abs(stats.change)}%
      </span>
    </div>
  );
}

// ─── Main Wizard ─────────────────────────────────────────────────

export default function OnboardingWizard() {
  const wizardComplete = useUserStore((s) => s.wizardComplete);
  const wizardStep = useUserStore((s) => s.wizardStep);
  const setWizardStep = useUserStore((s) => s.setWizardStep);
  const completeWizard = useUserStore((s) => s.completeWizard);

  // Slide animation state
  const [animDir, setAnimDir] = useState(0);
  const [animating, setAnimating] = useState(false);

  const goNext = useCallback(() => {
    if (wizardStep >= STEPS.length - 1 || animating) return;
    setAnimDir(1);
    setAnimating(true);
    setTimeout(() => {
      setWizardStep(wizardStep + 1);
      setAnimDir(0);
      setAnimating(false);
    }, 200);
  }, [wizardStep, animating, setWizardStep]);

  const goBack = useCallback(() => {
    if (wizardStep <= 0 || animating) return;
    setAnimDir(-1);
    setAnimating(true);
    setTimeout(() => {
      setWizardStep(wizardStep - 1);
      setAnimDir(0);
      setAnimating(false);
    }, 200);
  }, [wizardStep, animating, setWizardStep]);

  if (wizardComplete || wizardStep < 0) return null;

  const slideStyle = animating
    ? { transform: `translateX(${animDir * -30}px)`, opacity: 0, transition: 'all 0.2s ease' }
    : { transform: 'translateX(0)', opacity: 1, transition: 'all 0.2s ease' };

  // Step 0 has wider layout for chart hero
  const isHeroStep = wizardStep === 0;

  return (
    <>
      {/* Backdrop */}
      <div className="tf-modal-backdrop" style={{ ...preset.overlay, backdropFilter: 'blur(8px)' }} />

      {/* Modal */}
      <div
        className="tf-modal-content"
        style={{
          ...preset.modal,
          width: isHeroStep ? 560 : 500,
          maxWidth: '94vw',
          padding: 0,
          overflow: 'hidden',
          transition: 'width 0.3s ease',
        }}
      >
        {/* Progress dots */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 8,
            padding: `${space[4]}px ${space[6]}px 0`,
          }}
        >
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === wizardStep ? 28 : 8,
                height: 8,
                borderRadius: 4,
                background:
                  i === wizardStep ? `linear-gradient(90deg, ${C.b}, #f0b64e)` : i < wizardStep ? C.b + '60' : C.bd,
                transition: 'all 0.3s ease',
                cursor: i < wizardStep ? 'pointer' : 'default',
              }}
              onClick={() => i < wizardStep && setWizardStep(i)}
            />
          ))}
        </div>

        {/* Content area */}
        <div style={{ padding: `${space[5]}px ${space[6]}px ${space[4]}px`, minHeight: isHeroStep ? 380 : 320 }}>
          <div style={slideStyle}>
            {/* Step icon + title */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: space[3],
                marginBottom: space[1],
              }}
            >
              <span style={{ fontSize: 28 }}>{STEPS[wizardStep].icon}</span>
              <div>
                <h2 style={{ ...text.h2, margin: 0 }}>{STEPS[wizardStep].title}</h2>
                <div style={{ ...text.captionSm, marginTop: 2 }}>{STEPS[wizardStep].subtitle}</div>
              </div>
            </div>

            <div style={{ marginTop: space[4] }}>
              {wizardStep === 0 && <StepLiveChartHero />}
              {wizardStep === 1 && <StepQuickSetup />}
              {wizardStep === 2 && <StepComplete />}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: `${space[3]}px ${space[6]}px ${space[5]}px`,
            borderTop: `1px solid ${C.bd}`,
          }}
        >
          {wizardStep > 0 ? (
            <button
              onClick={goBack}
              className="tf-btn"
              style={{
                background: 'transparent',
                border: 'none',
                color: C.t3,
                fontSize: 13,
                fontFamily: F,
                cursor: 'pointer',
                padding: '8px 14px',
                borderRadius: radii.sm,
              }}
            >
              ← Back
            </button>
          ) : (
            <button
              onClick={completeWizard}
              className="tf-btn"
              style={{
                background: 'transparent',
                border: 'none',
                color: C.t3,
                fontSize: 12,
                fontFamily: F,
                cursor: 'pointer',
                padding: '8px 14px',
              }}
            >
              Skip setup
            </button>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            {wizardStep > 0 && wizardStep < STEPS.length - 1 && (
              <button
                className="tf-btn"
                onClick={() => setWizardStep(wizardStep + 1)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: C.t3,
                  fontSize: 11,
                  fontFamily: F,
                  cursor: 'pointer',
                  padding: '6px 12px',
                }}
              >
                Skip
              </button>
            )}
            {wizardStep < STEPS.length - 1 ? (
              <Btn onClick={goNext}>
                {wizardStep === 0 ? 'Let\'s Go →' : 'Continue →'}
              </Btn>
            ) : (
              <Btn onClick={completeWizard}>Start Trading →</Btn>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Step 0: Live Chart Hero ─────────────────────────────────────
// Instant "Aha moment" — animated chart + live ticker

function StepLiveChartHero() {
  return (
    <div>
      {/* Live chart preview */}
      <div style={{
        borderRadius: radii.lg,
        overflow: 'hidden',
        background: 'rgba(0,0,0,0.3)',
        border: `1px solid ${C.bd}40`,
        marginBottom: space[4],
      }}>
        <LiveStatsTicker />
        <AnimatedPriceLine width={460} height={160} />
      </div>

      {/* Value props — compact 2×2 grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: space[2],
      }}>
        <FeatureChip icon="📈" label="Real-Time Charts" />
        <FeatureChip icon="📒" label="Smart Journal" />
        <FeatureChip icon="🧠" label="AI Co-Pilot" />
        <FeatureChip icon="🎯" label="Risk Guardrails" />
      </div>

      <p style={{ ...text.captionSm, marginTop: space[3], textAlign: 'center', opacity: 0.7 }}>
        Free forever · No credit card · Your data stays local
      </p>
    </div>
  );
}

// ─── Step 1: Quick Setup (condensed from Steps 1+2+3) ────────────

const BROKERS = [
  { id: 'thinkorswim', label: 'TD / thinkorswim', icon: '🟢' },
  { id: 'tradovate', label: 'Tradovate', icon: '🔵' },
  { id: 'interactive', label: 'Interactive Brokers', icon: '🔴' },
  { id: 'webull', label: 'Webull', icon: '🟠' },
  { id: 'robinhood', label: 'Robinhood', icon: '🟡' },
  { id: 'metatrader', label: 'MetaTrader', icon: '🟣' },
  { id: 'other', label: 'Other', icon: '📋' },
];

function StepQuickSetup() {
  const updateSettings = useUserStore((s) => s.update);
  const accountSize = useUserStore((s) => s.accountSize);
  const riskPerTrade = useUserStore((s) => s.riskPerTrade);
  const broker = useUserStore((s) => s.broker);
  const theme = useUserStore((s) => s.theme);
  const setTheme = useUserStore((s) => s.setTheme);

  return (
    <div>
      {/* Account basics — compact row */}
      <div style={{ display: 'flex', gap: space[3], marginBottom: space[4] }}>
        <SettingInput
          label="Account Size ($)"
          value={accountSize || ''}
          placeholder="10000"
          onChange={(v) => updateSettings({ accountSize: Number(v) || 0 })}
        />
        <SettingInput
          label="Risk Per Trade (%)"
          value={riskPerTrade || ''}
          placeholder="1"
          onChange={(v) => updateSettings({ riskPerTrade: Number(v) || 0 })}
        />
      </div>

      {/* Broker — compact grid */}
      <div style={{ marginBottom: space[4] }}>
        <div style={{ ...text.label, marginBottom: space[2] }}>Broker (for CSV auto-detect)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {BROKERS.map((b) => (
            <button
              key={b.id}
              className="tf-btn"
              onClick={() => updateSettings({ broker: b.id })}
              style={{
                padding: '5px 10px',
                background: broker === b.id ? C.b + '15' : C.sf2,
                border: `1.5px solid ${broker === b.id ? C.b : C.bd + '60'}`,
                borderRadius: radii.sm,
                color: broker === b.id ? C.b : C.t2,
                fontSize: 11,
                fontFamily: F,
                fontWeight: broker === b.id ? 600 : 400,
                cursor: 'pointer',
                transition: `all ${transition.base}`,
              }}
            >
              {b.icon} {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Theme — inline toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: space[3] }}>
        <span style={{ ...text.label }}>Theme</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <ThemePill label="🌙 Dark" active={theme === 'dark'} onClick={() => setTheme('dark')} />
          <ThemePill label="☀️ Light" active={theme === 'light'} onClick={() => setTheme('light')} />
        </div>
        <span style={{ ...text.captionSm, marginLeft: 'auto', opacity: 0.6 }}>Press T to toggle</span>
      </div>

      <p style={{ ...text.captionSm, marginTop: space[3], fontStyle: 'italic', opacity: 0.6 }}>
        All fields optional. Change anytime in Settings.
      </p>
    </div>
  );
}

// ─── Step 2: Complete ────────────────────────────────────────────

function StepComplete() {
  return (
    <div>
      <p style={{ ...text.body, marginBottom: space[4] }}>
        You're ready! Here are some power-user tips:
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: space[3] }}>
        <FeatureHighlight
          icon="📒"
          title="Log Early, Log Often"
          desc="Journal right after closing — emotions are freshest. More data = sharper insights."
        />
        <FeatureHighlight
          icon="🎨"
          title="Drawing Tools"
          desc="Trend lines, Fibonacci, and more. Press D to toggle the toolbar."
        />
        <FeatureHighlight
          icon="📁"
          title="Import Trades"
          desc="Import your existing trades via CSV — your broker format is auto-detected."
        />
        <FeatureHighlight
          icon="🧠"
          title="Insights Page"
          desc="Strategy breakdown, psychology analysis, and risk modeling in one hub."
        />
      </div>

      {/* Legal disclaimer */}
      <div
        style={{
          marginTop: space[4],
          padding: `${space[2]}px ${space[3]}px`,
          background: C.sf2,
          borderRadius: radii.sm,
          borderLeft: `3px solid ${C.y}`,
        }}
      >
        <p style={{ ...text.captionSm, margin: 0, lineHeight: 1.5, opacity: 0.8 }}>
          ⚠️ <strong>Disclaimer:</strong> charEdge is not financial advice. All analytics, metrics,
          and coaching features are for educational purposes only. Trade at your own risk.
        </p>
      </div>
    </div>
  );
}

// ─── Shared Sub-components ───────────────────────────────────────

function FeatureHighlight({ icon, title, desc }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: space[3],
        padding: space[3],
        background: C.sf2,
        borderRadius: radii.md,
        border: `1px solid ${C.bd}40`,
      }}
    >
      <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ ...text.h3, fontSize: 12, marginBottom: 2 }}>{title}</div>
        <div style={text.bodyXs}>{desc}</div>
      </div>
    </div>
  );
}

function FeatureChip({ icon, label }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: `${space[2]}px ${space[3]}px`,
      background: C.sf2,
      borderRadius: radii.md,
      border: `1px solid ${C.bd}30`,
    }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ ...text.bodySm, fontWeight: 500 }}>{label}</span>
    </div>
  );
}

function ThemePill({ label, active, onClick }) {
  return (
    <button
      className="tf-btn"
      onClick={onClick}
      style={{
        padding: '4px 12px',
        background: active ? C.b + '15' : 'transparent',
        border: `1.5px solid ${active ? C.b : C.bd}`,
        borderRadius: 20,
        color: active ? C.b : C.t3,
        fontSize: 12,
        fontFamily: F,
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        transition: `all ${transition.base}`,
      }}
    >
      {label}
    </button>
  );
}

function SettingInput({ label, value, placeholder, onChange }) {
  return (
    <div style={{ flex: 1 }}>
      <label style={{ ...text.label, display: 'block', marginBottom: space[1] }}>{label}</label>
      <input
        type="number"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...preset.input, fontFamily: M, width: '100%' }}
      />
    </div>
  );
}
