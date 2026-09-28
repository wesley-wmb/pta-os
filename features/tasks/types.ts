import type { TaskDescription } from './rich-text';

export type { TaskDescription } from './rich-text';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskWeekLane =
  | 'backlog'
  | 'emergency'
  | 'important'
  | 'scheduled'
  | 'delivered'
  | 'revision'
  | 'ideas'
  | 'discarded';
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
  due_at: string | null;
  due_time: string | null;
  due_is_date_only: boolean;
  week_position: number;
  board_position: number;
  week_lane: TaskWeekLane;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  primary_assignee_id: string | null;
  primary_assignee_name: string | null;
  type_id: string | null;
  type_name: string | null;
  product_id: string | null;
  product_name: string | null;
  event_id: string | null;
  event_name: string | null;
  checklist_total?: number;
  checklist_completed?: number;
  comment_count?: number;
  description_preview?: string | null;
};

export type TaskDetailTask = TaskOverview & {
  description_json: TaskDescription;
  requester_id: string | null;
  requester_name: string | null;
};

export type TaskCustomFieldType =
  'text' | 'number' | 'date' | 'boolean' | 'single_select';

export type TaskCustomField = {
  id: string;
  name: string;
  type: TaskCustomFieldType;
  position: number;
  version: number;
  value: string | number | boolean | null;
  options: Array<{ id: string; label: string }>;
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

export type TaskChecklistItem = {
  id: string;
  content: string;
  position: number;
  is_completed: boolean;
  completed_by: string | null;
  completed_by_name: string | null;
  completed_at: string | null;
  created_by: string;
  creator_name: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskChecklist = {
  id: string;
  title: string;
  is_default: boolean;
  position: number;
  created_by: string;
  creator_name: string | null;
  created_at: string;
  updated_at: string;
  items: TaskChecklistItem[];
};

export type TaskComment = {
  id: string;
  parent_comment_id: string | null;
  body: string | null;
  created_by: string;
  author_name: string | null;
  created_at: string;
  updated_at: string;
  edited_at: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  can_edit_comment: boolean;
  can_delete_comment: boolean;
};

export type TaskCommentsCursor = {
  created_at: string;
  id: string;
};

export type TaskCommentsPage = {
  comments: TaskComment[];
  has_more: boolean;
  next_cursor: TaskCommentsCursor | null;
};

export type TaskCommentsPageInfo = Omit<TaskCommentsPage, 'comments'>;

export type TaskLink = {
  description?: string;
  id: string;
  url: string;
  label: string | null;
  provider: string;
  created_by: string;
  author_name: string | null;
  created_at: string;
  updated_at: string;
  can_edit_link: boolean;
  can_delete_link: boolean;
};

export type TaskCollaborationPayload = {
  checklists: TaskChecklist[];
  comments: TaskComment[];
  comments_page: TaskCommentsPageInfo;
  links: TaskLink[];
};

export type TaskDetailPayload = {
  task: TaskDetailTask;
  activity: TaskActivity[];
  collaboration: TaskCollaborationPayload;
  custom_fields: TaskCustomField[];
  subtasks: TaskOverview[];
  parent_task: TaskOverview | null;
  capabilities: {
    can_edit: boolean;
    can_manage_assignees: boolean;
    can_manage_custom_fields: boolean;
    can_edit_custom_field_values: boolean;
    can_edit_description: boolean;
    can_manage_checklist_structure: boolean;
    can_toggle_checklist: boolean;
    can_comment: boolean;
    can_add_link: boolean;
    can_remove_any_link: boolean;
    can_create_subtask: boolean;
    supports_task_steps: boolean;
    can_manage_task_steps: boolean;
  };
};
