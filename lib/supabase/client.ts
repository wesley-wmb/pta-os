'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import { getPublicSupabaseConfig } from '@/lib/supabase/config';

let browserClient: SupabaseClient<Database> | undefined;

export function createClient() {
  const config = getPublicSupabaseConfig();

  if (!config) {
    throw new Error('PTA_SUPABASE_NOT_CONFIGURED');
  }

  browserClient ??= createBrowserClient<Database>(
    config.url,
    config.publishableKey,
  );
  return browserClient;
}
