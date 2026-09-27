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
    PostgrestVersion: "14.5"
  }
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
      attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          note_id: string | null
          size_bytes: number | null
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          note_id?: string | null
          size_bytes?: number | null
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          note_id?: string | null
          size_bytes?: number | null
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          archived: boolean
          color: string
          created_at: string
          id: string
          name: string
          position: number
          user_id: string
        }
        Insert: {
          archived?: boolean
          color?: string
          created_at?: string
          id?: string
          name: string
          position?: number
          user_id: string
        }
        Update: {
          archived?: boolean
          color?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          all_day: boolean
          course_id: string | null
          created_at: string
          ends_at: string | null
          google_event_id: string | null
          id: string
          kind: string
          outlook_event_id: string | null
          starts_at: string
          sync_error: string | null
          task_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          course_id?: string | null
          created_at?: string
          ends_at?: string | null
          google_event_id?: string | null
          id?: string
          kind?: string
          outlook_event_id?: string | null
          starts_at: string
          sync_error?: string | null
          task_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean
          course_id?: string | null
          created_at?: string
          ends_at?: string | null
          google_event_id?: string | null
          id?: string
          kind?: string
          outlook_event_id?: string | null
          starts_at?: string
          sync_error?: string | null
          task_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          back: string
          course_id: string | null
          created_at: string
          due_at: string
          ease: number
          front: string
          id: string
          interval_days: number
          note_id: string | null
          repetitions: number
          user_id: string
        }
        Insert: {
          back: string
          course_id?: string | null
          created_at?: string
          due_at?: string
          ease?: number
          front: string
          id?: string
          interval_days?: number
          note_id?: string | null
          repetitions?: number
          user_id: string
        }
        Update: {
          back?: string
          course_id?: string | null
          created_at?: string
          due_at?: string
          ease?: number
          front?: string
          id?: string
          interval_days?: number
          note_id?: string | null
          repetitions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcards_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      focus_sessions: {
        Row: {
          course_id: string | null
          created_at: string
          id: string
          minutes: number
          started_at: string
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          id?: string
          minutes: number
          started_at: string
          user_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          id?: string
          minutes?: number
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "focus_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          course_id: string
          created_at: string
          id: string
          name: string
          parent_id: string | null
          position: number
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          position?: number
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          position?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          access_token_enc: string | null
          access_token_expires_at: string | null
          account_email: string | null
          calendar_id: string | null
          created_at: string
          provider: string
          refresh_token_enc: string
          user_id: string
        }
        Insert: {
          access_token_enc?: string | null
          access_token_expires_at?: string | null
          account_email?: string | null
          calendar_id?: string | null
          created_at?: string
          provider: string
          refresh_token_enc: string
          user_id: string
        }
        Update: {
          access_token_enc?: string | null
          access_token_expires_at?: string | null
          account_email?: string | null
          calendar_id?: string | null
          created_at?: string
          provider?: string
          refresh_token_enc?: string
          user_id?: string
        }
        Relationships: []
      }
      lecture_photos: {
        Row: {
          caption: string | null
          course_id: string | null
          created_at: string
          id: string
          lecture_id: string | null
          offset_seconds: number | null
          slide_text: string | null
          storage_path: string
          taken_at: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          lecture_id?: string | null
          offset_seconds?: number | null
          slide_text?: string | null
          storage_path: string
          taken_at?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          lecture_id?: string | null
          offset_seconds?: number | null
          slide_text?: string | null
          storage_path?: string
          taken_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lecture_photos_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lecture_photos_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
        ]
      }
      lecture_topics: {
        Row: {
          lecture_id: string
          topic_id: string
          user_id: string
        }
        Insert: {
          lecture_id: string
          topic_id: string
          user_id: string
        }
        Update: {
          lecture_id?: string
          topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lecture_topics_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lecture_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      lectures: {
        Row: {
          course_id: string | null
          created_at: string
          duration_seconds: number | null
          id: string
          note_id: string | null
          recorded_at: string
          status: string
          title: string
          transcript: string | null
          transcript_live: string | null
          transcript_segments: Json | null
          transcript_source: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          note_id?: string | null
          recorded_at?: string
          status?: string
          title: string
          transcript?: string | null
          transcript_live?: string | null
          transcript_segments?: Json | null
          transcript_source?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          note_id?: string | null
          recorded_at?: string
          status?: string
          title?: string
          transcript?: string | null
          transcript_live?: string | null
          transcript_segments?: Json | null
          transcript_source?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lectures_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lectures_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          content: Json
          content_text: string
          course_id: string | null
          created_at: string
          folder_id: string | null
          id: string
          onenote_page_id: string | null
          pinned: boolean
          search: unknown
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: Json
          content_text?: string
          course_id?: string | null
          created_at?: string
          folder_id?: string | null
          id?: string
          onenote_page_id?: string | null
          pinned?: boolean
          search?: unknown
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json
          content_text?: string
          course_id?: string | null
          created_at?: string
          folder_id?: string | null
          id?: string
          onenote_page_id?: string | null
          pinned?: boolean
          search?: unknown
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_questions: {
        Row: {
          answer: string
          choices: Json | null
          course_id: string
          created_at: string
          difficulty: number
          explanation: string | null
          id: string
          question: string
          source_lecture_id: string | null
          study_guide_id: string | null
          topic_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          answer: string
          choices?: Json | null
          course_id: string
          created_at?: string
          difficulty?: number
          explanation?: string | null
          id?: string
          question: string
          source_lecture_id?: string | null
          study_guide_id?: string | null
          topic_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          answer?: string
          choices?: Json | null
          course_id?: string
          created_at?: string
          difficulty?: number
          explanation?: string | null
          id?: string
          question?: string
          source_lecture_id?: string | null
          study_guide_id?: string | null
          topic_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_questions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_questions_source_lecture_id_fkey"
            columns: ["source_lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_questions_study_guide_id_fkey"
            columns: ["study_guide_id"]
            isOneToOne: false
            referencedRelation: "study_guides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      question_attempts: {
        Row: {
          answered_at: string
          correct: boolean
          id: string
          question_id: string
          response: string | null
          user_id: string
        }
        Insert: {
          answered_at?: string
          correct: boolean
          id?: string
          question_id: string
          response?: string | null
          user_id: string
        }
        Update: {
          answered_at?: string
          correct?: boolean
          id?: string
          question_id?: string
          response?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "practice_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          digest_email: string | null
          digest_enabled: boolean
          onenote_notebook_id: string | null
          onenote_section_id: string | null
          recording_policy_ack: boolean
          timezone: string
          user_id: string
          whisper_model_size: string
        }
        Insert: {
          digest_email?: string | null
          digest_enabled?: boolean
          onenote_notebook_id?: string | null
          onenote_section_id?: string | null
          recording_policy_ack?: boolean
          timezone?: string
          user_id: string
          whisper_model_size?: string
        }
        Update: {
          digest_email?: string | null
          digest_enabled?: boolean
          onenote_notebook_id?: string | null
          onenote_section_id?: string | null
          recording_policy_ack?: boolean
          timezone?: string
          user_id?: string
          whisper_model_size?: string
        }
        Relationships: []
      }
      study_guides: {
        Row: {
          course_id: string
          created_at: string
          exam_event_id: string | null
          id: string
          overview_md: string
          source: string
          title: string
          topic_ids: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          exam_event_id?: string | null
          id?: string
          overview_md?: string
          source?: string
          title: string
          topic_ids?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          exam_event_id?: string | null
          id?: string
          overview_md?: string
          source?: string
          title?: string
          topic_ids?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_guides_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_guides_exam_event_id_fkey"
            columns: ["exam_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      syllabi: {
        Row: {
          course_id: string
          created_at: string
          id: string
          parsed: Json | null
          raw_text: string
          storage_path: string | null
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          parsed?: Json | null
          raw_text: string
          storage_path?: string | null
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          parsed?: Json | null
          raw_text?: string
          storage_path?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "syllabi_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          course_id: string | null
          created_at: string
          details: string | null
          done: boolean
          done_at: string | null
          due_at: string | null
          id: string
          note_id: string | null
          priority: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          details?: string | null
          done?: boolean
          done_at?: string | null
          due_at?: string | null
          id?: string
          note_id?: string | null
          priority?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          details?: string | null
          done?: boolean
          done_at?: string | null
          due_at?: string | null
          id?: string
          note_id?: string | null
          priority?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          position: number
          scheduled_date: string | null
          title: string
          user_id: string
          week: number | null
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          scheduled_date?: string | null
          title: string
          user_id: string
          week?: number | null
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          scheduled_date?: string | null
          title?: string
          user_id?: string
          week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "topics_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      search_all: {
        Args: { q: string }
        Returns: {
          course_id: string
          id: string
          kind: string
          score: number
          snippet: string
          title: string
        }[]
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
