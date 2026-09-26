import { addDays, format, isToday, isTomorrow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import type { TaskPriority, TaskStatusCategory } from './types';
import { dateFromKey, toDateKey } from './date-utils';

export const priorityLabels: Record<TaskPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

export function formatDueDate(value: string | null, todayKey?: string) {
  if (!value) return 'Sem prazo';
  if (todayKey) {
    if (value === todayKey) return 'Hoje';
    if (value === toDateKey(addDays(dateFromKey(todayKey), 1))) return 'Amanhã';
  }
  const date = parseISO(value);
  if (!todayKey && isToday(date)) return 'Hoje';
  if (!todayKey && isTomorrow(date)) return 'Amanhã';
  return format(date, "d 'de' MMM", { locale: ptBR });
}

export function statusTone(category: TaskStatusCategory) {
  return {
    backlog:
      'bg-[#efefeb] text-[#555950] dark:bg-[#2b2e29] dark:text-[#d4d8d0]',
    todo: 'bg-[#efefeb] text-[#555950] dark:bg-[#2b2e29] dark:text-[#d4d8d0]',
    in_progress:
      'bg-[#eef3ff] text-[#315bb7] dark:bg-[#172745] dark:text-[#b9ceff]',
    review: 'bg-[#f2efff] text-[#6549bc] dark:bg-[#29213f] dark:text-[#d4c5ff]',
    blocked:
      'bg-[#fff0f0] text-[#b52e2e] dark:bg-[#421f1f] dark:text-[#ffb9b5]',
    done: 'bg-[#eaf8f1] text-[#18764a] dark:bg-[#17352a] dark:text-[#a9e7c9]',
    cancelled:
      'bg-[#efefeb] text-[#5f625c] dark:bg-[#2b2e29] dark:text-[#c7cbc3]',
  }[category];
}

export function isClosed(category: TaskStatusCategory) {
  return category === 'done' || category === 'cancelled';
}
