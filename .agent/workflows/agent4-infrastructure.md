---
description: Infrastructure — security hardening (API key encryption, CSP, rate limiting) and IndexedDB consolidation
---

# Agent 4: Infrastructure — Security & IDB Consolidation

// turbo-all

## Overview
Two related infrastructure tasks that have been deferred from previous sessions:
1. **Security hardening** — encrypt API keys, tighten CSP, rate-limit proxy
2. **IndexedDB consolidation** — merge 6 separate databases into one unified CacheManager

## File Boundaries (ONLY modify these files)
- `src/data/engine/CacheManager.js` — IDB consolidation hub
- `src/data/engine/SessionManager.js` — session data migration
- `src/services/` — all service files (API key handling)
- `server.js` — CSP headers, rate limiting
- `index.html` — CSP meta tag if present
- `src/state/useAuthStore.js` — token/key management
- **NEW** `src/utils/crypto.js` — Web Crypto API helpers

**DO NOT modify any files outside this list.** Especially do not touch `src/pages/`, `src/app/components/`, `src/constants.js`, or `src/theme/`.

## Steps

### 1. Read relevant existing code
```
Read src/data/engine/CacheManager.js — understand current IDB structure
Read server.js — understand current proxy endpoints and CSP headers
Read src/state/useAuthStore.js — understand current auth token handling
Read src/services/ — understand how API keys are stored/used
```

### 2. Create Web Crypto helpers (src/utils/crypto.js)
Build encryption/decryption utilities using the Web Crypto API:
- `generateKey()` — generate an AES-GCM key, store in IndexedDB (not localStorage)
- `encrypt(plaintext, key)` — returns base64 ciphertext + IV
- `decrypt(ciphertext, iv, key)` — returns plaintext
- Key derivation from a user passphrase (optional, for export)
- These are used to encrypt API keys before storing in localStorage

### 3. Encrypt API keys in localStorage
- Identify all places API keys are stored (localStorage, store state)
- Wrap storage with encrypt-on-write, decrypt-on-read
- Migration: on first load, encrypt any existing plaintext keys
- Graceful fallback if Web Crypto not available (e.g., HTTP context)

### 4. Audit and tighten CSP headers
In `server.js` and/or `index.html`:
- Remove `unsafe-inline` from `script-src` (use nonces or hashes instead)
- Remove `unsafe-eval` from `script-src`
- Ensure `connect-src` whitelist covers all API domains used
- Add `frame-ancestors 'none'` to prevent clickjacking
- Test that the app still works with the tightened CSP

### 5. Add rate limiting to RSS proxy
In `server.js`, add rate limiting middleware to proxy endpoints:
- Limit: 30 requests per minute per IP
- Return 429 Too Many Requests with Retry-After header
- Use in-memory rate limiter (no Redis needed for this scale)
- Apply to `/api/rss`, `/api/proxy`, and any other proxy endpoints

### 6. Consolidate IndexedDB databases
Currently there are 6 separate databases:
- `tradeforge-cache` — general data cache
- `TradeForgeBarCache` — OHLCV bar data
- `tf_ohlcv_cache` — another OHLCV cache layer
- `tradeforge-drawings` — chart drawings
- `tradeforge-sessions` — session data
- `tradeforge-ticks` — tick data

Consolidate into a single `tradeforge-unified` database managed by `CacheManager.js`:
- Create object stores for each data type (bars, drawings, sessions, ticks, cache)
- Implement migration: on first open, read from old DBs → write to new → delete old
- Update all consumers to use CacheManager instead of direct IDB access
- Maintain backward compatibility during migration

### 7. Verify
```
npx vitest run
```

Run the full test suite. Verify:
- API keys are encrypted in localStorage (inspect with DevTools)
- CSP headers are properly set (check Network tab)
- Rate limiting returns 429 after threshold
- All IDB data migrated correctly (check Application > IndexedDB in DevTools)
