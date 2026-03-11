// ═══════════════════════════════════════════════════════════════════
// charEdge — Supabase Client
// Singleton client instance configured from environment variables.
// ═══════════════════════════════════════════════════════════════════
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/observability/logger';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
    logger.boot.warn(
        '[charEdge] Supabase credentials not configured. Auth features will be unavailable.\n' +
        'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local'
    );
}

/**
 * Singleton Supabase client.
 * Safe to import anywhere — returns `null` if credentials are missing.
 */
export const supabase: SupabaseClient | null =
    supabaseUrl && supabaseAnonKey
        ? createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true,   // needed for OAuth redirects
                storageKey: 'charedge-auth', // custom key to avoid collisions
            },
        })
        : null;

export default supabase;
