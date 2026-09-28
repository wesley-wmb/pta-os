import { z } from 'zod';

export const operatingTeamSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string(),
  version: z.number(),
  member_count: z.number(),
  project_count: z.number(),
  workspace_event_id: z.string().uuid().nullable(),
  task_count: z.number(),
});
export const teamDirectorySchema = z.object({
  teams: z.array(operatingTeamSchema),
  unassigned_count: z.number(),
  can_manage: z.boolean(),
});
export type OperatingTeam = z.infer<typeof operatingTeamSchema>;
