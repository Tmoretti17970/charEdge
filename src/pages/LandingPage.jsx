// ═══════════════════════════════════════════════════════════════════
// charEdge — Landing Page (Task 2.2.2)
//
// Production hero page showcasing performance benchmarks, feature
// cards, and architecture highlights. Styled via CSS module.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState, useRef } from 'react';
import { C } from '../constants.js';
import { useUIStore } from '../state/useUIStore';
import s from './LandingPage.module.css';

// ─── Animated Counter ────────────────────────────────────────────
function AnimatedStat({ label, value, suffix = '', prefix = '', duration = 1800 }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(Math.round(eased * value));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value, duration]);

  return (
    <div ref={ref} className={s.stat}>
      <div className={s.statValue}>
        {prefix}{display.toLocaleString()}{suffix}
      </div>
      <div className={s.statLabel}>{label}</div>
    </div>
  );
}

// ─── Feature Card ────────────────────────────────────────────────
function FeatureCard({ icon, title, description, accent }) {
  return (
    <div className={s.card}>
      <div className={s.cardIcon} style={{ background: `${accent}18` }}>
        {icon}
      </div>
      <h3 className={s.cardTitle}>{title}</h3>
      <p className={s.cardDesc}>{description}</p>
    </div>
  );
}

// ─── Tech Pill ───────────────────────────────────────────────────
function TechPill({ label }) {
  return <span className={s.techPill}>{label}</span>;
}

// ─── CTA Button ──────────────────────────────────────────────────
function CTAButton({ children, onClick, secondary = false }) {
  return (
    <button
      onClick={onClick}
      className={secondary ? s.ctaBtnSecondary : s.ctaBtn}
    >
      {children}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function LandingPage() {
  const setPage = useUIStore((s) => s.setPage);

  // Parallax glow animation
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  };

  return (
    <div onMouseMove={handleMouseMove} className={s.root}>
      {/* ═══ HERO SECTION ═══════════════════════════════════════ */}
      <section id="landing-hero" className={s.hero}>
        {/* Ambient glow — follows mouse (needs inline style for dynamic position) */}
        <div
          aria-hidden="true"
          className={s.heroGlow}
          style={{
            left: `${mousePos.x * 100}%`,
            top: `${mousePos.y * 100}%`,
          }}
        />

        {/* Grid pattern background */}
        <div aria-hidden="true" className={s.heroGrid} />

        {/* Brand Logo */}
        <div className={s.logoWrap}>
          <div className={s.logo}>CE</div>
        </div>

        {/* Headline */}
        <h1 className={s.headline}>
          The Fastest Charting
          <br />
          <span className={s.headlineGradient}>Engine on the Web</span>
        </h1>

        {/* Tagline */}
        <p id="landing-tagline" className={s.tagline}>
          GPU-accelerated charts. Intelligent analysis. Trade journal
          that actually makes you better. <strong className={s.taglineStrong}>Find Your Edge.</strong>
        </p>

        {/* CTA Buttons */}
        <div className={s.ctaGroup}>
          <CTAButton onClick={() => setPage('journal')}>
            Start Trading Smarter →
          </CTAButton>
          <CTAButton secondary onClick={() => setPage('charts')}>
            Open Charts
          </CTAButton>
        </div>

        {/* Trust line */}
        <p className={s.trustLine}>
          No account required · 100% client-side · Your data stays yours
        </p>
      </section>

      {/* ═══ BENCHMARK STATS ════════════════════════════════════ */}
      <section id="landing-benchmarks" className={s.benchmarks}>
        <AnimatedStat prefix="<" value={5} suffix="ms" label="Frame Time" />
        <AnimatedStat value={100} suffix="K+" label="Bars Rendered" />
        <AnimatedStat value={0} suffix="%" label="Idle GPU Usage" />
        <AnimatedStat value={1} suffix="" label="WebSocket Per Exchange" />
      </section>

      {/* ═══ FEATURES ═══════════════════════════════════════════ */}
      <section id="landing-features" className={s.features}>
        <h2 className={s.sectionTitle}>Built Different</h2>
        <p className={s.sectionSubtitle}>
          Every module hand-tuned for performance. No bloat, no framework tax.
        </p>

        <div className={s.featureGrid}>
          <FeatureCard
            icon="⚡"
            title="GPU Charting Engine"
            accent={C.b}
            description="WebGL instanced rendering with WebGPU compute shaders. EMA, RSI, Bollinger — all calculated on the GPU in microseconds. 100K bars at 60fps."
          />
          <FeatureCard
            icon="🧠"
            title="Smart Insights"
            accent={C.p}
            description="Pattern recognition, trade analysis, and psychology insights. Identifies your strengths and blind spots. Educational analysis that grows with you."
          />
          <FeatureCard
            icon="📊"
            title="Trade Journal"
            accent={C.g}
            description="Log trades, track P&L, analyze psychology patterns. Session analytics, win rate tracking, and fatigue detection. All stored locally."
          />
        </div>
      </section>

      {/* ═══ ARCHITECTURE / TECH ════════════════════════════════ */}
      <section id="landing-tech" className={s.techSection}>
        <h2 className={s.techSectionTitle}>Under the Hood</h2>
        <p className={s.techSectionSubtitle}>
          The infrastructure most platforms dream about — purpose-built for speed.
        </p>

        <div className={s.techPillGrid}>
          <TechPill label="WebGL 2.0 Instanced" />
          <TechPill label="WebGPU Compute" />
          <TechPill label="GPU Instancing" />
          <TechPill label="SharedWorker" />
          <TechPill label="Compute Workers" />
          <TechPill label="Binary WebSocket" />
          <TechPill label="OPFS Storage" />
          <TechPill label="Zero-Copy Transfer" />
          <TechPill label="Render-on-Demand" />
          <TechPill label="LOD Decimation" />
          <TechPill label="Blit-Pan" />
          <TechPill label="Scene Graph" />
        </div>
      </section>

      {/* ═══ PRICING PREVIEW ═════════════════════════════════════ */}
      <section id="landing-pricing" className={s.pricing}>
        <h2 className={s.pricingTitle}>Simple Pricing</h2>
        <p className={s.pricingSubtitle}>
          Start free. Upgrade when you're ready.
        </p>

        <div className={s.pricingGrid}>
          {[
            { name: 'Free', price: '$0', desc: 'Charts + Journal', accent: C.t3 },
            { name: 'Trader', price: '$14.99', desc: 'Smart Insights + More', accent: C.b },
            { name: 'Pro', price: '$29.99', desc: 'Full Power', accent: C.p },
          ].map((tier) => (
            <div
              key={tier.name}
              className={tier.name === 'Trader' ? s.pricingCardFeatured : s.pricingCard}
              style={tier.name === 'Trader' ? { borderColor: `${tier.accent}40` } : undefined}
            >
              <div className={s.pricingTier} style={{ color: tier.accent }}>
                {tier.name}
              </div>
              <div className={s.pricingAmount}>{tier.price}</div>
              <div className={s.pricingDesc}>{tier.desc}</div>
            </div>
          ))}
        </div>

        <div className={s.pricingCta}>
          <CTAButton secondary onClick={() => setPage('pricing')}>
            View All Plans →
          </CTAButton>
        </div>
      </section>

      {/* ═══ CTA FOOTER ═════════════════════════════════════════ */}
      <section id="landing-cta" className={s.ctaFooter}>
        {/* Gradient glow */}
        <div aria-hidden="true" className={s.ctaFooterGlow} />

        <h2 className={s.ctaFooterTitle}>Ready to Find Your Edge?</h2>
        <p className={s.ctaFooterDesc}>
          Free forever. No sign-up required. Your data never leaves your browser.
        </p>

        <CTAButton onClick={() => setPage('journal')}>
          Start Trading Smarter →
        </CTAButton>

        {/* Footer links */}
        <div className={s.footerLinks}>
          <button onClick={() => setPage('terms')} className={s.footerLink}>
            Terms of Service
          </button>
          <button onClick={() => setPage('privacy')} className={s.footerLink}>
            Privacy Policy
          </button>
          <span className={s.footerCopy}>© 2026 charEdge</span>
        </div>
      </section>
    </div>
  );
}
