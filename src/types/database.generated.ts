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
          evaluation_gateway_config_id: string | null
          evaluation_gateway_fingerprint: string | null
          evaluation_gateway_revision: number | null
          evaluation_model: string | null
          evaluation_prompt_version: string | null
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
          evaluation_gateway_config_id?: string | null
          evaluation_gateway_fingerprint?: string | null
          evaluation_gateway_revision?: number | null
          evaluation_model?: string | null
          evaluation_prompt_version?: string | null
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
          evaluation_gateway_config_id?: string | null
          evaluation_gateway_fingerprint?: string | null
          evaluation_gateway_revision?: number | null
          evaluation_model?: string | null
          evaluation_prompt_version?: string | null
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
            foreignKeyName: "attempt_evaluation_gateway_fk"
            columns: [
              "evaluation_gateway_config_id",
              "user_id",
              "evaluation_gateway_revision",
              "evaluation_gateway_fingerprint",
              "evaluation_model",
            ]
            isOneToOne: false
            referencedRelation: "user_model_gateway_configs"
            referencedColumns: [
              "id",
              "user_id",
              "revision",
              "config_fingerprint",
              "model",
            ]
          },
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
          saved_item_id: string
          segment_ids: string[]
          snapshot_id: string
          start_seconds: number
          user_id: string
          video_source_id: string
        }
        Insert: {
          confidence: number
          created_at?: string
          end_seconds: number
          evidence_text: string
          expression_sense_id: string
          id?: string
          saved_item_id: string
          segment_ids: string[]
          snapshot_id: string
          start_seconds: number
          user_id: string
          video_source_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          end_seconds?: number
          evidence_text?: string
          expression_sense_id?: string
          id?: string
          saved_item_id?: string
          segment_ids?: string[]
          snapshot_id?: string
          start_seconds?: number
          user_id?: string
          video_source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expression_occurrence_save_owner_fk"
            columns: [
              "saved_item_id",
              "user_id",
              "video_source_id",
              "snapshot_id",
            ]
            isOneToOne: false
            referencedRelation: "saved_items"
            referencedColumns: [
              "id",
              "user_id",
              "video_source_id",
              "snapshot_id",
            ]
          },
          {
            foreignKeyName: "expression_occurrence_sense_owner_fk"
            columns: ["expression_sense_id", "user_id", "video_source_id"]
            isOneToOne: false
            referencedRelation: "expression_senses"
            referencedColumns: ["id", "user_id", "video_source_id"]
          },
          {
            foreignKeyName: "expression_occurrence_snapshot_owner_fk"
            columns: ["snapshot_id", "user_id", "video_source_id"]
            isOneToOne: false
            referencedRelation: "video_snapshots"
            referencedColumns: ["id", "user_id", "video_source_id"]
          },
          {
            foreignKeyName: "expression_occurrence_source_owner_fk"
            columns: ["video_source_id", "user_id"]
            isOneToOne: false
            referencedRelation: "video_sources"
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
      knowledge_job_internal: {
        Row: {
          created_at: string
          input: Json
          knowledge_job_id: string
          result: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          input?: Json
          knowledge_job_id: string
          result?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          input?: Json
          knowledge_job_id?: string
          result?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_job_internal_owner_fk"
            columns: ["knowledge_job_id", "user_id"]
            isOneToOne: false
            referencedRelation: "knowledge_jobs"
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
      model_gateway_origins: {
        Row: {
          adapter_kind: string
          base_path: string
          canonical_origin: string
          created_at: string
          display_name: string
          id: string
          slug: string
          state: string
          updated_at: string
        }
        Insert: {
          adapter_kind: string
          base_path?: string
          canonical_origin: string
          created_at?: string
          display_name: string
          id?: string
          slug: string
          state?: string
          updated_at?: string
        }
        Update: {
          adapter_kind?: string
          base_path?: string
          canonical_origin?: string
          created_at?: string
          display_name?: string
          id?: string
          slug?: string
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      practice_draft_attempts: {
        Row: {
          accuracy_feedback_english: string
          accuracy_score: number
          assistance_level: string
          contextual_fit_feedback_english: string
          contextual_fit_score: number
          created_at: string
          evaluation_gateway_config_id: string | null
          evaluation_gateway_fingerprint: string | null
          evaluation_gateway_revision: number | null
          evaluation_model: string | null
          evaluation_prompt_version: string | null
          future_user_expression_id: string
          id: string
          independent_use: boolean
          naturalness_feedback_english: string
          naturalness_score: number
          passed: boolean
          practice_draft_id: string
          response_chinese: string
          revision: number
          submitted_at: string
          user_id: string
        }
        Insert: {
          accuracy_feedback_english: string
          accuracy_score: number
          assistance_level: string
          contextual_fit_feedback_english: string
          contextual_fit_score: number
          created_at?: string
          evaluation_gateway_config_id?: string | null
          evaluation_gateway_fingerprint?: string | null
          evaluation_gateway_revision?: number | null
          evaluation_model?: string | null
          evaluation_prompt_version?: string | null
          future_user_expression_id: string
          id?: string
          independent_use: boolean
          naturalness_feedback_english: string
          naturalness_score: number
          passed: boolean
          practice_draft_id: string
          response_chinese: string
          revision: number
          submitted_at: string
          user_id: string
        }
        Update: {
          accuracy_feedback_english?: string
          accuracy_score?: number
          assistance_level?: string
          contextual_fit_feedback_english?: string
          contextual_fit_score?: number
          created_at?: string
          evaluation_gateway_config_id?: string | null
          evaluation_gateway_fingerprint?: string | null
          evaluation_gateway_revision?: number | null
          evaluation_model?: string | null
          evaluation_prompt_version?: string | null
          future_user_expression_id?: string
          id?: string
          independent_use?: boolean
          naturalness_feedback_english?: string
          naturalness_score?: number
          passed?: boolean
          practice_draft_id?: string
          response_chinese?: string
          revision?: number
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_draft_attempt_draft_owner_fk"
            columns: [
              "practice_draft_id",
              "user_id",
              "future_user_expression_id",
            ]
            isOneToOne: false
            referencedRelation: "practice_drafts"
            referencedColumns: ["id", "user_id", "future_user_expression_id"]
          },
          {
            foreignKeyName: "practice_draft_attempt_evaluation_gateway_fk"
            columns: [
              "evaluation_gateway_config_id",
              "user_id",
              "evaluation_gateway_revision",
              "evaluation_gateway_fingerprint",
              "evaluation_model",
            ]
            isOneToOne: false
            referencedRelation: "user_model_gateway_configs"
            referencedColumns: [
              "id",
              "user_id",
              "revision",
              "config_fingerprint",
              "model",
            ]
          },
        ]
      }
      practice_drafts: {
        Row: {
          activation_gateway_config_id: string | null
          activation_gateway_fingerprint: string | null
          activation_gateway_revision: number | null
          activation_model: string | null
          activation_prompt_version: string | null
          candidate_artifact_id: string
          candidate_artifact_type: string
          candidate_index: number
          created_at: string
          future_user_expression_id: string
          goal_english: string
          id: string
          instructions_english: string
          native_language: string
          prompt_chinese: string
          saved_item_id: string
          status: string
          target_expression: string
          target_language: string
          updated_at: string
          user_id: string
          video_source_id: string
        }
        Insert: {
          activation_gateway_config_id?: string | null
          activation_gateway_fingerprint?: string | null
          activation_gateway_revision?: number | null
          activation_model?: string | null
          activation_prompt_version?: string | null
          candidate_artifact_id: string
          candidate_artifact_type?: string
          candidate_index: number
          created_at?: string
          future_user_expression_id: string
          goal_english: string
          id?: string
          instructions_english: string
          native_language: string
          prompt_chinese: string
          saved_item_id: string
          status?: string
          target_expression: string
          target_language: string
          updated_at?: string
          user_id: string
          video_source_id: string
        }
        Update: {
          activation_gateway_config_id?: string | null
          activation_gateway_fingerprint?: string | null
          activation_gateway_revision?: number | null
          activation_model?: string | null
          activation_prompt_version?: string | null
          candidate_artifact_id?: string
          candidate_artifact_type?: string
          candidate_index?: number
          created_at?: string
          future_user_expression_id?: string
          goal_english?: string
          id?: string
          instructions_english?: string
          native_language?: string
          prompt_chinese?: string
          saved_item_id?: string
          status?: string
          target_expression?: string
          target_language?: string
          updated_at?: string
          user_id?: string
          video_source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_draft_activation_gateway_fk"
            columns: [
              "activation_gateway_config_id",
              "user_id",
              "activation_gateway_revision",
              "activation_gateway_fingerprint",
              "activation_model",
            ]
            isOneToOne: false
            referencedRelation: "user_model_gateway_configs"
            referencedColumns: [
              "id",
              "user_id",
              "revision",
              "config_fingerprint",
              "model",
            ]
          },
          {
            foreignKeyName: "practice_draft_candidate_owner_fk"
            columns: [
              "candidate_artifact_id",
              "user_id",
              "video_source_id",
              "saved_item_id",
              "candidate_artifact_type",
            ]
            isOneToOne: false
            referencedRelation: "generated_artifacts"
            referencedColumns: [
              "id",
              "user_id",
              "video_source_id",
              "saved_item_id",
              "artifact_type",
            ]
          },
          {
            foreignKeyName: "practice_draft_save_owner_fk"
            columns: ["saved_item_id", "user_id", "video_source_id"]
            isOneToOne: false
            referencedRelation: "saved_items"
            referencedColumns: ["id", "user_id", "video_source_id"]
          },
          {
            foreignKeyName: "practice_draft_source_owner_fk"
            columns: ["video_source_id", "user_id"]
            isOneToOne: false
            referencedRelation: "video_sources"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      practice_tasks: {
        Row: {
          activation_gateway_config_id: string | null
          activation_gateway_fingerprint: string | null
          activation_gateway_revision: number | null
          activation_model: string | null
          activation_prompt_version: string | null
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
          activation_gateway_config_id?: string | null
          activation_gateway_fingerprint?: string | null
          activation_gateway_revision?: number | null
          activation_model?: string | null
          activation_prompt_version?: string | null
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
          activation_gateway_config_id?: string | null
          activation_gateway_fingerprint?: string | null
          activation_gateway_revision?: number | null
          activation_model?: string | null
          activation_prompt_version?: string | null
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
            foreignKeyName: "practice_task_activation_gateway_fk"
            columns: [
              "activation_gateway_config_id",
              "user_id",
              "activation_gateway_revision",
              "activation_gateway_fingerprint",
              "activation_model",
            ]
            isOneToOne: false
            referencedRelation: "user_model_gateway_configs"
            referencedColumns: [
              "id",
              "user_id",
              "revision",
              "config_fingerprint",
              "model",
            ]
          },
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
            columns: ["snapshot_id", "user_id", "video_source_id"]
            isOneToOne: false
            referencedRelation: "video_snapshots"
            referencedColumns: ["id", "user_id", "video_source_id"]
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
      user_model_gateway_configs: {
        Row: {
          adapter_kind: string
          config_fingerprint: string
          consent_policy_version: string | null
          consented_at: string | null
          consented_origin: string | null
          created_at: string
          display_name: string
          id: string
          model: string
          origin_id: string
          revision: number
          revoked_at: string | null
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          adapter_kind: string
          config_fingerprint: string
          consent_policy_version?: string | null
          consented_at?: string | null
          consented_origin?: string | null
          created_at: string
          display_name: string
          id: string
          model: string
          origin_id: string
          revision: number
          revoked_at?: string | null
          state?: string
          updated_at: string
          user_id: string
        }
        Update: {
          adapter_kind?: string
          config_fingerprint?: string
          consent_policy_version?: string | null
          consented_at?: string | null
          consented_origin?: string | null
          created_at?: string
          display_name?: string
          id?: string
          model?: string
          origin_id?: string
          revision?: number
          revoked_at?: string | null
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_model_gateway_configs_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "model_gateway_origins"
            referencedColumns: ["id"]
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
      activate_user_model_gateway_config: {
        Args: {
          p_config_id: string
          p_exact_origin: string
          p_now: string
          p_policy_version: string
          p_user_id: string
        }
        Returns: boolean
      }
      capture_saved_item: {
        Args: {
          p_captured_at: string
          p_client_event_id: string
          p_kind: string
          p_payload: Json
          p_start_seconds: number
          p_youtube_video_id: string
        }
        Returns: {
          saved_item_id: string
          status: string
          video_source_id: string
        }[]
      }
      claim_knowledge_jobs: {
        Args: { p_limit: number; p_now: string }
        Returns: {
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
        }[]
        SetofOptions: {
          from: "*"
          to: "knowledge_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_gateway_learning_artifact_job: {
        Args: {
          p_artifact_type: string
          p_config_id: string
          p_content: Json
          p_expected_attempt_count: number
          p_expected_config_fingerprint: string
          p_expected_config_revision: number
          p_expected_lease_expires_at: string
          p_job_id: string
          p_job_type: string
          p_model: string
          p_now: string
          p_prompt_version: string
          p_result_key: string
          p_user_id: string
          p_video_source_id: string
        }
        Returns: string
      }
      complete_learning_artifact_job: {
        Args: {
          p_artifact_type: string
          p_content: Json
          p_expected_attempt_count: number
          p_expected_lease_expires_at: string
          p_job_id: string
          p_job_type: string
          p_model: string
          p_now: string
          p_prompt_version: string
          p_result_key: string
          p_user_id: string
          p_video_source_id: string
        }
        Returns: string
      }
      complete_resolve_snapshot_job: {
        Args: {
          p_expected_attempt_count: number
          p_expected_lease_expires_at: string
          p_job_id: string
          p_now: string
          p_snapshot_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      create_user_model_gateway_config: {
        Args: {
          p_api_key: string
          p_config_id: string
          p_display_name: string
          p_model: string
          p_now: string
          p_origin_id: string
          p_user_id: string
        }
        Returns: {
          config_id: string
          revision: number
          state: string
        }[]
      }
      has_user_model_gateway_secret: {
        Args: { p_config_id: string; p_user_id: string }
        Returns: boolean
      }
      promote_valid_practice_draft_attempt: {
        Args: {
          p_due_at: string
          p_interval_days: number
          p_normalized_expression_text: string
          p_practice_draft_attempt_id: string
          p_user_id: string
        }
        Returns: {
          attempt_id: string
          created: boolean
          expression_sense_id: string
          mastery_event_id: string
          occurrence_id: string
          practice_task_id: string
          review_task_id: string
          user_expression_id: string
        }[]
      }
      register_gateway_learning_artifact_job: {
        Args: {
          p_config_id: string
          p_dedupe_key: string
          p_expected_config_fingerprint: string
          p_expected_config_revision: number
          p_input: Json
          p_job_type: string
          p_now: string
          p_user_id: string
          p_video_source_id: string
        }
        Returns: {
          created: boolean
          knowledge_job_id: string
          status: string
        }[]
      }
      register_learning_artifact_job: {
        Args: {
          p_dedupe_key: string
          p_input: Json
          p_job_type: string
          p_now: string
          p_user_id: string
          p_video_source_id: string
        }
        Returns: {
          created: boolean
          knowledge_job_id: string
          status: string
        }[]
      }
      register_resolve_snapshot_job: {
        Args: {
          p_dedupe_key: string
          p_now: string
          p_provider_job_id: string
          p_user_id: string
          p_video_source_id: string
        }
        Returns: {
          created_or_attached: boolean
          knowledge_job_id: string
          status: string
        }[]
      }
      rename_user_model_gateway_config: {
        Args: {
          p_config_id: string
          p_display_name: string
          p_now: string
          p_user_id: string
        }
        Returns: boolean
      }
      resolve_active_user_model_gateway_pin: {
        Args: { p_user_id: string }
        Returns: {
          config_fingerprint: string
          config_id: string
          model: string
          revision: number
        }[]
      }
      resolve_user_model_gateway_config: {
        Args: {
          p_config_id: string
          p_expected_revision: number
          p_user_id: string
        }
        Returns: {
          adapter_kind: string
          api_key: string
          base_path: string
          canonical_origin: string
          config_fingerprint: string
          credential_revision: number
          display_name: string
          model: string
          revision: number
        }[]
      }
      revoke_user_model_gateway_config: {
        Args: { p_config_id: string; p_now: string; p_user_id: string }
        Returns: boolean
      }
      rotate_user_model_gateway_key: {
        Args: {
          p_api_key: string
          p_config_id: string
          p_now: string
          p_user_id: string
        }
        Returns: boolean
      }
      transition_learning_artifact_failure: {
        Args: {
          p_clear_input: boolean
          p_error_code: string
          p_expected_attempt_count: number
          p_expected_lease_expires_at: string
          p_job_id: string
          p_job_type: string
          p_next_attempt_at: string
          p_now: string
          p_target_status: string
          p_user_id: string
          p_video_source_id: string
        }
        Returns: boolean
      }
      transition_resolve_snapshot_failure: {
        Args: {
          p_clear_input: boolean
          p_error_code: string
          p_expected_attempt_count: number
          p_expected_lease_expires_at: string
          p_job_id: string
          p_next_attempt_at: string
          p_now: string
          p_provider_job_id: string
          p_target_status: string
          p_user_id: string
        }
        Returns: boolean
      }
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
