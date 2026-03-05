// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — SSR / Static Serving
// Production: serves dist/client with SSR for SEO pages
// Development: wires Vite dev server with HMR
// ═══════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';

/**
 * Set up production static + SSR serving.
 * @param {import('express').Express} app
 * @param {string} rootDir - Project root directory
 */
export async function setupProductionSSR(app, rootDir) {
    const distClient = path.join(rootDir, 'dist/client');
    const distServer = path.join(rootDir, 'dist/server');

    if (!fs.existsSync(distClient)) {
        console.error('\x1b[31m✗ Build not found. Run: npm run build\x1b[0m');
        process.exit(1);
    }

    const template = fs.readFileSync(path.join(distClient, 'index.html'), 'utf-8');

    // Load SSR module
    let ssrRender = null;
    const ssrEntry = path.join(distServer, 'entry-server.js');
    if (fs.existsSync(ssrEntry)) {
        try {
            const ssrModule = await import(ssrEntry);
            ssrRender = ssrModule.render;
            console.log('✓ SSR module loaded');
        } catch (err) {
            console.warn('⚠ SSR module failed to load, falling back to SPA mode:', err.message);
        }
    }

    // Hashed assets — immutable cache
    app.use('/assets', (await import('express')).default.static(path.join(distClient, 'assets'), {
        maxAge: '1y',
        immutable: true,
        etag: false,
    }));

    // Other static files (icons, manifest, sw.js)
    app.use((await import('express')).default.static(distClient, {
        maxAge: '1h',
        index: false,
    }));

    // Service worker — no-cache
    app.get('/sw.js', (req, res) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Content-Type', 'application/javascript');
        res.sendFile(path.join(distClient, 'sw.js'));
    });

    // All routes → SSR or SPA fallback
    app.get('*', async (req, res) => {
        try {
            let html = template;

            if (ssrRender) {
                const ssrResult = await ssrRender(req.originalUrl);

                if (ssrResult.redirect) {
                    return res.redirect(ssrResult.statusCode || 302, ssrResult.redirect);
                }
                if (ssrResult.html) {
                    html = html.replace('<!--ssr-outlet-->', ssrResult.html);
                }
                if (ssrResult.head) {
                    html = html.replace('<!--ssr-head-->', ssrResult.head);
                }
                res.status(ssrResult.statusCode || 200);
            }

            res.setHeader('Content-Type', 'text/html');
            res.setHeader('Cache-Control', 'no-cache');
            res.send(html);
        } catch (err) {
            console.error('SSR render error:', err);
            res.status(200)
                .setHeader('Content-Type', 'text/html')
                .send(template);
        }
    });
}

/**
 * Set up development mode with Vite HMR.
 * @param {import('express').Express} app
 * @param {string} rootDir - Project root directory
 */
export async function setupDevSSR(app, rootDir) {
    const { createServer: createViteServer } = await import('vite');

    const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'custom',
    });

    app.use(vite.middlewares);

    app.get('*', async (req, res) => {
        try {
            let template = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8');
            template = await vite.transformIndexHtml(req.originalUrl, template);

            const { render } = await vite.ssrLoadModule('/src/entry-server.jsx');
            const ssrResult = await render(req.originalUrl);

            if (ssrResult.redirect) {
                return res.redirect(ssrResult.statusCode || 302, ssrResult.redirect);
            }

            let html = template;
            if (ssrResult.html) {
                html = html.replace('<!--ssr-outlet-->', ssrResult.html);
            }
            if (ssrResult.head) {
                html = html.replace('<!--ssr-head-->', ssrResult.head);
            }

            res.status(ssrResult.statusCode || 200)
                .setHeader('Content-Type', 'text/html')
                .send(html);
        } catch (err) {
            vite.ssrFixStacktrace(err);
            console.error('Dev SSR error:', err);
            res.status(500).send(`
        <pre style="color:red;font-family:monospace;padding:2em;white-space:pre-wrap">
          ${err.stack || err.message}
        </pre>
      `);
        }
    });
}
