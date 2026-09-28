import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260927130000_api_automation_foundation.sql',
  ),
  'utf8',
);

describe('API and automation database foundation', () => {
  it('stores only API key hashes and scopes keys by workspace', () => {
    expect(migration).toContain('create table public.workspace_api_keys');
    expect(migration).toContain("digest(v_token, 'sha256')");
    expect(migration).not.toContain('token_plaintext');
    expect(migration).toContain('foreign key (workspace_id, created_by)');
  });

  it('uses canonical domain triggers and not activity logs as the outbox source', () => {
    expect(migration).toContain('create trigger tasks_enqueue_automation');
    expect(migration).toContain('create trigger assignees_enqueue_automation');
    expect(migration).toContain('create trigger comments_enqueue_automation');
    expect(migration).not.toContain('activity_logs_enqueue_task_automation');
  });

  it('prevents self notifications and duplicate source events', () => {
    expect(migration).toContain('unique (source_key)');
    expect(migration).toContain('task_automation_no_self_notification');
    expect(migration).toContain(
      'check (recipient_id is null or actor_id is distinct from recipient_id)',
    );
    expect(migration).toContain(
      'candidate.user_id is distinct from p_actor_id',
    );
    expect(migration).toContain('v_recipient_id is distinct from p_actor_id');
  });

  it('collapses pending deliveries before claiming work', () => {
    expect(migration).toContain('COLLAPSED_INTO_NEWER_EVENT');
    expect(migration).toContain(
      'newer_event.collapse_key = stale_event.collapse_key',
    );
    expect(migration).toContain("newer.status in ('pending', 'failed')");
  });

  it('stores recoverable provider credentials only in Vault', () => {
    expect(migration).toContain(
      'create extension if not exists supabase_vault',
    );
    expect(migration).toContain('vault.create_secret');
    expect(migration).toContain('vault.decrypted_secrets');
    expect(migration).not.toContain('credential_plaintext');
  });

  it('keeps public API mutation wrappers behind service role', () => {
    expect(migration).toContain('public.api_update_task');
    expect(migration).toContain('public.api_add_task_comment');
    expect(migration).toContain('to service_role');
  });
});
