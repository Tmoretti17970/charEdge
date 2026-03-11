// ═══════════════════════════════════════════════════════════════════
// charEdge — Public Route Definitions (SEO)
// Defines URL patterns for server-side rendered public pages.
// ═══════════════════════════════════════════════════════════════════

const PUBLIC_ROUTES = [
  { path: '/', page: 'landing', title: () => 'charEdge — Find Your Edge' },
  { path: '/pricing', page: 'pricing', title: () => 'Pricing — charEdge' },
  { path: '/terms', page: 'terms', title: () => 'Terms of Service — charEdge' },
  { path: '/privacy', page: 'privacy', title: () => 'Privacy Policy — charEdge' },
  { path: '/changelog', page: 'changelog', title: () => 'Changelog — charEdge' },
  { path: '/s/:symbol', page: 'symbol', title: (p) => `${p.symbol} — charEdge` },
  { path: '/snap/:id', page: 'snapshot', title: () => 'Trade Snapshot — charEdge' },
  { path: '/u/:username', page: 'profile', title: (p) => `${p.username} — charEdge` },
  { path: '/leaderboard', page: 'leaderboard', title: () => 'Leaderboard — charEdge' },
];

export function matchRoute(url) {
  for (const route of PUBLIC_ROUTES) {
    const pattern = route.path.replace(/:(\w+)/g, '(?<$1>[^/]+)');
    const match = url.match(new RegExp(`^${pattern}$`));
    if (match) return { ...route, params: match.groups || {} };
  }
  return null;
}

export function getAllPublicPaths() {
  return PUBLIC_ROUTES.map((r) => r.path);
}

export { PUBLIC_ROUTES };
