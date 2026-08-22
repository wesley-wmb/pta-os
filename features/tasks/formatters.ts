import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import type { TaskPriority, TaskStatusCategory } from './types';

export const priorityLabels: Record<TaskPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

export function formatDueDate(value: string | null) {
  if (!value) return 'Sem prazo';
  const date = parseISO(value);
  if (isToday(date)) return 'Hoje';
  if (isTomorrow(date)) return 'Amanhã';
  return format(date, "d 'de' MMM", { locale: ptBR });
}

export function statusTone(category: TaskStatusCategory) {
  return {
    backlog: 'bg-stone-100 text-stone-700',
    todo: 'bg-stone-100 text-stone-700',
    in_progress: 'bg-blue-50 text-blue-700',
    review: 'bg-violet-50 text-violet-700',
    blocked: 'bg-red-50 text-red-700',
    done: 'bg-emerald-50 text-emerald-700',
    cancelled: 'bg-stone-100 text-stone-500',
  }[category];
}

export function isClosed(category: TaskStatusCategory) {
  return category === 'done' || category === 'cancelled';
}
