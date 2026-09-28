import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getWorkspaceContext } from '@/features/workspace/server';
import { createClient } from '@/lib/supabase/server';
import { teamDirectorySchema } from './directory-schemas';

export const getOperatingDirectory = cache(async () => {
  const context = await getWorkspaceContext();
  if (!context?.workspace) redirect('/login');
  const client = await createClient();
  const { data, error } = await client.rpc('list_team_directory', {
    p_workspace_id: context.workspace.id,
  });
  if (error) throw new Error('Não foi possível carregar as equipes.');
  return {
    context: { ...context, workspace: context.workspace },
    directory: teamDirectorySchema.parse(data),
  };
});

const modelSchema = z.object({
  teams: z.array(
    z.object({
      id: z.string(),
      can_manage_members: z.boolean(),
      members: z.array(
        z.object({
          user_id: z.string(),
          full_name: z.string(),
          team_role: z.enum(['lead', 'member']),
          version: z.number(),
          is_primary_team: z.boolean(),
        }),
      ),
    }),
  ),
});
export async function getOperatingMembers(workspaceId: string, teamId: string) {
  const client = await createClient();
  const { data, error } = await client.rpc('list_workspace_operating_model', {
    p_workspace_id: workspaceId,
  });
  if (error) throw new Error('Não foi possível carregar os membros da equipe.');
  return modelSchema.parse(data).teams.find((team) => team.id === teamId);
}
