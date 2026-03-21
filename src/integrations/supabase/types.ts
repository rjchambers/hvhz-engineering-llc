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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      client_profiles: {
        Row: {
          company_address: string | null
          company_city: string | null
          company_name: string | null
          company_state: string | null
          company_zip: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          stripe_customer_id: string | null
          terms_accepted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_address?: string | null
          company_city?: string | null
          company_name?: string | null
          company_state?: string | null
          company_zip?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          stripe_customer_id?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_address?: string | null
          company_city?: string | null
          company_name?: string | null
          company_state?: string | null
          company_zip?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          stripe_customer_id?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      engineer_profiles: {
        Row: {
          created_at: string
          digital_signing_enabled: boolean | null
          firm_name: string | null
          full_name: string
          id: string
          p12_certificate_path: string | null
          pe_expiry: string | null
          pe_license_number: string | null
          pe_license_state: string | null
          signature_image_url: string | null
          stamp_image_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          digital_signing_enabled?: boolean | null
          firm_name?: string | null
          full_name: string
          id?: string
          p12_certificate_path?: string | null
          pe_expiry?: string | null
          pe_license_number?: string | null
          pe_license_state?: string | null
          signature_image_url?: string | null
          stamp_image_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          digital_signing_enabled?: boolean | null
          firm_name?: string | null
          full_name?: string
          id?: string
          p12_certificate_path?: string | null
          pe_expiry?: string | null
          pe_license_number?: string | null
          pe_license_state?: string | null
          signature_image_url?: string | null
          stamp_image_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      field_data: {
        Row: {
          created_at: string
          form_data: Json
          id: string
          service_type: string
          submitted_at: string | null
          submitted_by: string | null
          work_order_id: string
        }
        Insert: {
          created_at?: string
          form_data?: Json
          id?: string
          service_type: string
          submitted_at?: string | null
          submitted_by?: string | null
          work_order_id: string
        }
        Update: {
          created_at?: string
          form_data?: Json
          id?: string
          service_type?: string
          submitted_at?: string | null
          submitted_by?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_data_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: true
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          client_id: string
          created_at: string
          distance_fee: number | null
          id: string
          job_address: string | null
          job_city: string | null
          job_county: string | null
          job_zip: string | null
          notes: string | null
          roof_area_sqft: number | null
          roof_data: Json | null
          services: string[]
          status: string
          stripe_session_id: string | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          distance_fee?: number | null
          id?: string
          job_address?: string | null
          job_city?: string | null
          job_county?: string | null
          job_zip?: string | null
          notes?: string | null
          roof_area_sqft?: number | null
          roof_data?: Json | null
          services: string[]
          status?: string
          stripe_session_id?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          distance_fee?: number | null
          id?: string
          job_address?: string | null
          job_city?: string | null
          job_county?: string | null
          job_zip?: string | null
          notes?: string | null
          roof_area_sqft?: number | null
          roof_data?: Json | null
          services?: string[]
          status?: string
          stripe_session_id?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      outsource_partners: {
        Row: {
          active: boolean
          contact_email: string
          contact_name: string | null
          created_at: string
          email_template: string | null
          id: string
          name: string
          services: string[]
          updated_at: string
        }
        Insert: {
          active?: boolean
          contact_email: string
          contact_name?: string | null
          created_at?: string
          email_template?: string | null
          id?: string
          name: string
          services?: string[]
          updated_at?: string
        }
        Update: {
          active?: boolean
          contact_email?: string
          contact_name?: string | null
          created_at?: string
          email_template?: string | null
          id?: string
          name?: string
          services?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      service_config: {
        Row: {
          active: boolean
          price_override: number | null
          service_key: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          price_override?: number | null
          service_key: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          price_override?: number | null
          service_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      signed_documents: {
        Row: {
          fac_rule_ref: string | null
          id: string
          is_cryptographically_signed: boolean | null
          pe_notes: string | null
          signed_at: string
          signed_by: string
          signed_pdf_url: string
          signing_method: string | null
          work_order_id: string
        }
        Insert: {
          fac_rule_ref?: string | null
          id?: string
          is_cryptographically_signed?: boolean | null
          pe_notes?: string | null
          signed_at?: string
          signed_by: string
          signed_pdf_url: string
          signing_method?: string | null
          work_order_id: string
        }
        Update: {
          fac_rule_ref?: string | null
          id?: string
          is_cryptographically_signed?: boolean | null
          pe_notes?: string | null
          signed_at?: string
          signed_by?: string
          signed_pdf_url?: string
          signing_method?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signed_documents_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: true
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      work_order_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          section_tag: string | null
          sort_order: number | null
          storage_path: string
          uploaded_by: string
          work_order_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          section_tag?: string | null
          sort_order?: number | null
          storage_path: string
          uploaded_by: string
          work_order_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          section_tag?: string | null
          sort_order?: number | null
          storage_path?: string
          uploaded_by?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_photos_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          assigned_engineer_id: string | null
          assigned_technician_id: string | null
          client_id: string
          created_at: string
          id: string
          order_id: string
          outsource_company: string | null
          outsource_email_sent_at: string | null
          pe_notes: string | null
          pe_reviewed_at: string | null
          rejection_notes: string | null
          result_pdf_url: string | null
          scheduled_date: string | null
          service_type: string
          signed_at: string | null
          signed_report_url: string | null
          status: string
          submitted_at: string | null
          unsigned_report_url: string | null
          updated_at: string
        }
        Insert: {
          assigned_engineer_id?: string | null
          assigned_technician_id?: string | null
          client_id: string
          created_at?: string
          id?: string
          order_id: string
          outsource_company?: string | null
          outsource_email_sent_at?: string | null
          pe_notes?: string | null
          pe_reviewed_at?: string | null
          rejection_notes?: string | null
          result_pdf_url?: string | null
          scheduled_date?: string | null
          service_type: string
          signed_at?: string | null
          signed_report_url?: string | null
          status?: string
          submitted_at?: string | null
          unsigned_report_url?: string | null
          updated_at?: string
        }
        Update: {
          assigned_engineer_id?: string | null
          assigned_technician_id?: string | null
          client_id?: string
          created_at?: string
          id?: string
          order_id?: string
          outsource_company?: string | null
          outsource_email_sent_at?: string | null
          pe_notes?: string | null
          pe_reviewed_at?: string | null
          rejection_notes?: string | null
          result_pdf_url?: string | null
          scheduled_date?: string | null
          service_type?: string
          signed_at?: string | null
          signed_report_url?: string | null
          status?: string
          submitted_at?: string | null
          unsigned_report_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
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
  public: {
    Enums: {},
  },
} as const
