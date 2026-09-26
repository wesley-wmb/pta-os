import 'server-only';

import { notFound, redirect } from 'next/navigation';

import {
  calendarWeekKeys,
  currentDateInTimeZone,
} from '@/features/tasks/date-utils';
import { getWorkspaceContext } from '@/features/workspace/server';
import type { WorkspaceRole } from '@/features/workspace/types';
import { createClient } from '@/lib/supabase/server';

import type {
  ActivitySummary,
  EventDetail,
  EventPhase,
  EventsPageData,
  HistoryPageData,
  ProductsPageData,
  TeamPageData,
} from './types';
import {
  eventDetailSchema,
  eventsPageSchema,
  productsPageSchema,
} from './portfolio-schemas';

const CLOSED_CATEGORIES = new Set(['done', 'cancelled']);

async function requireWorkspace() {
  const context = await getWorkspaceContext();
  if (!context?.workspace) redirect('/login');
  return { ...context, workspace: context.workspace };
}

export async function getOperationsContext() {
  const context = await requireWorkspace();
  return {
    workspaceId: context.workspace.id,
    taskPrefix: context.workspace.taskPrefix,
    members: context.members,
    canManage: ['owner', 'admin', 'manager'].includes(context.workspace.role),
  };
}

export async function getEventsPageData(): Promise<EventsPageData> {
  const context = await requireWorkspace();
  const workspaceId = context.workspace.id;
  const supabase = await createClient();
  const operationalResult = await supabase.rpc('list_events_operational', {
    p_workspace_id: workspaceId,
  });
  if (operationalResult.error) throw new Error('PTA_EVENTS_UNAVAILABLE');
  const operationalData = eventsPageSchema.safeParse(operationalResult.data);
  if (!operationalData.success) throw new Error('PTA_EVENTS_INVALID_RESPONSE');
  return operationalData.data;
  /* Legacy read path retained below only until the operational migration is deployed. */
  /* c8 ignore start */
  const [
    eventsResult,
    productsResult,
    tasksResult,
    statusesResult,
    membersResult,
  ] = await Promise.all([
    supabase
      .from('events')
      .select('id, name, product_id, owner_id, start_date, end_date')
      .eq('workspace_id', workspaceId)
      .is('archived_at', null)
      .order('start_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('products')
      .select('id, name')
      .eq('workspace_id', workspaceId)
      .is('archived_at', null),
    supabase
      .from('tasks')
      .select('id, event_id, status_id, due_at')
      .eq('workspace_id', workspaceId)
      .is('archived_at', null),
    supabase
      .from('task_statuses')
      .select('id, system_category')
      .eq('workspace_id', workspaceId),
    supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active'),
  ]);

  const coreError = [
    eventsResult.error,
    productsResult.error,
    tasksResult.error,
    statusesResult.error,
    membersResult.error,
  ].find(Boolean);
  if (coreError) throw new Error('PTA_EVENTS_UNAVAILABLE');

  const memberIds = (membersResult.data ?? []).map((member) => member.user_id);
  const profilesResult = memberIds.length
    ? await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', memberIds)
    : { data: [], error: null };
  if (profilesResult.error) throw new Error('PTA_EVENTS_UNAVAILABLE');

  const productById = new Map(
    (productsResult.data ?? []).map((product) => [product.id, product.name]),
  );
  const profileById = new Map(
    (profilesResult.data ?? []).map((profile) => [
      profile.id,
      profile.full_name,
    ]),
  );
  const categoryByStatus = new Map(
    (statusesResult.data ?? []).map((status) => [
      status.id,
      status.system_category,
    ]),
  );
  const tasksByEvent = new Map<
    string,
    Array<{ statusId: string; dueAt: string | null }>
  >();
  for (const task of tasksResult.data ?? []) {
    if (!task.event_id || !task.status_id) continue;
    const eventId = task.event_id as string;
    const statusId = task.status_id as string;
    const group = tasksByEvent.get(eventId) ?? [];
    group.push({ statusId, dueAt: task.due_at });
    tasksByEvent.set(eventId, group);
  }

  const today = currentDateInTimeZone(context.workspace.timezone);
  const now = new Date().toISOString();
  const events = (eventsResult.data ?? []).map((event) => {
    const tasks = tasksByEvent.get(event.id) ?? [];
    const operationalTasks = tasks.filter(
      (task) => categoryByStatus.get(task.statusId) !== 'cancelled',
    );
    const doneTasks = operationalTasks.filter(
      (task) => categoryByStatus.get(task.statusId) === 'done',
    ).length;
    const openTasks = operationalTasks.length - doneTasks;
    const overdueTasks = operationalTasks.filter((task) => {
      const category = categoryByStatus.get(task.statusId);
      return category !== 'done' && Boolean(task.dueAt && task.dueAt < now);
    }).length;

    return {
      id: event.id,
      name: event.name,
      startDate: event.start_date,
      endDate: event.end_date,
      productName: event.product_id
        ? (productById.get(event.product_id) ?? null)
        : null,
      ownerName: event.owner_id
        ? (profileById.get(event.owner_id) ?? null)
        : null,
      ownerAssigned: Boolean(event.owner_id),
      phase: eventPhase(event.start_date, event.end_date, today),
      totalTasks: operationalTasks.length,
      openTasks,
      doneTasks,
      overdueTasks,
      progress: operationalTasks.length
        ? Math.round((doneTasks / operationalTasks.length) * 100)
        : null,
    };
  });

  return { events, today } as unknown as EventsPageData;
  /* c8 ignore stop */
}

export async function getProjectDetail(
  projectId: string,
): Promise<EventDetail> {
  await requireWorkspace();
  const supabase = await createClient();
  const result = await supabase.rpc('get_event_operational', {
    p_event_id: projectId,
  });
  if (result.error) throw new Error('PTA_PROJECT_UNAVAILABLE');
  const parsed = eventDetailSchema.safeParse(result.data);
  if (!parsed.success) throw new Error('PTA_PROJECT_INVALID_RESPONSE');
  return parsed.data;
}

export async function getProductsPageData(): Promise<ProductsPageData> {
  const context = await requireWorkspace();
  const workspaceId = context.workspace.id;
  const supabase = await createClient();
  const operationalResult = await supabase.rpc('list_products_operational', {
    p_workspace_id: workspaceId,
  });
  if (operationalResult.error) throw new Error('PTA_PRODUCTS_UNAVAILABLE');
  const operationalData = productsPageSchema.safeParse(operationalResult.data);
  if (!operationalData.success)
    throw new Error('PTA_PRODUCTS_INVALID_RESPONSE');
  return operationalData.data;
  /* c8 ignore start */
  const [
    productsResult,
    eventsResult,
    tasksResult,
    statusesResult,
    membersResult,
  ] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, owner_id, updated_at')
      .eq('workspace_id', workspaceId)
      .is('archived_at', null)
      .order('updated_at', { ascending: false }),
    supabase
      .from('events')
      .select('id, product_id')
      .eq('workspace_id', workspaceId)
      .is('archived_at', null),
    supabase
      .from('tasks')
      .select('id, product_id, event_id, status_id')
      .eq('workspace_id', workspaceId)
      .is('archived_at', null),
    supabase
      .from('task_statuses')
      .select('id, system_category')
      .eq('workspace_id', workspaceId),
    supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active'),
  ]);

  const coreError = [
    productsResult.error,
    eventsResult.error,
    tasksResult.error,
    statusesResult.error,
    membersResult.error,
  ].find(Boolean);
  if (coreError) throw new Error('PTA_PRODUCTS_UNAVAILABLE');

  const memberIds = (membersResult.data ?? []).map((member) => member.user_id);
  const profilesResult = memberIds.length
    ? await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', memberIds)
    : { data: [], error: null };
  if (profilesResult.error) throw new Error('PTA_PRODUCTS_UNAVAILABLE');

  const profileById = new Map(
    (profilesResult.data ?? []).map((profile) => [
      profile.id,
      profile.full_name,
    ]),
  );
  const categoryByStatus = new Map(
    (statusesResult.data ?? []).map((status) => [
      status.id,
      status.system_category,
    ]),
  );
  const eventProductById = new Map(
    (eventsResult.data ?? []).map((event) => [event.id, event.product_id]),
  );

  return {
    products: (productsResult.data ?? []).map((product) => {
      const productEvents = (eventsResult.data ?? []).filter(
        (event) => event.product_id === product.id,
      );
      const productTasks = (tasksResult.data ?? []).filter((task) => {
        if (task.product_id === product.id) return true;
        return Boolean(
          task.event_id && eventProductById.get(task.event_id) === product.id,
        );
      });
      const openTaskCount = productTasks.filter((task) =>
        isOpenCategory(categoryByStatus.get(task.status_id)),
      ).length;

      return {
        id: product.id,
        name: product.name,
        ownerName: product.owner_id
          ? (profileById.get(product.owner_id) ?? null)
          : null,
        ownerAssigned: Boolean(product.owner_id),
        updatedAt: product.updated_at,
        eventCount: productEvents.length,
        openTaskCount,
        totalTaskCount: productTasks.length,
      };
    }),
  } as unknown as ProductsPageData;
  /* c8 ignore stop */
}

export async function getTeamPageData(): Promise<TeamPageData> {
  const context = await requireWorkspace();
  if (context.workspace.role === 'viewer') notFound();
  const workspaceId = context.workspace.id;
  const supabase = await createClient();
  const [membersResult, tasksResult, assigneesResult, statusesResult] =
    await Promise.all([
      supabase.rpc('list_team_members', { p_workspace_id: workspaceId }),
      supabase
        .from('tasks')
        .select(
          'id, status_id, due_at, due_date, due_is_date_only, estimated_minutes, completed_at',
        )
        .eq('workspace_id', workspaceId)
        .is('archived_at', null),
      supabase
        .from('task_assignees')
        .select('task_id, user_id')
        .eq('workspace_id', workspaceId),
      supabase
        .from('task_statuses')
        .select('id, system_category')
        .eq('workspace_id', workspaceId),
    ]);

  const coreError = [
    membersResult.error,
    tasksResult.error,
    assigneesResult.error,
    statusesResult.error,
  ].find(Boolean);
  if (coreError) throw new Error('PTA_TEAM_UNAVAILABLE');

  const taskById = new Map(
    (tasksResult.data ?? []).map((task) => [task.id, task]),
  );
  const categoryByStatus = new Map(
    (statusesResult.data ?? []).map((status) => [
      status.id,
      status.system_category,
    ]),
  );
  const taskIdsByMember = new Map<string, Set<string>>();
  for (const assignee of assigneesResult.data ?? []) {
    const ids = taskIdsByMember.get(assignee.user_id) ?? new Set<string>();
    ids.add(assignee.task_id);
    taskIdsByMember.set(assignee.user_id, ids);
  }
  const weekKeys = calendarWeekKeys(context.workspace.timezone);
  const recentCutoff = Date.now() - 28 * 24 * 60 * 60 * 1000;

  const members = (membersResult.data ?? []).map((member) => {
    const tasks = [...(taskIdsByMember.get(member.user_id) ?? [])].flatMap(
      (taskId) => {
        const task = taskById.get(taskId);
        return task ? [task] : [];
      },
    );
    const openTasks = tasks.filter((task) =>
      isOpenCategory(categoryByStatus.get(task.status_id)),
    );
    const now = new Date().toISOString();
    const overdueTasks = openTasks.filter(
      (task) => task.due_at && task.due_at < now,
    );
    const plannedWeekTasks = openTasks.filter(
      (task) => task.due_date && weekKeys.includes(task.due_date),
    );
    const estimatedWeekTasks = plannedWeekTasks.filter(
      (task) => task.estimated_minutes !== null,
    );
    const plannedWeekMinutes = estimatedWeekTasks.reduce(
      (total, task) => total + (task.estimated_minutes ?? 0),
      0,
    );
    const completedThisWeek = tasks.filter(
      (task) =>
        task.completed_at &&
        weekKeys.includes(
          dateKeyInTimeZone(task.completed_at, context.workspace.timezone),
        ),
    ).length;
    const recentlyCompleted = tasks.filter(
      (task) =>
        task.completed_at && Date.parse(task.completed_at) >= recentCutoff,
    );
    const recentlyCompletedWithDueDate = recentlyCompleted.filter(
      (task) => task.due_at || task.due_date,
    );
    const onTimeCompleted = recentlyCompletedWithDueDate.filter((task) => {
      if (!task.completed_at) return false;
      if (task.due_is_date_only && task.due_date) {
        return (
          dateKeyInTimeZone(task.completed_at, context.workspace.timezone) <=
          task.due_date
        );
      }
      return Boolean(task.due_at && task.completed_at <= task.due_at);
    });

    return {
      id: member.user_id,
      fullName: member.full_name,
      initials: member.initials || initials(member.full_name),
      role: member.role as WorkspaceRole,
      joinedAt: member.joined_at,
      weeklyCapacityMinutes: member.weekly_capacity_minutes,
      totalAssignedTasks: tasks.length,
      openTasks: openTasks.length,
      overdueTasks: overdueTasks.length,
      plannedWeekMinutes,
      estimatedWeekTasks: estimatedWeekTasks.length,
      completedThisWeek,
      completedLast28Days: recentlyCompletedWithDueDate.length,
      onTimeCompletedLast28Days: onTimeCompleted.length,
      isCurrentUser: member.user_id === context.user.id,
    };
  });

  return {
    scope: context.workspace.role === 'member' ? 'self' : 'team',
    members: members.sort((left, right) => {
      if (left.isCurrentUser !== right.isCurrentUser)
        return left.isCurrentUser ? -1 : 1;
      return left.fullName.localeCompare(right.fullName, 'pt-BR');
    }),
  };
}

export async function getHistoryPageData(): Promise<HistoryPageData> {
  const context = await requireWorkspace();
  const workspaceId = context.workspace.id;
  const supabase = await createClient();
  const logsResult = await supabase.rpc('list_task_activity', {
    p_workspace_id: workspaceId,
  });
  if (logsResult.error) throw new Error('PTA_HISTORY_UNAVAILABLE');

  const logs = logsResult.data ?? [];
  const activity: ActivitySummary[] = logs.map((log) => {
    return {
      id: log.activity_id,
      action: log.action,
      actorName: log.actor_id
        ? (log.actor_name ?? 'Pessoa da equipe')
        : 'Automação do sistema',
      subjectName: log.subject_user_id
        ? (log.subject_name ?? 'Pessoa da equipe')
        : null,
      taskId: log.task_id,
      taskKey:
        log.task_number === null
          ? null
          : `${context.workspace.taskPrefix}-${String(log.task_number).padStart(6, '0')}`,
      taskTitle: log.task_title,
      taskArchived: log.task_archived,
      createdAt: log.created_at,
      dateKey: dateKeyInTimeZone(log.created_at, context.workspace.timezone),
    };
  });

  return {
    activity,
    timezone: context.workspace.timezone,
    today: currentDateInTimeZone(context.workspace.timezone),
  };
}

function eventPhase(
  startDate: string | null,
  endDate: string | null,
  today: string,
): EventPhase {
  if (endDate && endDate < today) return 'ended';
  if (startDate && startDate > today) return 'upcoming';
  if (startDate && startDate <= today && (!endDate || endDate >= today))
    return 'active';
  return 'planning';
}

function isOpenCategory(category: string | undefined) {
  return !category || !CLOSED_CATEGORIES.has(category);
}

function initials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function dateKeyInTimeZone(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}
