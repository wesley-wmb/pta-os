import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import type { Database } from '@/lib/database.types';
import { getPublicSupabaseConfig } from '@/lib/supabase/config';

export async function createClient() {
  const config = getPublicSupabaseConfig();

  if (!config) {
    throw new Error('PTA_SUPABASE_NOT_CONFIGURED');
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always mutate cookies. proxy.ts refreshes them.
        }
      },
    },
  });
}
