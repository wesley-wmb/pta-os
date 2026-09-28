import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TaskCardPreferencesPreview } from '@/features/settings/card-preferences-context';
import { DEFAULT_TASK_CARD_PREFERENCES } from '@/features/settings/preferences';

import { TaskCardContent } from './task-card-content';
import type { TaskOverview } from './types';

const nowIso = '2026-09-24T15:00:00.000Z';
const task: TaskOverview = {
  id: 'task-1',
  workspace_id: 'workspace-1',
  task_key: 'PTA-001',
  task_number: 1,
  title: 'Preparar campanha',
  priority: 'medium',
  status_id: 'status-1',
  status_name: 'A fazer',
  status_category: 'todo',
  status_color: '#000000',
  due_date: null,
  due_at: null,
  due_time: null,
  due_is_date_only: true,
  week_position: 0,
  board_position: 1000,
  week_lane: 'backlog',
  version: 1,
  created_by: 'user-1',
  created_at: nowIso,
  updated_at: nowIso,
  primary_assignee_id: null,
  primary_assignee_name: null,
  type_id: null,
  type_name: null,
  product_id: null,
  product_name: null,
  event_id: null,
  event_name: null,
};

afterEach(cleanup);

describe('TaskCardContent', () => {
  it('shows missing deadline and owner without fabricating optional metrics', () => {
    render(<TaskCardContent task={task} nowIso={nowIso} today="2026-09-24" />);

    expect(
      screen.getByRole('heading', { name: task.title }),
    ).toBeInTheDocument();
    expect(screen.getByText('Sem prazo')).toBeInTheDocument();
    expect(screen.getByText('A definir')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/comentários|Checklist:/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Produto:|Evento:|Tipo:/),
    ).not.toBeInTheDocument();
  });

  it('exposes checklist completion and identifies overdue status with text', () => {
    render(
      <TaskCardContent
        task={{
          ...task,
          status_name: 'Bloqueada',
          status_category: 'blocked',
          due_date: '2026-09-23',
          due_at: '2026-09-23T20:00:00.000Z',
          checklist_total: 4,
          checklist_completed: 3,
          comment_count: 2,
        }}
        nowIso={nowIso}
        today="2026-09-24"
      />,
    );

    expect(screen.getByText('Bloqueada')).toBeInTheDocument();
    expect(screen.getByText(/Atrasada ·/)).toBeInTheDocument();
    const progress = screen.getByRole('progressbar', {
      name: `Checklist de ${task.title}`,
    });
    expect(progress).toHaveAttribute('aria-valuenow', '75');
    expect(progress).toHaveAttribute(
      'aria-valuetext',
      '3 de 4 itens concluídos',
    );
    expect(screen.getByText('comentários')).toBeInTheDocument();
  });

  it('does not label completed tasks overdue or infer missing checklist completion', () => {
    render(
      <TaskCardContent
        task={{
          ...task,
          status_name: 'Concluída',
          status_category: 'done',
          due_date: '2026-09-23',
          due_at: '2026-09-23T20:00:00.000Z',
          checklist_total: 4,
        }}
        nowIso={nowIso}
        today="2026-09-24"
      />,
    );

    expect(screen.getByText('Concluída')).toBeInTheDocument();
    expect(screen.queryByText(/Atrasada/)).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('honors personal field visibility and density without leaving empty rows', () => {
    const { container } = render(
      <TaskCardPreferencesPreview
        value={{
          ...DEFAULT_TASK_CARD_PREFERENCES,
          density: 'compact',
          visibleFields: {
            ...DEFAULT_TASK_CARD_PREFERENCES.visibleFields,
            priority: false,
            context: false,
            description: false,
            status: false,
            checklist: false,
            comments: false,
            dueDate: false,
            assignee: false,
          },
        }}
      >
        <TaskCardContent
          task={{
            ...task,
            description_preview: 'Descrição que deve ficar oculta',
            checklist_total: 2,
            checklist_completed: 1,
            comment_count: 3,
          }}
          nowIso={nowIso}
          today="2026-09-24"
        />
      </TaskCardPreferencesPreview>,
    );

    expect(screen.getByRole('heading', { name: task.title })).toBeVisible();
    expect(screen.queryByText('Média')).not.toBeInTheDocument();
    expect(screen.queryByText('A fazer')).not.toBeInTheDocument();
    expect(screen.queryByText('Sem prazo')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-card-density="compact"]'),
    ).toHaveClass('p-3');
  });
});

it('simplifica o Kanban sem esconder tags, prazo ou contagem da checklist', () => {
  render(
    <TaskCardContent
      simplified
      task={{
        ...task,
        priority: 'urgent',
        event_name: 'teste',
        type_name: 'Criativo',
        description_preview: 'Descrição detalhada',
        checklist_total: 2,
        checklist_completed: 2,
        due_date: '2026-09-24',
      }}
      nowIso={nowIso}
      today="2026-09-24"
    />,
  );
  expect(screen.getByText('Urgente')).toBeVisible();
  expect(screen.getByText('teste')).toBeVisible();
  expect(screen.getByText('Criativo')).toBeVisible();
  expect(screen.getByText('Descrição detalhada')).toBeVisible();
  expect(screen.queryByText('A fazer')).not.toBeInTheDocument();
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  expect(
    screen.getByLabelText('Checklist: 2 de 2 itens concluídos'),
  ).toBeVisible();
});
