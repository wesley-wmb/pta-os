import { afterEach, describe, expect, it } from 'vitest';
import { format } from 'date-fns';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import type { EventMilestone, PortfolioTask } from './types';
import type { TaskStatus } from '@/features/tasks/types';
import {
  buildTimelineRange,
  calculateTimelineTaskChange,
  groupTimelineTasks,
  ProjectTimeline,
} from './project-timeline';

afterEach(cleanup);

const task = (
  id: string,
  dueDate: string | null,
  assigneeName: string | null,
  statusName = 'A fazer',
): PortfolioTask => ({
  id,
  taskNumber: Number(id),
  title: `Tarefa ${id}`,
  priority: 'medium',
  dueDate,
  statusName,
  statusCategory: 'todo',
  assigneeName,
});

const milestone = (id: string, dueDate: string | null): EventMilestone => ({
  id,
  title: `Marco ${id}`,
  dueDate,
  phase: 'planning',
  completedAt: null,
  position: Number(id),
  version: 1,
});

describe('timeline toolbar', () => {
  it('opens structural actions from the menu and recenters today after scrolling', async () => {
    const user = userEvent.setup();
    const onAddMilestone = vi.fn();
    render(
      <ProjectTimeline
        tasks={[]}
        milestones={[]}
        today="2026-09-26"
        projectStart={null}
        projectEnd={null}
        canEdit
        canManageStructure
        pendingMilestoneId={null}
        onAddMilestone={onAddMilestone}
        onAddPhase={() => undefined}
        onToggleMilestone={() => undefined}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: 'Mais ações do cronograma' }),
    );
    expect(screen.getByRole('menuitem', { name: 'Nova fase' })).toBeVisible();
    await user.click(screen.getByRole('menuitem', { name: 'Novo marco' }));
    expect(onAddMilestone).toHaveBeenCalledOnce();

    const grid = screen.getByRole('region', { name: 'Grade do cronograma' });
    Object.defineProperty(grid, 'clientWidth', {
      configurable: true,
      value: 1200,
    });
    grid.scrollLeft = 1400;
    await user.click(screen.getByRole('button', { name: 'Hoje' }));
    await waitFor(() => expect(grid.scrollLeft).toBeLessThan(1400));
  });
});

describe('project timeline model', () => {
  it('moves a scheduled interval without changing its duration', () => {
    const patch = calculateTimelineTaskChange({
      task: {
        ...task('1', '2026-10-02', 'Bruna'),
        startDate: '2026-09-28',
        statusId: 'todo',
        version: 4,
      },
      mode: 'move',
      deltaDays: 3,
    });

    expect(patch).toEqual({
      start_date: '2026-10-01',
      due_date: '2026-10-05',
    });
  });

  it('keeps at least one day when resizing either edge', () => {
    const scheduled = {
      ...task('1', '2026-10-02', 'Bruna'),
      startDate: '2026-09-28',
      version: 4,
    };

    expect(
      calculateTimelineTaskChange({
        task: scheduled,
        mode: 'resize-start',
        deltaDays: 20,
      }),
    ).toEqual({ start_date: '2026-10-02' });
    expect(
      calculateTimelineTaskChange({
        task: scheduled,
        mode: 'resize-end',
        deltaDays: -20,
      }),
    ).toEqual({ due_date: '2026-09-28' });
  });

  it('keeps a stable planning window even when project data has distant dates', () => {
    const range = buildTimelineRange({
      today: '2026-09-26',
      tasks: [task('1', '2026-10-20', 'Wesley')],
      milestones: [milestone('1', '2000-02-01')],
      projectStart: '2000-01-01',
      projectEnd: '2038-12-15',
    });

    expect(format(range.start, 'yyyy-MM-dd')).toBe('2026-09-21');
    expect(format(range.end, 'yyyy-MM-dd')).toBe('2026-11-29');
    expect(range.totalDays).toBe(70);
  });

  it('keeps an empty plan useful without inventing dates', () => {
    const range = buildTimelineRange({
      today: '2026-09-26',
      tasks: [],
      milestones: [],
      projectStart: null,
      projectEnd: null,
    });

    expect(range.totalDays).toBeGreaterThanOrEqual(42);
  });

  it('groups undirected work explicitly instead of dropping it', () => {
    const groups = groupTimelineTasks(
      [
        task('2', '2026-10-02', null),
        task('1', '2026-09-28', 'Bruna'),
        task('3', '2026-10-05', 'Bruna'),
      ],
      'assignee',
    );

    expect(groups.map((group) => group.label)).toEqual([
      'Bruna',
      'Sem responsável',
    ]);
    expect(groups[0]?.items.map((item) => item.id)).toEqual(['1', '3']);
  });

  it('supports the same timeline grouped by workflow status', () => {
    const groups = groupTimelineTasks(
      [
        task('1', '2026-09-28', 'Bruna', 'Em andamento'),
        task('2', '2026-10-02', 'Wesley', 'A fazer'),
      ],
      'status',
    );

    expect(groups.map((group) => group.label)).toEqual([
      'A fazer',
      'Em andamento',
    ]);
  });

  it('keeps empty workflow sections in their canonical order', () => {
    const statuses: TaskStatus[] = [
      {
        id: 'review',
        name: 'Em revisão',
        category: 'review',
        color: 'violet',
        position: 30,
      },
      {
        id: 'todo',
        name: 'A fazer',
        category: 'todo',
        color: 'stone',
        position: 10,
      },
    ];

    const groups = groupTimelineTasks(
      [task('1', '2026-09-28', 'Bruna', 'A fazer')],
      'status',
      statuses,
    );

    expect(groups.map((group) => group.label)).toEqual([
      'A fazer',
      'Em revisão',
    ]);
    expect(groups[1]?.items).toHaveLength(0);
  });

  it('keeps distant milestones accessible without expanding the visible scale', async () => {
    const user = userEvent.setup();
    render(
      <ProjectTimeline
        tasks={[task('1', '2026-09-25', 'Wesley')]}
        milestones={[milestone('1', '2000-02-01')]}
        today="2026-09-26"
        projectStart={null}
        projectEnd={null}
        canEdit={false}
        pendingMilestoneId={null}
        onAddMilestone={() => undefined}
        onToggleMilestone={() => undefined}
      />,
    );

    const queue = screen.getByRole('button', { name: /Sem data/ });
    expect(queue).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Marco 1')).not.toBeInTheDocument();

    await user.click(queue);

    expect(queue).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Marco 1')).toBeInTheDocument();
    expect(screen.getByText(/1 fev 2000/)).toBeInTheDocument();
  });

  it('zooms the timeline without changing its selected time scale', async () => {
    const user = userEvent.setup();
    const view = render(
      <ProjectTimeline
        tasks={[task('1', '2026-09-28', 'Wesley')]}
        milestones={[]}
        today="2026-09-26"
        projectStart={null}
        projectEnd={null}
        canEdit={false}
        pendingMilestoneId={null}
        onAddMilestone={() => undefined}
        onToggleMilestone={() => undefined}
      />,
    );

    expect(
      within(view.container).getByRole('button', {
        name: 'Escala do cronograma: Dias',
      }),
    ).toBeInTheDocument();
    await user.click(
      within(view.container).getByRole('button', {
        name: 'Aumentar zoom, atual 100%',
      }),
    );
    expect(
      within(view.container).getByRole('button', {
        name: 'Zoom do cronograma em 125%. Restaurar para 100%',
      }),
    ).toBeInTheDocument();

    fireEvent.change(
      within(view.container).getByRole('slider', {
        name: 'Zoom do cronograma: 125%',
      }),
      { target: { value: '200' } },
    );
    expect(
      within(view.container).getByRole('button', {
        name: 'Aumentar zoom, atual 200%',
      }),
    ).toBeDisabled();

    fireEvent.wheel(
      within(view.container).getByRole('region', {
        name: 'Grade do cronograma',
      }),
      { ctrlKey: true, deltaY: 100, clientX: 500 },
    );
    expect(
      within(view.container).getByRole('slider', {
        name: 'Zoom do cronograma: 195%',
      }),
    ).toBeInTheDocument();

    await user.click(
      within(view.container).getByRole('button', {
        name: 'Zoom do cronograma em 195%. Restaurar para 100%',
      }),
    );
    expect(
      within(view.container).getByRole('button', {
        name: 'Aumentar zoom, atual 100%',
      }),
    ).toBeInTheDocument();
  });

  it('uses one date cell for a due-date-only task and spans dated ranges', () => {
    const singleDateTask = {
      ...task('1', '2026-09-26', 'Wesley'),
      version: 1,
    };
    const view = render(
      <ProjectTimeline
        tasks={[singleDateTask]}
        milestones={[]}
        today="2026-09-26"
        projectStart={null}
        projectEnd={null}
        canEdit={false}
        pendingMilestoneId={null}
        onAddMilestone={() => undefined}
        onToggleMilestone={() => undefined}
      />,
    );

    const singleBar = screen.getByRole('link', {
      name: /Tarefa 1/,
    }).parentElement;
    expect(singleBar).not.toBeNull();
    const singleWidth = Number.parseFloat(singleBar!.style.width);
    expect(singleWidth).toBeLessThan(32);

    view.rerender(
      <ProjectTimeline
        tasks={[
          {
            ...singleDateTask,
            startDate: '2026-09-26',
            dueDate: '2026-09-30',
          },
        ]}
        milestones={[]}
        today="2026-09-26"
        projectStart={null}
        projectEnd={null}
        canEdit={false}
        pendingMilestoneId={null}
        onAddMilestone={() => undefined}
        onToggleMilestone={() => undefined}
      />,
    );

    const rangedBar = screen.getByRole('link', {
      name: /Tarefa 1/,
    }).parentElement;
    expect(rangedBar).not.toBeNull();
    expect(Number.parseFloat(rangedBar!.style.width)).toBeGreaterThan(
      singleWidth * 4,
    );
  });

  it('supports keyboard movement, resizing, and status changes', async () => {
    const user = userEvent.setup();
    const onTaskChange = vi.fn();
    const statuses: TaskStatus[] = [
      {
        id: 'todo',
        name: 'A fazer',
        category: 'todo',
        color: 'stone',
        position: 10,
      },
      {
        id: 'doing',
        name: 'Em andamento',
        category: 'in_progress',
        color: 'blue',
        position: 20,
      },
    ];
    const scheduled = {
      ...task('1', '2026-10-02', 'Bruna'),
      startDate: '2026-09-28',
      statusId: 'todo',
      version: 4,
    };

    const view = render(
      <ProjectTimeline
        tasks={[scheduled]}
        statuses={statuses}
        milestones={[]}
        today="2026-09-26"
        projectStart={null}
        projectEnd={null}
        canEdit
        pendingMilestoneId={null}
        onAddMilestone={() => undefined}
        onToggleMilestone={() => undefined}
        onTaskChange={onTaskChange}
      />,
    );

    let taskLink = within(view.container).getByRole('link', {
      name: /Tarefa 1/,
    });
    taskLink.focus();
    await user.keyboard('{ArrowRight}');

    expect(onTaskChange).toHaveBeenNthCalledWith(1, {
      taskId: '1',
      expectedVersion: 4,
      patch: {
        start_date: '2026-09-29',
        due_date: '2026-10-03',
      },
    });

    await waitFor(() => expect(onTaskChange).toHaveBeenCalledTimes(1));
    taskLink = within(view.container).getByRole('link', { name: /Tarefa 1/ });
    taskLink.focus();
    await user.keyboard('{ArrowDown}');

    expect(onTaskChange).toHaveBeenNthCalledWith(2, {
      taskId: '1',
      expectedVersion: 5,
      patch: { status_id: 'doing' },
    });

    const endHandle = within(view.container).getByRole('button', {
      name: 'Ajustar término de Tarefa 1',
    });
    endHandle.focus();
    await user.keyboard('{ArrowLeft}');

    expect(onTaskChange).toHaveBeenNthCalledWith(3, {
      taskId: '1',
      expectedVersion: 6,
      patch: { due_date: '2026-10-02' },
    });
  });

  it('commits a horizontal pointer drag in whole-day steps', async () => {
    const setPointerCapture = vi.fn();
    Element.prototype.setPointerCapture = setPointerCapture;
    const onTaskChange = vi.fn();
    const scheduled = {
      ...task('1', '2026-10-02', 'Bruna'),
      startDate: '2026-09-28',
      statusId: 'todo',
      version: 2,
    };

    const view = render(
      <ProjectTimeline
        tasks={[scheduled]}
        statuses={[
          {
            id: 'todo',
            name: 'A fazer',
            category: 'todo',
            color: 'stone',
            position: 10,
          },
        ]}
        milestones={[]}
        today="2026-09-26"
        projectStart={null}
        projectEnd={null}
        canEdit
        pendingMilestoneId={null}
        onAddMilestone={() => undefined}
        onToggleMilestone={() => undefined}
        onTaskChange={onTaskChange}
      />,
    );

    const taskLink = within(view.container).getByRole('link', {
      name: /Tarefa 1/,
    });
    const bar = taskLink.parentElement!;
    fireEvent.pointerDown(bar, {
      pointerId: 1,
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(bar, {
      pointerId: 1,
      clientX: 164,
      clientY: 100,
    });
    fireEvent.pointerUp(bar, {
      pointerId: 1,
      clientX: 164,
      clientY: 100,
    });

    await waitFor(() =>
      expect(onTaskChange).toHaveBeenCalledWith({
        taskId: '1',
        expectedVersion: 2,
        patch: {
          start_date: '2026-09-30',
          due_date: '2026-10-04',
        },
      }),
    );
    expect(setPointerCapture).toHaveBeenCalledWith(1);
  });

  it('keeps a small pointer movement as a click instead of a drag', async () => {
    const setPointerCapture = vi.fn();
    Element.prototype.setPointerCapture = setPointerCapture;
    const onTaskChange = vi.fn();
    const scheduled = {
      ...task('1', '2026-10-02', 'Bruna'),
      startDate: '2026-09-28',
      statusId: 'todo',
      version: 2,
    };

    const view = render(
      <ProjectTimeline
        tasks={[scheduled]}
        statuses={[
          {
            id: 'todo',
            name: 'A fazer',
            category: 'todo',
            color: 'stone',
            position: 10,
          },
        ]}
        milestones={[]}
        today="2026-09-26"
        projectStart={null}
        projectEnd={null}
        canEdit
        pendingMilestoneId={null}
        onAddMilestone={() => undefined}
        onToggleMilestone={() => undefined}
        onTaskChange={onTaskChange}
      />,
    );

    const taskLink = within(view.container).getByRole('link', {
      name: /Tarefa 1/,
    });
    const bar = taskLink.parentElement!;
    fireEvent.pointerDown(bar, {
      pointerId: 1,
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(bar, {
      pointerId: 1,
      clientX: 106,
      clientY: 103,
    });
    fireEvent.pointerUp(bar, {
      pointerId: 1,
      clientX: 106,
      clientY: 103,
    });

    expect(onTaskChange).not.toHaveBeenCalled();
    expect(setPointerCapture).not.toHaveBeenCalled();
  });

  it('keeps resize and completion controls hidden until interaction', () => {
    const view = render(
      <ProjectTimeline
        tasks={[
          {
            ...task('1', '2026-10-02', 'Bruna'),
            startDate: '2026-09-28',
            statusId: 'done',
            statusCategory: 'done',
            version: 2,
          },
        ]}
        statuses={[
          {
            id: 'done',
            name: 'Concluída',
            category: 'done',
            color: 'green',
            position: 10,
          },
        ]}
        milestones={[]}
        today="2026-09-26"
        projectStart={null}
        projectEnd={null}
        canEdit
        pendingMilestoneId={null}
        onAddMilestone={() => undefined}
        onToggleMilestone={() => undefined}
        onTaskChange={() => undefined}
      />,
    );

    const startHandle = within(view.container).getByRole('button', {
      name: 'Ajustar início de Tarefa 1',
    });
    const bar = startHandle.parentElement!;
    const completion = bar.querySelector('.lucide-check');

    expect(bar).toHaveClass('group/timeline-task');
    expect(startHandle).toHaveClass('opacity-0');
    expect(startHandle.className).toContain(
      'group-hover/timeline-task:opacity-100',
    );
    expect(completion).toHaveClass('opacity-0');
  });

  it('shows user-defined phases and preserves the project timeline return path', async () => {
    const user = userEvent.setup();
    const onEditPhase = vi.fn();
    const projectId = '0cbbeb33-dfa5-48e2-a71a-28dd154b6264';
    const view = render(
      <ProjectTimeline
        projectId={projectId}
        tasks={[task('1', '2026-09-28', 'Bruna'), task('2', null, 'Wesley')]}
        milestones={[
          {
            ...milestone('1', '2026-09-28'),
            eventPhaseId: 'phase-1',
          },
        ]}
        phases={[
          {
            id: 'phase-1',
            name: 'Captação',
            color: 'violet',
            position: 1000,
            startDate: '2026-09-26',
            endDate: '2026-10-02',
            version: 1,
          },
        ]}
        today="2026-09-26"
        projectStart={null}
        projectEnd={null}
        canEdit={false}
        canManageStructure
        pendingMilestoneId={null}
        onAddMilestone={() => undefined}
        onEditPhase={onEditPhase}
        onToggleMilestone={() => undefined}
      />,
    );

    expect(within(view.container).getByText('Captação')).toBeInTheDocument();
    await user.click(
      within(view.container).getByRole('button', {
        name: /Editar fase Captação, de 2026-09-26 até 2026-10-02/,
      }),
    );
    expect(onEditPhase).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'phase-1', name: 'Captação' }),
    );
    const expectedHref = `/tarefa/1?retorno=${encodeURIComponent(
      `/projetos/${projectId}?visao=timeline`,
    )}`;
    expect(
      within(view.container).getByRole('link', { name: /Tarefa 1/ }),
    ).toHaveAttribute('href', expectedHref);

    await user.click(
      within(view.container).getByRole('button', { name: /Sem data/ }),
    );

    expect(
      within(view.container).getByRole('link', { name: /^Tarefa 2/ }),
    ).toHaveAttribute(
      'href',
      `/tarefa/2?retorno=${encodeURIComponent(
        `/projetos/${projectId}?visao=timeline`,
      )}`,
    );
  });

  it('moves milestones by date and phase with keyboard controls', async () => {
    const user = userEvent.setup();
    const onMilestoneChange = vi.fn();
    const phases = [
      {
        id: 'phase-1',
        name: 'Captação',
        color: 'violet',
        position: 1000,
        startDate: '2026-09-26',
        endDate: '2026-10-02',
        version: 1,
      },
      {
        id: 'phase-2',
        name: 'Vendas',
        color: 'blue',
        position: 2000,
        startDate: '2026-10-03',
        endDate: '2026-10-10',
        version: 1,
      },
    ];
    const item = {
      ...milestone('1', '2026-09-28'),
      eventPhaseId: 'phase-1',
    };
    const view = render(
      <ProjectTimeline
        tasks={[]}
        milestones={[item]}
        phases={phases}
        today="2026-09-26"
        projectStart={null}
        projectEnd={null}
        canEdit
        canManageStructure
        pendingMilestoneId={null}
        onAddMilestone={() => undefined}
        onToggleMilestone={() => undefined}
        onMilestoneChange={onMilestoneChange}
      />,
    );

    const marker = within(view.container).getByRole('button', {
      name: /Marco 1\. Use as setas/,
    });
    expect(marker).not.toHaveClass('-translate-x-1/2');
    expect(marker).toHaveStyle({ transform: 'translate(-13px, 0px)' });
    marker.focus();
    await user.keyboard('{ArrowRight}');

    expect(onMilestoneChange).toHaveBeenNthCalledWith(1, {
      milestoneId: '1',
      expectedVersion: 1,
      dueDate: '2026-09-29',
      eventPhaseId: 'phase-1',
    });

    await waitFor(() => expect(onMilestoneChange).toHaveBeenCalledTimes(1));
    within(view.container)
      .getByRole('button', { name: /Marco 1\. Use as setas/ })
      .focus();
    await user.keyboard('{ArrowDown}');

    expect(onMilestoneChange).toHaveBeenNthCalledWith(2, {
      milestoneId: '1',
      expectedVersion: 2,
      dueDate: '2026-09-29',
      eventPhaseId: 'phase-2',
    });
  });
});

describe('timeline planning actions', () => {
  function setup(onTaskChange = vi.fn()) {
    render(
      <ProjectTimeline
        tasks={[
          { ...task('1', null, 'Bruna'), statusId: 'todo', version: 7 },
          {
            ...task('2', '2026-09-28', 'Wesley'),
            statusId: 'todo',
            version: 3,
            priority: 'urgent',
          },
        ]}
        statuses={[
          {
            id: 'todo',
            name: 'A fazer',
            category: 'todo',
            color: 'blue',
            position: 1,
          },
        ]}
        milestones={[]}
        today="2026-09-26"
        projectStart={null}
        projectEnd={null}
        canEdit
        pendingMilestoneId={null}
        onAddMilestone={() => undefined}
        onToggleMilestone={() => undefined}
        onTaskChange={onTaskChange}
      />,
    );
    return onTaskChange;
  }
  it('schedules an undated task with its version and removes it from the queue', async () => {
    const callback = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Sem data (1)' }));
    fireEvent.change(screen.getByLabelText('Agendar Tarefa 1'), {
      target: { value: '2026-09-29' },
    });
    await waitFor(() =>
      expect(callback).toHaveBeenCalledWith({
        taskId: '1',
        expectedVersion: 7,
        patch: { due_date: '2026-09-29' },
      }),
    );
    expect(screen.getByRole('button', { name: 'Sem data (0)' })).toBeVisible();
  });
  it('restores an undated task when scheduling fails', async () => {
    setup(vi.fn().mockRejectedValue(new Error('conflict')));
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Sem data (1)' }));
    fireEvent.change(screen.getByLabelText('Agendar Tarefa 1'), {
      target: { value: '2026-09-29' },
    });
    await waitFor(() =>
      expect(screen.getByLabelText('Agendar Tarefa 1')).toBeEnabled(),
    );
    expect(screen.getByRole('button', { name: 'Sem data (1)' })).toBeVisible();
  });
  it('combines filters and restores them without changing task data', async () => {
    const callback = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Filtrar' }));
    await user.selectOptions(screen.getByLabelText('Prioridade'), 'low');
    expect(
      screen.queryByRole('link', { name: /Tarefa 2/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(screen.getByRole('link', { name: /Tarefa 2/ })).toBeInTheDocument();
    expect(callback).not.toHaveBeenCalled();
  });
  it('opens planning from a task and submits date-only values', async () => {
    const callback = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Planejar Tarefa 2' }));
    fireEvent.change(screen.getByLabelText('Data de início'), {
      target: { value: '2026-09-27' },
    });
    await user.click(
      screen.getByRole('button', { name: 'Salvar planejamento' }),
    );
    await waitFor(() =>
      expect(callback).toHaveBeenCalledWith({
        taskId: '2',
        expectedVersion: 3,
        patch: {
          event_phase_id: null,
          start_date: '2026-09-27',
          due_date: '2026-09-28',
          status_id: 'todo',
        },
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });
  it('collapses all sections and restores focus after closing options', async () => {
    setup();
    const user = userEvent.setup();
    const options = screen.getByRole('button', { name: 'Opções' });
    await user.click(options);
    await user.click(
      screen.getByRole('button', { name: 'Recolher todas as seções' }),
    );
    expect(screen.getByRole('button', { name: 'A fazer' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await user.click(screen.getByRole('button', { name: 'Fechar opções' }));
    expect(options).toHaveFocus();
  });
});
