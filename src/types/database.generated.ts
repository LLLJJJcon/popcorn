export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      attempts: {
        Row: {
          accuracy_feedback_english: string
          accuracy_score: number
          assistance_level: string
          contextual_fit_feedback_english: string
          contextual_fit_score: number
          created_at: string
          id: string
          independent_use: boolean
          naturalness_feedback_english: string
          naturalness_score: number
          passed: boolean
          practice_task_id: string
          response_chinese: string
          submitted_at: string
          user_expression_id: string
          user_id: string
        }
        Insert: {
          accuracy_feedback_english: string
          accuracy_score: number
          assistance_level: string
          contextual_fit_feedback_english: string
          contextual_fit_score: number
          created_at?: string
          id?: string
          independent_use: boolean
          naturalness_feedback_english: string
          naturalness_score: number
          passed: boolean
          practice_task_id: string
          response_chinese: string
          submitted_at: string
          user_expression_id: string
          user_id: string
        }
        Update: {
          accuracy_feedback_english?: string
          accuracy_score?: number
          assistance_level?: string
          contextual_fit_feedback_english?: string
          contextual_fit_score?: number
          created_at?: string
          id?: string
          independent_use?: boolean
          naturalness_feedback_english?: string
          naturalness_score?: number
          passed?: boolean
          practice_task_id?: string
          response_chinese?: string
          submitted_at?: string
          user_expression_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempt_expression_owner_fk"
            columns: ["user_expression_id", "user_id"]
            isOneToOne: false
            referencedRelation: "user_expressions"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "attempt_task_owner_fk"
            columns: ["practice_task_id", "user_id", "user_expression_id"]
            isOneToOne: false
            referencedRelation: "practice_tasks"
            referencedColumns: ["id", "user_id", "user_expression_id"]
          },
        ]
      }
      expression_occurrences: {
        Row: {
          confidence: number
          created_at: string
          end_seconds: number
          evidence_text: string
          expression_sense_id: string
          id: string
          saved_item_id: string | null
          segment_ids: string[]
          snapshot_id: string
          start_seconds: number
          user_id: string
        }
        Insert: {
          confidence: number
          created_at?: string
          end_seconds: number
          evidence_text: string
          expression_sense_id: string
          id?: string
          saved_item_id?: string | null
          segment_ids: string[]
          snapshot_id: string
          start_seconds: number
          user_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          end_seconds?: number
          evidence_text?: string
          expression_sense_id?: string
          id?: string
          saved_item_id?: string | null
          segment_ids?: string[]
          snapshot_id?: string
          start_seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expression_occurrence_save_owner_fk"
            columns: ["saved_item_id", "user_id"]
            isOneToOne: false
            referencedRelation: "saved_items"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "expression_occurrence_sense_owner_fk"
            columns: ["expression_sense_id", "user_id"]
            isOneToOne: false
            referencedRelation: "expression_senses"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "expression_occurrence_snapshot_owner_fk"
            columns: ["snapshot_id", "user_id"]
            isOneToOne: false
            referencedRelation: "video_snapshots"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      expression_senses: {
        Row: {
          communicative_function: string
          created_at: string
          english_explanation: string
          english_meaning: string
          expression_text: string
          id: string
          normalized_expression_text: string
          register: string
          saved_item_id: string | null
          tone: string
          updated_at: string
          user_id: string
          video_source_id: string
        }
        Insert: {
          communicative_function: string
          created_at?: string
          english_explanation: string
          english_meaning: string
          expression_text: string
          id?: string
          normalized_expression_text: string
          register: string
          saved_item_id?: string | null
          tone: string
          updated_at?: string
          user_id: string
          video_source_id: string
        }
        Update: {
          communicative_function?: string
          created_at?: string
          english_explanation?: string
          english_meaning?: string
          expression_text?: string
          id?: string
          normalized_expression_text?: string
          register?: string
          saved_item_id?: string | null
          tone?: string
          updated_at?: string
          user_id?: string
          video_source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expression_sense_save_owner_fk"
            columns: ["saved_item_id", "user_id", "video_source_id"]
            isOneToOne: false
            referencedRelation: "saved_items"
            referencedColumns: ["id", "user_id", "video_source_id"]
          },
          {
            foreignKeyName: "expression_sense_source_owner_fk"
            columns: ["video_source_id", "user_id"]
            isOneToOne: false
            referencedRelation: "video_sources"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      generated_artifacts: {
        Row: {
          artifact_type: string
          content: Json
          created_at: string
          id: string
          model: string
          native_language: string
          prompt_version: string
          result_key: string
          saved_item_id: string | null
          target_language: string
          user_id: string
          video_source_id: string
        }
        Insert: {
          artifact_type: string
          content: Json
          created_at?: string
          id?: string
          model: string
          native_language: string
          prompt_version: string
          result_key: string
          saved_item_id?: string | null
          target_language: string
          user_id: string
          video_source_id: string
        }
        Update: {
          artifact_type?: string
          content?: Json
          created_at?: string
          id?: string
          model?: string
          native_language?: string
          prompt_version?: string
          result_key?: string
          saved_item_id?: string | null
          target_language?: string
          user_id?: string
          video_source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_artifact_save_owner_fk"
            columns: ["saved_item_id", "user_id", "video_source_id"]
            isOneToOne: false
            referencedRelation: "saved_items"
            referencedColumns: ["id", "user_id", "video_source_id"]
          },
          {
            foreignKeyName: "generated_artifact_source_owner_fk"
            columns: ["video_source_id", "user_id"]
            isOneToOne: false
            referencedRelation: "video_sources"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      knowledge_jobs: {
        Row: {
          attempt_count: number
          created_at: string
          dedupe_key: string
          id: string
          job_type: string
          last_error_code: string | null
          lease_expires_at: string | null
          next_attempt_at: string | null
          saved_item_id: string | null
          status: string
          updated_at: string
          user_id: string
          video_source_id: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          dedupe_key: string
          id?: string
          job_type: string
          last_error_code?: string | null
          lease_expires_at?: string | null
          next_attempt_at?: string | null
          saved_item_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
          video_source_id: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          dedupe_key?: string
          id?: string
          job_type?: string
          last_error_code?: string | null
          lease_expires_at?: string | null
          next_attempt_at?: string | null
          saved_item_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          video_source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_job_save_owner_fk"
            columns: ["saved_item_id", "user_id", "video_source_id"]
            isOneToOne: false
            referencedRelation: "saved_items"
            referencedColumns: ["id", "user_id", "video_source_id"]
          },
          {
            foreignKeyName: "knowledge_job_source_owner_fk"
            columns: ["video_source_id", "user_id"]
            isOneToOne: false
            referencedRelation: "video_sources"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      mastery_events: {
        Row: {
          attempt_id: string | null
          created_at: string
          evidence_kind: string
          id: string
          new_state: string
          occurred_at: string
          prior_state: string | null
          user_expression_id: string
          user_id: string
        }
        Insert: {
          attempt_id?: string | null
          created_at?: string
          evidence_kind: string
          id?: string
          new_state: string
          occurred_at: string
          prior_state?: string | null
          user_expression_id: string
          user_id: string
        }
        Update: {
          attempt_id?: string | null
          created_at?: string
          evidence_kind?: string
          id?: string
          new_state?: string
          occurred_at?: string
          prior_state?: string | null
          user_expression_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mastery_event_attempt_owner_fk"
            columns: ["attempt_id", "user_id", "user_expression_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id", "user_id", "user_expression_id"]
          },
          {
            foreignKeyName: "mastery_event_expression_owner_fk"
            columns: ["user_expression_id", "user_id"]
            isOneToOne: false
            referencedRelation: "user_expressions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      practice_tasks: {
        Row: {
          created_at: string
          due_at: string | null
          goal_english: string
          id: string
          instructions_english: string
          kind: string
          native_language: string
          prompt_chinese: string
          target_expression: string
          target_language: string
          user_expression_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          due_at?: string | null
          goal_english: string
          id?: string
          instructions_english: string
          kind: string
          native_language: string
          prompt_chinese: string
          target_expression: string
          target_language: string
          user_expression_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          due_at?: string | null
          goal_english?: string
          id?: string
          instructions_english?: string
          kind?: string
          native_language?: string
          prompt_chinese?: string
          target_expression?: string
          target_language?: string
          user_expression_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_task_expression_owner_fk"
            columns: ["user_expression_id", "user_id"]
            isOneToOne: false
            referencedRelation: "user_expressions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          native_language: string
          target_language: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          native_language?: string
          target_language?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          native_language?: string
          target_language?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      review_tasks: {
        Row: {
          consecutive_successes: number
          created_at: string
          due_at: string
          id: string
          interval_days: number
          mastery_state: string
          status: string
          updated_at: string
          user_expression_id: string
          user_id: string
        }
        Insert: {
          consecutive_successes: number
          created_at?: string
          due_at: string
          id?: string
          interval_days: number
          mastery_state: string
          status: string
          updated_at?: string
          user_expression_id: string
          user_id: string
        }
        Update: {
          consecutive_successes?: number
          created_at?: string
          due_at?: string
          id?: string
          interval_days?: number
          mastery_state?: string
          status?: string
          updated_at?: string
          user_expression_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_task_expression_owner_fk"
            columns: ["user_expression_id", "user_id"]
            isOneToOne: false
            referencedRelation: "user_expressions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      saved_items: {
        Row: {
          captured_at: string
          client_event_id: string
          created_at: string
          id: string
          kind: string
          payload: Json
          snapshot_id: string | null
          start_seconds: number | null
          status: string
          updated_at: string
          user_id: string
          video_source_id: string
          youtube_video_id: string
        }
        Insert: {
          captured_at: string
          client_event_id: string
          created_at?: string
          id?: string
          kind: string
          payload: Json
          snapshot_id?: string | null
          start_seconds?: number | null
          status: string
          updated_at?: string
          user_id: string
          video_source_id: string
          youtube_video_id: string
        }
        Update: {
          captured_at?: string
          client_event_id?: string
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          snapshot_id?: string | null
          start_seconds?: number | null
          status?: string
          updated_at?: string
          user_id?: string
          video_source_id?: string
          youtube_video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_item_snapshot_owner_fk"
            columns: ["snapshot_id", "user_id"]
            isOneToOne: false
            referencedRelation: "video_snapshots"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "saved_item_source_owner_fk"
            columns: ["video_source_id", "user_id", "youtube_video_id"]
            isOneToOne: false
            referencedRelation: "video_sources"
            referencedColumns: ["id", "user_id", "youtube_video_id"]
          },
        ]
      }
      transcript_segments: {
        Row: {
          created_at: string
          end_seconds: number
          english_translation: string | null
          id: string
          language: string
          original_chinese: string
          position: number
          snapshot_id: string
          stable_id: string
          start_seconds: number
          user_id: string
        }
        Insert: {
          created_at?: string
          end_seconds: number
          english_translation?: string | null
          id?: string
          language: string
          original_chinese: string
          position: number
          snapshot_id: string
          stable_id: string
          start_seconds: number
          user_id: string
        }
        Update: {
          created_at?: string
          end_seconds?: number
          english_translation?: string | null
          id?: string
          language?: string
          original_chinese?: string
          position?: number
          snapshot_id?: string
          stable_id?: string
          start_seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcript_segment_snapshot_owner_fk"
            columns: ["snapshot_id", "user_id"]
            isOneToOne: false
            referencedRelation: "video_snapshots"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      user_expressions: {
        Row: {
          created_at: string
          expression_sense_id: string
          id: string
          mastery_state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expression_sense_id: string
          id?: string
          mastery_state: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expression_sense_id?: string
          id?: string
          mastery_state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_expression_sense_owner_fk"
            columns: ["expression_sense_id", "user_id"]
            isOneToOne: false
            referencedRelation: "expression_senses"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      video_snapshots: {
        Row: {
          captured_at: string
          channel: string
          created_at: string
          description: string
          duration_seconds: number
          id: string
          thumbnail_url: string
          title: string
          transcript_hash: string
          transcript_language: string
          user_id: string
          video_source_id: string
        }
        Insert: {
          captured_at: string
          channel: string
          created_at?: string
          description?: string
          duration_seconds: number
          id?: string
          thumbnail_url: string
          title: string
          transcript_hash: string
          transcript_language: string
          user_id: string
          video_source_id: string
        }
        Update: {
          captured_at?: string
          channel?: string
          created_at?: string
          description?: string
          duration_seconds?: number
          id?: string
          thumbnail_url?: string
          title?: string
          transcript_hash?: string
          transcript_language?: string
          user_id?: string
          video_source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_snapshot_source_owner_fk"
            columns: ["video_source_id", "user_id"]
            isOneToOne: false
            referencedRelation: "video_sources"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      video_sources: {
        Row: {
          canonical_url: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
          youtube_video_id: string
        }
        Insert: {
          canonical_url: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          youtube_video_id: string
        }
        Update: {
          canonical_url?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          youtube_video_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
