export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      ai_agent_config: {
        Row: {
          agent_name: string;
          persona_tone: string;
          tenant_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          agent_name?: string;
          persona_tone?: string;
          tenant_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          agent_name?: string;
          persona_tone?: string;
          tenant_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_agent_config_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: true;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_agent_config_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
        ];
      };
      appointments: {
        Row: {
          appointment_type: string;
          client_id: string | null;
          created_at: string;
          duration_min: number;
          id: string;
          lead_id: string | null;
          origin: string;
          staff_id: string;
          start_at: string;
          tenant_id: string;
          time_range: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          appointment_type?: string;
          client_id?: string | null;
          created_at?: string;
          duration_min?: number;
          id?: string;
          lead_id?: string | null;
          origin?: string;
          staff_id: string;
          start_at: string;
          tenant_id: string;
          time_range?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          appointment_type?: string;
          client_id?: string | null;
          created_at?: string;
          duration_min?: number;
          id?: string;
          lead_id?: string | null;
          origin?: string;
          staff_id?: string;
          start_at?: string;
          tenant_id?: string;
          time_range?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      client_contact_links: {
        Row: {
          client_id: string;
          contact_id: string;
          created_at: string;
          role_label: string;
        };
        Insert: {
          client_id: string;
          contact_id: string;
          created_at?: string;
          role_label?: string;
        };
        Update: {
          client_id?: string;
          contact_id?: string;
          created_at?: string;
          role_label?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_contact_links_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_contact_links_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      client_document_config: {
        Row: {
          catalog_id: string | null;
          client_id: string;
          created_at: string;
          enabled: boolean;
          id: string;
          name: string;
          next_due_date: string | null;
          periodicity: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          catalog_id?: string | null;
          client_id: string;
          created_at?: string;
          enabled?: boolean;
          id?: string;
          name: string;
          next_due_date?: string | null;
          periodicity?: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          catalog_id?: string | null;
          client_id?: string;
          created_at?: string;
          enabled?: boolean;
          id?: string;
          name?: string;
          next_due_date?: string | null;
          periodicity?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_document_config_catalog_id_fkey";
            columns: ["catalog_id"];
            isOneToOne: false;
            referencedRelation: "document_catalog";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_document_config_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_document_config_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          cnpj: string;
          created_at: string;
          id: string;
          name: string;
          notes: string;
          responsible_staff_id: string | null;
          tax_regime: string;
          tenant_id: string;
          updated_at: string;
          whatsapp_number: string;
        };
        Insert: {
          cnpj: string;
          created_at?: string;
          id?: string;
          name: string;
          notes?: string;
          responsible_staff_id?: string | null;
          tax_regime: string;
          tenant_id: string;
          updated_at?: string;
          whatsapp_number: string;
        };
        Update: {
          cnpj?: string;
          created_at?: string;
          id?: string;
          name?: string;
          notes?: string;
          responsible_staff_id?: string | null;
          tax_regime?: string;
          tenant_id?: string;
          updated_at?: string;
          whatsapp_number?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clients_responsible_staff_id_fkey";
            columns: ["responsible_staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clients_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      consent_policy_versions: {
        Row: {
          id: string;
          published_at: string;
          published_by: string | null;
          tenant_id: string;
          text: string;
          version_number: number;
        };
        Insert: {
          id?: string;
          published_at?: string;
          published_by?: string | null;
          tenant_id: string;
          text: string;
          version_number?: number;
        };
        Update: {
          id?: string;
          published_at?: string;
          published_by?: string | null;
          tenant_id?: string;
          text?: string;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "consent_policy_versions_published_by_fkey";
            columns: ["published_by"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consent_policy_versions_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      contacts: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          tenant_id: string;
          updated_at: string;
          whatsapp_number: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          tenant_id: string;
          updated_at?: string;
          whatsapp_number: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          tenant_id?: string;
          updated_at?: string;
          whatsapp_number?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contacts_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      departments: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          slug: string;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "departments_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      document_catalog: {
        Row: {
          created_at: string;
          default_periodicity: string;
          id: string;
          name: string;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          default_periodicity?: string;
          id?: string;
          name: string;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          default_periodicity?: string;
          id?: string;
          name?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "document_catalog_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      document_submissions: {
        Row: {
          client_document_config_id: string;
          id: string;
          note: string;
          submitted_at: string;
          tenant_id: string;
        };
        Insert: {
          client_document_config_id: string;
          id?: string;
          note?: string;
          submitted_at?: string;
          tenant_id: string;
        };
        Update: {
          client_document_config_id?: string;
          id?: string;
          note?: string;
          submitted_at?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "document_submissions_client_document_config_id_fkey";
            columns: ["client_document_config_id"];
            isOneToOne: false;
            referencedRelation: "client_document_config";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_submissions_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      knowledge_base_documents: {
        Row: {
          created_at: string;
          file_name: string;
          file_type: string;
          id: string;
          size_bytes: number;
          storage_path: string;
          tenant_id: string;
          uploaded_by: string | null;
        };
        Insert: {
          created_at?: string;
          file_name: string;
          file_type: string;
          id?: string;
          size_bytes: number;
          storage_path: string;
          tenant_id: string;
          uploaded_by?: string | null;
        };
        Update: {
          created_at?: string;
          file_name?: string;
          file_type?: string;
          id?: string;
          size_bytes?: number;
          storage_path?: string;
          tenant_id?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "knowledge_base_documents_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "knowledge_base_documents_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
        ];
      };
      knowledge_base_faq: {
        Row: {
          answer: string;
          created_at: string;
          id: string;
          question: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          answer: string;
          created_at?: string;
          id?: string;
          question: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          answer?: string;
          created_at?: string;
          id?: string;
          question?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "knowledge_base_faq_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      leads: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          reason: string;
          segment: string;
          stage: string;
          tenant_id: string;
          updated_at: string;
          whatsapp_number: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          reason?: string;
          segment?: string;
          stage?: string;
          tenant_id: string;
          updated_at?: string;
          whatsapp_number?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          reason?: string;
          segment?: string;
          stage?: string;
          tenant_id?: string;
          updated_at?: string;
          whatsapp_number?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "leads_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      staff: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          invited_at: string;
          is_admin: boolean;
          name: string;
          status: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id: string;
          invited_at?: string;
          is_admin?: boolean;
          name: string;
          status?: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          invited_at?: string;
          is_admin?: boolean;
          name?: string;
          status?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_departments: {
        Row: {
          department_id: string;
          staff_id: string;
        };
        Insert: {
          department_id: string;
          staff_id: string;
        };
        Update: {
          department_id?: string;
          staff_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_departments_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_departments_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_time_blocks: {
        Row: {
          created_at: string;
          end_at: string;
          id: string;
          reason: string;
          staff_id: string;
          start_at: string;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          end_at: string;
          id?: string;
          reason?: string;
          staff_id: string;
          start_at: string;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          end_at?: string;
          id?: string;
          reason?: string;
          staff_id?: string;
          start_at?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_time_blocks_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_time_blocks_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_integration_secrets: {
        Row: {
          provider: string;
          secret_value: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          provider: string;
          secret_value: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          provider?: string;
          secret_value?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_integration_secrets_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_integrations: {
        Row: {
          is_configured: boolean;
          metadata: Json;
          provider: string;
          tenant_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          is_configured?: boolean;
          metadata?: Json;
          provider: string;
          tenant_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          is_configured?: boolean;
          metadata?: Json;
          provider?: string;
          tenant_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_integrations_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_integrations_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
        ];
      };
      tenants: {
        Row: {
          created_at: string;
          id: string;
          meta_verification_status: string;
          name: string;
          plan: string;
          updated_at: string;
          whatsapp_number: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          meta_verification_status?: string;
          name: string;
          plan?: string;
          updated_at?: string;
          whatsapp_number?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          meta_verification_status?: string;
          name?: string;
          plan?: string;
          updated_at?: string;
          whatsapp_number?: string | null;
        };
        Relationships: [];
      };
      whatsapp_message_templates: {
        Row: {
          body: string;
          category: string;
          created_at: string;
          id: string;
          name: string;
          status: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          body: string;
          category: string;
          created_at?: string;
          id?: string;
          name: string;
          status?: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          category?: string;
          created_at?: string;
          id?: string;
          name?: string;
          status?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_templates_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_staff_invite: {
        Args: { p_name?: string };
        Returns: {
          created_at: string;
          email: string;
          id: string;
          invited_at: string;
          is_admin: boolean;
          name: string;
          status: string;
          tenant_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "staff";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      current_tenant_id: { Args: never; Returns: string };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
