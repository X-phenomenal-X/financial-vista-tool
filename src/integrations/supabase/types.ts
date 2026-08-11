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
  public: {
    Tables: {
      accounts: {
        Row: {
          balance: number
          created_at: string
          id: string
          kind: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          kind: string
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          kind?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json
          entity: string
          entity_id: string | null
          id: string
          summary: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          entity: string
          entity_id?: string | null
          id?: string
          summary: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: string
          summary?: string
          user_id?: string
        }
        Relationships: []
      }
      budget_categories: {
        Row: {
          created_at: string
          id: string
          kind: string
          name: string
          planned: number
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          name: string
          planned?: number
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          name?: string
          planned?: number
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      debts: {
        Row: {
          apr: number
          balance: number
          created_at: string
          credit_limit: number | null
          due_date: string | null
          id: string
          kind: string
          minimum_estimated: boolean
          minimum_payment: number
          name: string
          notes: string | null
          pending: number
          priority: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          apr?: number
          balance?: number
          created_at?: string
          credit_limit?: number | null
          due_date?: string | null
          id?: string
          kind?: string
          minimum_estimated?: boolean
          minimum_payment?: number
          name: string
          notes?: string | null
          pending?: number
          priority?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          apr?: number
          balance?: number
          created_at?: string
          credit_limit?: number | null
          due_date?: string | null
          id?: string
          kind?: string
          minimum_estimated?: boolean
          minimum_payment?: number
          name?: string
          notes?: string | null
          pending?: number
          priority?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          active: boolean
          created_at: string
          current_amount: number
          id: string
          kind: string
          name: string
          notes: string | null
          sort_order: number
          target_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          current_amount?: number
          id?: string
          kind?: string
          name: string
          notes?: string | null
          sort_order?: number
          target_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          current_amount?: number
          id?: string
          kind?: string
          name?: string
          notes?: string | null
          sort_order?: number
          target_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      import_items: {
        Row: {
          amount: number
          category: string | null
          confidence: number
          created_at: string
          decision: string
          description: string | null
          duplicate_of: string | null
          id: string
          import_id: string
          item_type: string
          occurred_on: string | null
          raw: string | null
          tx_type: string
          user_id: string
        }
        Insert: {
          amount?: number
          category?: string | null
          confidence?: number
          created_at?: string
          decision?: string
          description?: string | null
          duplicate_of?: string | null
          id?: string
          import_id: string
          item_type?: string
          occurred_on?: string | null
          raw?: string | null
          tx_type?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          confidence?: number
          created_at?: string
          decision?: string
          description?: string | null
          duplicate_of?: string | null
          id?: string
          import_id?: string
          item_type?: string
          occurred_on?: string | null
          raw?: string | null
          tx_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_items_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_items_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "statement_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      net_worth_snapshots: {
        Row: {
          assets_total: number | null
          car_loan_total: number
          cash_total: number
          created_at: string
          high_interest_debt_total: number
          id: string
          liabilities_total: number | null
          net_worth: number | null
          other_assets_total: number
          other_liabilities_total: number
          retirement_total: number
          snapshot_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assets_total?: number | null
          car_loan_total?: number
          cash_total?: number
          created_at?: string
          high_interest_debt_total?: number
          id?: string
          liabilities_total?: number | null
          net_worth?: number | null
          other_assets_total?: number
          other_liabilities_total?: number
          retirement_total?: number
          snapshot_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assets_total?: number | null
          car_loan_total?: number
          cash_total?: number
          created_at?: string
          high_interest_debt_total?: number
          id?: string
          liabilities_total?: number | null
          net_worth?: number | null
          other_assets_total?: number
          other_liabilities_total?: number
          retirement_total?: number
          snapshot_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          id: string
          read: boolean
          reminder_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          channel?: string
          created_at?: string
          id?: string
          read?: boolean
          reminder_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          id?: string
          read?: boolean
          reminder_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      payday_plan_items: {
        Row: {
          actual_amount: number | null
          amount: number
          created_at: string
          debt_id: string | null
          id: string
          kind: string
          label: string
          paid: boolean
          plan_id: string
          sort_order: number
          user_id: string
        }
        Insert: {
          actual_amount?: number | null
          amount?: number
          created_at?: string
          debt_id?: string | null
          id?: string
          kind?: string
          label: string
          paid?: boolean
          plan_id: string
          sort_order?: number
          user_id: string
        }
        Update: {
          actual_amount?: number | null
          amount?: number
          created_at?: string
          debt_id?: string | null
          id?: string
          kind?: string
          label?: string
          paid?: boolean
          plan_id?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payday_plan_items_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payday_plan_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "payday_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      payday_plans: {
        Row: {
          buffer: number
          created_at: string
          expected_pay: number
          extra_debt_payment: number
          id: string
          notes: string | null
          pay_date: string
          spending_allowance: number
          starting_cash: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          buffer?: number
          created_at?: string
          expected_pay?: number
          extra_debt_payment?: number
          id?: string
          notes?: string | null
          pay_date: string
          spending_allowance?: number
          starting_cash?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          buffer?: number
          created_at?: string
          expected_pay?: number
          extra_debt_payment?: number
          id?: string
          notes?: string | null
          pay_date?: string
          spending_allowance?: number
          starting_cash?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          currency: string
          display_name: string | null
          email: string | null
          is_owner: boolean
          notifications_browser: boolean
          seeded: boolean
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          display_name?: string | null
          email?: string | null
          is_owner?: boolean
          notifications_browser?: boolean
          seeded?: boolean
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          display_name?: string | null
          email?: string | null
          is_owner?: boolean
          notifications_browser?: boolean
          seeded?: boolean
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_transaction_occurrences: {
        Row: {
          actual_amount: number | null
          completed_at: string | null
          created_at: string
          due_date: string
          expected_amount: number
          id: string
          linked_transaction_id: string | null
          metadata: Json
          recurring_transaction_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_amount?: number | null
          completed_at?: string | null
          created_at?: string
          due_date: string
          expected_amount: number
          id?: string
          linked_transaction_id?: string | null
          metadata?: Json
          recurring_transaction_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_amount?: number | null
          completed_at?: string | null
          created_at?: string
          due_date?: string
          expected_amount?: number
          id?: string
          linked_transaction_id?: string | null
          metadata?: Json
          recurring_transaction_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transaction_occurrences_recurring_transaction_id_fkey"
            columns: ["recurring_transaction_id"]
            isOneToOne: false
            referencedRelation: "recurring_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_transactions: {
        Row: {
          account_id: string | null
          amount: number
          autopay: boolean
          cadence: Database["public"]["Enums"]["recurring_cadence"]
          category: string | null
          created_at: string
          currency: string
          custom_interval_days: number | null
          debt_id: string | null
          description: string | null
          end_date: string | null
          goal_id: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["recurring_transaction_kind"]
          last_generated_at: string | null
          merchant: string | null
          metadata: Json
          name: string
          next_due_date: string
          reminder_days_before: number[]
          source: Database["public"]["Enums"]["recurring_source"]
          start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          autopay?: boolean
          cadence: Database["public"]["Enums"]["recurring_cadence"]
          category?: string | null
          created_at?: string
          currency?: string
          custom_interval_days?: number | null
          debt_id?: string | null
          description?: string | null
          end_date?: string | null
          goal_id?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["recurring_transaction_kind"]
          last_generated_at?: string | null
          merchant?: string | null
          metadata?: Json
          name: string
          next_due_date: string
          reminder_days_before?: number[]
          source?: Database["public"]["Enums"]["recurring_source"]
          start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          autopay?: boolean
          cadence?: Database["public"]["Enums"]["recurring_cadence"]
          category?: string | null
          created_at?: string
          currency?: string
          custom_interval_days?: number | null
          debt_id?: string | null
          description?: string | null
          end_date?: string | null
          goal_id?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["recurring_transaction_kind"]
          last_generated_at?: string | null
          merchant?: string | null
          metadata?: Json
          name?: string
          next_due_date?: string
          reminder_days_before?: number[]
          source?: Database["public"]["Enums"]["recurring_source"]
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          completed: boolean
          created_at: string
          due_at: string
          id: string
          kind: string
          last_fired_at: string | null
          notes: string | null
          notify_browser: boolean
          paused: boolean
          recurrence: string
          snoozed_until: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          due_at: string
          id?: string
          kind?: string
          last_fired_at?: string | null
          notes?: string | null
          notify_browser?: boolean
          paused?: boolean
          recurrence?: string
          snoozed_until?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          due_at?: string
          id?: string
          kind?: string
          last_fired_at?: string | null
          notes?: string | null
          notify_browser?: boolean
          paused?: boolean
          recurrence?: string
          snoozed_until?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      statement_imports: {
        Row: {
          account_id: string | null
          created_at: string
          debt_id: string | null
          detected: Json
          doc_kind: string
          file_name: string
          file_size: number
          file_type: string
          id: string
          items_accepted: number
          items_total: number
          statement_end: string | null
          statement_start: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          debt_id?: string | null
          detected?: Json
          doc_kind?: string
          file_name: string
          file_size?: number
          file_type?: string
          id?: string
          items_accepted?: number
          items_total?: number
          statement_end?: string | null
          statement_start?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          debt_id?: string | null
          detected?: Json
          doc_kind?: string
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          items_accepted?: number
          items_total?: number
          statement_end?: string | null
          statement_start?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "statement_imports_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statement_imports_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_rules: {
        Row: {
          action: Json
          created_at: string
          id: string
          is_active: boolean
          match_field: string
          match_operator: string
          match_value: string
          name: string
          priority: number
          updated_at: string
          user_id: string
        }
        Insert: {
          action: Json
          created_at?: string
          id?: string
          is_active?: boolean
          match_field: string
          match_operator: string
          match_value: string
          name: string
          priority?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          match_field?: string
          match_operator?: string
          match_value?: string
          name?: string
          priority?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          category: string | null
          cleared: boolean
          created_at: string
          debt_id: string | null
          description: string | null
          id: string
          need_want: string | null
          occurred_on: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount?: number
          category?: string | null
          cleared?: boolean
          created_at?: string
          debt_id?: string | null
          description?: string | null
          id?: string
          need_want?: string | null
          occurred_on?: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string | null
          cleared?: boolean
          created_at?: string
          debt_id?: string | null
          description?: string | null
          id?: string
          need_want?: string | null
          occurred_on?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_signup_open: { Args: never; Returns: boolean }
      next_recurring_date: {
        Args: {
          cadence_value: Database["public"]["Enums"]["recurring_cadence"]
          current_date_value: string
          interval_days?: number
        }
        Returns: string
      }
    }
    Enums: {
      recurring_cadence:
        | "weekly"
        | "biweekly"
        | "semimonthly"
        | "monthly"
        | "quarterly"
        | "semiannual"
        | "annual"
        | "custom"
      recurring_source:
        | "manual"
        | "statement_detection"
        | "transaction_rule"
        | "payday_plan"
        | "import"
      recurring_transaction_kind:
        | "income"
        | "expense"
        | "transfer"
        | "debt_payment"
        | "subscription"
        | "bill"
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
      recurring_cadence: [
        "weekly",
        "biweekly",
        "semimonthly",
        "monthly",
        "quarterly",
        "semiannual",
        "annual",
        "custom",
      ],
      recurring_source: [
        "manual",
        "statement_detection",
        "transaction_rule",
        "payday_plan",
        "import",
      ],
      recurring_transaction_kind: [
        "income",
        "expense",
        "transfer",
        "debt_payment",
        "subscription",
        "bill",
      ],
    },
  },
} as const
