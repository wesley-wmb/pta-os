import type { WorkspaceRole } from '@/features/workspace/types';

export type OperationalHealth = 'healthy' | 'attention' | 'risk';
export type EventPhase = 'active' | 'upcoming' | 'ended' | 'planning';
export type EventOperationalStatus =
  'planning' | 'active' | 'completed' | 'cancelled';
export type ProductOperationalStatus =
  'planning' | 'active' | 'paused' | 'completed';

export type EventSummary = {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  productName: string | null;
  ownerName: string | null;
  ownerId: string | null;
  ownerAssigned: boolean;
  phase: EventPhase;
  status: EventOperationalStatus;
  summary: string | null;
  totalTasks: number;
  openTasks: number;
  doneTasks: number;
  overdueTasks: number;
  progress: number | null;
  health: OperationalHealth;
  resourceCount: number;
  teamCount: number;
  milestoneCount: number;
  completedMilestoneCount: number;
  version: number;
  updatedAt: string;
};

export type EventsPageData = {
  events: EventSummary[];
  today: string;
};

export type ProductSummary = {
  id: string;
  name: string;
  ownerName: string | null;
  ownerId: string | null;
  ownerAssigned: boolean;
  status: ProductOperationalStatus;
  description: string;
  health: OperationalHealth;
  updatedAt: string;
  eventCount: number;
  upcomingEventCount: number;
  openTaskCount: number;
  totalTaskCount: number;
  overdueTaskCount: number;
  resourceCount: number;
  teamCount: number;
  version: number;
};

export type ProductsPageData = {
  products: ProductSummary[];
};

export type PortfolioTask = {
  id: string;
  taskNumber: number;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate?: string | null;
  startTime?: string | null;
  dueDate: string | null;
  dueTime?: string | null;
  statusId?: string;
  statusName: string;
  statusCategory: string;
  eventPhaseId?: string | null;
  version?: number;
  canEdit?: boolean;
  assigneeId?: string | null;
  assigneeName: string | null;
};

export type ProjectPhase = {
  id: string;
  name: string;
  color: string;
  position: number;
  startDate: string | null;
  endDate: string | null;
  version: number;
};

export type PortfolioResource = {
  id: string;
  title: string;
  type: string;
  updatedAt: string;
};

export type PortfolioMember = {
  id: string;
  name: string;
  roleLabel: string | null;
};

export type PortfolioHistoryItem = {
  id: string;
  action: string;
  actorName: string | null;
  createdAt: string;
};

export type EventMilestone = {
  id: string;
  title: string;
  dueDate: string | null;
  phase: string;
  eventPhaseId?: string | null;
  completedAt: string | null;
  position: number;
  version: number;
};

export type ProjectTimelineData = {
  phases: ProjectPhase[];
  tasks: PortfolioTask[];
  milestones: EventMilestone[];
  capabilities: {
    canEditTasks: boolean;
    canManageStructure: boolean;
  };
};

export type EventDetail = {
  event: {
    id: string;
    name: string;
    status: EventOperationalStatus;
    summary: string | null;
    objective: string | null;
    successMetric: string | null;
    healthOverride: OperationalHealth | null;
    productId: string | null;
    productName: string | null;
    ownerId: string | null;
    ownerName: string | null;
    startDate: string | null;
    endDate: string | null;
    totalTasks: number;
    doneTasks: number;
    openTasks: number;
    overdueTasks: number;
    progress: number | null;
    health: OperationalHealth;
    version: number;
    createdAt: string;
    updatedAt: string;
  };
  tasks: PortfolioTask[];
  resources: PortfolioResource[];
  team: PortfolioMember[];
  milestones: EventMilestone[];
  history: PortfolioHistoryItem[];
  capabilities: { canEdit: boolean; canCreateTask: boolean };
};

export type ProductDetail = {
  product: {
    id: string;
    name: string;
    status: ProductOperationalStatus;
    description: string;
    ownerId: string | null;
    ownerName: string | null;
    version: number;
    createdAt: string;
    updatedAt: string;
  };
  events: Array<{
    id: string;
    name: string;
    status: EventOperationalStatus;
    startDate: string | null;
    endDate: string | null;
    ownerName: string | null;
  }>;
  tasks: PortfolioTask[];
  resources: PortfolioResource[];
  team: PortfolioMember[];
  history: PortfolioHistoryItem[];
  capabilities: { canEdit: boolean; canCreateTask: boolean };
};

export type TeamMemberSummary = {
  id: string;
  fullName: string;
  initials: string;
  role: WorkspaceRole;
  joinedAt: string;
  weeklyCapacityMinutes: number | null;
  totalAssignedTasks: number;
  openTasks: number;
  overdueTasks: number;
  plannedWeekMinutes: number;
  estimatedWeekTasks: number;
  completedThisWeek: number;
  completedLast28Days: number;
  onTimeCompletedLast28Days: number;
  isCurrentUser: boolean;
};

export type TeamPageData = {
  members: TeamMemberSummary[];
  scope: 'self' | 'team';
};

export type ActivityAction =
  | 'task.created'
  | 'task.updated'
  | 'task.assignee_added'
  | 'task.assignee_changed'
  | 'task.assignee_removed'
  | string;

export type ActivitySummary = {
  id: string;
  action: ActivityAction;
  actorName: string;
  subjectName: string | null;
  taskId: string;
  taskKey: string | null;
  taskTitle: string | null;
  taskArchived: boolean;
  createdAt: string;
  dateKey: string;
};

export type HistoryPageData = {
  activity: ActivitySummary[];
  timezone: string;
  today: string;
};
