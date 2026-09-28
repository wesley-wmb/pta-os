'use client';

import type { QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';

/** Auth can change from another tab or any sign-out surface, not just the shell. */
export function useAuthCacheBoundary(queryClient: QueryClient) {
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let userId: string | null | undefined;
    const { data } = createClient().auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user.id ?? null;
      // INITIAL_SESSION establishes the baseline without discarding hydration.
      // Repeated SIGNED_IN and TOKEN_REFRESHED for the same user keep warm data.
      if (
        event === 'SIGNED_OUT' ||
        (userId !== undefined && userId !== nextUserId)
      ) {
        queryClient.clear();
      }
      userId = nextUserId;
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);
}
