import 'server-only';

import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import { initialsFor, profileResponseSchema } from './schemas';
import type { ProfileData } from './types';

export async function getOwnProfile(): Promise<ProfileData> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect('/login');

  const completeResult = await supabase
    .from('profiles')
    .select(
      'id, full_name, email, initials, avatar_path, pronouns, job_title, department, bio, locale, updated_at',
    )
    .eq('id', user.id)
    .maybeSingle();

  if (!completeResult.error && completeResult.data) {
    const parsed = profileResponseSchema.safeParse(completeResult.data);
    if (!parsed.success) throw new Error('PTA_PROFILE_INVALID_RESPONSE');
    return { ...parsed.data, canEdit: true };
  }

  // Keeps the profile page readable while a pending database migration is
  // being promoted. Editing remains disabled by the unavailable RPC.
  const legacyResult = await supabase
    .from('profiles')
    .select('id, full_name, email, initials, avatar_path, locale, updated_at')
    .eq('id', user.id)
    .maybeSingle();

  if (legacyResult.error || !legacyResult.data) {
    throw new Error('PTA_PROFILE_UNAVAILABLE');
  }

  return {
    canEdit: false,
    id: legacyResult.data.id,
    fullName: legacyResult.data.full_name,
    email: legacyResult.data.email,
    initials:
      legacyResult.data.initials || initialsFor(legacyResult.data.full_name),
    avatarUrl: legacyResult.data.avatar_path,
    pronouns: null,
    jobTitle: null,
    department: null,
    bio: null,
    locale: legacyResult.data.locale,
    updatedAt: legacyResult.data.updated_at,
  };
}
