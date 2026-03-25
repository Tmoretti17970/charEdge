// ═══════════════════════════════════════════════════════════════════
// charEdge — Intel Page Source Tests
//
// Source-verification tests for the Intel page and its sub-components.
// Validates structure, imports, navigation, accessibility, telemetry,
// AI integration, and signal tab definitions.
// ═══════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import { describe, it, expect } from 'vitest';

// Read all Intel component sources
const intelPage = fs.readFileSync('src/pages/IntelPage.jsx', 'utf8');
const signalsSection = fs.readFileSync('src/app/components/intel/SignalsSection.jsx', 'utf8');
const researchSection = fs.readFileSync('src/app/components/intel/ResearchSection.jsx', 'utf8');
const marketPulse = fs.readFileSync('src/app/components/intel/MarketPulse.jsx', 'utf8');
const fearGreedMini = fs.readFileSync('src/app/components/intel/FearGreedMini.jsx', 'utf8');
const trendingNarratives = fs.readFileSync('src/app/components/intel/TrendingNarratives.jsx', 'utf8');
const optionsFlow = fs.readFileSync('src/app/components/intel/OptionsFlowCompact.jsx', 'utf8');
const insiderCompact = fs.readFileSync('src/app/components/intel/InsiderCompact.jsx', 'utf8');
const technicalSignals = fs.readFileSync('src/app/components/intel/TechnicalSignalsCompact.jsx', 'utf8');
const macroSection = fs.readFileSync('src/app/components/intel/MacroSection.jsx', 'utf8');
const predictionMarkets = fs.readFileSync('src/app/components/intel/PredictionMarkets.jsx', 'utf8');
const intelCopilot = fs.readFileSync('src/app/components/intel/IntelCopilot.jsx', 'utf8');
const theBrief = fs.readFileSync('src/app/components/intel/TheBrief.jsx', 'utf8');

// Read navigation and routing sources
const pageRouter = fs.readFileSync('src/app/layouts/PageRouter.jsx', 'utf8');
const sidebar = fs.readFileSync('src/app/layouts/Sidebar.jsx', 'utf8');
const mobileNav = fs.readFileSync('src/app/layouts/MobileNav.jsx', 'utf8');

// ─── Structure ───────────────────────────────────────────────────

describe('Structure', () => {
  it('IntelPage exports default with React.memo', () => {
    expect(intelPage).toContain('export default React.memo(IntelPage)');
  });

  it('SignalsSection exports default with React.memo', () => {
    expect(signalsSection).toContain('export default React.memo(SignalsSection)');
  });

  it('ResearchSection exports default with React.memo', () => {
    expect(researchSection).toContain('export default React.memo(ResearchSection)');
  });

  it('MarketPulse exports default with React.memo', () => {
    expect(marketPulse).toContain('export default React.memo(MarketPulse)');
  });

  it('IntelCopilot exports default with React.memo', () => {
    expect(intelCopilot).toContain('export default React.memo(IntelCopilot)');
  });

  it('TheBrief exports default with React.memo', () => {
    expect(theBrief).toContain('export default React.memo(TheBrief)');
  });

  it('MacroSection exports default with React.memo', () => {
    expect(macroSection).toContain('export default React.memo(MacroSection)');
  });
});

// ─── Imports ─────────────────────────────────────────────────────

describe('Imports', () => {
  it('IntelPage imports constants and colorUtils', () => {
    expect(intelPage).toContain("from '../constants.js'");
    expect(intelPage).toContain("from '@/shared/colorUtils'");
  });

  it('SignalsSection imports constants and colorUtils', () => {
    expect(signalsSection).toContain("from '../../../constants.js'");
    expect(signalsSection).toContain("from '@/shared/colorUtils'");
  });

  it('ResearchSection imports constants and colorUtils', () => {
    expect(researchSection).toContain("from '../../../constants.js'");
    expect(researchSection).toContain("from '@/shared/colorUtils'");
  });

  it('MarketPulse imports constants and colorUtils', () => {
    expect(marketPulse).toContain("from '../../../constants.js'");
    expect(marketPulse).toContain("from '@/shared/colorUtils'");
  });

  it('IntelCopilot imports constants and colorUtils', () => {
    expect(intelCopilot).toContain("from '../../../constants.js'");
    expect(intelCopilot).toContain("from '@/shared/colorUtils'");
  });
});

// ─── Navigation ──────────────────────────────────────────────────

describe('Navigation', () => {
  it('PageRouter has intel route mapped to IntelPage', () => {
    expect(pageRouter).toContain('intel: IntelPage');
  });

  it('PageRouter lazy-loads IntelPage', () => {
    expect(pageRouter).toContain("import('../../pages/IntelPage.jsx')");
  });

  it('Sidebar has intel nav item', () => {
    expect(sidebar).toContain("id: 'intel'");
    expect(sidebar).toContain("label: 'Intel'");
  });

  it('MobileNav has intel nav item', () => {
    expect(mobileNav).toContain("id: 'intel'");
    expect(mobileNav).toContain("label: 'Intel'");
  });

  it('PageRouter also maps discover to IntelPage', () => {
    expect(pageRouter).toContain('discover: IntelPage');
  });
});

// ─── Accessibility ───────────────────────────────────────────────

describe('Accessibility', () => {
  it('IntelPage persona selector uses radiogroup role', () => {
    expect(intelPage).toContain('role="radiogroup"');
    expect(intelPage).toContain('role="radio"');
    expect(intelPage).toContain('aria-checked');
  });

  it('SignalsSection has tablist and tab roles', () => {
    expect(signalsSection).toContain('role="tablist"');
    expect(signalsSection).toContain('role="tab"');
    expect(signalsSection).toContain('aria-selected');
  });

  it('SignalsSection has tabpanel role', () => {
    expect(signalsSection).toContain('role="tabpanel"');
    expect(signalsSection).toContain('aria-labelledby');
  });

  it('ResearchSection has tablist and tab roles', () => {
    expect(researchSection).toContain('role="tablist"');
    expect(researchSection).toContain('role="tab"');
    expect(researchSection).toContain('aria-selected');
  });

  it('ResearchSection has tabpanel role', () => {
    expect(researchSection).toContain('role="tabpanel"');
    expect(researchSection).toContain('aria-labelledby');
  });

  it('IntelPage sections have aria-labelledby', () => {
    expect(intelPage).toContain('aria-labelledby');
  });
});

// ─── Telemetry ───────────────────────────────────────────────────

describe('Telemetry', () => {
  it('IntelPage imports trackFeatureUse and trackClick', () => {
    expect(intelPage).toContain('trackFeatureUse');
    expect(intelPage).toContain('trackClick');
    expect(intelPage).toContain("from '../observability/telemetry.ts'");
  });

  it('IntelPage imports useDataStore for impression tracking', () => {
    expect(intelPage).toContain('useDataStore');
    expect(intelPage).toContain("from '../state/useDataStore.js'");
  });

  it('IntelPage tracks page view on mount', () => {
    expect(intelPage).toContain("trackFeatureUse('intel_page_view')");
  });

  it('IntelPage tracks persona change', () => {
    expect(intelPage).toContain("trackClick('intel_persona_' + id");
  });

  it('IntelPage tracks section impressions via IntersectionObserver', () => {
    expect(intelPage).toContain("trackImpression('intel_section_' + id)");
  });

  it('SignalsSection imports trackClick', () => {
    expect(signalsSection).toContain('trackClick');
    expect(signalsSection).toContain("from '../../../observability/telemetry.ts'");
  });

  it('SignalsSection tracks tab switch', () => {
    expect(signalsSection).toContain("trackClick('intel_signal_tab_' + tabId");
  });

  it('ResearchSection imports trackClick', () => {
    expect(researchSection).toContain('trackClick');
    expect(researchSection).toContain("from '../../../observability/telemetry.ts'");
  });

  it('ResearchSection tracks tab switch', () => {
    expect(researchSection).toContain("trackClick('intel_research_tab_' + tabId");
  });

  it('IntelCopilot imports trackFeatureUse', () => {
    expect(intelCopilot).toContain('trackFeatureUse');
    expect(intelCopilot).toContain("from '../../../observability/telemetry.ts'");
  });

  it('IntelCopilot tracks query send', () => {
    expect(intelCopilot).toContain("trackFeatureUse('intel_copilot_query'");
  });

  it('IntelCopilot tracks quick prompt click', () => {
    expect(intelCopilot).toContain("trackFeatureUse('intel_copilot_quick_prompt'");
  });
});

// ─── AI Integration ──────────────────────────────────────────────

describe('AI Integration', () => {
  it('IntelCopilot imports aiRouter', () => {
    expect(intelCopilot).toContain('aiRouter');
    expect(intelCopilot).toContain("from '../../../ai/AIRouter.ts'");
  });

  it('IntelCopilot imports journalRAG', () => {
    expect(intelCopilot).toContain('journalRAG');
  });

  it('IntelCopilot imports traderDNA', () => {
    expect(intelCopilot).toContain('traderDNA');
  });

  it('IntelCopilot has section-specific prompts', () => {
    expect(intelCopilot).toContain('SECTION_PROMPTS');
  });
});

// ─── Signals Tabs ────────────────────────────────────────────────

describe('Signals tabs', () => {
  it('SignalsSection defines all 6 tabs', () => {
    expect(signalsSection).toContain("id: 'all'");
    expect(signalsSection).toContain("id: 'flow'");
    expect(signalsSection).toContain("id: 'insider'");
    expect(signalsSection).toContain("id: 'technical'");
    expect(signalsSection).toContain("id: 'whale'");
    expect(signalsSection).toContain("id: 'liquidations'");
  });

  it('SignalsSection renders sub-components for each tab', () => {
    expect(signalsSection).toContain('OptionsFlowCompact');
    expect(signalsSection).toContain('InsiderCompact');
    expect(signalsSection).toContain('TechnicalSignalsCompact');
  });
});
