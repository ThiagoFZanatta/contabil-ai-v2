export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          plan: string;
          whatsapp_number: string | null;
          meta_verification_status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          plan?: string;
          whatsapp_number?: string | null;
          meta_verification_status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          plan?: string;
          whatsapp_number?: string | null;
          meta_verification_status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      staff: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          email: string;
          is_admin: boolean;
          status: string;
          invited_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          tenant_id: string;
          name: string;
          email: string;
          is_admin?: boolean;
          status?: string;
          invited_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          email?: string;
          is_admin?: boolean;
          status?: string;
          invited_at?: string;
          created_at?: string;
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
      departments: {
        Row: {
          id: string;
          tenant_id: string;
          slug: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          slug: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          slug?: string;
          name?: string;
          created_at?: string;
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
      staff_departments: {
        Row: {
          staff_id: string;
          department_id: string;
        };
        Insert: {
          staff_id: string;
          department_id: string;
        };
        Update: {
          staff_id?: string;
          department_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_departments_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_departments_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          cnpj: string;
          tax_regime: string;
          whatsapp_number: string;
          responsible_staff_id: string | null;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          cnpj: string;
          tax_regime: string;
          whatsapp_number: string;
          responsible_staff_id?: string | null;
          notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          cnpj?: string;
          tax_regime?: string;
          whatsapp_number?: string;
          responsible_staff_id?: string | null;
          notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clients_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clients_responsible_staff_id_fkey";
            columns: ["responsible_staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
        ];
      };
      document_catalog: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          default_periodicity: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          default_periodicity?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          default_periodicity?: string;
          created_at?: string;
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
      client_document_config: {
        Row: {
          id: string;
          tenant_id: string;
          client_id: string;
          catalog_id: string | null;
          name: string;
          periodicity: string;
          enabled: boolean;
          next_due_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          client_id: string;
          catalog_id?: string | null;
          name: string;
          periodicity?: string;
          enabled?: boolean;
          next_due_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          client_id?: string;
          catalog_id?: string | null;
          name?: string;
          periodicity?: string;
          enabled?: boolean;
          next_due_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_document_config_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_document_config_catalog_id_fkey";
            columns: ["catalog_id"];
            isOneToOne: false;
            referencedRelation: "document_catalog";
            referencedColumns: ["id"];
          },
        ];
      };
      document_submissions: {
        Row: {
          id: string;
          tenant_id: string;
          client_document_config_id: string;
          submitted_at: string;
          note: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          client_document_config_id: string;
          submitted_at?: string;
          note?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          client_document_config_id?: string;
          submitted_at?: string;
          note?: string;
        };
        Relationships: [
          {
            foreignKeyName: "document_submissions_client_document_config_id_fkey";
            columns: ["client_document_config_id"];
            isOneToOne: false;
            referencedRelation: "client_document_config";
            referencedColumns: ["id"];
          },
        ];
      };
      contacts: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          whatsapp_number: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          whatsapp_number: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          whatsapp_number?: string;
          created_at?: string;
          updated_at?: string;
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
      client_contact_links: {
        Row: {
          client_id: string;
          contact_id: string;
          role_label: string;
          created_at: string;
        };
        Insert: {
          client_id: string;
          contact_id: string;
          role_label?: string;
          created_at?: string;
        };
        Update: {
          client_id?: string;
          contact_id?: string;
          role_label?: string;
          created_at?: string;
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      current_tenant_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      accept_staff_invite: {
        Args: { p_name?: string | null };
        Returns: Database["public"]["Tables"]["staff"]["Row"];
      };
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
