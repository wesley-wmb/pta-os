import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EventDetail } from './types';
import { ProjectOverview } from './project-overview';

vi.mock('./portfolio-detail-sheet', () => ({
  formatRange: () => 'Período não definido',
}));
vi.mock('@/features/tasks/task-detail-link', () => ({
  TaskDetailLink: ({
    taskId,
    children,
    className,
  }: {
    taskId: string;
    children: React.ReactNode;
    className?: string;
  }) => {
    return (
      <a href={`/tarefa/${taskId}`} className={className}>
        {children}
      </a>
    );
  },
}));
afterEach(cleanup);
const detail: EventDetail = {
  event: {
    id: 'project',
    name: 'Projeto',
    status: 'planning',
    summary: null,
    objective: null,
    successMetric: null,
    healthOverride: null,
    productId: null,
    productName: null,
    ownerId: null,
    ownerName: null,
    startDate: null,
    endDate: null,
    totalTasks: 0,
    doneTasks: 0,
    openTasks: 0,
    overdueTasks: 0,
    progress: null,
    health: 'healthy',
    version: 1,
    createdAt: '2026-09-27',
    updatedAt: '2026-09-27',
  },
  tasks: [],
  resources: [],
  team: [],
  milestones: [],
  history: [],
  capabilities: { canEdit: true, canCreateTask: true },
};
function setup(value = detail) {
  const onNavigate = vi.fn();
  const onAddTask = vi.fn();
  const onAddMilestone = vi.fn();
  render(
    <ProjectOverview
      detail={value}
      workspaceId="workspace"
      onNavigate={onNavigate}
      onAddTask={onAddTask}
      onAddMilestone={onAddMilestone}
    />,
  );
  return { onNavigate, onAddTask, onAddMilestone };
}
describe('ProjectOverview', () => {
  it('não inventa progresso em um projeto sem tarefas', () => {
    setup();
    expect(screen.getByRole('progressbar')).not.toHaveAttribute(
      'aria-valuenow',
    );
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      'Sem tarefas para calcular',
    );
  });
  it('respeita as permissões para criar e editar', () => {
    setup({
      ...detail,
      capabilities: { canEdit: false, canCreateTask: false },
    });
    expect(
      screen.queryByRole('button', { name: 'Adicionar tarefa' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Adicionar marco' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Editar direção' }),
    ).not.toBeInTheDocument();
  });
  it('leva ações de contexto para as áreas do mesmo projeto', async () => {
    const { onNavigate, onAddMilestone } = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Editar direção' }));
    expect(onNavigate).toHaveBeenLastCalledWith('settings');
    await user.click(screen.getByRole('button', { name: 'Cronograma' }));
    expect(onNavigate).toHaveBeenLastCalledWith('timeline');
    await user.click(screen.getByRole('button', { name: 'Adicionar marco' }));
    expect(onAddMilestone).toHaveBeenCalledOnce();
  });
  it('prioriza marcos pendentes por data e mantém os sem data depois', () => {
    setup({
      ...detail,
      milestones: [
        {
          id: 'done',
          title: 'Concluído',
          dueDate: '2026-09-01',
          completedAt: '2026-09-01',
          phase: 'preparation',
          position: 0,
          version: 1,
        },
        {
          id: 'undated',
          title: 'Sem prazo',
          dueDate: null,
          completedAt: null,
          phase: 'preparation',
          position: 1,
          version: 1,
        },
        {
          id: 'next',
          title: 'Próxima entrega',
          dueDate: '2026-10-04',
          completedAt: null,
          phase: 'preparation',
          position: 2,
          version: 1,
        },
      ],
    });
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Próxima entrega');
    expect(items[0]).toHaveTextContent('4 de out. de 2026');
    expect(items[1]).toHaveTextContent('Sem prazo');
    expect(items[2]).toHaveTextContent('Concluído');
  });
});
