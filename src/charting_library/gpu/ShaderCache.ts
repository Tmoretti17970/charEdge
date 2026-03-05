// ═══════════════════════════════════════════════════════════════════
// charEdge — Shader Cache (IndexedDB)
//
// Persists compiled shader source in IndexedDB for instant reload.
// Keyed by content hash so stale entries are auto-invalidated.
//
// Note: WebGL doesn't expose compiled shader binaries in most
// browsers, so we cache the GLSL source + compilation metadata.
// The real win is skipping the JS-side source assembly and
// providing instant ShaderLibrary warm-up on reload.
// ═══════════════════════════════════════════════════════════════════

export interface CachedShader {
    name: string;
    hash: string;
    vertSource: string;
    fragSource: string;
    cachedAt: number;
}

const DB_NAME = 'charEdge_shaderCache';
const STORE_NAME = 'shaders';
const DB_VERSION = 1;

/**
 * Simple FNV-1a hash for shader source strings.
 * Fast and sufficient for cache key generation.
 */
export function hashShaderSource(vert: string, frag: string): string {
    let h = 0x811c9dc5; // FNV offset basis
    const combined = vert + '|||' + frag;
    for (let i = 0; i < combined.length; i++) {
        h ^= combined.charCodeAt(i);
        h = Math.imul(h, 0x01000193); // FNV prime
    }
    return (h >>> 0).toString(36);
}

/**
 * Open the shader cache IndexedDB.
 */
function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB not available'));
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'name' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get a cached shader by name. Returns null if not found or hash mismatch.
 */
export async function getCachedShader(
    name: string,
    expectedHash: string,
): Promise<CachedShader | null> {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(name);

            request.onsuccess = () => {
                const result = request.result as CachedShader | undefined;
                if (result && result.hash === expectedHash) {
                    resolve(result);
                } else {
                    resolve(null); // Hash mismatch = stale cache
                }
            };

            request.onerror = () => resolve(null);
        });
    } catch {
        return null;
    }
}

/**
 * Store a shader in the cache.
 */
export async function setCachedShader(entry: CachedShader): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.put(entry);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch {
        // Silently fail — caching is non-critical
    }
}

/**
 * Clear all cached shaders.
 */
export async function clearShaderCache(): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch {
        // Silently fail
    }
}

/**
 * Get count of cached shaders.
 */
export async function getCacheSize(): Promise<number> {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(0);
        });
    } catch {
        return 0;
    }
}
