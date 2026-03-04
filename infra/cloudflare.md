# ═══════════════════════════════════════════════════════════════════
# charEdge — Cloudflare Configuration Reference
#
# This file documents the recommended Cloudflare settings.
# Apply these via the Cloudflare dashboard or Wrangler CLI.
# ═══════════════════════════════════════════════════════════════════

# ─── DNS Records ─────────────────────────────────────────────────
#
# Type    Name              Content              Proxy    TTL
# A       charedge.app      <HETZNER_IP>         Proxied  Auto
# CNAME   www               charedge.app         Proxied  Auto
#
# ─── SSL/TLS ─────────────────────────────────────────────────────
#
# Encryption Mode: Full (Strict)
# Always Use HTTPS: On
# Minimum TLS Version: 1.2
# HSTS: Enabled (max-age=31536000, includeSubDomains)
#
# Origin Certificate:
#   Generate via Cloudflare dashboard → SSL/TLS → Origin Server
#   Save as infra/ssl/cert.pem and infra/ssl/key.pem
#
# ─── Speed ───────────────────────────────────────────────────────
#
# Auto Minify: JavaScript, CSS, HTML
# Brotli: On
# Rocket Loader: Off (conflicts with React SPA)
# Early Hints: On
#
# ─── Caching ─────────────────────────────────────────────────────
#
# Browser Cache TTL: Respect Existing Headers
# Cache Level: Standard
#
# Page Rules:
#   1. charedge.app/assets/*
#      Cache Level: Cache Everything
#      Edge Cache TTL: 1 month
#      Browser Cache TTL: 1 year
#
#   2. charedge.app/api/*
#      Cache Level: Bypass
#
#   3. charedge.app/ws/*
#      Cache Level: Bypass (WebSocket)
#
# ─── Security ────────────────────────────────────────────────────
#
# WAF: On (Managed Rules)
# Bot Fight Mode: On
# Security Level: Medium
# Challenge Passage: 30 minutes
#
# Rate Limiting Rules:
#   /api/*  → 100 requests/10s per IP → Challenge
#   /ws/*   → 10 connections/min per IP → Block
#
# ─── Performance Analytics ───────────────────────────────────────
#
# Web Analytics: Enabled
# Core Web Vitals monitoring: Yes
#
# ─── Workers (Future) ───────────────────────────────────────────
#
# Planned: Edge-side price caching for Hub Mode
# Route: charedge.app/api/prices/*
# Worker: infra/workers/price-cache.js (TBD)
