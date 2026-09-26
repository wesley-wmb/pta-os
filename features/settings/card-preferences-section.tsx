'use client';

import {
  CalendarDays,
  CircleUserRound,
  FileText,
  Flag,
  FolderKanban,
  Gauge,
  ListChecks,
  MessageSquare,
  RotateCcw,
  Tag,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { TaskCardContent } from '@/features/tasks/task-card-content';
import type { TaskOverview } from '@/features/tasks/types';
import { cn } from '@/lib/utils';

import { TaskCardPreferencesPreview } from './card-preferences-context';
import {
  DEFAULT_TASK_CARD_PREFERENCES,
  type TaskCardDensity,
  type TaskCardField,
  type TaskCardPreferences,
} from './preferences';

const densityOptions: ReadonlyArray<{
  value: TaskCardDensity;
  label: string;
  description: string;
}> = [
  {
    value: 'compact',
    label: 'Compacto',
    description: 'Mais tarefas por coluna',
  },
  {
    value: 'comfortable',
    label: 'Confortável',
    description: 'Equilíbrio para o dia a dia',
  },
  {
    value: 'spacious',
    label: 'Amplo',
    description: 'Mais respiro e contexto',
  },
];

const fieldOptions: ReadonlyArray<{
  id: TaskCardField;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    id: 'priority',
    label: 'Prioridade',
    description: 'Urgente, alta, média ou baixa',
    icon: Flag,
  },
  {
    id: 'context',
    label: 'Contexto',
    description: 'Projeto, produto e tipo',
    icon: Tag,
  },
  {
    id: 'description',
    label: 'Descrição',
    description: 'Prévia curta do conteúdo',
    icon: FileText,
  },
  {
    id: 'status',
    label: 'Status',
    description: 'Etapa atual da tarefa',
    icon: Gauge,
  },
  {
    id: 'checklist',
    label: 'Checklist',
    description: 'Contagem e progresso',
    icon: ListChecks,
  },
  {
    id: 'comments',
    label: 'Comentários',
    description: 'Quantidade de conversas',
    icon: MessageSquare,
  },
  {
    id: 'dueDate',
    label: 'Prazo',
    description: 'Data, horário e atraso',
    icon: CalendarDays,
  },
  {
    id: 'assignee',
    label: 'Responsável',
    description: 'Avatar de quem executa',
    icon: CircleUserRound,
  },
];

const previewTask: TaskOverview = {
  id: 'card-preview',
  workspace_id: 'card-preview',
  task_key: 'PTA-000001',
  task_number: 1,
  title: 'Preparar campanha de lançamento',
  priority: 'urgent',
  status_id: 'preview-status',
  status_name: 'Em andamento',
  status_category: 'in_progress',
  status_color: '#0066cc',
  due_date: '2026-09-25',
  due_at: null,
  due_time: '14:00:00',
  due_is_date_only: false,
  week_position: 0,
  board_position: 1000,
  week_lane: 'scheduled',
  version: 1,
  created_by: 'card-preview-user',
  created_at: '2026-09-24T12:00:00.000Z',
  updated_at: '2026-09-24T12:00:00.000Z',
  primary_assignee_id: 'card-preview-user',
  primary_assignee_name: 'Wesley Silva',
  type_id: 'preview-type',
  type_name: 'Criativo',
  product_id: null,
  product_name: null,
  event_id: 'preview-project',
  event_name: 'Campanha primavera',
  checklist_total: 4,
  checklist_completed: 3,
  comment_count: 2,
  description_preview:
    'Revisar as peças finais e confirmar os formatos antes da publicação.',
};

export function CardPreferencesSection({
  preferences,
  onChange,
}: {
  preferences: TaskCardPreferences;
  onChange: (preferences: TaskCardPreferences) => void;
}) {
  const isDefault =
    preferences.density === DEFAULT_TASK_CARD_PREFERENCES.density &&
    fieldOptions.every(
      ({ id }) =>
        preferences.visibleFields[id] ===
        DEFAULT_TASK_CARD_PREFERENCES.visibleFields[id],
    );

  function setDensity(density: TaskCardDensity) {
    onChange({ ...preferences, density });
  }

  function toggleField(field: TaskCardField) {
    onChange({
      ...preferences,
      visibleFields: {
        ...preferences.visibleFields,
        [field]: !preferences.visibleFields[field],
      },
    });
  }

  return (
    <section className="pta-page-enter rounded-2xl border bg-card p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)] sm:p-7">
      <header className="mb-6 flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Pessoal · neste navegador
          </p>
          <h2 className="mt-2 text-xl font-bold tracking-tight">
            Cards de tarefas
          </h2>
          <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground">
            Escolha o que aparece no Quadro e na Semana. A preferência vale
            apenas para você neste workspace.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isDefault}
          onClick={() => onChange(DEFAULT_TASK_CARD_PREFERENCES)}
          className="shrink-0"
        >
          <RotateCcw aria-hidden="true" />
          Restaurar padrão
        </Button>
      </header>

      <div className="grid items-start gap-7 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-7">
          <fieldset>
            <legend className="text-sm font-semibold">Tamanho do card</legend>
            <p className="mb-3 mt-1 text-sm text-muted-foreground">
              A densidade altera tipografia, espaçamento e quantidade de texto.
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {densityOptions.map((option) => {
                const selected = preferences.density === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setDensity(option.value)}
                    className={cn(
                      'min-h-20 rounded-xl border px-3 py-3 text-left transition-[border-color,background-color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.99] motion-reduce:transition-none',
                      selected
                        ? 'border-primary/55 bg-primary/10'
                        : 'bg-background hover:border-primary/30 hover:bg-muted/45',
                    )}
                  >
                    <span className="block text-sm font-semibold">
                      {option.label}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold">Campos visíveis</legend>
            <p className="mb-3 mt-1 text-sm text-muted-foreground">
              O título permanece sempre visível para manter cada tarefa
              identificável.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {fieldOptions.map(({ id, label, description, icon: Icon }) => (
                <label
                  key={id}
                  className="flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border bg-background px-3.5 py-3 transition-colors hover:border-primary/30"
                >
                  <Icon
                    aria-hidden="true"
                    className="size-[18px] shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{label}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                      {description}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={preferences.visibleFields[id]}
                    onChange={() => toggleField(id)}
                  />
                  <span
                    aria-hidden="true"
                    className="relative h-6 w-11 shrink-0 rounded-full bg-muted-foreground/25 transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-background after:shadow-sm after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 peer-focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:after:transition-none"
                  />
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <aside
          className="w-full max-w-md 2xl:sticky 2xl:top-6 2xl:max-w-none"
          aria-label="Prévia do card"
        >
          <div className="rounded-2xl border bg-muted/35 p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Prévia ao vivo</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Exemplo com dados completos
                </p>
              </div>
              <FolderKanban
                aria-hidden="true"
                className="size-5 text-muted-foreground"
              />
            </div>
            <div className="pta-task-card overflow-hidden rounded-xl border border-border/80 bg-card">
              <TaskCardPreferencesPreview value={preferences}>
                <TaskCardContent
                  task={previewTask}
                  nowIso="2026-09-24T15:00:00.000Z"
                  today="2026-09-24"
                />
              </TaskCardPreferencesPreview>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
