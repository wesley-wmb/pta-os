import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), cookies: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('next/headers', () => ({ cookies: mocks.cookies }));
import { getWorkspaceContext } from './server';

const workspaceId = '00000000-0000-4000-8000-000000000001';
const outsiderWorkspace = '00000000-0000-4000-8000-000000000002';
const user = { id: 'member', email: 'member@example.com', user_metadata: {} };
const workspace = {
  id: workspaceId,
  name: 'PTA',
  task_prefix: 'PTA',
  timezone: 'America/Sao_Paulo',
  archived_at: null,
};

function setup({
  authenticated = true,
  visibleWorkspace = workspace as typeof workspace | null,
  members = [] as unknown[],
} = {}) {
  let membershipReads = 0;
  const from = vi.fn((table: string) => {
    const data =
      table === 'profiles'
        ? { id: user.id, full_name: 'Pessoa', avatar_path: null }
        : membershipReads++ === 0
          ? [
              {
                workspace_id: workspaceId,
                role: 'member',
                created_at: '2026-01-01',
                workspace: visibleWorkspace,
              },
            ]
          : members;
    const result = Promise.resolve({ data, error: null });
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn(() => {
        throw new Error(
          'Column-level grants do not permit filtering removed_at',
        );
      }),
      order: vi.fn().mockReturnThis(),
      maybeSingle: () => result,
      then: result.then.bind(result),
    };
    return builder;
  });
  const getUser = vi.fn().mockResolvedValue({
    data: { user: authenticated ? user : null },
    error: null,
  });
  mocks.createClient.mockResolvedValue({ auth: { getUser }, from });
  return { from, getUser };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookies.mockResolvedValue({
    get: () => ({ value: outsiderWorkspace }),
  });
});

describe('contexto de workspace com relações embutidas', () => {
  it('mantém autenticação antes de ler dados de domínio', async () => {
    const { from } = setup({ authenticated: false });
    expect(await getWorkspaceContext()).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
  it('não confia no cookie de outro workspace e carrega o contexto com três consultas', async () => {
    const { from } = setup();
    const context = await getWorkspaceContext();
    expect(context?.workspace?.id).toBe(workspaceId);
    expect(context?.workspace?.role).toBe('member');
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      'profiles',
      'workspace_members',
      'workspace_members',
    ]);
  });
  it('não expõe workspace que RLS não retornou no join', async () => {
    setup({ visibleWorkspace: null });
    expect((await getWorkspaceContext())?.workspace).toBeNull();
  });
  it('exclui perfis inativos, ocultos por RLS e viewers da atribuição', async () => {
    setup({
      members: [
        {
          user_id: 'active',
          role: 'member',
          profile: { id: 'active', full_name: 'Ativo', is_active: true },
        },
        {
          user_id: 'inactive',
          role: 'member',
          profile: { id: 'inactive', full_name: 'Inativo', is_active: false },
        },
        { user_id: 'hidden', role: 'member', profile: null },
        {
          user_id: 'viewer',
          role: 'viewer',
          profile: { id: 'viewer', full_name: 'Leitura', is_active: true },
        },
      ],
    });
    expect((await getWorkspaceContext())?.members).toEqual([
      { id: 'active', fullName: 'Ativo' },
    ]);
  });
});
