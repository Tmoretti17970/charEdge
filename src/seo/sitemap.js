// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Sitemap Generator
//
// Generates sitemap.xml for search engine indexing.
// Includes all public routes: static pages + known symbol pages.
//
// Called by server.js on GET /sitemap.xml.
// Can also be used for static generation: node -e "import('./src/seo/sitemap.js').then(m => logger.boot.info(m.generateSitemap()))"
// ═══════════════════════════════════════════════════════════════════

import { SITE_URL } from './meta.js';
import { getAllPublicPaths } from './routes.js';

/**
 * P2 8.3: Dynamic sitemap — fetches live symbol data for accurate lastmod.
 * @returns {Promise<string>} XML string
 */
export async function generateSitemap() {
  const paths = getAllPublicPaths();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Fetch known symbols for dynamic /s/:symbol pages
  let symbolPaths = [];
  try {
    const { openCacheDB } = await import('../data/DataCache.ts');
    const db = await openCacheDB();
    const tx = db.transaction('meta', 'readonly');
    const store = tx.objectStore('meta');
    const allMeta = await new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
    symbolPaths = allMeta
      .filter((m) => m.key && m.key.startsWith('candles:'))
      .map((m) => {
        const symbol = m.key.split(':')[1];
        const lastmod = m.lastUpdated
          ? new Date(m.lastUpdated).toISOString().split('T')[0]
          : today;
        return { path: `/s/${symbol}`, lastmod };
      });
  } catch { /* DataCache unavailable — use static paths only */ }

  const urls = paths.map((path) => {
    const priority = getPriority(path);
    const changefreq = getChangefreq(path);

    return `  <url>
    <loc>${SITE_URL}${path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
  });

  // Append dynamic symbol pages
  for (const sp of symbolPaths) {
    urls.push(`  <url>
    <loc>${SITE_URL}${sp.path}</loc>
    <lastmod>${sp.lastmod}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.7</priority>
  </url>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
}

/**
 * Generate robots.txt content.
 * @returns {string}
 */
export function generateRobotsTxt() {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /_internal/',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ].join('\n');
}

// ─── Helpers ──────────────────────────────────────────────────

function getPriority(path) {
  if (path === '/') return '1.0';
  if (path === '/leaderboard') return '0.8';
  if (path.startsWith('/symbol/')) return '0.7';
  if (path.startsWith('/shared/')) return '0.5';
  return '0.5';
}

function getChangefreq(path) {
  if (path === '/') return 'daily';
  if (path === '/leaderboard') return 'hourly';
  if (path.startsWith('/symbol/')) return 'hourly';
  if (path.startsWith('/shared/')) return 'weekly';
  return 'weekly';
}
