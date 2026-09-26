import { z } from 'zod';

import { SEARCH_ENTITY_TYPES } from './types';

const internalHrefSchema = z
  .string()
  .min(1)
  .max(500)
  .refine(
    (value) =>
      value.startsWith('/') &&
      !value.startsWith('//') &&
      !value.includes('\\') &&
      !/[\u0000-\u001f\u007f]/.test(value),
    'Destino interno inválido',
  );

const searchResultItemSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(300),
  subtitle: z.string().trim().min(1).max(300).nullable(),
  href: internalHrefSchema,
  score: z.number().finite(),
});

const searchResultGroupSchema = z.object({
  entity_type: z.enum(SEARCH_ENTITY_TYPES),
  label: z.string().trim().min(1).max(60),
  items: z.array(searchResultItemSchema).max(20),
});

export const searchWorkspacePayloadSchema = z.object({
  query: z.string().trim().min(2).max(100),
  groups: z.array(searchResultGroupSchema).max(SEARCH_ENTITY_TYPES.length),
  total: z.number().int().nonnegative(),
});
