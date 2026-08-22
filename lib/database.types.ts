export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.15';
  };
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          changes_json: Json;
          created_at: string;
          entity_id: string;
          entity_type: string;
          id: string;
          metadata_json: Json;
          workspace_id: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          changes_json?: Json;
          created_at?: string;
          entity_id: string;
          entity_type: string;
          id?: string;
          metadata_json?: Json;
          workspace_id: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          changes_json?: Json;
          created_at?: string;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          metadata_json?: Json;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'activity_logs_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activity_logs_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      events: {
        Row: {
          archived_at: string | null;
          created_at: string;
          created_by: string;
          end_date: string | null;
          id: string;
          name: string;
          owner_id: string | null;
          product_id: string | null;
          slug: string;
          start_date: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          created_by: string;
          end_date?: string | null;
          id?: string;
          name: string;
          owner_id?: string | null;
          product_id?: string | null;
          slug: string;
          start_date?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string;
          end_date?: string | null;
          id?: string;
          name?: string;
          owner_id?: string | null;
          product_id?: string | null;
          slug?: string;
          start_date?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'events_workspace_id_created_by_fkey';
            columns: ['workspace_id', 'created_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'events_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_workspace_id_owner_id_fkey';
            columns: ['workspace_id', 'owner_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'events_workspace_id_product_id_fkey';
            columns: ['workspace_id', 'product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      notifications: {
        Row: {
          actor_id: string | null;
          archived_at: string | null;
          body: string | null;
          created_at: string;
          dedupe_key: string | null;
          entity_id: string;
          entity_type: string;
          id: string;
          notification_type: string;
          read_at: string | null;
          title: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          actor_id?: string | null;
          archived_at?: string | null;
          body?: string | null;
          created_at?: string;
          dedupe_key?: string | null;
          entity_id: string;
          entity_type: string;
          id?: string;
          notification_type: string;
          read_at?: string | null;
          title: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          actor_id?: string | null;
          archived_at?: string | null;
          body?: string | null;
          created_at?: string;
          dedupe_key?: string | null;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          notification_type?: string;
          read_at?: string | null;
          title?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_workspace_id_user_id_fkey';
            columns: ['workspace_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
        ];
      };
      products: {
        Row: {
          archived_at: string | null;
          created_at: string;
          created_by: string;
          description_json: Json;
          id: string;
          name: string;
          owner_id: string | null;
          slug: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          created_by: string;
          description_json?: Json;
          id?: string;
          name: string;
          owner_id?: string | null;
          slug: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string;
          description_json?: Json;
          id?: string;
          name?: string;
          owner_id?: string | null;
          slug?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'products_workspace_id_created_by_fkey';
            columns: ['workspace_id', 'created_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'products_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'products_workspace_id_owner_id_fkey';
            columns: ['workspace_id', 'owner_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          initials: string | null;
          is_active: boolean;
          locale: string;
          updated_at: string;
        };
        Insert: {
          avatar_path?: string | null;
          created_at?: string;
          email: string;
          full_name: string;
          id: string;
          initials?: string | null;
          is_active?: boolean;
          locale?: string;
          updated_at?: string;
        };
        Update: {
          avatar_path?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          initials?: string | null;
          is_active?: boolean;
          locale?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      task_assignees: {
        Row: {
          assigned_at: string;
          assigned_by: string;
          is_primary: boolean;
          task_id: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          assigned_at?: string;
          assigned_by: string;
          is_primary?: boolean;
          task_id: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          assigned_at?: string;
          assigned_by?: string;
          is_primary?: boolean;
          task_id?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_assignees_workspace_id_assigned_by_fkey';
            columns: ['workspace_id', 'assigned_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'task_assignees_workspace_id_task_id_fkey';
            columns: ['workspace_id', 'task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'task_assignees_workspace_id_task_id_fkey';
            columns: ['workspace_id', 'task_id'];
            isOneToOne: false;
            referencedRelation: 'v_task_overview';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'task_assignees_workspace_id_user_id_fkey';
            columns: ['workspace_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
        ];
      };
      task_statuses: {
        Row: {
          color: string;
          created_at: string;
          id: string;
          is_active: boolean;
          is_closed: boolean | null;
          is_default: boolean;
          name: string;
          position: number;
          system_category: Database['public']['Enums']['task_status_category'];
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          is_closed?: boolean | null;
          is_default?: boolean;
          name: string;
          position?: number;
          system_category: Database['public']['Enums']['task_status_category'];
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          is_closed?: boolean | null;
          is_default?: boolean;
          name?: string;
          position?: number;
          system_category?: Database['public']['Enums']['task_status_category'];
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_statuses_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      task_types: {
        Row: {
          color: string;
          created_at: string;
          icon: string | null;
          id: string;
          is_active: boolean;
          name: string;
          position: number;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          icon?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          position?: number;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          icon?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          position?: number;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_types_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      tasks: {
        Row: {
          archived_at: string | null;
          archived_by: string | null;
          blocked_reason: string | null;
          completed_at: string | null;
          completed_by: string | null;
          created_at: string;
          created_by: string;
          description_json: Json;
          due_at: string | null;
          due_date: string | null;
          due_is_date_only: boolean | null;
          due_time: string | null;
          estimated_minutes: number | null;
          event_id: string | null;
          id: string;
          priority: Database['public']['Enums']['task_priority'];
          product_id: string | null;
          search_vector: unknown;
          status_id: string;
          task_number: number;
          title: string;
          type_id: string | null;
          updated_at: string;
          updated_by: string;
          version: number;
          week_position: number;
          workspace_id: string;
        };
        Insert: {
          archived_at?: string | null;
          archived_by?: string | null;
          blocked_reason?: string | null;
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string;
          created_by: string;
          description_json?: Json;
          due_at?: string | null;
          due_date?: string | null;
          due_is_date_only?: boolean | null;
          due_time?: string | null;
          estimated_minutes?: number | null;
          event_id?: string | null;
          id?: string;
          priority?: Database['public']['Enums']['task_priority'];
          product_id?: string | null;
          search_vector?: unknown;
          status_id: string;
          task_number: number;
          title: string;
          type_id?: string | null;
          updated_at?: string;
          updated_by: string;
          version?: number;
          week_position?: number;
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          archived_by?: string | null;
          blocked_reason?: string | null;
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string;
          created_by?: string;
          description_json?: Json;
          due_at?: string | null;
          due_date?: string | null;
          due_is_date_only?: boolean | null;
          due_time?: string | null;
          estimated_minutes?: number | null;
          event_id?: string | null;
          id?: string;
          priority?: Database['public']['Enums']['task_priority'];
          product_id?: string | null;
          search_vector?: unknown;
          status_id?: string;
          task_number?: number;
          title?: string;
          type_id?: string | null;
          updated_at?: string;
          updated_by?: string;
          version?: number;
          week_position?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tasks_workspace_id_archived_by_fkey';
            columns: ['workspace_id', 'archived_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'tasks_workspace_id_completed_by_fkey';
            columns: ['workspace_id', 'completed_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'tasks_workspace_id_created_by_fkey';
            columns: ['workspace_id', 'created_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'tasks_workspace_id_event_id_fkey';
            columns: ['workspace_id', 'event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'tasks_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_workspace_id_product_id_fkey';
            columns: ['workspace_id', 'product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'tasks_workspace_id_status_id_fkey';
            columns: ['workspace_id', 'status_id'];
            isOneToOne: false;
            referencedRelation: 'task_statuses';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'tasks_workspace_id_type_id_fkey';
            columns: ['workspace_id', 'type_id'];
            isOneToOne: false;
            referencedRelation: 'task_types';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'tasks_workspace_id_updated_by_fkey';
            columns: ['workspace_id', 'updated_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
        ];
      };
      workspace_counters: {
        Row: {
          entity_type: string;
          last_number: number;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          entity_type: string;
          last_number?: number;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          entity_type?: string;
          last_number?: number;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_counters_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspace_invitations: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          role: Database['public']['Enums']['workspace_role'];
          token_hash: string;
          workspace_id: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          email: string;
          expires_at: string;
          id?: string;
          invited_by: string;
          role?: Database['public']['Enums']['workspace_role'];
          token_hash: string;
          workspace_id: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          role?: Database['public']['Enums']['workspace_role'];
          token_hash?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_invitations_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workspace_invitations_workspace_id_invited_by_fkey';
            columns: ['workspace_id', 'invited_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
        ];
      };
      workspace_members: {
        Row: {
          created_at: string;
          joined_at: string;
          role: Database['public']['Enums']['workspace_role'];
          status: Database['public']['Enums']['membership_status'];
          suspended_at: string | null;
          user_id: string;
          weekly_capacity_minutes: number | null;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          joined_at?: string;
          role: Database['public']['Enums']['workspace_role'];
          status?: Database['public']['Enums']['membership_status'];
          suspended_at?: string | null;
          user_id: string;
          weekly_capacity_minutes?: number | null;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          joined_at?: string;
          role?: Database['public']['Enums']['workspace_role'];
          status?: Database['public']['Enums']['membership_status'];
          suspended_at?: string | null;
          user_id?: string;
          weekly_capacity_minutes?: number | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workspace_members_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspace_preferences: {
        Row: {
          credentials_enabled: boolean;
          notification_digest: boolean;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          credentials_enabled?: boolean;
          notification_digest?: boolean;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          credentials_enabled?: boolean;
          notification_digest?: boolean;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_preferences_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: true;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspaces: {
        Row: {
          accent_color: string;
          archived_at: string | null;
          created_at: string;
          created_by: string;
          default_due_time: string;
          id: string;
          locale: string;
          name: string;
          slug: string;
          task_prefix: string;
          timezone: string;
          updated_at: string;
          week_starts_on: number;
          working_days: number[];
        };
        Insert: {
          accent_color?: string;
          archived_at?: string | null;
          created_at?: string;
          created_by: string;
          default_due_time?: string;
          id?: string;
          locale?: string;
          name: string;
          slug: string;
          task_prefix?: string;
          timezone?: string;
          updated_at?: string;
          week_starts_on?: number;
          working_days?: number[];
        };
        Update: {
          accent_color?: string;
          archived_at?: string | null;
          created_at?: string;
          created_by?: string;
          default_due_time?: string;
          id?: string;
          locale?: string;
          name?: string;
          slug?: string;
          task_prefix?: string;
          timezone?: string;
          updated_at?: string;
          week_starts_on?: number;
          working_days?: number[];
        };
        Relationships: [
          {
            foreignKeyName: 'workspaces_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      v_task_overview: {
        Row: {
          created_at: string | null;
          created_by: string | null;
          due_date: string | null;
          due_is_date_only: boolean | null;
          due_time: string | null;
          id: string | null;
          primary_assignee_id: string | null;
          primary_assignee_name: string | null;
          priority: Database['public']['Enums']['task_priority'] | null;
          status_category:
            Database['public']['Enums']['task_status_category'] | null;
          status_color: string | null;
          status_id: string | null;
          status_name: string | null;
          task_key: string | null;
          task_number: number | null;
          title: string | null;
          updated_at: string | null;
          version: number | null;
          week_position: number | null;
          workspace_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'tasks_workspace_id_created_by_fkey';
            columns: ['workspace_id', 'created_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'tasks_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_workspace_id_status_id_fkey';
            columns: ['workspace_id', 'status_id'];
            isOneToOne: false;
            referencedRelation: 'task_statuses';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
    };
    Functions: {
      bootstrap_user_workspace: {
        Args: { p_name: string; p_slug: string; p_task_prefix?: string };
        Returns: string;
      };
      create_task: {
        Args: {
          p_due_date?: string;
          p_due_time?: string;
          p_primary_assignee_id?: string;
          p_priority?: Database['public']['Enums']['task_priority'];
          p_status_id?: string;
          p_title: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      get_task_detail: { Args: { p_task_id: string }; Returns: Json };
      move_task_to_day: {
        Args: {
          p_due_date: string;
          p_expected_version: number;
          p_position: number;
          p_task_id: string;
        };
        Returns: Json;
      };
      set_task_primary_assignee: {
        Args: {
          p_expected_version: number;
          p_task_id: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      update_task: {
        Args: { p_expected_version: number; p_patch: Json; p_task_id: string };
        Returns: Json;
      };
    };
    Enums: {
      membership_status: 'active' | 'suspended';
      task_priority: 'low' | 'medium' | 'high' | 'urgent';
      task_status_category:
        | 'backlog'
        | 'todo'
        | 'in_progress'
        | 'review'
        | 'blocked'
        | 'done'
        | 'cancelled';
      workspace_role: 'owner' | 'admin' | 'manager' | 'member' | 'viewer';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      membership_status: ['active', 'suspended'],
      task_priority: ['low', 'medium', 'high', 'urgent'],
      task_status_category: [
        'backlog',
        'todo',
        'in_progress',
        'review',
        'blocked',
        'done',
        'cancelled',
      ],
      workspace_role: ['owner', 'admin', 'manager', 'member', 'viewer'],
    },
  },
} as const;
