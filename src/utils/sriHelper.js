// ═══════════════════════════════════════════════════════════════════
// charEdge — SRI (Subresource Integrity) Helper
//
// Build-time utility for generating SRI hashes for external scripts
// and stylesheets. Currently charEdge self-hosts all assets via
// @fontsource, so no external scripts exist. This helper is provided
// for future-proofing if external CDN resources are ever added.
//
// Usage (build script):
//   import { generateSRI, validateSRI } from './sriHelper.js';
//   const hash = await generateSRI('https://cdn.example.com/lib.js');
//   // → 'sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/...'
//
// Usage (runtime validation):
//   const valid = validateSRI(content, expectedHash);
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate an SRI hash for a given resource content.
 * Uses SHA-384 (recommended by W3C SRI spec).
 *
 * @param {string|ArrayBuffer} content - Resource content
 * @param {'sha256'|'sha384'|'sha512'} algorithm - Hash algorithm (default: sha384)
 * @returns {Promise<string>} SRI hash string (e.g., 'sha384-...')
 */
export async function generateSRI(content, algorithm = 'sha384') {
    const algoMap = {
        sha256: 'SHA-256',
        sha384: 'SHA-384',
        sha512: 'SHA-512',
    };

    const subtle = typeof crypto !== 'undefined' ? crypto.subtle : null;
    if (!subtle) throw new Error('Web Crypto API not available');

    const encoded = typeof content === 'string'
        ? new TextEncoder().encode(content)
        : new Uint8Array(content);

    const hashBuffer = await subtle.digest(algoMap[algorithm], encoded);
    const hashArray = new Uint8Array(hashBuffer);

    // Convert to base64
    const base64 = btoa(String.fromCharCode(...hashArray));

    return `${algorithm}-${base64}`;
}

/**
 * Validate content against an SRI hash.
 *
 * @param {string|ArrayBuffer} content - Resource content to validate
 * @param {string} expectedHash - SRI hash string (e.g., 'sha384-...')
 * @returns {Promise<boolean>} True if content matches hash
 */
export async function validateSRI(content, expectedHash) {
    const parts = expectedHash.split('-', 1);
    const algorithm = /** @type {'sha256'|'sha384'|'sha512'} */ (parts[0] || 'sha384');
    const computedHash = await generateSRI(content, algorithm);
    return computedHash === expectedHash;
}

/**
 * Fetch a remote resource and generate its SRI hash.
 * For use in build scripts to pre-compute hashes.
 *
 * @param {string} url - URL of the external resource
 * @param {'sha256'|'sha384'|'sha512'} algorithm - Hash algorithm
 * @returns {Promise<{ url: string, hash: string }>}
 */
export async function fetchAndHash(url, algorithm = 'sha384') {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
    const content = await response.arrayBuffer();
    const hash = await generateSRI(content, algorithm);
    return { url, hash };
}

/**
 * Audit an HTML string for external scripts/links missing integrity attributes.
 * Returns an array of URLs that should have SRI hashes added.
 *
 * @param {string} html - HTML content to audit
 * @returns {string[]} URLs of external resources missing integrity
 */
export function auditMissingSRI(html) {
    /** @type {string[]} */
    const missing = [];

    // Match <script src="https://..."> without integrity
    const scriptRegex = /<script[^>]+src=["'](?:https?:\/\/[^"']+)["'][^>]*>/gi;
    for (const match of html.matchAll(scriptRegex)) {
        const tag = match[0];
        if (!tag.includes('integrity=')) {
            const srcMatch = tag.match(/src=["']([^"']+)["']/);
            if (srcMatch && srcMatch[1]) missing.push(srcMatch[1]);
        }
    }

    // Match <link href="https://..." rel="stylesheet"> without integrity
    const linkRegex = /<link[^>]+href=["'](?:https?:\/\/[^"']+)["'][^>]*>/gi;
    for (const match of html.matchAll(linkRegex)) {
        const tag = match[0];
        if (tag.includes('rel="stylesheet"') && !tag.includes('integrity=')) {
            const hrefMatch = tag.match(/href=["']([^"']+)["']/);
            if (hrefMatch && hrefMatch[1]) missing.push(hrefMatch[1]);
        }
    }

    return missing;
}
