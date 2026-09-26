import type { TaskOverview, TaskStatus } from './types';

const BOARD_POSITION_STEP = 1000;
const MINIMUM_BOARD_GAP = 0.0000000001;

export type BoardMovePlan = {
  taskId: string;
  statusId: string;
  beforeTaskId: string | null;
  afterTaskId: string | null;
  position: number;
  positions: ReadonlyMap<string, number>;
};

export function compareBoardTasks(
  left: Pick<TaskOverview, 'board_position' | 'task_number' | 'id'>,
  right: Pick<TaskOverview, 'board_position' | 'task_number' | 'id'>,
) {
  return (
    left.board_position - right.board_position ||
    left.task_number - right.task_number ||
    left.id.localeCompare(right.id)
  );
}

export function planBoardMove({
  tasks,
  statuses,
  taskId,
  overId,
  insertAfter = false,
}: {
  tasks: TaskOverview[];
  statuses: TaskStatus[];
  taskId: string;
  overId: string;
  insertAfter?: boolean;
}): BoardMovePlan | null {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return null;

  const overTask = tasks.find((item) => item.id === overId);
  const statusId =
    overTask?.status_id ?? statuses.find((item) => item.id === overId)?.id;
  if (!statusId) return null;

  const destination = tasks
    .filter((item) => item.status_id === statusId && item.id !== taskId)
    .toSorted(compareBoardTasks);
  let insertionIndex = overTask
    ? destination.findIndex((item) => item.id === overTask.id)
    : destination.length;
  if (insertionIndex < 0) insertionIndex = destination.length;
  if (overTask && insertAfter) insertionIndex += 1;

  const beforeTask = destination[insertionIndex - 1] ?? null;
  const afterTask = destination[insertionIndex] ?? null;
  const positions = new Map<string, number>();
  const position = positionBetween(beforeTask, afterTask);

  if (position !== null) {
    positions.set(taskId, position);
    return {
      taskId,
      statusId,
      beforeTaskId: beforeTask?.id ?? null,
      afterTaskId: afterTask?.id ?? null,
      position,
      positions,
    };
  }

  const reordered = [...destination];
  reordered.splice(insertionIndex, 0, task);
  reordered.forEach((item, index) =>
    positions.set(item.id, (index + 1) * BOARD_POSITION_STEP),
  );

  return {
    taskId,
    statusId,
    beforeTaskId: beforeTask?.id ?? null,
    afterTaskId: afterTask?.id ?? null,
    position: positions.get(taskId) ?? BOARD_POSITION_STEP,
    positions,
  };
}

export function applyBoardMove(
  tasks: TaskOverview[],
  statuses: TaskStatus[],
  plan: BoardMovePlan,
) {
  const status = statuses.find((item) => item.id === plan.statusId);
  if (!status) return tasks;
  return tasks.map((task) => {
    const position = plan.positions.get(task.id);
    if (task.id !== plan.taskId && position === undefined) return task;
    return {
      ...task,
      ...(task.id === plan.taskId
        ? {
            status_id: status.id,
            status_name: status.name,
            status_category: status.category,
            status_color: status.color,
          }
        : null),
      board_position: position ?? plan.position,
    };
  });
}

function positionBetween(
  beforeTask: Pick<TaskOverview, 'board_position'> | null,
  afterTask: Pick<TaskOverview, 'board_position'> | null,
) {
  if (!beforeTask && !afterTask) return BOARD_POSITION_STEP;
  if (!beforeTask && afterTask) {
    if (afterTask.board_position > MINIMUM_BOARD_GAP)
      return afterTask.board_position / 2;
    return null;
  }
  if (beforeTask && !afterTask)
    return beforeTask.board_position + BOARD_POSITION_STEP;
  if (!beforeTask || !afterTask) return null;
  const gap = afterTask.board_position - beforeTask.board_position;
  return gap > MINIMUM_BOARD_GAP ? beforeTask.board_position + gap / 2 : null;
}
