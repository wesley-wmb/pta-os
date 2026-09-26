import { z } from 'zod';

import type {
  EventDetail,
  EventsPageData,
  ProductDetail,
  ProductsPageData,
  ProjectTimelineData,
} from './types';

const healthSchema = z.enum(['healthy', 'attention', 'risk']);
const eventStatusSchema = z.enum([
  'planning',
  'active',
  'completed',
  'cancelled',
]);
const productStatusSchema = z.enum([
  'planning',
  'active',
  'paused',
  'completed',
]);

const eventSummarySchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(2),
    status: eventStatusSchema,
    summary: z.string().nullable(),
    product_id: z.uuid().nullable(),
    product_name: z.string().nullable(),
    owner_id: z.uuid().nullable(),
    owner_name: z.string().nullable(),
    start_date: z.iso.date().nullable(),
    end_date: z.iso.date().nullable(),
    version: z.number().int().positive(),
    updated_at: z.iso.datetime({ offset: true }),
    task_count: z.number().int().nonnegative(),
    done_task_count: z.number().int().nonnegative(),
    open_task_count: z.number().int().nonnegative(),
    overdue_task_count: z.number().int().nonnegative(),
    progress: z.number().int().min(0).max(100).nullable(),
    health: healthSchema,
    resource_count: z.number().int().nonnegative(),
    team_count: z.number().int().nonnegative(),
    milestone_count: z.number().int().nonnegative(),
    completed_milestone_count: z.number().int().nonnegative(),
  })
  .transform((value) => ({
    id: value.id,
    name: value.name,
    status: value.status,
    summary: value.summary,
    productId: value.product_id,
    productName: value.product_name,
    ownerId: value.owner_id,
    ownerName: value.owner_name,
    ownerAssigned: value.owner_id !== null,
    phase:
      value.status === 'completed' || value.status === 'cancelled'
        ? ('ended' as const)
        : value.status === 'active'
          ? ('active' as const)
          : ('planning' as const),
    startDate: value.start_date,
    endDate: value.end_date,
    version: value.version,
    updatedAt: value.updated_at,
    totalTasks: value.task_count,
    doneTasks: value.done_task_count,
    openTasks: value.open_task_count,
    overdueTasks: value.overdue_task_count,
    progress: value.progress,
    health: value.health,
    resourceCount: value.resource_count,
    teamCount: value.team_count,
    milestoneCount: value.milestone_count,
    completedMilestoneCount: value.completed_milestone_count,
  }));

const productSummarySchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(2),
    status: productStatusSchema,
    description: z.string(),
    owner_id: z.uuid().nullable(),
    owner_name: z.string().nullable(),
    version: z.number().int().positive(),
    updated_at: z.iso.datetime({ offset: true }),
    event_count: z.number().int().nonnegative(),
    upcoming_event_count: z.number().int().nonnegative(),
    task_count: z.number().int().nonnegative(),
    open_task_count: z.number().int().nonnegative(),
    overdue_task_count: z.number().int().nonnegative(),
    resource_count: z.number().int().nonnegative(),
    team_count: z.number().int().nonnegative(),
    health: healthSchema,
  })
  .transform((value) => ({
    id: value.id,
    name: value.name,
    status: value.status,
    description: value.description,
    ownerId: value.owner_id,
    ownerName: value.owner_name,
    ownerAssigned: value.owner_id !== null,
    version: value.version,
    updatedAt: value.updated_at,
    eventCount: value.event_count,
    upcomingEventCount: value.upcoming_event_count,
    totalTaskCount: value.task_count,
    openTaskCount: value.open_task_count,
    overdueTaskCount: value.overdue_task_count,
    resourceCount: value.resource_count,
    teamCount: value.team_count,
    health: value.health,
  }));

export const eventsPageSchema = z
  .object({ events: z.array(eventSummarySchema), today: z.iso.date() })
  .transform((value): EventsPageData => value);

export const productsPageSchema = z
  .object({ products: z.array(productSummarySchema) })
  .transform((value): ProductsPageData => value);

const taskSchema = z
  .object({
    id: z.uuid(),
    task_number: z.number().int().positive(),
    title: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    due_date: z.iso.date().nullable(),
    status_name: z.string(),
    status_category: z.string(),
    assignee_name: z.string().nullable(),
  })
  .transform((value) => ({
    id: value.id,
    taskNumber: value.task_number,
    title: value.title,
    priority: value.priority,
    dueDate: value.due_date,
    statusName: value.status_name,
    statusCategory: value.status_category,
    assigneeName: value.assignee_name,
  }));

export const projectTimelineSchema = z
  .object({
    phases: z.array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        color: z.string(),
        position: z.coerce.number(),
        start_date: z.iso.date().nullable(),
        end_date: z.iso.date().nullable(),
        version: z.number().int().positive(),
      }),
    ),
    statuses: z.array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        category: z.string(),
        color: z.string(),
        position: z.number().int(),
      }),
    ),
    tasks: z.array(
      z.object({
        id: z.uuid(),
        task_number: z.number().int().positive(),
        title: z.string(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']),
        status_id: z.uuid(),
        event_phase_id: z.uuid().nullable(),
        start_date: z.iso.date().nullable(),
        start_time: z.string().nullable(),
        due_date: z.iso.date().nullable(),
        due_time: z.string().nullable(),
        version: z.number().int().positive(),
        can_edit: z.boolean(),
        assignee_id: z.uuid().nullable(),
        assignee_name: z.string().nullable(),
      }),
    ),
    milestones: z.array(
      z.object({
        id: z.uuid(),
        title: z.string(),
        due_date: z.iso.date().nullable(),
        event_phase_id: z.uuid().nullable(),
        position: z.number().int().nonnegative(),
        completed_at: z.iso.datetime({ offset: true }).nullable(),
        version: z.number().int().positive(),
      }),
    ),
    capabilities: z.object({
      can_edit_tasks: z.boolean(),
      can_manage_structure: z.boolean(),
    }),
  })
  .transform((value): ProjectTimelineData => {
    const statuses = new Map(
      value.statuses.map((status) => [status.id, status]),
    );
    return {
      phases: value.phases.map((phase) => ({
        id: phase.id,
        name: phase.name,
        color: phase.color,
        position: phase.position,
        startDate: phase.start_date,
        endDate: phase.end_date,
        version: phase.version,
      })),
      tasks: value.tasks.map((task) => {
        const status = statuses.get(task.status_id);
        return {
          id: task.id,
          taskNumber: task.task_number,
          title: task.title,
          priority: task.priority,
          startDate: task.start_date,
          startTime: task.start_time,
          dueDate: task.due_date,
          dueTime: task.due_time,
          statusId: task.status_id,
          statusName: status?.name ?? 'Sem status',
          statusCategory: status?.category ?? 'todo',
          eventPhaseId: task.event_phase_id,
          version: task.version,
          canEdit: task.can_edit,
          assigneeId: task.assignee_id,
          assigneeName: task.assignee_name,
        };
      }),
      milestones: value.milestones.map((milestone) => ({
        id: milestone.id,
        title: milestone.title,
        dueDate: milestone.due_date,
        phase: 'custom',
        eventPhaseId: milestone.event_phase_id,
        completedAt: milestone.completed_at,
        position: milestone.position,
        version: milestone.version,
      })),
      capabilities: {
        canEditTasks: value.capabilities.can_edit_tasks,
        canManageStructure: value.capabilities.can_manage_structure,
      },
    };
  });

const resourceSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    type: z.string(),
    updated_at: z.iso.datetime({ offset: true }),
  })
  .transform((value) => ({
    id: value.id,
    title: value.title,
    type: value.type,
    updatedAt: value.updated_at,
  }));

const memberSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    role_label: z.string().nullable(),
  })
  .transform((value) => ({
    id: value.id,
    name: value.name,
    roleLabel: value.role_label,
  }));

const historySchema = z
  .object({
    id: z.uuid(),
    action: z.string(),
    actor_name: z.string().nullable(),
    created_at: z.iso.datetime({ offset: true }),
  })
  .transform((value) => ({
    id: value.id,
    action: value.action,
    actorName: value.actor_name,
    createdAt: value.created_at,
  }));

const capabilitiesSchema = z
  .object({ can_edit: z.boolean(), can_create_task: z.boolean() })
  .transform((value) => ({
    canEdit: value.can_edit,
    canCreateTask: value.can_create_task,
  }));

export const eventDetailSchema = z
  .object({
    event: z.object({
      id: z.uuid(),
      name: z.string(),
      status: eventStatusSchema,
      summary: z.string().nullable(),
      objective: z.string().nullable(),
      success_metric: z.string().nullable(),
      health_override: healthSchema.nullable(),
      product_id: z.uuid().nullable(),
      product_name: z.string().nullable(),
      owner_id: z.uuid().nullable(),
      owner_name: z.string().nullable(),
      start_date: z.iso.date().nullable(),
      end_date: z.iso.date().nullable(),
      task_count: z.number().int().nonnegative(),
      done_task_count: z.number().int().nonnegative(),
      open_task_count: z.number().int().nonnegative(),
      overdue_task_count: z.number().int().nonnegative(),
      progress: z.number().int().min(0).max(100).nullable(),
      health: healthSchema,
      version: z.number().int().positive(),
      created_at: z.iso.datetime({ offset: true }),
      updated_at: z.iso.datetime({ offset: true }),
    }),
    tasks: z.array(taskSchema),
    resources: z.array(resourceSchema),
    team: z.array(memberSchema),
    milestones: z.array(
      z
        .object({
          id: z.uuid(),
          title: z.string(),
          due_date: z.iso.date().nullable(),
          phase: z.string(),
          completed_at: z.iso.datetime({ offset: true }).nullable(),
          position: z.number().int().nonnegative(),
          version: z.number().int().positive(),
        })
        .transform((value) => ({
          id: value.id,
          title: value.title,
          dueDate: value.due_date,
          phase: value.phase,
          completedAt: value.completed_at,
          position: value.position,
          version: value.version,
        })),
    ),
    history: z.array(historySchema),
    capabilities: capabilitiesSchema,
  })
  .transform((value): EventDetail => ({
    ...value,
    event: {
      id: value.event.id,
      name: value.event.name,
      status: value.event.status,
      summary: value.event.summary,
      objective: value.event.objective,
      successMetric: value.event.success_metric,
      healthOverride: value.event.health_override,
      productId: value.event.product_id,
      productName: value.event.product_name,
      ownerId: value.event.owner_id,
      ownerName: value.event.owner_name,
      startDate: value.event.start_date,
      endDate: value.event.end_date,
      totalTasks: value.event.task_count,
      doneTasks: value.event.done_task_count,
      openTasks: value.event.open_task_count,
      overdueTasks: value.event.overdue_task_count,
      progress: value.event.progress,
      health: value.event.health,
      version: value.event.version,
      createdAt: value.event.created_at,
      updatedAt: value.event.updated_at,
    },
  }));

export const productDetailSchema = z
  .object({
    product: z.object({
      id: z.uuid(),
      name: z.string(),
      status: productStatusSchema,
      description: z.string(),
      owner_id: z.uuid().nullable(),
      owner_name: z.string().nullable(),
      version: z.number().int().positive(),
      created_at: z.iso.datetime({ offset: true }),
      updated_at: z.iso.datetime({ offset: true }),
    }),
    events: z.array(
      z
        .object({
          id: z.uuid(),
          name: z.string(),
          status: eventStatusSchema,
          start_date: z.iso.date().nullable(),
          end_date: z.iso.date().nullable(),
          owner_name: z.string().nullable(),
        })
        .transform((value) => ({
          id: value.id,
          name: value.name,
          status: value.status,
          startDate: value.start_date,
          endDate: value.end_date,
          ownerName: value.owner_name,
        })),
    ),
    tasks: z.array(taskSchema),
    resources: z.array(resourceSchema),
    team: z.array(memberSchema),
    history: z.array(historySchema),
    capabilities: capabilitiesSchema,
  })
  .transform((value): ProductDetail => ({
    ...value,
    product: {
      id: value.product.id,
      name: value.product.name,
      status: value.product.status,
      description: value.product.description,
      ownerId: value.product.owner_id,
      ownerName: value.product.owner_name,
      version: value.product.version,
      createdAt: value.product.created_at,
      updatedAt: value.product.updated_at,
    },
  }));

export const portfolioMutationSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
});

export const productFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Informe um nome com pelo menos 2 caracteres.')
    .max(180),
  status: productStatusSchema,
  description: z.string().trim().max(4000),
  ownerId: z.string(),
});

export const eventFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Informe um nome com pelo menos 2 caracteres.')
      .max(180),
    status: eventStatusSchema,
    healthOverride: z.enum(['auto', 'healthy', 'attention', 'risk']),
    productId: z.string(),
    ownerId: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    summary: z.string().trim().max(4000),
    objective: z.string().trim().max(1000),
    successMetric: z.string().trim().max(500),
  })
  .refine(
    (value) =>
      !value.startDate || !value.endDate || value.endDate >= value.startDate,
    {
      message: 'A data final deve ser igual ou posterior à inicial.',
      path: ['endDate'],
    },
  );

export type ProductFormInput = z.infer<typeof productFormSchema>;
export type EventFormInput = z.infer<typeof eventFormSchema>;
