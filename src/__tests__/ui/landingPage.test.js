// ═══════════════════════════════════════════════════════════════════
// charEdge — Landing Page Tests (Task 2.2.2)
//
// Source-code assertion tests following the tier3_security.test.js
// pattern. Validates: export, content, router wiring, SEO route.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

describe('LandingPage — production hero page (Task 2.2.2)', () => {
  it('exports a default component', async () => {
    const mod = await import('../../pages/LandingPage.jsx');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('contains hero section with "Find Your Edge" tagline', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/pages/LandingPage.jsx', 'utf8');
    expect(source).toContain('Find Your Edge');
    expect(source).toContain('landing-hero');
  });

  it('contains performance benchmark stats', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/pages/LandingPage.jsx', 'utf8');
    expect(source).toContain('landing-benchmarks');
    expect(source).toContain('Frame Time');
    expect(source).toContain('Bars Rendered');
    expect(source).toContain('Idle GPU Usage');
  });

  it('contains feature cards for GPU, AI Coach, and Journal', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/pages/LandingPage.jsx', 'utf8');
    expect(source).toContain('landing-features');
    expect(source).toContain('GPU Charting Engine');
    expect(source).toContain('AI Coach');
    expect(source).toContain('Trade Journal');
  });

  it('contains CTA button that navigates to journal', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/pages/LandingPage.jsx', 'utf8');
    expect(source).toContain('Start Trading Smarter');
    expect(source).toContain("setPage('journal')");
  });

  it('contains tech architecture pills', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/pages/LandingPage.jsx', 'utf8');
    expect(source).toContain('landing-tech');
    expect(source).toContain('WebGPU Compute');
    expect(source).toContain('GPU Instancing');
    expect(source).toContain('SharedWorker');
  });

  it('is registered in PageRouter', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/app/layouts/PageRouter.jsx', 'utf8');
    expect(source).toContain('LandingPage');
    expect(source).toContain('landing:');
  });

  it('has a SEO route entry for root path', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/seo/routes.js', 'utf8');
    expect(source).toContain("path: '/'");
    expect(source).toContain("page: 'landing'");
  });

  it('links to Terms and Privacy pages', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/pages/LandingPage.jsx', 'utf8');
    expect(source).toContain("setPage('terms')");
    expect(source).toContain("setPage('privacy')");
    expect(source).toContain('Terms of Service');
    expect(source).toContain('Privacy Policy');
  });

  it('supports accessibility: reduced motion and aria attributes', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/pages/LandingPage.jsx', 'utf8');
    const cssSource = await fs.promises.readFile('src/pages/LandingPage.module.css', 'utf8');
    // prefers-reduced-motion moved to CSS module during CSS module migration
    expect(cssSource).toContain('prefers-reduced-motion');
    expect(source).toContain('aria-hidden');
  });
});
