export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatusCategory =
  | 'backlog'
  | 'todo'
  | 'in_progress'
  | 'review'
  | 'blocked'
  | 'done'
  | 'cancelled';

export type TaskOverview = {
  id: string;
  workspace_id: string;
  task_key: string;
  task_number: number;
  title: string;
  priority: TaskPriority;
  status_id: string;
  status_name: string;
  status_category: TaskStatusCategory;
  status_color: string;
  due_date: string | null;
  due_time: string | null;
  due_is_date_only: boolean;
  week_position: number;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  primary_assignee_id: string | null;
  primary_assignee_name: string | null;
};

export type TaskStatus = {
  id: string;
  name: string;
  category: TaskStatusCategory;
  color: string;
  position: number;
};

export type TaskActivity = {
  id: string;
  actor_id: string | null;
  action: string;
  changes_json: Record<string, unknown>;
  metadata_json: Record<string, unknown>;
  created_at: string;
};

export type TaskDetailPayload = {
  task: TaskOverview;
  activity: TaskActivity[];
  capabilities: {
    can_edit: boolean;
    can_manage_assignees: boolean;
  };
};
