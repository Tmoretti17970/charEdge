// ═══════════════════════════════════════════════════════════════════
// charEdge — Settings Search Index
//
// Flat index of all searchable settings items for deep search.
// Each entry maps to a page + section for navigation.
// ═══════════════════════════════════════════════════════════════════

export const SETTINGS_INDEX = [
  // ─── Account ──────────────────────────────────────────────────
  { page: 'account', section: 'profile', label: 'Display Name', keywords: 'username name avatar photo image identity profile' },
  { page: 'account', section: 'profile', label: 'Bio & Tagline', keywords: 'about description tagline' },
  { page: 'account', section: 'profile', label: 'Trader Card', keywords: 'card stats profile share community' },
  { page: 'account', section: 'security', label: 'Security', keywords: 'password login authentication two-factor 2fa' },
  { page: 'account', section: 'achievements', label: 'Achievements', keywords: 'gamification xp level rank badge streak quest reward' },
  { page: 'account', section: 'achievements', label: 'Daily Goals', keywords: 'goal target pnl daily weekly monthly yearly loss limit' },

  // ─── App ──────────────────────────────────────────────────────
  { page: 'app', section: 'appearance', label: 'Theme', keywords: 'dark light mode color scheme appearance' },
  { page: 'app', section: 'appearance', label: 'Accent Color', keywords: 'brand accent primary tint color' },
  { page: 'app', section: 'appearance', label: 'Chart Colors', keywords: 'candle bull bear classic neon mono ocean sunset palette chart' },
  { page: 'app', section: 'appearance', label: 'Density', keywords: 'compact comfortable standard spacing layout density' },
  { page: 'app', section: 'appearance', label: 'Font Size', keywords: 'text size typography font scale' },
  { page: 'app', section: 'appearance', label: 'Simple Mode', keywords: 'simple beginner minimal clean' },
  { page: 'app', section: 'featurelab', label: 'Feature Lab', keywords: 'experimental beta tier unlock advanced power features' },

  // ─── AI ───────────────────────────────────────────────────────
  { page: 'ai', section: 'intelligence', label: 'AI Engine', keywords: 'model copilot webllm gemini groq local cloud provider engine' },
  { page: 'ai', section: 'intelligence', label: 'AI Personality', keywords: 'tone coaching concise detailed friendly personality style' },
  { page: 'ai', section: 'intelligence', label: 'Context Sources', keywords: 'journal trades watchlist chart dna memory context' },
  { page: 'ai', section: 'intelligence', label: 'AI Privacy', keywords: 'local cloud on-device privacy ai data' },

  // ─── Alerts ───────────────────────────────────────────────────
  { page: 'alerts', section: 'notifications', label: 'Notifications', keywords: 'push email sound alert notification notify' },
  { page: 'alerts', section: 'notifications', label: 'Do Not Disturb', keywords: 'dnd quiet focus mute pause silence' },
  { page: 'alerts', section: 'notifications', label: 'Price Alerts', keywords: 'price alert watchlist trigger target' },

  // ─── Data ─────────────────────────────────────────────────────
  { page: 'data', section: 'import', label: 'Import Trades', keywords: 'csv json upload file tradovate ninjatrader thinkorswim ibkr webull robinhood mt5 binance import' },
  { page: 'data', section: 'export', label: 'Export Data', keywords: 'download csv json report performance export' },
  { page: 'data', section: 'backup', label: 'Backup & Restore', keywords: 'save restore cloud sync auto-backup schedule backup' },
  { page: 'data', section: 'export', label: 'Performance Report', keywords: 'report card pdf shareable stats metrics' },

  // ─── Privacy & Security ───────────────────────────────────────
  { page: 'privacy', section: 'apikeys', label: 'API Keys', keywords: 'polygon alpha vantage broker key secret token api' },
  { page: 'privacy', section: 'consent', label: 'Analytics & Consent', keywords: 'gdpr privacy tracking telemetry opt-out analytics consent' },
  { page: 'privacy', section: 'danger', label: 'Reset All Data', keywords: 'delete clear wipe factory reset danger erase' },
  { page: 'privacy', section: 'danger', label: 'Delete Account', keywords: 'remove account delete permanent' },
];

/**
 * Search the settings index.
 * Returns matching entries sorted by relevance (label match > keyword match).
 */
export function searchSettings(query) {
  if (!query || query.trim().length < 2) return [];
  const q = query.toLowerCase().trim();
  const results = [];

  for (const item of SETTINGS_INDEX) {
    const labelMatch = item.label.toLowerCase().includes(q);
    const keywordMatch = item.keywords.includes(q);
    if (labelMatch || keywordMatch) {
      results.push({ ...item, relevance: labelMatch ? 2 : 1 });
    }
  }

  return results
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 8); // Cap at 8 results
}
