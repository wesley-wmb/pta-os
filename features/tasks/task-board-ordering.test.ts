import { describe, expect, it } from 'vitest';

import {
  applyBoardMove,
  compareBoardTasks,
  planBoardMove,
} from './task-board-ordering';
import type { TaskOverview, TaskStatus } from './types';

const todo = status('00000000-0000-4000-8000-000000000010', 'A fazer');
const doing = status(
  '00000000-0000-4000-8000-000000000020',
  'Em andamento',
  'in_progress',
);
const statuses = [todo, doing];

describe('ordenação persistente do Kanban', () => {
  it('calcula uma posição fracionária entre dois cartões', () => {
    const tasks = [
      task('1', todo.id, 1000),
      task('2', todo.id, 2000),
      task('3', todo.id, 3000),
    ];
    const plan = planBoardMove({
      tasks,
      statuses,
      taskId: tasks[2].id,
      overId: tasks[1].id,
    });
    expect(plan).toMatchObject({
      statusId: todo.id,
      beforeTaskId: tasks[0].id,
      afterTaskId: tasks[1].id,
      position: 1500,
    });
  });

  it('move para o fim de outra coluna e aplica o status visualmente', () => {
    const tasks = [task('1', todo.id, 1000), task('2', doing.id, 1000)];
    const plan = planBoardMove({
      tasks,
      statuses,
      taskId: tasks[0].id,
      overId: doing.id,
    });
    expect(plan).not.toBeNull();
    const moved = applyBoardMove(tasks, statuses, plan!);
    expect(moved.find((item) => item.id === tasks[0].id)).toMatchObject({
      status_id: doing.id,
      status_name: doing.name,
      board_position: 2000,
    });
  });

  it('rebalanceia localmente quando não existe intervalo numérico seguro', () => {
    const tasks = [
      task('1', todo.id, 0),
      task('2', todo.id, 0.00000000001),
      task('3', todo.id, 3000),
    ];
    const plan = planBoardMove({
      tasks,
      statuses,
      taskId: tasks[2].id,
      overId: tasks[1].id,
    });
    expect([...plan!.positions.values()]).toEqual([1000, 2000, 3000]);
    expect(plan?.position).toBe(2000);
  });

  it('estabiliza empates por número e id', () => {
    const tasks = [task('2', todo.id, 1000), task('1', todo.id, 1000)];
    expect(
      tasks.toSorted(compareBoardTasks).map((item) => item.task_number),
    ).toEqual([1, 2]);
  });
});

function task(
  seed: string,
  statusId: string,
  boardPosition: number,
): TaskOverview {
  const taskNumber = Number(seed);
  return {
    id: `00000000-0000-4000-8000-${taskNumber.toString().padStart(12, '0')}`,
    workspace_id: '00000000-0000-4000-8000-000000000099',
    task_key: `PTA-${seed}`,
    task_number: taskNumber,
    title: `Tarefa ${seed}`,
    priority: 'medium',
    status_id: statusId,
    status_name: statusId === todo.id ? todo.name : doing.name,
    status_category: statusId === todo.id ? todo.category : doing.category,
    status_color: '#777777',
    due_date: null,
    due_at: null,
    due_time: null,
    due_is_date_only: false,
    week_position: 1000,
    week_lane: 'backlog',
    board_position: boardPosition,
    version: 1,
    created_by: '00000000-0000-4000-8000-000000000001',
    created_at: '2026-09-24T10:00:00Z',
    updated_at: '2026-09-24T10:00:00Z',
    primary_assignee_id: null,
    primary_assignee_name: null,
    type_id: null,
    type_name: null,
    product_id: null,
    product_name: null,
    event_id: null,
    event_name: null,
  };
}

function status(
  id: string,
  name: string,
  category: TaskStatus['category'] = 'todo',
): TaskStatus {
  return { id, name, category, color: '#777777', position: 1000 };
}
