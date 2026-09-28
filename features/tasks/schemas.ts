import { z } from 'zod';

import { taskDescriptionSchema } from './rich-text';
import { isDateKey } from './date-utils';

export const taskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

export const newTaskSchema = z
  .object({
    title: z.string().trim().min(3, 'Dê um título mais específico.').max(180),
    priority: taskPrioritySchema,
    dueDate: z
      .string()
      .refine((value) => !value || isDateKey(value), 'Data inválida.'),
    dueTime: z
      .string()
      .refine(
        (value) => !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value),
        'Horário inválido.',
      ),
    primaryAssigneeId: z.string(),
    typeId: z.string(),
    productId: z.string(),
    eventId: z.string(),
    description: taskDescriptionSchema,
    blockedReason: z
      .string()
      .trim()
      .max(1000, 'O motivo pode ter no máximo 1.000 caracteres.'),
  })
  .refine((value) => !value.dueTime || Boolean(value.dueDate), {
    message: 'Escolha uma data antes do horário.',
    path: ['dueTime'],
  });

export type NewTaskInput = z.infer<typeof newTaskSchema>;
