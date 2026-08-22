import { z } from 'zod';

export const taskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

export const newTaskSchema = z
  .object({
    title: z.string().trim().min(3, 'Dê um título mais específico.').max(180),
    priority: taskPrioritySchema,
    dueDate: z
      .string()
      .refine(
        (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),
        'Data inválida.',
      ),
    dueTime: z
      .string()
      .refine(
        (value) => !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value),
        'Horário inválido.',
      ),
    primaryAssigneeId: z.string(),
  })
  .refine((value) => !value.dueTime || Boolean(value.dueDate), {
    message: 'Escolha uma data antes do horário.',
    path: ['dueTime'],
  });

export type NewTaskInput = z.infer<typeof newTaskSchema>;
