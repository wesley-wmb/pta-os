import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260925103000_profile_identity.sql',
  ),
  'utf8',
).toLowerCase();

describe('profile identity migration contract', () => {
  it('adds bounded professional identity fields', () => {
    expect(sql).toContain('add column if not exists pronouns text');
    expect(sql).toContain('add column if not exists job_title text');
    expect(sql).toContain('add column if not exists department text');
    expect(sql).toContain('add column if not exists bio text');
    expect(sql).toContain('profiles_bio_length');
  });

  it('updates only the authenticated active profile with an optimistic lock', () => {
    expect(sql).toContain(
      'create or replace function public.update_own_profile',
    );
    expect(sql).toContain('v_actor uuid := auth.uid()');
    expect(sql).toContain('where profile.id = v_actor');
    expect(sql).toContain('for update');
    expect(sql).toContain(
      'v_profile.updated_at is distinct from p_expected_updated_at',
    );
    expect(sql).toContain("message = 'pta_version_conflict'");
  });

  it('rejects unsafe avatar URLs and direct profile writes', () => {
    expect(sql).toContain("v_avatar_path !~ '^https://[^[:space:]]+$'");
    expect(sql).toContain(
      'revoke insert, update, delete, truncate on table public.profiles',
    );
    expect(sql).toContain(
      'grant execute on function public.update_own_profile',
    );
    expect(sql.trimEnd().endsWith('commit;')).toBe(true);
  });
});
