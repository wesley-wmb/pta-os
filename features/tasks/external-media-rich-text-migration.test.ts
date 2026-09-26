import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260825090000_external_media_links_rich_text.sql',
);
const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

describe('external media and rich text migration', () => {
  it('blocks new Supabase Storage uploads without deleting legacy data', () => {
    expect(sql).toContain(
      'drop policy if exists task_attachments_object_insert on storage.objects',
    );
    expect(sql).toContain(
      'revoke execute on function public.prepare_task_attachment',
    );
    expect(sql).toContain(
      'revoke execute on function public.complete_task_attachment',
    );
    expect(sql).not.toContain('delete from storage.objects');
    expect(sql).not.toContain('drop table public.task_attachments');
  });

  it('allowlists rich text and rejects every media node by omission', () => {
    expect(sql).toContain(
      'create or replace function private.is_valid_task_description_node',
    );
    expect(sql).toContain("v_type in ('bold', 'italic', 'strike', 'code')");
    expect(sql).toContain("v_type <> 'link'");
    expect(sql).toContain("'tasklist'");
    expect(sql).toContain("'taskitem'");
    expect(sql).not.toContain("v_type = 'image'");
    expect(sql).not.toContain("v_type = 'video'");
    expect(sql).not.toContain("v_type = 'audio'");
  });
});
