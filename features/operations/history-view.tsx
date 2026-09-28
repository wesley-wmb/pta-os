'use client';

import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowRight,
  CalendarDays,
  Download,
  FileClock,
  History,
  ListChecks,
  PencilLine,
  Search,
  Shapes,
  UserMinus,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { useDeferredValue, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { dateFromKey } from '@/features/tasks/date-utils';
import { sanitizeSpreadsheetCell } from '@/features/tasks/task-pipeline-model';
import { cn } from '@/lib/utils';

import { OperationEmptyState } from './shared';
import type { ActivitySummary, HistoryPageData } from './types';

export function HistoryView({ data }: { data: HistoryPageData }) {
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<'7' | '30' | 'all'>('30');
  const deferredSearch = useDeferredValue(search);
  const filteredActivity = useMemo(() => {
    const query = deferredSearch.trim().toLocaleLowerCase('pt-BR');
    const periodDays = period === 'all' ? null : Number(period);
    const cutoffDateKey = periodDays
      ? format(subDays(dateFromKey(data.today), periodDays - 1), 'yyyy-MM-dd')
      : null;
    return data.activity.filter((item) => {
      if (cutoffDateKey && item.dateKey < cutoffDateKey) return false;
      if (!query) return true;
      return [
        item.actorName,
        item.subjectName,
        item.taskKey,
        item.taskTitle,
        activityActionLabel(item.action),
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLocaleLowerCase('pt-BR').includes(query),
        );
    });
  }, [data.activity, data.today, deferredSearch, period]);

  if (!data.activity.length) {
    return (
      <OperationEmptyState
        icon={History}
        title="Nenhuma movimentação registrada"
      />
    );
  }

  const groups = groupByDate(filteredActivity);
  const summary = summarizeActivity(filteredActivity);
  const actionCategories = summarizeActions(filteredActivity);
  const oldestActivity = filteredActivity.at(-1);
  const newestActivity = filteredActivity[0];

  function exportHistory() {
    const rows = [
      ['Data', 'Hora', 'Pessoa', 'Ação', 'Demanda', 'Título'],
      ...filteredActivity.map((item) => [
        item.dateKey,
        formatTime(item.createdAt, data.timezone),
        item.actorName,
        activityActionLabel(item.action),
        item.taskKey ?? '',
        item.taskTitle ?? 'Demanda arquivada',
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `historico-pta-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section aria-label="Histórico da operação">
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar no histórico"
            aria-label="Buscar no histórico"
            className="rounded-xl bg-background pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="history-period">
            Filtrar período
          </label>
          <select
            id="history-period"
            value={period}
            onChange={(event) =>
              setPeriod(event.target.value as '7' | '30' | 'all')
            }
            className="min-h-10 rounded-xl border bg-background px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="all">Todos os registros carregados</option>
          </select>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={exportHistory}
            disabled={!filteredActivity.length}
          >
            <Download aria-hidden="true" />
            Exportar
          </Button>
        </div>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        Exibindo até 50 movimentações recentes. Filtros e exportação usam os registros carregados.
      </p>
      <div className="grid overflow-hidden rounded-2xl border bg-card  sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric
          label="Registros carregados"
          value={summary.activityCount}
          description="movimentações recentes"
          icon={FileClock}
        />
        <SummaryMetric
          label="Demandas envolvidas"
          value={summary.taskCount}
          description="com atividade registrada"
          icon={ListChecks}
        />
        <SummaryMetric
          label="Pessoas ativas"
          value={summary.actorCount}
          description="autores nesta amostra"
          icon={UsersRound}
        />
        <SummaryMetric
          label="Dias com atividade"
          value={summary.dayCount}
          description="no período carregado"
          icon={CalendarDays}
        />
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section
          className="overflow-hidden rounded-2xl border bg-card "
          aria-labelledby="history-title"
        >
          <div className="flex flex-col gap-2 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
            <div>
              <p className="pta-eyebrow">Registro</p>
              <h2
                id="history-title"
                className="mt-1 text-xl font-semibold tracking-[-0.015em]"
              >
                Atividade da operação
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {filteredActivity.length === 1
                ? '1 movimentação carregada'
                : `${filteredActivity.length} movimentações carregadas`}
            </p>
          </div>

          <div className="px-3 pb-3 sm:px-4 sm:pb-4">
            {groups.length ? (
              groups.map((group) => (
                <section
                  key={group.dateKey}
                  className="mt-2 rounded-2xl bg-muted/[0.28] px-3 py-3 first:mt-0 sm:px-4"
                  aria-labelledby={`history-${group.dateKey}`}
                >
                  <h3
                    id={`history-${group.dateKey}`}
                    className="px-2 py-2 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase"
                  >
                    {format(dateFromKey(group.dateKey), "d 'de' MMMM", {
                      locale: ptBR,
                    })}
                  </h3>
                  <ol className="divide-y divide-border/75">
                    {group.items.map((item) => (
                      <li
                        key={item.id}
                        className="grid gap-3 px-2 py-4 sm:grid-cols-[40px_minmax(0,1fr)_auto] sm:items-start"
                      >
                        <ActivityIcon action={item.action} />
                        <div className="min-w-0">
                          <TaskReference item={item} />
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            <strong className="font-semibold text-foreground">
                              {item.actorName}
                            </strong>{' '}
                            <ActionCopy item={item} />
                          </p>
                        </div>
                        <time
                          dateTime={item.createdAt}
                          className="pl-[52px] text-xs font-medium text-muted-foreground tabular-nums sm:pl-0 sm:pt-1"
                        >
                          {formatTime(item.createdAt, data.timezone)}
                        </time>
                      </li>
                    ))}
                  </ol>
                </section>
              ))
            ) : (
              <OperationEmptyState
                icon={Search}
                title="Nenhuma movimentação encontrada"
              />
            )}
          </div>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-5">
          <section
            className="rounded-2xl border bg-card p-5 "
            aria-labelledby="history-categories-title"
          >
            <p className="pta-eyebrow">Atividade</p>
            <h2
              id="history-categories-title"
              className="mt-1 text-xl font-semibold tracking-[-0.015em]"
            >
              Por tipo de ação
            </h2>
            <div className="mt-5 space-y-4">
              {actionCategories.map((category) => (
                <div key={category.key}>
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/[0.085] text-primary">
                      <category.icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {category.label}
                    </span>
                    <strong className="text-sm font-semibold tabular-nums">
                      {category.count}
                    </strong>
                  </div>
                  <div
                    className="ml-12 mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={`${category.label}: ${category.count} ${category.count === 1 ? 'registro' : 'registros'}`}
                  >
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${category.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {oldestActivity && newestActivity ? (
            <section
              className="rounded-2xl border border-primary/15 bg-primary/[0.055] p-5"
              aria-labelledby="history-range-title"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-primary/[0.1] text-primary">
                <CalendarDays className="size-4" aria-hidden="true" />
              </span>
              <h2
                id="history-range-title"
                className="mt-4 text-[15px] font-semibold"
              >
                Período visível
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Atividades de {formatFullDate(oldestActivity.dateKey)} a{' '}
                {formatFullDate(newestActivity.dateKey)}.
              </p>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                A página apresenta as movimentações recentes disponíveis para
                este workspace.
              </p>
            </section>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

function SummaryMetric({
  label,
  value,
  description,
  icon: Icon,
}: {
  label: string;
  value: number;
  description: string;
  icon: typeof History;
}) {
  return (
    <article className="border-b p-5 last:border-b-0 sm:[&:nth-child(odd)]:border-r sm:[&:nth-last-child(-n+2)]:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.03em] tabular-nums">
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/[0.085] text-primary">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}

function TaskReference({ item }: { item: ActivitySummary }) {
  if (item.taskTitle && !item.taskArchived) {
    return (
      <Link
        href={`/tarefa/${item.taskId}?retorno=%2Fhistorico`}
        scroll={false}
        className="group inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-lg text-[15px] font-semibold text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 sm:min-h-0"
      >
        {item.taskKey ? (
          <span className="shrink-0 rounded-md bg-primary/[0.075] px-1.5 py-0.5 font-mono text-xs font-medium text-primary">
            {item.taskKey}
          </span>
        ) : null}
        <span className="max-w-[38rem] truncate">{item.taskTitle}</span>
        <ArrowRight
          aria-hidden="true"
          className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5"
        />
      </Link>
    );
  }

  return (
    <p className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold text-foreground">
      {item.taskKey ? (
        <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs font-medium text-muted-foreground">
          {item.taskKey}
        </span>
      ) : null}
      <span className="truncate">{item.taskTitle ?? 'Demanda arquivada'}</span>
    </p>
  );
}

function ActionCopy({ item }: { item: ActivitySummary }) {
  switch (item.action) {
    case 'task.created':
      return <>criou uma demanda</>;
    case 'task.updated':
      return <>atualizou uma demanda</>;
    case 'task.assignee_added':
      return (
        <>
          atribuiu{' '}
          <strong className="font-semibold">
            {item.subjectName ?? 'uma pessoa'}
          </strong>{' '}
          à demanda
        </>
      );
    case 'task.assignee_changed':
      return (
        <>
          alterou a responsabilidade de{' '}
          <strong className="font-semibold">
            {item.subjectName ?? 'uma pessoa'}
          </strong>
        </>
      );
    case 'task.assignee_removed':
      return (
        <>
          removeu{' '}
          <strong className="font-semibold">
            {item.subjectName ?? 'uma pessoa'}
          </strong>{' '}
          da demanda
        </>
      );
    default:
      return <>registrou uma movimentação</>;
  }
}

function activityActionLabel(action: string) {
  switch (action) {
    case 'task.created':
      return 'Criação de demanda';
    case 'task.updated':
      return 'Atualização de demanda';
    case 'task.assignee_added':
      return 'Pessoa atribuída';
    case 'task.assignee_changed':
      return 'Responsabilidade alterada';
    case 'task.assignee_removed':
      return 'Pessoa removida';
    default:
      return 'Movimentação registrada';
  }
}

function csvCell(value: string) {
  return `"${sanitizeSpreadsheetCell(value).replaceAll('"', '""')}"`;
}

function summarizeActivity(activity: ActivitySummary[]) {
  return {
    activityCount: activity.length,
    taskCount: new Set(activity.map((item) => item.taskId)).size,
    actorCount: new Set(
      activity
        .filter((item) => item.actorName !== 'Automação do sistema')
        .map((item) => item.actorName),
    ).size,
    dayCount: new Set(activity.map((item) => item.dateKey)).size,
  };
}

function summarizeActions(activity: ActivitySummary[]) {
  const definitions: Array<{
    key: string;
    label: string;
    icon: typeof History;
    matches: (action: string) => boolean;
  }> = [
    {
      key: 'created',
      label: 'Demandas criadas',
      icon: ListChecks,
      matches: (action) => action === 'task.created',
    },
    {
      key: 'updated',
      label: 'Atualizações',
      icon: PencilLine,
      matches: (action) => action === 'task.updated',
    },
    {
      key: 'assignee-added',
      label: 'Atribuições adicionadas',
      icon: UserPlus,
      matches: (action) => action === 'task.assignee_added',
    },
    {
      key: 'assignee-changed',
      label: 'Responsabilidade alterada',
      icon: UsersRound,
      matches: (action) => action === 'task.assignee_changed',
    },
    {
      key: 'assignee-removed',
      label: 'Atribuições removidas',
      icon: UserMinus,
      matches: (action) => action === 'task.assignee_removed',
    },
    {
      key: 'other',
      label: 'Outras movimentações',
      icon: Shapes,
      matches: (action) =>
        ![
          'task.created',
          'task.updated',
          'task.assignee_added',
          'task.assignee_changed',
          'task.assignee_removed',
        ].includes(action),
    },
  ];

  const categories = definitions
    .map((definition) => ({
      ...definition,
      count: activity.filter((item) => definition.matches(item.action)).length,
    }))
    .filter((category) => category.count > 0);
  const largestCount = Math.max(
    ...categories.map((category) => category.count),
  );

  return categories.map((category) => ({
    ...category,
    percentage:
      largestCount > 0 ? Math.round((category.count / largestCount) * 100) : 0,
  }));
}

function ActivityIcon({ action }: { action: string }) {
  const Icon =
    action === 'task.created'
      ? ListChecks
      : action === 'task.updated'
        ? PencilLine
        : action === 'task.assignee_removed'
          ? UserMinus
          : action === 'task.assignee_added'
            ? UserPlus
            : UsersRound;
  return (
    <span
      className={cn(
        'relative z-10 grid size-9 shrink-0 place-items-center rounded-xl border bg-background text-muted-foreground',
        action === 'task.created' &&
          'border-primary/15 bg-primary/[0.06] text-primary',
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
    </span>
  );
}

function groupByDate(activity: ActivitySummary[]) {
  const groups = new Map<string, ActivitySummary[]>();
  for (const item of activity) {
    const items = groups.get(item.dateKey) ?? [];
    items.push(item);
    groups.set(item.dateKey, items);
  }
  return [...groups].map(([dateKey, items]) => ({ dateKey, items }));
}

function formatTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatFullDate(dateKey: string) {
  return format(dateFromKey(dateKey), "d 'de' MMMM 'de' yyyy", {
    locale: ptBR,
  });
}
