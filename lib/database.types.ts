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
    PostgrestVersion: '14.5';
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
      event_members: {
        Row: {
          added_at: string;
          added_by: string;
          event_id: string;
          role_label: string | null;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          added_at?: string;
          added_by: string;
          event_id: string;
          role_label?: string | null;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          added_at?: string;
          added_by?: string;
          event_id?: string;
          role_label?: string | null;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_members_workspace_id_added_by_fkey';
            columns: ['workspace_id', 'added_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'event_members_workspace_id_event_id_fkey';
            columns: ['workspace_id', 'event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'event_members_workspace_id_user_id_fkey';
            columns: ['workspace_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
        ];
      };
      event_milestones: {
        Row: {
          completed_at: string | null;
          created_at: string;
          created_by: string;
          due_date: string | null;
          event_id: string;
          event_phase_id: string | null;
          id: string;
          phase: string;
          position: number;
          title: string;
          updated_at: string;
          updated_by: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          created_by: string;
          due_date?: string | null;
          event_id: string;
          event_phase_id?: string | null;
          id?: string;
          phase?: string;
          position?: number;
          title: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
          workspace_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          created_by?: string;
          due_date?: string | null;
          event_id?: string;
          event_phase_id?: string | null;
          id?: string;
          phase?: string;
          position?: number;
          title?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_milestones_workspace_event_phase_fkey';
            columns: ['workspace_id', 'event_id', 'event_phase_id'];
            isOneToOne: false;
            referencedRelation: 'event_phases';
            referencedColumns: ['workspace_id', 'event_id', 'id'];
          },
          {
            foreignKeyName: 'event_milestones_workspace_id_created_by_fkey';
            columns: ['workspace_id', 'created_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'event_milestones_workspace_id_event_id_fkey';
            columns: ['workspace_id', 'event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'event_milestones_workspace_id_updated_by_fkey';
            columns: ['workspace_id', 'updated_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
        ];
      };
      event_phases: {
        Row: {
          archived_at: string | null;
          color: string;
          created_at: string;
          created_by: string;
          end_date: string | null;
          event_id: string;
          id: string;
          name: string;
          position: number;
          start_date: string | null;
          updated_at: string;
          updated_by: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          archived_at?: string | null;
          color?: string;
          created_at?: string;
          created_by: string;
          end_date?: string | null;
          event_id: string;
          id?: string;
          name: string;
          position?: number;
          start_date?: string | null;
          updated_at?: string;
          updated_by: string;
          version?: number;
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          color?: string;
          created_at?: string;
          created_by?: string;
          end_date?: string | null;
          event_id?: string;
          id?: string;
          name?: string;
          position?: number;
          start_date?: string | null;
          updated_at?: string;
          updated_by?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_phases_workspace_id_created_by_fkey';
            columns: ['workspace_id', 'created_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'event_phases_workspace_id_event_id_fkey';
            columns: ['workspace_id', 'event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'event_phases_workspace_id_updated_by_fkey';
            columns: ['workspace_id', 'updated_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
        ];
      };
      events: {
        Row: {
          archived_at: string | null;
          created_at: string;
          created_by: string;
          end_date: string | null;
          health_override: string | null;
          id: string;
          name: string;
          objective: string | null;
          owner_id: string | null;
          product_id: string | null;
          search_vector: unknown;
          slug: string;
          start_date: string | null;
          status: string;
          success_metric: string | null;
          summary: string | null;
          updated_at: string;
          updated_by: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          created_by: string;
          end_date?: string | null;
          health_override?: string | null;
          id?: string;
          name: string;
          objective?: string | null;
          owner_id?: string | null;
          product_id?: string | null;
          search_vector?: unknown;
          slug: string;
          start_date?: string | null;
          status?: string;
          success_metric?: string | null;
          summary?: string | null;
          updated_at?: string;
          updated_by: string;
          version?: number;
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string;
          end_date?: string | null;
          health_override?: string | null;
          id?: string;
          name?: string;
          objective?: string | null;
          owner_id?: string | null;
          product_id?: string | null;
          search_vector?: unknown;
          slug?: string;
          start_date?: string | null;
          status?: string;
          success_metric?: string | null;
          summary?: string | null;
          updated_at?: string;
          updated_by?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'events_updated_by_member_fk';
            columns: ['workspace_id', 'updated_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
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
          {
            foreignKeyName: 'events_workspace_project_board_column_fkey';
            columns: ['workspace_id', 'status'];
            isOneToOne: false;
            referencedRelation: 'project_board_columns';
            referencedColumns: ['workspace_id', 'column_key'];
          },
        ];
      };
      job_functions: {
        Row: {
          archived_at: string | null;
          archived_by: string | null;
          category: string;
          created_at: string;
          created_by: string;
          description: string | null;
          id: string;
          is_system: boolean;
          name: string;
          position: number;
          system_key: string | null;
          updated_at: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          archived_at?: string | null;
          archived_by?: string | null;
          category: string;
          created_at?: string;
          created_by: string;
          description?: string | null;
          id?: string;
          is_system?: boolean;
          name: string;
          position?: number;
          system_key?: string | null;
          updated_at?: string;
          version?: number;
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          archived_by?: string | null;
          category?: string;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          id?: string;
          is_system?: boolean;
          name?: string;
          position?: number;
          system_key?: string | null;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'job_functions_workspace_id_archived_by_fkey';
            columns: ['workspace_id', 'archived_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'job_functions_workspace_id_created_by_fkey';
            columns: ['workspace_id', 'created_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'job_functions_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
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
      product_members: {
        Row: {
          added_at: string;
          added_by: string;
          product_id: string;
          role_label: string | null;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          added_at?: string;
          added_by: string;
          product_id: string;
          role_label?: string | null;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          added_at?: string;
          added_by?: string;
          product_id?: string;
          role_label?: string | null;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'product_members_workspace_id_added_by_fkey';
            columns: ['workspace_id', 'added_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'product_members_workspace_id_product_id_fkey';
            columns: ['workspace_id', 'product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'product_members_workspace_id_user_id_fkey';
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
          search_vector: unknown;
          slug: string;
          status: string;
          updated_at: string;
          updated_by: string;
          version: number;
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
          search_vector?: unknown;
          slug: string;
          status?: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
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
          search_vector?: unknown;
          slug?: string;
          status?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'products_updated_by_member_fk';
            columns: ['workspace_id', 'updated_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
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
          bio: string | null;
          created_at: string;
          department: string | null;
          email: string;
          full_name: string;
          id: string;
          initials: string | null;
          is_active: boolean;
          job_title: string | null;
          locale: string;
          pronouns: string | null;
          search_vector: unknown;
          updated_at: string;
        };
        Insert: {
          avatar_path?: string | null;
          bio?: string | null;
          created_at?: string;
          department?: string | null;
          email: string;
          full_name: string;
          id: string;
          initials?: string | null;
          is_active?: boolean;
          job_title?: string | null;
          locale?: string;
          pronouns?: string | null;
          search_vector?: unknown;
          updated_at?: string;
        };
        Update: {
          avatar_path?: string | null;
          bio?: string | null;
          created_at?: string;
          department?: string | null;
          email?: string;
          full_name?: string;
          id?: string;
          initials?: string | null;
          is_active?: boolean;
          job_title?: string | null;
          locale?: string;
          pronouns?: string | null;
          search_vector?: unknown;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_board_columns: {
        Row: {
          color: string;
          column_key: string;
          cover_url: string | null;
          created_at: string;
          icon_key: string;
          name: string;
          position: number;
          updated_at: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          color: string;
          column_key: string;
          cover_url?: string | null;
          created_at?: string;
          icon_key: string;
          name: string;
          position: number;
          updated_at?: string;
          version?: number;
          workspace_id: string;
        };
        Update: {
          color?: string;
          column_key?: string;
          cover_url?: string | null;
          created_at?: string;
          icon_key?: string;
          name?: string;
          position?: number;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'project_board_columns_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      project_board_settings: {
        Row: {
          updated_at: string;
          updated_by: string | null;
          version: number;
          workspace_id: string;
        };
        Insert: {
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
          workspace_id: string;
        };
        Update: {
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'project_board_settings_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_board_settings_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: true;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      resource_categories: {
        Row: {
          archived_at: string | null;
          color: string;
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          position: number;
          slug: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          archived_at?: string | null;
          color?: string;
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          position?: number;
          slug: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          color?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          position?: number;
          slug?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'resource_categories_workspace_id_created_by_fkey';
            columns: ['workspace_id', 'created_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'resource_categories_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      resource_events: {
        Row: {
          created_at: string;
          created_by: string;
          event_id: string;
          resource_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          event_id: string;
          resource_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          event_id?: string;
          resource_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'resource_events_workspace_id_created_by_fkey';
            columns: ['workspace_id', 'created_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'resource_events_workspace_id_event_id_fkey';
            columns: ['workspace_id', 'event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'resource_events_workspace_id_resource_id_fkey';
            columns: ['workspace_id', 'resource_id'];
            isOneToOne: false;
            referencedRelation: 'resources';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      resource_favorites: {
        Row: {
          created_at: string;
          resource_id: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          resource_id: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          resource_id?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'resource_favorites_workspace_id_resource_id_fkey';
            columns: ['workspace_id', 'resource_id'];
            isOneToOne: false;
            referencedRelation: 'resources';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'resource_favorites_workspace_id_user_id_fkey';
            columns: ['workspace_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
        ];
      };
      resource_permissions: {
        Row: {
          created_at: string;
          granted_by: string;
          permission: Database['public']['Enums']['resource_permission_level'];
          resource_id: string;
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          granted_by: string;
          permission?: Database['public']['Enums']['resource_permission_level'];
          resource_id: string;
          updated_at?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          granted_by?: string;
          permission?: Database['public']['Enums']['resource_permission_level'];
          resource_id?: string;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'resource_permissions_workspace_id_granted_by_fkey';
            columns: ['workspace_id', 'granted_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'resource_permissions_workspace_id_resource_id_fkey';
            columns: ['workspace_id', 'resource_id'];
            isOneToOne: false;
            referencedRelation: 'resources';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'resource_permissions_workspace_id_user_id_fkey';
            columns: ['workspace_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
        ];
      };
      resource_products: {
        Row: {
          created_at: string;
          created_by: string;
          product_id: string;
          resource_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          product_id: string;
          resource_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          product_id?: string;
          resource_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'resource_products_workspace_id_created_by_fkey';
            columns: ['workspace_id', 'created_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'resource_products_workspace_id_product_id_fkey';
            columns: ['workspace_id', 'product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'resource_products_workspace_id_resource_id_fkey';
            columns: ['workspace_id', 'resource_id'];
            isOneToOne: false;
            referencedRelation: 'resources';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      resource_tags: {
        Row: {
          created_at: string;
          created_by: string;
          resource_id: string;
          tag_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          resource_id: string;
          tag_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          resource_id?: string;
          tag_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'resource_tags_workspace_id_created_by_fkey';
            columns: ['workspace_id', 'created_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'resource_tags_workspace_id_resource_id_fkey';
            columns: ['workspace_id', 'resource_id'];
            isOneToOne: false;
            referencedRelation: 'resources';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'resource_tags_workspace_id_tag_id_fkey';
            columns: ['workspace_id', 'tag_id'];
            isOneToOne: false;
            referencedRelation: 'tags';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      resource_tasks: {
        Row: {
          created_at: string;
          created_by: string;
          resource_id: string;
          task_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          resource_id: string;
          task_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          resource_id?: string;
          task_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'resource_tasks_workspace_id_created_by_fkey';
            columns: ['workspace_id', 'created_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'resource_tasks_workspace_id_resource_id_fkey';
            columns: ['workspace_id', 'resource_id'];
            isOneToOne: false;
            referencedRelation: 'resources';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'resource_tasks_workspace_id_task_id_fkey';
            columns: ['workspace_id', 'task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'resource_tasks_workspace_id_task_id_fkey';
            columns: ['workspace_id', 'task_id'];
            isOneToOne: false;
            referencedRelation: 'v_task_overview';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      resource_visits: {
        Row: {
          first_visited_at: string;
          last_visited_at: string;
          resource_id: string;
          user_id: string;
          visit_count: number;
          workspace_id: string;
        };
        Insert: {
          first_visited_at?: string;
          last_visited_at?: string;
          resource_id: string;
          user_id: string;
          visit_count?: number;
          workspace_id: string;
        };
        Update: {
          first_visited_at?: string;
          last_visited_at?: string;
          resource_id?: string;
          user_id?: string;
          visit_count?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'resource_visits_workspace_id_resource_id_fkey';
            columns: ['workspace_id', 'resource_id'];
            isOneToOne: false;
            referencedRelation: 'resources';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'resource_visits_workspace_id_user_id_fkey';
            columns: ['workspace_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
        ];
      };
      resources: {
        Row: {
          archived_at: string | null;
          archived_by: string | null;
          category_id: string | null;
          created_at: string;
          created_by: string;
          description: string | null;
          external_url: string;
          id: string;
          is_restricted: boolean;
          resource_type: Database['public']['Enums']['resource_type'];
          search_vector: unknown;
          title: string;
          updated_at: string;
          updated_by: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          archived_at?: string | null;
          archived_by?: string | null;
          category_id?: string | null;
          created_at?: string;
          created_by: string;
          description?: string | null;
          external_url: string;
          id?: string;
          is_restricted?: boolean;
          resource_type?: Database['public']['Enums']['resource_type'];
          search_vector?: unknown;
          title: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          archived_by?: string | null;
          category_id?: string | null;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          external_url?: string;
          id?: string;
          is_restricted?: boolean;
          resource_type?: Database['public']['Enums']['resource_type'];
          search_vector?: unknown;
          title?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'resources_workspace_id_archived_by_fkey';
            columns: ['workspace_id', 'archived_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'resources_workspace_id_category_id_fkey';
            columns: ['workspace_id', 'category_id'];
            isOneToOne: false;
            referencedRelation: 'resource_categories';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'resources_workspace_id_created_by_fkey';
            columns: ['workspace_id', 'created_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'resources_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'resources_workspace_id_updated_by_fkey';
            columns: ['workspace_id', 'updated_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
        ];
      };
      tags: {
        Row: {
          archived_at: string | null;
          color: string;
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          archived_at?: string | null;
          color?: string;
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          color?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tags_workspace_id_created_by_fkey';
            columns: ['workspace_id', 'created_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'tags_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      task_approval_requests: {
        Row: {
          approval_round: number;
          approver_id: string;
          decided_at: string | null;
          decided_by: string | null;
          decision: Database['public']['Enums']['task_approval_decision'];
          decision_comment: string | null;
          id: string;
          requested_at: string;
          requested_by: string;
          task_id: string;
          task_version: number;
          updated_at: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          approval_round: number;
          approver_id: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision?: Database['public']['Enums']['task_approval_decision'];
          decision_comment?: string | null;
          id?: string;
          requested_at?: string;
          requested_by: string;
          task_id: string;
          task_version: number;
          updated_at?: string;
          version?: number;
          workspace_id: string;
        };
        Update: {
          approval_round?: number;
          approver_id?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision?: Database['public']['Enums']['task_approval_decision'];
          decision_comment?: string | null;
          id?: string;
          requested_at?: string;
          requested_by?: string;
          task_id?: string;
          task_version?: number;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_approval_requests_workspace_id_approver_id_fkey';
            columns: ['workspace_id', 'approver_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'task_approval_requests_workspace_id_decided_by_fkey';
            columns: ['workspace_id', 'decided_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'task_approval_requests_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_approval_requests_workspace_id_requested_by_fkey';
            columns: ['workspace_id', 'requested_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'task_approval_requests_workspace_id_task_id_fkey';
            columns: ['workspace_id', 'task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'task_approval_requests_workspace_id_task_id_fkey';
            columns: ['workspace_id', 'task_id'];
            isOneToOne: false;
            referencedRelation: 'v_task_overview';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
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
      task_attachments: {
        Row: {
          bucket_id: string;
          created_at: string;
          delete_requested_at: string | null;
          delete_requested_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          file_extension: string;
          file_name: string;
          file_size: number;
          id: string;
          mime_type: string;
          object_path: string;
          ready_at: string | null;
          removal_lease_expires_at: string | null;
          removal_token: string | null;
          state: Database['public']['Enums']['task_attachment_state'];
          task_id: string;
          uploaded_by: string;
          workspace_id: string;
        };
        Insert: {
          bucket_id?: string;
          created_at?: string;
          delete_requested_at?: string | null;
          delete_requested_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          file_extension: string;
          file_name: string;
          file_size: number;
          id?: string;
          mime_type: string;
          object_path: string;
          ready_at?: string | null;
          removal_lease_expires_at?: string | null;
          removal_token?: string | null;
          state?: Database['public']['Enums']['task_attachment_state'];
          task_id: string;
          uploaded_by: string;
          workspace_id: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          delete_requested_at?: string | null;
          delete_requested_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          file_extension?: string;
          file_name?: string;
          file_size?: number;
          id?: string;
          mime_type?: string;
          object_path?: string;
          ready_at?: string | null;
          removal_lease_expires_at?: string | null;
          removal_token?: string | null;
          state?: Database['public']['Enums']['task_attachment_state'];
          task_id?: string;
          uploaded_by?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_attachments_workspace_id_delete_requested_by_fkey';
            columns: ['workspace_id', 'delete_requested_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'task_attachments_workspace_id_deleted_by_fkey';
            columns: ['workspace_id', 'deleted_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'task_attachments_workspace_id_task_id_fkey';
            columns: ['workspace_id', 'task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'task_attachments_workspace_id_task_id_fkey';
            columns: ['workspace_id', 'task_id'];
            isOneToOne: false;
            referencedRelation: 'v_task_overview';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'task_attachments_workspace_id_uploaded_by_fkey';
            columns: ['workspace_id', 'uploaded_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
        ];
      };
      task_board_settings: {
        Row: {
          board_kind: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
          workspace_id: string;
        };
        Insert: {
          board_kind: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
          workspace_id: string;
        };
        Update: {
          board_kind?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_board_settings_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_board_settings_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      task_checklist_items: {
        Row: {
          checklist_id: string;
          completed_at: string | null;
          completed_by: string | null;
          content: string;
          created_at: string;
          created_by: string;
          id: string;
          is_completed: boolean;
          position: number;
          task_id: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          checklist_id: string;
          completed_at?: string | null;
          completed_by?: string | null;
          content: string;
          created_at?: string;
          created_by: string;
          id?: string;
          is_completed?: boolean;
          position?: number;
          task_id: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          checklist_id?: string;
          completed_at?: string | null;
          completed_by?: string | null;
          content?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          is_completed?: boolean;
          position?: number;
          task_id?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_checklist_items_workspace_id_completed_by_fkey';
            columns: ['workspace_id', 'completed_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'task_checklist_items_workspace_id_created_by_fkey';
            columns: ['workspace_id', 'created_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'task_checklist_items_workspace_id_task_id_checklist_id_fkey';
            columns: ['workspace_id', 'task_id', 'checklist_id'];
            isOneToOne: false;
            referencedRelation: 'task_checklists';
            referencedColumns: ['workspace_id', 'task_id', 'id'];
          },
        ];
      };
      task_checklists: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          is_default: boolean;
          position: number;
          task_id: string;
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          is_default?: boolean;
          position?: number;
          task_id: string;
          title: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          is_default?: boolean;
          position?: number;
          task_id?: string;
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_checklists_workspace_id_created_by_fkey';
            columns: ['workspace_id', 'created_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'task_checklists_workspace_id_task_id_fkey';
            columns: ['workspace_id', 'task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'task_checklists_workspace_id_task_id_fkey';
            columns: ['workspace_id', 'task_id'];
            isOneToOne: false;
            referencedRelation: 'v_task_overview';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      task_comments: {
        Row: {
          body: string | null;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          deleted_by: string | null;
          edited_at: string | null;
          id: string;
          parent_comment_id: string | null;
          task_id: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          edited_at?: string | null;
          id?: string;
          parent_comment_id?: string | null;
          task_id: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          edited_at?: string | null;
          id?: string;
          parent_comment_id?: string | null;
          task_id?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_comments_parent_same_task';
            columns: ['workspace_id', 'task_id', 'parent_comment_id'];
            isOneToOne: false;
            referencedRelation: 'task_comments';
            referencedColumns: ['workspace_id', 'task_id', 'id'];
          },
          {
            foreignKeyName: 'task_comments_workspace_id_created_by_fkey';
            columns: ['workspace_id', 'created_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'task_comments_workspace_id_deleted_by_fkey';
            columns: ['workspace_id', 'deleted_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'task_comments_workspace_id_task_id_fkey';
            columns: ['workspace_id', 'task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'task_comments_workspace_id_task_id_fkey';
            columns: ['workspace_id', 'task_id'];
            isOneToOne: false;
            referencedRelation: 'v_task_overview';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      task_custom_field_definitions: {
        Row: {
          archived_at: string | null;
          archived_by: string | null;
          created_at: string;
          created_by: string;
          field_type: Database['public']['Enums']['task_custom_field_type'];
          id: string;
          name: string;
          position: number;
          updated_at: string;
          updated_by: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          archived_at?: string | null;
          archived_by?: string | null;
          created_at?: string;
          created_by: string;
          field_type: Database['public']['Enums']['task_custom_field_type'];
          id?: string;
          name: string;
          position?: number;
          updated_at?: string;
          updated_by: string;
          version?: number;
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          archived_by?: string | null;
          created_at?: string;
          created_by?: string;
          field_type?: Database['public']['Enums']['task_custom_field_type'];
          id?: string;
          name?: string;
          position?: number;
          updated_at?: string;
          updated_by?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_custom_field_definitions_workspace_id_created_by_fkey';
            columns: ['workspace_id', 'created_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'task_custom_field_definitions_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_custom_field_definitions_workspace_id_updated_by_fkey';
            columns: ['workspace_id', 'updated_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
        ];
      };
      task_custom_field_options: {
        Row: {
          archived_at: string | null;
          created_at: string;
          field_id: string;
          id: string;
          label: string;
          position: number;
          workspace_id: string;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          field_id: string;
          id?: string;
          label: string;
          position?: number;
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          field_id?: string;
          id?: string;
          label?: string;
          position?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_custom_field_options_workspace_id_field_id_fkey';
            columns: ['workspace_id', 'field_id'];
            isOneToOne: false;
            referencedRelation: 'task_custom_field_definitions';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      task_custom_field_values: {
        Row: {
          boolean_value: boolean | null;
          date_value: string | null;
          field_id: string;
          number_value: number | null;
          option_id: string | null;
          task_id: string;
          text_value: string | null;
          updated_at: string;
          updated_by: string;
          workspace_id: string;
        };
        Insert: {
          boolean_value?: boolean | null;
          date_value?: string | null;
          field_id: string;
          number_value?: number | null;
          option_id?: string | null;
          task_id: string;
          text_value?: string | null;
          updated_at?: string;
          updated_by: string;
          workspace_id: string;
        };
        Update: {
          boolean_value?: boolean | null;
          date_value?: string | null;
          field_id?: string;
          number_value?: number | null;
          option_id?: string | null;
          task_id?: string;
          text_value?: string | null;
          updated_at?: string;
          updated_by?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_custom_field_values_workspace_id_field_id_fkey';
            columns: ['workspace_id', 'field_id'];
            isOneToOne: false;
            referencedRelation: 'task_custom_field_definitions';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'task_custom_field_values_workspace_id_field_id_option_id_fkey';
            columns: ['workspace_id', 'field_id', 'option_id'];
            isOneToOne: false;
            referencedRelation: 'task_custom_field_options';
            referencedColumns: ['workspace_id', 'field_id', 'id'];
          },
          {
            foreignKeyName: 'task_custom_field_values_workspace_id_task_id_fkey';
            columns: ['workspace_id', 'task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'task_custom_field_values_workspace_id_task_id_fkey';
            columns: ['workspace_id', 'task_id'];
            isOneToOne: false;
            referencedRelation: 'v_task_overview';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'task_custom_field_values_workspace_id_updated_by_fkey';
            columns: ['workspace_id', 'updated_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
        ];
      };
      task_dependencies: {
        Row: {
          archived_at: string | null;
          archived_by: string | null;
          blocked_task_id: string;
          blocking_task_id: string;
          created_at: string;
          created_by: string;
          id: string;
          updated_at: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          archived_at?: string | null;
          archived_by?: string | null;
          blocked_task_id: string;
          blocking_task_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          updated_at?: string;
          version?: number;
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          archived_by?: string | null;
          blocked_task_id?: string;
          blocking_task_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_dependencies_workspace_id_archived_by_fkey';
            columns: ['workspace_id', 'archived_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'task_dependencies_workspace_id_blocked_task_id_fkey';
            columns: ['workspace_id', 'blocked_task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'task_dependencies_workspace_id_blocked_task_id_fkey';
            columns: ['workspace_id', 'blocked_task_id'];
            isOneToOne: false;
            referencedRelation: 'v_task_overview';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'task_dependencies_workspace_id_blocking_task_id_fkey';
            columns: ['workspace_id', 'blocking_task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'task_dependencies_workspace_id_blocking_task_id_fkey';
            columns: ['workspace_id', 'blocking_task_id'];
            isOneToOne: false;
            referencedRelation: 'v_task_overview';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'task_dependencies_workspace_id_created_by_fkey';
            columns: ['workspace_id', 'created_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'task_dependencies_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      task_handoffs: {
        Row: {
          from_team_id: string;
          id: string;
          initiated_at: string;
          initiated_by: string;
          note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          source_task_id: string;
          status: Database['public']['Enums']['task_handoff_status'];
          target_assignee_id: string | null;
          target_task_id: string;
          to_team_id: string;
          updated_at: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          from_team_id: string;
          id?: string;
          initiated_at?: string;
          initiated_by: string;
          note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          source_task_id: string;
          status?: Database['public']['Enums']['task_handoff_status'];
          target_assignee_id?: string | null;
          target_task_id: string;
          to_team_id: string;
          updated_at?: string;
          version?: number;
          workspace_id: string;
        };
        Update: {
          from_team_id?: string;
          id?: string;
          initiated_at?: string;
          initiated_by?: string;
          note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          source_task_id?: string;
          status?: Database['public']['Enums']['task_handoff_status'];
          target_assignee_id?: string | null;
          target_task_id?: string;
          to_team_id?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_handoffs_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_handoffs_workspace_id_from_team_id_fkey';
            columns: ['workspace_id', 'from_team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'task_handoffs_workspace_id_initiated_by_fkey';
            columns: ['workspace_id', 'initiated_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'task_handoffs_workspace_id_resolved_by_fkey';
            columns: ['workspace_id', 'resolved_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'task_handoffs_workspace_id_source_task_id_fkey';
            columns: ['workspace_id', 'source_task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'task_handoffs_workspace_id_source_task_id_fkey';
            columns: ['workspace_id', 'source_task_id'];
            isOneToOne: false;
            referencedRelation: 'v_task_overview';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'task_handoffs_workspace_id_target_assignee_id_fkey';
            columns: ['workspace_id', 'target_assignee_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'task_handoffs_workspace_id_target_task_id_fkey';
            columns: ['workspace_id', 'target_task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'task_handoffs_workspace_id_target_task_id_fkey';
            columns: ['workspace_id', 'target_task_id'];
            isOneToOne: false;
            referencedRelation: 'v_task_overview';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'task_handoffs_workspace_id_to_team_id_fkey';
            columns: ['workspace_id', 'to_team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      task_links: {
        Row: {
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          deleted_by: string | null;
          id: string;
          label: string | null;
          provider: string;
          task_id: string;
          updated_at: string;
          url: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          id?: string;
          label?: string | null;
          provider?: string;
          task_id: string;
          updated_at?: string;
          url: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          id?: string;
          label?: string | null;
          provider?: string;
          task_id?: string;
          updated_at?: string;
          url?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_links_deleted_by_member';
            columns: ['workspace_id', 'deleted_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'task_links_workspace_id_created_by_fkey';
            columns: ['workspace_id', 'created_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'task_links_workspace_id_task_id_fkey';
            columns: ['workspace_id', 'task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'task_links_workspace_id_task_id_fkey';
            columns: ['workspace_id', 'task_id'];
            isOneToOne: false;
            referencedRelation: 'v_task_overview';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      task_status_week_lane_links: {
        Row: {
          created_at: string;
          direction: string;
          status_id: string;
          updated_at: string;
          version: number;
          week_lane_key: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          direction?: string;
          status_id: string;
          updated_at?: string;
          version?: number;
          week_lane_key: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          direction?: string;
          status_id?: string;
          updated_at?: string;
          version?: number;
          week_lane_key?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_status_week_lane_links_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_status_week_lane_links_workspace_id_status_id_fkey';
            columns: ['workspace_id', 'status_id'];
            isOneToOne: true;
            referencedRelation: 'task_statuses';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'task_status_week_lane_links_workspace_id_week_lane_key_fkey';
            columns: ['workspace_id', 'week_lane_key'];
            isOneToOne: true;
            referencedRelation: 'task_week_lanes';
            referencedColumns: ['workspace_id', 'lane_key'];
          },
        ];
      };
      task_statuses: {
        Row: {
          color: string;
          cover_url: string | null;
          created_at: string;
          icon_key: string;
          id: string;
          is_active: boolean;
          is_closed: boolean | null;
          is_default: boolean;
          name: string;
          position: number;
          semantic_key: string;
          system_category: Database['public']['Enums']['task_status_category'];
          updated_at: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          color?: string;
          cover_url?: string | null;
          created_at?: string;
          icon_key?: string;
          id?: string;
          is_active?: boolean;
          is_closed?: boolean | null;
          is_default?: boolean;
          name: string;
          position?: number;
          semantic_key: string;
          system_category: Database['public']['Enums']['task_status_category'];
          updated_at?: string;
          version?: number;
          workspace_id: string;
        };
        Update: {
          color?: string;
          cover_url?: string | null;
          created_at?: string;
          icon_key?: string;
          id?: string;
          is_active?: boolean;
          is_closed?: boolean | null;
          is_default?: boolean;
          name?: string;
          position?: number;
          semantic_key?: string;
          system_category?: Database['public']['Enums']['task_status_category'];
          updated_at?: string;
          version?: number;
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
      task_subtasks: {
        Row: {
          child_task_id: string;
          created_at: string;
          created_by: string;
          parent_task_id: string;
          workspace_id: string;
        };
        Insert: {
          child_task_id: string;
          created_at?: string;
          created_by: string;
          parent_task_id: string;
          workspace_id: string;
        };
        Update: {
          child_task_id?: string;
          created_at?: string;
          created_by?: string;
          parent_task_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_subtasks_workspace_id_child_task_id_fkey';
            columns: ['workspace_id', 'child_task_id'];
            isOneToOne: true;
            referencedRelation: 'tasks';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'task_subtasks_workspace_id_child_task_id_fkey';
            columns: ['workspace_id', 'child_task_id'];
            isOneToOne: true;
            referencedRelation: 'v_task_overview';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'task_subtasks_workspace_id_created_by_fkey';
            columns: ['workspace_id', 'created_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'task_subtasks_workspace_id_parent_task_id_fkey';
            columns: ['workspace_id', 'parent_task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'task_subtasks_workspace_id_parent_task_id_fkey';
            columns: ['workspace_id', 'parent_task_id'];
            isOneToOne: false;
            referencedRelation: 'v_task_overview';
            referencedColumns: ['workspace_id', 'id'];
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
      task_week_lanes: {
        Row: {
          color: string;
          cover_url: string | null;
          created_at: string;
          icon_key: string;
          is_active: boolean;
          is_system: boolean;
          lane_key: string;
          name: string;
          position: number;
          updated_at: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          color?: string;
          cover_url?: string | null;
          created_at?: string;
          icon_key?: string;
          is_active?: boolean;
          is_system?: boolean;
          lane_key: string;
          name: string;
          position?: number;
          updated_at?: string;
          version?: number;
          workspace_id: string;
        };
        Update: {
          color?: string;
          cover_url?: string | null;
          created_at?: string;
          icon_key?: string;
          is_active?: boolean;
          is_system?: boolean;
          lane_key?: string;
          name?: string;
          position?: number;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_week_lanes_workspace_id_fkey';
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
          board_position: number;
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
          event_phase_id: string | null;
          id: string;
          priority: Database['public']['Enums']['task_priority'];
          product_id: string | null;
          requester_id: string;
          search_vector: unknown;
          start_date: string | null;
          start_time: string | null;
          status_id: string;
          task_number: number;
          team_id: string;
          title: string;
          type_id: string | null;
          updated_at: string;
          updated_by: string;
          version: number;
          week_lane: string;
          week_position: number;
          workspace_id: string;
        };
        Insert: {
          archived_at?: string | null;
          archived_by?: string | null;
          blocked_reason?: string | null;
          board_position?: number;
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
          event_phase_id?: string | null;
          id?: string;
          priority?: Database['public']['Enums']['task_priority'];
          product_id?: string | null;
          requester_id: string;
          search_vector?: unknown;
          start_date?: string | null;
          start_time?: string | null;
          status_id: string;
          task_number: number;
          team_id: string;
          title: string;
          type_id?: string | null;
          updated_at?: string;
          updated_by: string;
          version?: number;
          week_lane?: string;
          week_position?: number;
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          archived_by?: string | null;
          blocked_reason?: string | null;
          board_position?: number;
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
          event_phase_id?: string | null;
          id?: string;
          priority?: Database['public']['Enums']['task_priority'];
          product_id?: string | null;
          requester_id?: string;
          search_vector?: unknown;
          start_date?: string | null;
          start_time?: string | null;
          status_id?: string;
          task_number?: number;
          team_id?: string;
          title?: string;
          type_id?: string | null;
          updated_at?: string;
          updated_by?: string;
          version?: number;
          week_lane?: string;
          week_position?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tasks_requester_workspace_fk';
            columns: ['workspace_id', 'requester_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'tasks_team_workspace_fk';
            columns: ['workspace_id', 'team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'tasks_workspace_event_phase_fkey';
            columns: ['workspace_id', 'event_id', 'event_phase_id'];
            isOneToOne: false;
            referencedRelation: 'event_phases';
            referencedColumns: ['workspace_id', 'event_id', 'id'];
          },
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
          {
            foreignKeyName: 'tasks_workspace_week_lane_fkey';
            columns: ['workspace_id', 'week_lane'];
            isOneToOne: false;
            referencedRelation: 'task_week_lanes';
            referencedColumns: ['workspace_id', 'lane_key'];
          },
        ];
      };
      team_member_functions: {
        Row: {
          archived_at: string | null;
          archived_by: string | null;
          assigned_at: string;
          assigned_by: string;
          is_primary: boolean;
          job_function_id: string;
          team_id: string;
          updated_at: string;
          user_id: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          archived_at?: string | null;
          archived_by?: string | null;
          assigned_at?: string;
          assigned_by: string;
          is_primary?: boolean;
          job_function_id: string;
          team_id: string;
          updated_at?: string;
          user_id: string;
          version?: number;
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          archived_by?: string | null;
          assigned_at?: string;
          assigned_by?: string;
          is_primary?: boolean;
          job_function_id?: string;
          team_id?: string;
          updated_at?: string;
          user_id?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'team_member_functions_workspace_id_archived_by_fkey';
            columns: ['workspace_id', 'archived_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'team_member_functions_workspace_id_assigned_by_fkey';
            columns: ['workspace_id', 'assigned_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'team_member_functions_workspace_id_job_function_id_fkey';
            columns: ['workspace_id', 'job_function_id'];
            isOneToOne: false;
            referencedRelation: 'job_functions';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'team_member_functions_workspace_id_team_id_user_id_fkey';
            columns: ['workspace_id', 'team_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'team_members';
            referencedColumns: ['workspace_id', 'team_id', 'user_id'];
          },
        ];
      };
      team_members: {
        Row: {
          added_by: string;
          is_primary: boolean;
          joined_at: string;
          removed_at: string | null;
          removed_by: string | null;
          role: Database['public']['Enums']['team_member_role'];
          team_id: string;
          updated_at: string;
          user_id: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          added_by: string;
          is_primary?: boolean;
          joined_at?: string;
          removed_at?: string | null;
          removed_by?: string | null;
          role?: Database['public']['Enums']['team_member_role'];
          team_id: string;
          updated_at?: string;
          user_id: string;
          version?: number;
          workspace_id: string;
        };
        Update: {
          added_by?: string;
          is_primary?: boolean;
          joined_at?: string;
          removed_at?: string | null;
          removed_by?: string | null;
          role?: Database['public']['Enums']['team_member_role'];
          team_id?: string;
          updated_at?: string;
          user_id?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'team_members_workspace_id_added_by_fkey';
            columns: ['workspace_id', 'added_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'team_members_workspace_id_removed_by_fkey';
            columns: ['workspace_id', 'removed_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'team_members_workspace_id_team_id_fkey';
            columns: ['workspace_id', 'team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'team_members_workspace_id_user_id_fkey';
            columns: ['workspace_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
        ];
      };
      teams: {
        Row: {
          archived_at: string | null;
          archived_by: string | null;
          color: string;
          created_at: string;
          created_by: string;
          description: string | null;
          id: string;
          is_default: boolean;
          name: string;
          slug: string;
          updated_at: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          archived_at?: string | null;
          archived_by?: string | null;
          color?: string;
          created_at?: string;
          created_by: string;
          description?: string | null;
          id?: string;
          is_default?: boolean;
          name: string;
          slug: string;
          updated_at?: string;
          version?: number;
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          archived_by?: string | null;
          color?: string;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          id?: string;
          is_default?: boolean;
          name?: string;
          slug?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'teams_workspace_id_archived_by_fkey';
            columns: ['workspace_id', 'archived_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'teams_workspace_id_created_by_fkey';
            columns: ['workspace_id', 'created_by'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'teams_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
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
          accepted_by: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          role: Database['public']['Enums']['workspace_role'];
          token_hash: string;
          updated_at: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          email: string;
          expires_at: string;
          id?: string;
          invited_by: string;
          role?: Database['public']['Enums']['workspace_role'];
          token_hash: string;
          updated_at?: string;
          version?: number;
          workspace_id: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          role?: Database['public']['Enums']['workspace_role'];
          token_hash?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_invitations_accepted_by_fkey';
            columns: ['accepted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workspace_invitations_cancelled_by_fkey';
            columns: ['cancelled_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
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
          removed_at: string | null;
          removed_by: string | null;
          role: Database['public']['Enums']['workspace_role'];
          status: Database['public']['Enums']['membership_status'];
          suspended_at: string | null;
          updated_at: string;
          user_id: string;
          version: number;
          weekly_capacity_minutes: number | null;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          joined_at?: string;
          removed_at?: string | null;
          removed_by?: string | null;
          role: Database['public']['Enums']['workspace_role'];
          status?: Database['public']['Enums']['membership_status'];
          suspended_at?: string | null;
          updated_at?: string;
          user_id: string;
          version?: number;
          weekly_capacity_minutes?: number | null;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          joined_at?: string;
          removed_at?: string | null;
          removed_by?: string | null;
          role?: Database['public']['Enums']['workspace_role'];
          status?: Database['public']['Enums']['membership_status'];
          suspended_at?: string | null;
          updated_at?: string;
          user_id?: string;
          version?: number;
          weekly_capacity_minutes?: number | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_members_removed_by_fkey';
            columns: ['removed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
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
          version: number;
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
          version?: number;
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
          version?: number;
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
          board_position: number | null;
          checklist_completed: number | null;
          checklist_total: number | null;
          comment_count: number | null;
          created_at: string | null;
          created_by: string | null;
          description_preview: string | null;
          due_at: string | null;
          due_date: string | null;
          due_is_date_only: boolean | null;
          due_time: string | null;
          event_id: string | null;
          event_name: string | null;
          id: string | null;
          primary_assignee_id: string | null;
          primary_assignee_name: string | null;
          priority: Database['public']['Enums']['task_priority'] | null;
          product_id: string | null;
          product_name: string | null;
          status_category:
            Database['public']['Enums']['task_status_category'] | null;
          status_color: string | null;
          status_id: string | null;
          status_name: string | null;
          task_key: string | null;
          task_number: number | null;
          title: string | null;
          type_id: string | null;
          type_name: string | null;
          updated_at: string | null;
          version: number | null;
          week_lane: string | null;
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
            foreignKeyName: 'tasks_workspace_week_lane_fkey';
            columns: ['workspace_id', 'week_lane'];
            isOneToOne: false;
            referencedRelation: 'task_week_lanes';
            referencedColumns: ['workspace_id', 'lane_key'];
          },
        ];
      };
    };
    Functions: {
      accept_workspace_invitation: { Args: { p_token: string }; Returns: Json };
      add_task_checklist_item: {
        Args: {
          p_checklist_id: string;
          p_content: string;
          p_position?: number;
        };
        Returns: Json;
      };
      add_task_checklist_item_to_task: {
        Args: { p_content: string; p_task_id: string };
        Returns: Json;
      };
      add_task_comment: {
        Args: {
          p_body: string;
          p_parent_comment_id?: string;
          p_task_id: string;
        };
        Returns: Json;
      };
      add_task_link: {
        Args: { p_label?: string; p_task_id: string; p_url: string };
        Returns: Json;
      };
      archive_event_phase: {
        Args: {
          p_expected_version: number;
          p_phase_id: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      archive_job_function: {
        Args: { p_expected_version: number; p_job_function_id: string };
        Returns: Json;
      };
      archive_operating_team: {
        Args: { p_expected_version: number; p_team_id: string };
        Returns: Json;
      };
      archive_resource: {
        Args: { p_expected_version: number; p_resource_id: string };
        Returns: Json;
      };
      archive_resource_category: {
        Args: { p_category_id: string; p_expected_updated_at: string };
        Returns: Json;
      };
      begin_remove_task_attachment: {
        Args: { p_attachment_id: string };
        Returns: Json;
      };
      bootstrap_user_workspace: {
        Args: { p_name: string; p_slug: string; p_task_prefix?: string };
        Returns: string;
      };
      cancel_task_attachment_removal: {
        Args: { p_attachment_id: string; p_removal_token: string };
        Returns: Json;
      };
      cancel_workspace_invitation: {
        Args: { p_invitation_id: string };
        Returns: Json;
      };
      change_workspace_member_role: {
        Args: {
          p_expected_version: number;
          p_role: Database['public']['Enums']['workspace_role'];
          p_user_id: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      complete_task_attachment: {
        Args: { p_attachment_id: string };
        Returns: Json;
      };
      create_context_task: {
        Args: {
          p_context_id: string;
          p_context_type: string;
          p_due_date?: string;
          p_primary_assignee_id?: string;
          p_priority?: Database['public']['Enums']['task_priority'];
          p_status_id?: string;
          p_title: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      create_event_milestone: {
        Args: {
          p_due_date?: string | null;
          p_event_id: string;
          p_phase?: string;
          p_title: string;
        };
        Returns: Json;
      };
      create_event_milestone_in_phase: {
        Args: {
          p_due_date?: string | null;
          p_event_id: string;
          p_event_phase_id: string | null;
          p_title: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      create_event_operational: {
        Args: {
          p_end_date?: string;
          p_member_ids?: string[];
          p_name: string;
          p_objective?: string;
          p_owner_id?: string;
          p_product_id?: string;
          p_start_date?: string;
          p_status?: string;
          p_success_metric?: string;
          p_summary?: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      create_event_phase: {
        Args: {
          p_color?: string;
          p_end_date?: string;
          p_event_id: string;
          p_name: string;
          p_start_date?: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      create_global_task: {
        Args: {
          p_blocked_reason?: string;
          p_description?: Json;
          p_due_date?: string;
          p_due_time?: string;
          p_event_id?: string;
          p_primary_assignee_id?: string;
          p_priority?: Database['public']['Enums']['task_priority'];
          p_product_id?: string;
          p_status_id?: string;
          p_title: string;
          p_type_id?: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      create_operating_team: {
        Args: {
          p_color?: string;
          p_description?: string;
          p_name: string;
          p_slug: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      create_product_operational: {
        Args: {
          p_description?: string;
          p_member_ids?: string[];
          p_name: string;
          p_owner_id?: string;
          p_status?: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      create_resource: {
        Args: {
          p_category_id?: string;
          p_description?: string;
          p_event_ids?: string[];
          p_external_url: string;
          p_is_restricted?: boolean;
          p_permissions?: Json;
          p_product_ids?: string[];
          p_resource_type?: Database['public']['Enums']['resource_type'];
          p_tag_ids?: string[];
          p_task_ids?: string[];
          p_title: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      create_resource_category: {
        Args: { p_color?: string; p_name: string; p_workspace_id: string };
        Returns: Json;
      };
      create_resource_tag: {
        Args: { p_color?: string; p_name: string; p_workspace_id: string };
        Returns: Json;
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
      create_task_checklist: {
        Args: { p_position?: number; p_task_id: string; p_title: string };
        Returns: Json;
      };
      create_task_custom_field: {
        Args: {
          p_field_type: Database['public']['Enums']['task_custom_field_type'];
          p_name: string;
          p_options?: string[];
          p_workspace_id: string;
        };
        Returns: Json;
      };
      create_task_subtask: {
        Args: {
          p_blocked_reason?: string;
          p_description?: Json;
          p_due_date?: string;
          p_due_time?: string;
          p_event_id?: string;
          p_parent_task_id: string;
          p_primary_assignee_id?: string;
          p_priority?: Database['public']['Enums']['task_priority'];
          p_product_id?: string;
          p_status_id?: string;
          p_title: string;
          p_type_id?: string;
        };
        Returns: Json;
      };
      create_workspace_invitation: {
        Args: {
          p_email: string;
          p_expires_in_days?: number;
          p_role: Database['public']['Enums']['workspace_role'];
          p_workspace_id: string;
        };
        Returns: Json;
      };
      delete_event_milestone: {
        Args: {
          p_expected_version: number;
          p_milestone_id: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      delete_task_comment: { Args: { p_comment_id: string }; Returns: Json };
      finalize_remove_task_attachment: {
        Args: { p_attachment_id: string; p_removal_token: string };
        Returns: Json;
      };
      get_event_operational: { Args: { p_event_id: string }; Returns: Json };
      get_product_operational: {
        Args: { p_product_id: string };
        Returns: Json;
      };
      get_project_board_configuration: {
        Args: { p_workspace_id: string };
        Returns: Json;
      };
      get_project_timeline: {
        Args: { p_event_id: string; p_workspace_id: string };
        Returns: Json;
      };
      get_resource_detail: { Args: { p_resource_id: string }; Returns: Json };
      get_task_board_configuration: {
        Args: { p_workspace_id: string };
        Returns: Json;
      };
      get_task_detail: { Args: { p_task_id: string }; Returns: Json };
      get_workspace_settings: {
        Args: { p_workspace_id: string };
        Returns: Json;
      };
      inspect_workspace_invitation: {
        Args: { p_token: string };
        Returns: Json;
      };
      list_events_operational: {
        Args: { p_workspace_id: string };
        Returns: Json;
      };
      list_products_operational: {
        Args: { p_workspace_id: string };
        Returns: Json;
      };
      list_resource_categories: {
        Args: { p_workspace_id: string };
        Returns: Json;
      };
      list_resources: {
        Args: {
          p_category_id?: string;
          p_include_archived?: boolean;
          p_limit?: number;
          p_offset?: number;
          p_only_favorites?: boolean;
          p_only_recent?: boolean;
          p_query?: string;
          p_resource_type?: Database['public']['Enums']['resource_type'];
          p_workspace_id: string;
        };
        Returns: Json;
      };
      list_task_activity: {
        Args: { p_workspace_id: string };
        Returns: {
          action: string;
          activity_id: string;
          actor_id: string;
          actor_name: string;
          created_at: string;
          subject_name: string;
          subject_user_id: string;
          task_archived: boolean;
          task_id: string;
          task_number: number;
          task_title: string;
        }[];
      };
      list_task_attachments: { Args: { p_task_id: string }; Returns: Json };
      list_task_comments: {
        Args: {
          p_cursor_created_at?: string;
          p_cursor_id?: string;
          p_limit?: number;
          p_task_id: string;
        };
        Returns: Json;
      };
      list_team_members: {
        Args: { p_workspace_id: string };
        Returns: {
          full_name: string;
          initials: string;
          joined_at: string;
          role: Database['public']['Enums']['workspace_role'];
          user_id: string;
          weekly_capacity_minutes: number;
        }[];
      };
      list_workspace_operating_model: {
        Args: { p_workspace_id: string };
        Returns: Json;
      };
      list_workspace_team_management: {
        Args: { p_workspace_id: string };
        Returns: Json;
      };
      move_event_milestone_in_timeline: {
        Args: {
          p_due_date: string | null;
          p_event_phase_id: string | null;
          p_expected_version: number;
          p_milestone_id: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      move_task_in_board: {
        Args: {
          p_after_task_id: string | null;
          p_before_task_id: string | null;
          p_blocked_reason?: string | null;
          p_expected_version: number;
          p_status_id: string;
          p_task_id: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      move_task_in_timeline: {
        Args: {
          p_due_date: string | null;
          p_due_time: string | null;
          p_event_id: string;
          p_event_phase_id: string | null;
          p_expected_version: number;
          p_start_date: string | null;
          p_start_time: string | null;
          p_status_id: string;
          p_task_id: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      move_task_in_week: {
        Args: {
          p_due_date: string | null;
          p_expected_version: number;
          p_position: number;
          p_task_id: string;
          p_week_lane: string;
        };
        Returns: Json;
      };
      move_task_to_day: {
        Args: {
          p_due_date: string;
          p_expected_version: number;
          p_position: number;
          p_task_id: string;
        };
        Returns: Json;
      };
      prepare_task_attachment: {
        Args: {
          p_file_extension: string;
          p_file_name: string;
          p_file_size: number;
          p_mime_type: string;
          p_task_id: string;
        };
        Returns: Json;
      };
      reactivate_workspace_member: {
        Args: {
          p_expected_version: number;
          p_user_id: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      record_resource_visit: { Args: { p_resource_id: string }; Returns: Json };
      remove_task_checklist: {
        Args: { p_checklist_id: string; p_expected_updated_at: string };
        Returns: Json;
      };
      remove_task_checklist_item: {
        Args: { p_expected_updated_at: string; p_item_id: string };
        Returns: Json;
      };
      remove_task_link: { Args: { p_link_id: string }; Returns: Json };
      remove_team_member: {
        Args: {
          p_expected_version: number;
          p_team_id: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      remove_workspace_member: {
        Args: {
          p_expected_version: number;
          p_user_id: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      reorder_project_board_columns: {
        Args: {
          p_expected_board_version: number;
          p_ordered_keys: string[];
          p_workspace_id: string;
        };
        Returns: Json;
      };
      reorder_resource_categories: {
        Args: {
          p_category_ids: string[];
          p_expected_snapshot: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      reorder_task_board_columns: {
        Args: {
          p_board_kind: string;
          p_expected_board_version: number;
          p_ordered_keys: string[];
          p_workspace_id: string;
        };
        Returns: Json;
      };
      save_job_function: {
        Args: {
          p_category: string;
          p_description?: string;
          p_expected_version: number;
          p_job_function_id: string;
          p_name: string;
          p_position?: number;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      search_resource_relation_options: {
        Args: {
          p_entity_type: string;
          p_limit?: number;
          p_query?: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      search_workspace: {
        Args: {
          p_limit_per_group?: number;
          p_query: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      set_resource_favorite: {
        Args: { p_is_favorite: boolean; p_resource_id: string };
        Returns: Json;
      };
      set_task_board_lane_link: {
        Args: {
          p_direction: string;
          p_enabled: boolean;
          p_expected_board_version: number;
          p_status_id: string;
          p_week_lane_key: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      set_task_card_archived: {
        Args: {
          p_archived: boolean;
          p_expected_version: number;
          p_task_id: string;
          p_workspace_id: string;
        };
        Returns: number;
      };
      set_task_custom_field_value: {
        Args: {
          p_expected_task_version: number;
          p_field_id: string;
          p_task_id: string;
          p_value: Json;
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
      set_team_member_functions: {
        Args: {
          p_expected_team_member_version: number;
          p_job_function_ids: string[];
          p_primary_job_function_id: string;
          p_team_id: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      suspend_workspace_member: {
        Args: {
          p_expected_version: number;
          p_user_id: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      toggle_event_milestone: {
        Args: {
          p_completed: boolean;
          p_expected_version: number;
          p_milestone_id: string;
        };
        Returns: Json;
      };
      toggle_task_checklist_item: {
        Args: { p_is_completed: boolean; p_item_id: string };
        Returns: Json;
      };
      transfer_workspace_ownership: {
        Args: {
          p_expected_new_owner_version: number;
          p_expected_owner_version: number;
          p_new_owner_id: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      unlink_task_subtask: {
        Args: {
          p_child_task_id: string;
          p_expected_parent_version: number;
          p_parent_task_id: string;
        };
        Returns: Json;
      };
      update_event_milestone: {
        Args: {
          p_expected_version: number;
          p_milestone_id: string;
          p_patch: Json;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      update_event_operational: {
        Args: {
          p_event_id: string;
          p_expected_version: number;
          p_member_ids?: string[];
          p_patch: Json;
        };
        Returns: Json;
      };
      update_event_phase: {
        Args: {
          p_expected_version: number;
          p_patch: Json;
          p_phase_id: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      update_operating_team: {
        Args: { p_expected_version: number; p_patch: Json; p_team_id: string };
        Returns: Json;
      };
      update_own_profile: {
        Args: {
          p_avatar_path: string | null;
          p_bio: string | null;
          p_department: string | null;
          p_expected_updated_at: string;
          p_full_name: string;
          p_job_title: string | null;
          p_pronouns: string | null;
        };
        Returns: Json;
      };
      update_product_operational: {
        Args: {
          p_expected_version: number;
          p_member_ids?: string[];
          p_patch: Json;
          p_product_id: string;
        };
        Returns: Json;
      };
      update_project_board_column: {
        Args: {
          p_color: string;
          p_column_key: string;
          p_cover_url?: string;
          p_expected_board_version: number;
          p_expected_column_version: number;
          p_icon_key: string;
          p_name: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      update_resource: {
        Args: {
          p_expected_version: number;
          p_patch: Json;
          p_resource_id: string;
        };
        Returns: Json;
      };
      update_resource_category: {
        Args: {
          p_category_id: string;
          p_color: string;
          p_expected_updated_at: string;
          p_name: string;
        };
        Returns: Json;
      };
      update_task: {
        Args: { p_expected_version: number; p_patch: Json; p_task_id: string };
        Returns: Json;
      };
      update_task_board_column: {
        Args: {
          p_board_kind: string;
          p_color: string;
          p_column_key: string;
          p_cover_url?: string;
          p_expected_board_version: number;
          p_expected_column_version: number;
          p_icon_key: string;
          p_name: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      update_task_checklist: {
        Args: {
          p_checklist_id: string;
          p_expected_updated_at: string;
          p_title: string;
        };
        Returns: Json;
      };
      update_task_checklist_item: {
        Args: {
          p_content: string;
          p_expected_updated_at: string;
          p_item_id: string;
        };
        Returns: Json;
      };
      update_task_comment: {
        Args: { p_body: string; p_comment_id: string };
        Returns: Json;
      };
      update_task_description: {
        Args: {
          p_description: Json;
          p_expected_version: number;
          p_task_id: string;
        };
        Returns: Json;
      };
      update_task_link: {
        Args: { p_label?: string; p_link_id: string; p_url: string };
        Returns: Json;
      };
      update_workspace_settings: {
        Args: {
          p_accent_color: string;
          p_default_due_time: string;
          p_expected_version: number;
          p_name: string;
          p_notification_digest: boolean;
          p_task_prefix: string;
          p_timezone: string;
          p_week_starts_on: number;
          p_working_days: number[];
          p_workspace_id: string;
        };
        Returns: Json;
      };
      upsert_team_member: {
        Args: {
          p_expected_version?: number;
          p_is_primary?: boolean;
          p_role?: Database['public']['Enums']['team_member_role'];
          p_team_id: string;
          p_user_id: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      membership_status: 'active' | 'suspended';
      resource_permission_level: 'view' | 'edit';
      resource_type:
        | 'link'
        | 'document'
        | 'folder'
        | 'system'
        | 'dashboard'
        | 'page'
        | 'creative'
        | 'video';
      task_approval_decision:
        'pending' | 'approved' | 'changes_requested' | 'rejected' | 'cancelled';
      task_attachment_state: 'pending' | 'ready' | 'deleting' | 'deleted';
      task_custom_field_type:
        'text' | 'number' | 'date' | 'boolean' | 'single_select';
      task_handoff_status: 'pending' | 'accepted' | 'declined' | 'cancelled';
      task_priority: 'low' | 'medium' | 'high' | 'urgent';
      task_status_category:
        | 'backlog'
        | 'todo'
        | 'in_progress'
        | 'review'
        | 'blocked'
        | 'done'
        | 'cancelled';
      team_member_role: 'lead' | 'member';
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
      resource_permission_level: ['view', 'edit'],
      resource_type: [
        'link',
        'document',
        'folder',
        'system',
        'dashboard',
        'page',
        'creative',
        'video',
      ],
      task_approval_decision: [
        'pending',
        'approved',
        'changes_requested',
        'rejected',
        'cancelled',
      ],
      task_attachment_state: ['pending', 'ready', 'deleting', 'deleted'],
      task_custom_field_type: [
        'text',
        'number',
        'date',
        'boolean',
        'single_select',
      ],
      task_handoff_status: ['pending', 'accepted', 'declined', 'cancelled'],
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
      team_member_role: ['lead', 'member'],
      workspace_role: ['owner', 'admin', 'manager', 'member', 'viewer'],
    },
  },
} as const;
