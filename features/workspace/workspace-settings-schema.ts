import { z } from 'zod';

export const workspaceRoleSchema = z.enum([
  'owner',
  'admin',
  'manager',
  'member',
  'viewer',
]);

export const workspaceSettingsFormSchema = z.object({
  workspaceId: z.uuid(),
  expectedVersion: z.number().int().positive(),
  name: z
    .string()
    .trim()
    .min(2, 'Informe o nome do workspace.')
    .max(120, 'Use no máximo 120 caracteres.'),
  taskPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,8}$/, 'Use de 2 a 8 letras maiúsculas ou números.'),
  accentColor: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^#[0-9A-F]{6}$/, 'Escolha uma cor válida.'),
  timezone: z.string().trim().min(1, 'Escolha o fuso horário.').max(80),
  weekStartsOn: z.number().int().min(0).max(6),
  workingDays: z
    .array(z.number().int().min(0).max(6))
    .min(1, 'Escolha pelo menos um dia de trabalho.')
    .transform((days) => [...new Set(days)].sort((a, b) => a - b)),
  defaultDueTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Informe um horário válido.'),
  notificationDigest: z.boolean(),
});

const roleCountsSchema = z
  .object({
    owner: z.number().int().nonnegative().optional(),
    admin: z.number().int().nonnegative().optional(),
    manager: z.number().int().nonnegative().optional(),
    member: z.number().int().nonnegative().optional(),
    viewer: z.number().int().nonnegative().optional(),
  })
  .transform((counts) => ({
    owner: counts.owner ?? 0,
    admin: counts.admin ?? 0,
    manager: counts.manager ?? 0,
    member: counts.member ?? 0,
    viewer: counts.viewer ?? 0,
  }));

export const workspaceSettingsResponseSchema = z
  .object({
    workspace_id: z.uuid(),
    name: z.string().trim().min(2).max(120),
    task_prefix: z.string().regex(/^[A-Z0-9]{2,8}$/),
    accent_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    timezone: z.string().min(1).max(80),
    locale: z.string().min(2).max(35),
    week_starts_on: z.number().int().min(0).max(6),
    working_days: z.array(z.number().int().min(0).max(6)).min(1),
    default_due_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    notification_digest: z.boolean(),
    version: z.number().int().positive(),
    role: workspaceRoleSchema,
    role_counts: roleCountsSchema,
    permissions: z.object({
      can_edit: z.boolean(),
      can_manage_members: z.boolean(),
      can_transfer_ownership: z.boolean(),
    }),
    backend_available: z.boolean().optional(),
  })
  .transform((settings) => ({
    workspaceId: settings.workspace_id,
    name: settings.name,
    taskPrefix: settings.task_prefix,
    accentColor: settings.accent_color.toUpperCase(),
    timezone: settings.timezone,
    locale: settings.locale,
    weekStartsOn: settings.week_starts_on,
    workingDays: [...settings.working_days].sort((a, b) => a - b),
    defaultDueTime: settings.default_due_time,
    notificationDigest: settings.notification_digest,
    version: settings.version,
    role: settings.role,
    roleCounts: settings.role_counts,
    permissions: {
      canEdit: settings.permissions.can_edit,
      canManageMembers: settings.permissions.can_manage_members,
      canTransferOwnership: settings.permissions.can_transfer_ownership,
    },
    backendAvailable: settings.backend_available ?? true,
  }));

export type WorkspaceSettings = z.infer<typeof workspaceSettingsResponseSchema>;
export type WorkspaceSettingsFormInput = z.input<
  typeof workspaceSettingsFormSchema
>;
export type WorkspaceSettingsFormValues = z.output<
  typeof workspaceSettingsFormSchema
>;
