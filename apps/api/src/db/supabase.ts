import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { requiredEnv } from '../config/env.js';

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (client) return client;
  client = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export function dbError(error: { message?: string } | null, fallback: string): Error {
  return new Error(error?.message || fallback);
}
