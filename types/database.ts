// =============================================================
// ARCHIVO GENERADO AUTOMATICAMENTE - NO EDITAR MANUALMENTE
// Generado por: npx supabase gen types typescript --local
// Fuente: supabase/migrations/001_base_multitenant_schema.sql
// Para regenerar: npx supabase@2.108.0 gen types typescript --local > types/database.ts
// =============================================================

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
      ai_classifications: {
        Row: {
          classification: Database["public"]["Enums"]["ai_classification"]
          confidence: number
          created_at: string
          id: string
          message_id: string
          producer_id: string
          quote_id: string
          raw_llm_response: Json | null
          requires_human: boolean
          suggested_action: Database["public"]["Enums"]["ai_suggested_action"]
          summary: string
        }
        Insert: {
          classification: Database["public"]["Enums"]["ai_classification"]
          confidence: number
          created_at?: string
          id?: string
          message_id: string
          producer_id: string
          quote_id: string
          raw_llm_response?: Json | null
          requires_human: boolean
          suggested_action: Database["public"]["Enums"]["ai_suggested_action"]
          summary: string
        }
        Update: {
          classification?: Database["public"]["Enums"]["ai_classification"]
          confidence?: number
          created_at?: string
          id?: string
          message_id?: string
          producer_id?: string
          quote_id?: string
          raw_llm_response?: Json | null
          requires_human?: boolean
          suggested_action?: Database["public"]["Enums"]["ai_suggested_action"]
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_classifications_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_classifications_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "producers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_classifications_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      approved_responses: {
        Row: {
          created_at: string
          example_question: string
          id: string
          is_active: boolean
          keywords: string[]
          producer_id: string
          response_text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          example_question: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          producer_id: string
          response_text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          example_question?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          producer_id?: string
          response_text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approved_responses_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "producers"
            referencedColumns: ["id"]
          },
        ]
      }
      human_handoffs: {
        Row: {
          created_at: string
          id: string
          producer_id: string
          prospect_id: string
          quote_id: string
          reason: Database["public"]["Enums"]["handoff_reason"]
          resolution_notes: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["handoff_status"]
          summary: string
        }
        Insert: {
          created_at?: string
          id?: string
          producer_id: string
          prospect_id: string
          quote_id: string
          reason: Database["public"]["Enums"]["handoff_reason"]
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["handoff_status"]
          summary: string
        }
        Update: {
          created_at?: string
          id?: string
          producer_id?: string
          prospect_id?: string
          quote_id?: string
          reason?: Database["public"]["Enums"]["handoff_reason"]
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["handoff_status"]
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "human_handoffs_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "producers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "human_handoffs_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "human_handoffs_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      producer_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invited_at: string
          is_active: boolean
          producer_id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string
          is_active?: boolean
          producer_id: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string
          is_active?: boolean
          producer_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "producer_members_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "producers"
            referencedColumns: ["id"]
          },
        ]
      }
      producers: {
        Row: {
          contact_name: string
          created_at: string
          follow_up_hours: number
          id: string
          message_signature: string | null
          name: string
          plan: Database["public"]["Enums"]["producer_plan"]
          send_mode: Database["public"]["Enums"]["send_mode"]
          status: Database["public"]["Enums"]["producer_status"]
          updated_at: string
          waba_config_ref: string | null
          waba_number: string | null
          waba_provider: Database["public"]["Enums"]["waba_provider"] | null
        }
        Insert: {
          contact_name: string
          created_at?: string
          follow_up_hours?: number
          id?: string
          message_signature?: string | null
          name: string
          plan?: Database["public"]["Enums"]["producer_plan"]
          send_mode?: Database["public"]["Enums"]["send_mode"]
          status?: Database["public"]["Enums"]["producer_status"]
          updated_at?: string
          waba_config_ref?: string | null
          waba_number?: string | null
          waba_provider?: Database["public"]["Enums"]["waba_provider"] | null
        }
        Update: {
          contact_name?: string
          created_at?: string
          follow_up_hours?: number
          id?: string
          message_signature?: string | null
          name?: string
          plan?: Database["public"]["Enums"]["producer_plan"]
          send_mode?: Database["public"]["Enums"]["send_mode"]
          status?: Database["public"]["Enums"]["producer_status"]
          updated_at?: string
          waba_config_ref?: string | null
          waba_number?: string | null
          waba_provider?: Database["public"]["Enums"]["waba_provider"] | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      prospects: {
        Row: {
          archived_at: string | null
          consent_status: Database["public"]["Enums"]["consent_status"]
          created_at: string
          email: string | null
          full_name: string
          id: string
          internal_notes: string | null
          opt_out: boolean
          opt_out_at: string | null
          phone: string
          producer_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          consent_status?: Database["public"]["Enums"]["consent_status"]
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          internal_notes?: string | null
          opt_out?: boolean
          opt_out_at?: string | null
          phone: string
          producer_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          consent_status?: Database["public"]["Enums"]["consent_status"]
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          internal_notes?: string | null
          opt_out?: boolean
          opt_out_at?: string | null
          phone?: string
          producer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospects_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "producers"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_events: {
        Row: {
          actor: Database["public"]["Enums"]["quote_event_actor"]
          created_at: string
          description: string | null
          event_type: string
          id: string
          new_status: Database["public"]["Enums"]["quote_status"] | null
          previous_status: Database["public"]["Enums"]["quote_status"] | null
          producer_id: string
          quote_id: string
        }
        Insert: {
          actor: Database["public"]["Enums"]["quote_event_actor"]
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          new_status?: Database["public"]["Enums"]["quote_status"] | null
          previous_status?: Database["public"]["Enums"]["quote_status"] | null
          producer_id: string
          quote_id: string
        }
        Update: {
          actor?: Database["public"]["Enums"]["quote_event_actor"]
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          new_status?: Database["public"]["Enums"]["quote_status"] | null
          previous_status?: Database["public"]["Enums"]["quote_status"] | null
          producer_id?: string
          quote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_events_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "producers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_events_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          approved_message: string | null
          created_at: string
          currency: string
          expiry_date: string | null
          follow_up_start_at: string | null
          id: string
          insurance_type: Database["public"]["Enums"]["insurance_type"]
          insurer_name: string | null
          internal_notes: string | null
          origin_channel: string | null
          producer_id: string
          prospect_id: string
          quote_date: string
          quoted_amount: number | null
          risk_description: string | null
          status: Database["public"]["Enums"]["quote_status"]
          updated_at: string
        }
        Insert: {
          approved_message?: string | null
          created_at?: string
          currency?: string
          expiry_date?: string | null
          follow_up_start_at?: string | null
          id?: string
          insurance_type: Database["public"]["Enums"]["insurance_type"]
          insurer_name?: string | null
          internal_notes?: string | null
          origin_channel?: string | null
          producer_id: string
          prospect_id: string
          quote_date: string
          quoted_amount?: number | null
          risk_description?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
        }
        Update: {
          approved_message?: string | null
          created_at?: string
          currency?: string
          expiry_date?: string | null
          follow_up_start_at?: string | null
          id?: string
          insurance_type?: Database["public"]["Enums"]["insurance_type"]
          insurer_name?: string | null
          internal_notes?: string | null
          origin_channel?: string | null
          producer_id?: string
          prospect_id?: string
          quote_date?: string
          quoted_amount?: number | null
          risk_description?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "producers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body: string
          created_at: string
          delivered_at: string | null
          delivery_status: Database["public"]["Enums"]["delivery_status"] | null
          direction: Database["public"]["Enums"]["message_direction"]
          failed_at: string | null
          failure_reason: string | null
          id: string
          metadata: Json | null
          producer_id: string
          prospect_id: string
          quote_id: string
          read_at: string | null
          sent_at: string | null
          template_name: string | null
          waba_message_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          delivered_at?: string | null
          delivery_status?:
            | Database["public"]["Enums"]["delivery_status"]
            | null
          direction: Database["public"]["Enums"]["message_direction"]
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          metadata?: Json | null
          producer_id: string
          prospect_id: string
          quote_id: string
          read_at?: string | null
          sent_at?: string | null
          template_name?: string | null
          waba_message_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          delivered_at?: string | null
          delivery_status?:
            | Database["public"]["Enums"]["delivery_status"]
            | null
          direction?: Database["public"]["Enums"]["message_direction"]
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          metadata?: Json | null
          producer_id?: string
          prospect_id?: string
          quote_id?: string
          read_at?: string | null
          sent_at?: string | null
          template_name?: string | null
          waba_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "producers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_producer_ids: { Args: never; Returns: string[] }
    }
    Enums: {
      ai_classification:
        | "interested"
        | "needs_more_info"
        | "price_objection"
        | "coverage_objection"
        | "wants_human_contact"
        | "not_interested"
        | "opt_out_requested"
        | "unclear_response"
        | "angry_or_sensitive"
      ai_suggested_action: "respond" | "escalate" | "close"
      consent_status: "unknown" | "granted" | "revoked"
      delivery_status: "pending" | "sent" | "delivered" | "read" | "failed"
      handoff_reason:
        | "prospect_interested"
        | "prospect_has_question"
        | "price_objection"
        | "coverage_objection"
        | "human_requested"
        | "low_confidence_classification"
        | "angry_or_sensitive"
        | "unclear_response"
        | "is_bot_question"
      handoff_status: "pending" | "accepted" | "resolved"
      insurance_type: "auto" | "home" | "life" | "commercial" | "other"
      member_role: "owner" | "admin" | "agent" | "viewer"
      message_direction: "outbound" | "inbound"
      producer_plan: "pilot" | "starter" | "pro" | "enterprise"
      producer_status: "active" | "inactive" | "suspended"
      quote_event_actor: "system" | "producer" | "webhook"
      quote_status:
        | "pending_follow_up"
        | "scheduled"
        | "pending_approval"
        | "contacted"
        | "no_response_1"
        | "contacted_2"
        | "responded"
        | "interested"
        | "human_handoff"
        | "closed_won"
        | "closed_lost"
        | "no_response"
        | "paused"
        | "cancelled"
        | "opt_out"
        | "error"
      send_mode: "manual" | "automatic"
      waba_provider: "twilio" | "360dialog" | "meta_direct"
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
    Enums: {
      ai_classification: [
        "interested",
        "needs_more_info",
        "price_objection",
        "coverage_objection",
        "wants_human_contact",
        "not_interested",
        "opt_out_requested",
        "unclear_response",
        "angry_or_sensitive",
      ],
      ai_suggested_action: ["respond", "escalate", "close"],
      consent_status: ["unknown", "granted", "revoked"],
      delivery_status: ["pending", "sent", "delivered", "read", "failed"],
      handoff_reason: [
        "prospect_interested",
        "prospect_has_question",
        "price_objection",
        "coverage_objection",
        "human_requested",
        "low_confidence_classification",
        "angry_or_sensitive",
        "unclear_response",
        "is_bot_question",
      ],
      handoff_status: ["pending", "accepted", "resolved"],
      insurance_type: ["auto", "home", "life", "commercial", "other"],
      member_role: ["owner", "admin", "agent", "viewer"],
      message_direction: ["outbound", "inbound"],
      producer_plan: ["pilot", "starter", "pro", "enterprise"],
      producer_status: ["active", "inactive", "suspended"],
      quote_event_actor: ["system", "producer", "webhook"],
      quote_status: [
        "pending_follow_up",
        "scheduled",
        "pending_approval",
        "contacted",
        "no_response_1",
        "contacted_2",
        "responded",
        "interested",
        "human_handoff",
        "closed_won",
        "closed_lost",
        "no_response",
        "paused",
        "cancelled",
        "opt_out",
        "error",
      ],
      send_mode: ["manual", "automatic"],
      waba_provider: ["twilio", "360dialog", "meta_direct"],
    },
  },
} as const

