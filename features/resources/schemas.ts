import { z } from 'zod';

import { RESOURCE_TYPES } from './types';

export const resourceTypeSchema = z.enum(RESOURCE_TYPES);

export const resourceCategorySchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(80),
  color: z.string().min(1).max(40),
});

export const resourceCategoryAdminSchema = resourceCategorySchema.extend({
  position: z.number().int().nonnegative(),
  updated_at: z.string().min(1),
  resource_count: z.number().int().nonnegative(),
});

export const resourceCategoryListPayloadSchema = z.object({
  snapshot: z.string().length(32),
  categories: z.array(resourceCategoryAdminSchema),
  can_manage: z.boolean(),
});

export const resourceRelationOptionSchema = z.object({
  id: z.uuid(),
  label: z.string().min(1).max(180),
  meta: z.string().max(180).nullable(),
  color: z.string().max(40).nullable(),
});

export const resourceRelationOptionsPayloadSchema = z.object({
  items: z.array(resourceRelationOptionSchema).max(50),
});

export const resourceListItemSchema = z.object({
  id: z.uuid(),
  workspace_id: z.uuid(),
  title: z.string().min(2).max(180),
  description: z.string().max(5000).nullable(),
  resource_type: resourceTypeSchema,
  external_url: z.string().max(2048),
  category: resourceCategorySchema.nullable(),
  is_restricted: z.boolean(),
  is_favorite: z.boolean(),
  last_visited_at: z.string().nullable(),
  version: z.number().int().positive(),
  updated_at: z.string(),
  archived_at: z.string().nullable(),
  can_edit: z.boolean(),
});

export const resourceListPayloadSchema = z.object({
  items: z.array(resourceListItemSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive().max(100),
  offset: z.number().int().nonnegative(),
  facets: z.object({
    categories: z.array(resourceCategorySchema),
    resource_types: z.array(resourceTypeSchema),
  }),
});

export const resourceDetailPayloadSchema = z.object({
  resource: resourceListItemSchema.omit({ can_edit: true }).extend({
    created_by: z.uuid(),
    created_at: z.string(),
  }),
  relations: z.object({
    tasks: z.array(
      z.object({
        id: z.uuid(),
        task_key: z.string().min(1),
        title: z.string().min(1),
      }),
    ),
    products: z.array(z.object({ id: z.uuid(), name: z.string().min(1) })),
    events: z.array(z.object({ id: z.uuid(), name: z.string().min(1) })),
    tags: z.array(
      z.object({
        id: z.uuid(),
        name: z.string().min(1),
        color: z.string().min(1),
      }),
    ),
  }),
  permissions: z.array(
    z.object({
      user_id: z.uuid(),
      full_name: z.string().min(1),
      permission: z.enum(['view', 'edit']),
    }),
  ),
  capabilities: z.object({
    can_edit: z.boolean(),
    can_manage_permissions: z.boolean(),
    can_archive: z.boolean(),
  }),
});

const HTTPS_RESOURCE_URL =
  /^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?(?:[/?#]\S*)?$/i;

export const resourceFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'Informe um título com pelo menos 2 caracteres.')
    .max(180, 'Use no máximo 180 caracteres.'),
  externalUrl: z
    .string()
    .trim()
    .min(1, 'Informe o endereço do recurso.')
    .max(2048, 'O endereço é muito longo.')
    .refine(
      isSafeHttpsUrl,
      'Use um endereço HTTPS válido, sem usuário ou senha.',
    ),
  resourceType: resourceTypeSchema,
  description: z.string().max(5000, 'Use no máximo 5.000 caracteres.'),
  categoryId: z.union([z.literal('none'), z.uuid()]),
  taskIds: uniqueUuidArray('demandas'),
  productIds: uniqueUuidArray('produtos'),
  eventIds: uniqueUuidArray('eventos'),
  tagIds: uniqueUuidArray('tags'),
  isRestricted: z.boolean(),
  permissions: z
    .array(
      z.object({
        userId: z.uuid(),
        permission: z.enum(['view', 'edit']),
      }),
    )
    .max(250),
});

function uniqueUuidArray(label: string) {
  return z
    .array(z.uuid())
    .max(100, `Selecione no máximo 100 ${label}.`)
    .refine((items) => new Set(items).size === items.length, {
      message: `Remova ${label} duplicados.`,
    });
}

export function isSafeHttpsUrl(value: string) {
  if (!HTTPS_RESOURCE_URL.test(value)) return false;

  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname.length > 0 &&
      !parsed.hostname.includes(':') &&
      !parsed.hostname.startsWith('[') &&
      parsed.username === '' &&
      parsed.password === '' &&
      (parsed.port === '' ||
        (Number(parsed.port) >= 1 && Number(parsed.port) <= 65535))
    );
  } catch {
    return false;
  }
}
