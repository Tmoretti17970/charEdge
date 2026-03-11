// ═══════════════════════════════════════════════════════════════════
// charEdge — SSR Static Pages
//
// Lightweight static page components for server-side rendering.
// These pages have no client-side interactivity — they exist for
// SEO crawlers and social-media link previews only.
// ═══════════════════════════════════════════════════════════════════


// ─── Landing Page ────────────────────────────────────────────────

export function LandingPage() {
    return (
        <main className="ssr-page ssr-landing">
            <section className="hero">
                <h1>charEdge — Find Your Edge</h1>
                <p>
                    Professional charting platform with real-time order flow analysis,
                    advanced technical indicators, and an integrated trade journal.
                </p>
            </section>
            <section className="features">
                <h2>Core Features</h2>
                <ul>
                    <li>GPU-accelerated candlestick charts with WebGL rendering</li>
                    <li>Real-time order flow: delta, volume profile, large trades</li>
                    <li>50+ indicators with custom scripting support</li>
                    <li>Integrated trade journal with psychology tracking</li>
                    <li>Multi-exchange data: Binance, Coinbase, Bybit, OKX</li>
                </ul>
            </section>
        </main>
    );
}

// ─── Pricing Page ────────────────────────────────────────────────

export function PricingPage() {
    return (
        <main className="ssr-page ssr-pricing">
            <h1>Pricing</h1>
            <section className="pricing-tiers">
                <article className="tier">
                    <h2>Free</h2>
                    <p>Core charting with delayed data. 3 indicators, basic journal.</p>
                </article>
                <article className="tier tier--featured">
                    <h2>Pro</h2>
                    <p>Real-time data, unlimited indicators, order flow overlays, AI coach.</p>
                </article>
                <article className="tier">
                    <h2>Enterprise</h2>
                    <p>Multi-seat licensing, custom integrations, priority support.</p>
                </article>
            </section>
        </main>
    );
}

// ─── Terms of Service ────────────────────────────────────────────

export function TermsPage() {
    return (
        <main className="ssr-page ssr-terms">
            <h1>Terms of Service</h1>
            <p>Last updated: March 2026</p>
            <section>
                <h2>1. Acceptance of Terms</h2>
                <p>
                    By accessing charEdge, you agree to be bound by these Terms of Service
                    and all applicable laws and regulations.
                </p>
            </section>
            <section>
                <h2>2. Use of Service</h2>
                <p>
                    charEdge provides charting and trade journaling tools for informational
                    purposes only. Nothing on this platform constitutes financial advice.
                </p>
            </section>
            <section>
                <h2>3. Data and Privacy</h2>
                <p>
                    Your trade data is stored locally on your device using IndexedDB.
                    We do not transmit personal trading data to external servers.
                </p>
            </section>
        </main>
    );
}

// ─── Privacy Policy ──────────────────────────────────────────────

export function PrivacyPage() {
    return (
        <main className="ssr-page ssr-privacy">
            <h1>Privacy Policy</h1>
            <p>Last updated: March 2026</p>
            <section>
                <h2>Data Collection</h2>
                <p>
                    charEdge collects minimal data: anonymized usage analytics (via web
                    vitals), crash reports, and optional account information for sync
                    features.
                </p>
            </section>
            <section>
                <h2>Local Storage</h2>
                <p>
                    Trade journal entries, chart drawings, and settings are stored
                    exclusively in your browser&apos;s IndexedDB. This data never leaves your device
                    unless you explicitly enable cloud sync.
                </p>
            </section>
        </main>
    );
}

// ─── Changelog ───────────────────────────────────────────────────

export function ChangelogPage() {
    return (
        <main className="ssr-page ssr-changelog">
            <h1>Changelog</h1>
            <article className="changelog-entry">
                <h2>v10.4 — March 2026</h2>
                <ul>
                    <li>GPU pan fast path for smooth scrolling</li>
                    <li>WebGL volume bars and line charts</li>
                    <li>AI Coach integration with context-aware suggestions</li>
                    <li>Unified IndexedDB consolidation</li>
                    <li>Progressive boot with skeleton UI</li>
                </ul>
            </article>
            <article className="changelog-entry">
                <h2>v10.3 — February 2026</h2>
                <ul>
                    <li>Order flow overlays: delta histogram, volume profile</li>
                    <li>Indicator pane architecture with splitter drag</li>
                    <li>Drawing tool persistence to IndexedDB</li>
                </ul>
            </article>
        </main>
    );
}
