import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260823003447_workspace_team_activation.sql',
);
const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

function functionBody(name: string, nextName: string) {
  const start = sql.indexOf(`create or replace function ${name}`);
  const end = sql.indexOf(`create or replace function ${nextName}`, start + 1);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}

describe('workspace team activation migration contract', () => {
  it('stores only a sha256 hash and returns the raw invite token once', () => {
    const create = functionBody(
      'public.create_workspace_invitation',
      'public.cancel_workspace_invitation',
    );

    expect(create).toContain(
      "v_raw_token := encode(extensions.gen_random_bytes(32), 'hex')",
    );
    expect(create).toContain(
      "v_token_hash := encode(extensions.digest(v_raw_token, 'sha256'), 'hex')",
    );
    expect(create).toContain('token_hash = v_token_hash');
    expect(create).toContain("'raw_token', v_raw_token");
    expect(create).not.toContain('token_hash = v_raw_token');

    const auditWrites = create.match(
      /insert into public\.activity_logs[\s\S]*?\);/g,
    );
    expect(auditWrites).not.toBeNull();
    for (const auditWrite of auditWrites ?? []) {
      expect(auditWrite).not.toContain('raw_token');
      expect(auditWrite).not.toContain('token_hash');
      expect(auditWrite).not.toContain("'email'");
    }
  });

  it('keeps post-write JSON helpers volatile so they see the new row version', () => {
    const memberHelper = functionBody(
      'private.workspace_member_management_json',
      'private.workspace_invitation_management_json',
    );
    const invitationHelper = functionBody(
      'private.workspace_invitation_management_json',
      'public.list_workspace_team_management',
    );
    const managementList = functionBody(
      'public.list_workspace_team_management',
      'public.create_workspace_invitation',
    );

    for (const body of [memberHelper, invitationHelper, managementList]) {
      expect(body).not.toMatch(/\nlanguage (?:sql|plpgsql)\nstable\n/);
    }
  });

  it('deduplicates open invitations while holding the workspace lock', () => {
    expect(sql).toContain('where accepted_at is null and cancelled_at is null');

    const create = functionBody(
      'public.create_workspace_invitation',
      'public.cancel_workspace_invitation',
    );
    const workspaceLock = create.indexOf("'pta:workspace-team:'");
    const openInviteLock = create.indexOf('for update');
    const insert = create.indexOf('insert into public.workspace_invitations');

    expect(workspaceLock).toBeGreaterThan(0);
    expect(openInviteLock).toBeGreaterThan(workspaceLock);
    expect(insert).toBeGreaterThan(openInviteLock);
  });

  it('reveals workspace context only for a matching pending token', () => {
    const inspect = functionBody(
      'public.inspect_workspace_invitation',
      'public.accept_workspace_invitation',
    );
    const mismatch = inspect.indexOf("'status', 'email_mismatch'");
    const accepted = inspect.indexOf("'status', 'accepted'");
    const cancelled = inspect.indexOf("'status', 'cancelled'");
    const expired = inspect.indexOf("'status', 'expired'");
    const workspaceContext = inspect.indexOf(
      "'workspace_name', v_workspace_name",
    );

    expect(mismatch).toBeGreaterThan(0);
    expect(accepted).toBeGreaterThan(mismatch);
    expect(cancelled).toBeGreaterThan(accepted);
    expect(expired).toBeGreaterThan(cancelled);
    expect(workspaceContext).toBeGreaterThan(expired);
    expect(inspect.slice(0, workspaceContext)).not.toContain(
      "'email', v_invitation.email",
    );
  });

  it('accepts under the workspace lock and revalidates the matching email', () => {
    const accept = functionBody(
      'public.accept_workspace_invitation',
      'public.change_workspace_member_role',
    );
    const workspaceLock = accept.indexOf("'pta:workspace-team:'");
    const invitationLock = accept.indexOf('for update');
    const emailCheck = accept.indexOf('v_invitation.email <> v_actor_email');
    const membershipWrite = accept.indexOf(
      'insert into public.workspace_members',
    );
    const invitationAccept = accept.indexOf(
      'update public.workspace_invitations',
    );

    expect(workspaceLock).toBeGreaterThan(0);
    expect(invitationLock).toBeGreaterThan(workspaceLock);
    expect(emailCheck).toBeGreaterThan(invitationLock);
    expect(membershipWrite).toBeGreaterThan(emailCheck);
    expect(invitationAccept).toBeGreaterThan(membershipWrite);
    expect(accept).toContain(
      'v_invitation.accepted_by is distinct from v_actor',
    );
    expect(accept).toContain("message = 'pta_invitation_already_used'");
    expect(accept).toContain(
      "elsif v_member.status = 'suspended'::public.membership_status",
    );
    expect(accept).toContain('v_membership_activated := true');
  });

  it('keeps removals logical and cancels every remaining open invite', () => {
    const remove = functionBody(
      'public.remove_workspace_member',
      'public.transfer_workspace_ownership',
    );

    expect(remove).toContain("status = 'suspended'::public.membership_status");
    expect(remove).toContain('removed_at = statement_timestamp()');
    expect(remove).toContain('removed_by = v_actor');
    expect(remove).toContain('with cancelled as (');
    expect(remove).toContain('invitation.accepted_at is null');
    expect(remove).toContain('invitation.cancelled_at is null');
    expect(remove).not.toContain('delete from public.workspace_members');
  });

  it('protects every member mutation with versions and the shared lock', () => {
    const functions = [
      [
        'public.change_workspace_member_role',
        'public.suspend_workspace_member',
      ],
      ['public.suspend_workspace_member', 'public.reactivate_workspace_member'],
      ['public.reactivate_workspace_member', 'public.remove_workspace_member'],
      ['public.remove_workspace_member', 'public.transfer_workspace_ownership'],
    ] as const;

    for (const [name, next] of functions) {
      const body = functionBody(name, next);
      expect(body).toContain('p_expected_version integer');
      expect(body).toContain("'pta:workspace-team:'");
      expect(body).toContain('for update');
      expect(body).toContain("message = 'pta_version_conflict'");
    }
  });

  it('transfers ownership atomically and retains a deferred last-owner guard', () => {
    const transferStart = sql.indexOf(
      'create or replace function public.transfer_workspace_ownership',
    );
    const policiesStart = sql.indexOf(
      'alter table public.workspace_members enable row level security',
      transferStart,
    );
    const transfer = sql.slice(transferStart, policiesStart);

    expect(sql).toContain(
      'create constraint trigger workspace_members_require_active_owner',
    );
    expect(sql).toContain(
      'create constraint trigger profiles_require_active_workspace_owner',
    );
    expect(sql).toContain('deferrable initially deferred');
    expect(transfer).toContain("set role = 'admin'::public.workspace_role");
    expect(transfer).toContain("set role = 'owner'::public.workspace_role");
    expect(transfer).toContain("message = 'pta_last_owner_required'");
    expect(transfer).toContain('order by member.user_id');
    expect(transfer).toContain('profile.id = p_new_owner_id');
    expect(transfer).toContain('and profile.is_active');
  });

  it('forces RLS, revokes direct writes and grants only authenticated RPC use', () => {
    expect(sql).toContain(
      'alter table public.workspace_invitations force row level security',
    );
    expect(sql).toContain(
      'revoke all on table public.workspace_invitations from public, anon, authenticated',
    );
    expect(sql).toContain(
      'revoke insert, update, delete, truncate on table public.workspace_members from public, anon, authenticated',
    );

    const rpcSignatures = [
      'public.list_workspace_team_management(uuid)',
      'public.create_workspace_invitation(uuid, text, public.workspace_role, integer)',
      'public.cancel_workspace_invitation(uuid)',
      'public.inspect_workspace_invitation(text)',
      'public.accept_workspace_invitation(text)',
      'public.change_workspace_member_role(uuid, uuid, public.workspace_role, integer)',
      'public.suspend_workspace_member(uuid, uuid, integer)',
      'public.reactivate_workspace_member(uuid, uuid, integer)',
      'public.remove_workspace_member(uuid, uuid, integer)',
      'public.transfer_workspace_ownership(uuid, uuid, integer, integer)',
    ];

    for (const signature of rpcSignatures) {
      expect(sql).toContain(`alter function ${signature} owner to postgres`);
      expect(sql).toContain(
        `revoke all on function ${signature} from public, anon, authenticated`,
      );
      expect(sql).toContain(
        `grant execute on function ${signature} to authenticated`,
      );
    }
  });
});
