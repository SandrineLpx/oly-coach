export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      athlete_profiles: {
        Row: {
          cardio_preference: string | null
          created_at: string
          id: string
          name: string
          preferred_days: number[]
          program_start_date: string | null
          strava_connected: boolean
          training_age: number
          updated_at: string
          user_id: string
          weather_preference: string | null
        }
        Insert: {
          cardio_preference?: string | null
          created_at?: string
          id?: string
          name: string
          preferred_days?: number[]
          program_start_date?: string | null
          strava_connected?: boolean
          training_age?: number
          updated_at?: string
          user_id: string
          weather_preference?: string | null
        }
        Update: {
          cardio_preference?: string | null
          created_at?: string
          id?: string
          name?: string
          preferred_days?: number[]
          program_start_date?: string | null
          strava_connected?: boolean
          training_age?: number
          updated_at?: string
          user_id?: string
          weather_preference?: string | null
        }
        Relationships: []
      }
      body_weight_logs: {
        Row: {
          created_at: string
          id: string
          logged_at: string
          unit: string
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          logged_at?: string
          unit?: string
          user_id: string
          weight: number
        }
        Update: {
          created_at?: string
          id?: string
          logged_at?: string
          unit?: string
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      gym_settings: {
        Row: {
          coach_invite_code_hash: string | null
          id: number
          is_setup_complete: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          coach_invite_code_hash?: string | null
          id?: number
          is_setup_complete?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          coach_invite_code_hash?: string | null
          id?: number
          is_setup_complete?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      pr_history: {
        Row: {
          achieved_at: string
          created_at: string
          id: string
          lift_name: string
          unit: string
          user_id: string
          weight: number
        }
        Insert: {
          achieved_at?: string
          created_at?: string
          id?: string
          lift_name: string
          unit?: string
          user_id: string
          weight: number
        }
        Update: {
          achieved_at?: string
          created_at?: string
          id?: string
          lift_name?: string
          unit?: string
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      program_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          athlete_id: string
          completed_at: string | null
          current_week: number
          id: string
          is_active: boolean
          program_id: string
          start_date: string | null
          status: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          athlete_id: string
          completed_at?: string | null
          current_week?: number
          id?: string
          is_active?: boolean
          program_id: string
          start_date?: string | null
          status?: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          athlete_id?: string
          completed_at?: string | null
          current_week?: number
          id?: string
          is_active?: boolean
          program_id?: string
          start_date?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_assignments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_exercises: {
        Row: {
          id: string
          name: string
          notes: string | null
          order_index: number
          percent_of_max: number | null
          reps: string | null
          session_id: string
          sets: number | null
          weight: number | null
        }
        Insert: {
          id?: string
          name: string
          notes?: string | null
          order_index?: number
          percent_of_max?: number | null
          reps?: string | null
          session_id: string
          sets?: number | null
          weight?: number | null
        }
        Update: {
          id?: string
          name?: string
          notes?: string | null
          order_index?: number
          percent_of_max?: number | null
          reps?: string | null
          session_id?: string
          sets?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "program_exercises_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "program_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      program_sessions: {
        Row: {
          can_merge_into: string | null
          day_of_week: number
          droppable: boolean | null
          focus_label: string | null
          id: string
          name: string | null
          notes: string | null
          order_index: number
          priority: string | null
          program_id: string
          session_type: string
          week_number: number
        }
        Insert: {
          can_merge_into?: string | null
          day_of_week: number
          droppable?: boolean | null
          focus_label?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          order_index?: number
          priority?: string | null
          program_id: string
          session_type?: string
          week_number: number
        }
        Update: {
          can_merge_into?: string | null
          day_of_week?: number
          droppable?: boolean | null
          focus_label?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          order_index?: number
          priority?: string | null
          program_id?: string
          session_type?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_sessions_can_merge_into_fkey"
            columns: ["can_merge_into"]
            isOneToOne: false
            referencedRelation: "program_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_sessions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_template: boolean | null
          name: string
          phase_summary: Json | null
          published: boolean
          source: string | null
          start_date: string
          user_id: string
          weeks: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_template?: boolean | null
          name: string
          phase_summary?: Json | null
          published?: boolean
          source?: string | null
          start_date: string
          user_id: string
          weeks?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_template?: boolean | null
          name?: string
          phase_summary?: Json | null
          published?: boolean
          source?: string | null
          start_date?: string
          user_id?: string
          weeks?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekly_overrides: {
        Row: {
          athlete_id: string
          available_days: string[] | null
          created_at: string
          created_by: string | null
          dropped_sessions: Json | null
          id: string
          program_id: string
          session_assignments: Json | null
          week_number: number
        }
        Insert: {
          athlete_id: string
          available_days?: string[] | null
          created_at?: string
          created_by?: string | null
          dropped_sessions?: Json | null
          id?: string
          program_id: string
          session_assignments?: Json | null
          week_number: number
        }
        Update: {
          athlete_id?: string
          available_days?: string[] | null
          created_at?: string
          created_by?: string | null
          dropped_sessions?: Json | null
          id?: string
          program_id?: string
          session_assignments?: Json | null
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "weekly_overrides_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_exercise: {
        Args: { _session_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_program: {
        Args: { _program_id: string; _user_id: string }
        Returns: boolean
      }
      has_active_assignment: {
        Args: { _program_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_program_owner: {
        Args: { _program_id: string; _user_id: string }
        Returns: boolean
      }
      owns_exercise_session: {
        Args: { _session_id: string; _user_id: string }
        Returns: boolean
      }
      redeem_coach_code: { Args: { _plain_code: string }; Returns: Json }
      setup_gym_code: { Args: { _plain_code: string }; Returns: Json }
    }
    Enums: {
      app_role: "coach" | "athlete"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["coach", "athlete"],
    },
  },
} as const
