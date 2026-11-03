/**
 * مولَّد من السكيما — لا تعدّله بيدك.
 *
 * لإعادة توليده بعد أي تغيير في القاعدة:
 *   npx supabase gen types typescript \
 *     --project-id mcuyvxbwvdvvmmyesnbk > supabase/database.types.ts
 *
 * ملاحظة على الأرقام: أعمدة bigint تظهر هنا `number`. كل مبالغنا تحت
 * 2^53 بفرق هائل (٩ كوادريليون فلس)، فلا خطر. لكن لا تستخدم `number`
 * لو أضفت لاحقًا عمودًا يحمل معرّفًا كبيرًا.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          archived: boolean
          color: string
          created_at: string
          currency_code: string | null
          deleted_at: string | null
          exclude_from_spending: boolean
          id: string
          kind: Database["public"]["Enums"]["account_kind"]
          name: string
          opening_balance: number
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          color?: string
          created_at?: string
          currency_code?: string | null
          deleted_at?: string | null
          exclude_from_spending?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["account_kind"]
          name: string
          opening_balance?: number
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          color?: string
          created_at?: string
          currency_code?: string | null
          deleted_at?: string | null
          exclude_from_spending?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["account_kind"]
          name?: string
          opening_balance?: number
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          dismissed_at: string | null
          id: string
          kind: string
          raised_at: string
          severity: string
          subject_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          dismissed_at?: string | null
          id?: string
          kind: string
          raised_at?: string
          severity?: string
          subject_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          dismissed_at?: string | null
          id?: string
          kind?: string
          raised_at?: string
          severity?: string
          subject_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          archived: boolean
          color: string
          created_at: string
          deleted_at: string | null
          icon: string
          id: string
          keywords: string[]
          monthly_limit: number | null
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          color: string
          created_at?: string
          deleted_at?: string | null
          icon: string
          id?: string
          keywords?: string[]
          monthly_limit?: number | null
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          color?: string
          created_at?: string
          deleted_at?: string | null
          icon?: string
          id?: string
          keywords?: string[]
          monthly_limit?: number | null
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fixed_commitments: {
        Row: {
          account_id: string | null
          active: boolean
          amount: number
          auto_deduct: boolean
          category_id: string | null
          created_at: string
          day_of_month: number | null
          deleted_at: string | null
          id: string
          is_approximate: boolean
          kind: Database["public"]["Enums"]["commitment_kind"]
          name: string
          started_on: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          active?: boolean
          amount?: number
          auto_deduct?: boolean
          category_id?: string | null
          created_at?: string
          day_of_month?: number | null
          deleted_at?: string | null
          id?: string
          is_approximate?: boolean
          kind?: Database["public"]["Enums"]["commitment_kind"]
          name: string
          started_on?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          active?: boolean
          amount?: number
          auto_deduct?: boolean
          category_id?: string | null
          created_at?: string
          day_of_month?: number | null
          deleted_at?: string | null
          id?: string
          is_approximate?: boolean
          kind?: Database["public"]["Enums"]["commitment_kind"]
          name?: string
          started_on?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_commitments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_commitments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      income_overrides: {
        Row: {
          actual_amount: number
          created_at: string
          deleted_at: string | null
          extras: Json
          id: string
          month: string
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_amount: number
          created_at?: string
          deleted_at?: string | null
          extras?: Json
          id?: string
          month: string
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_amount?: number
          created_at?: string
          deleted_at?: string | null
          extras?: Json
          id?: string
          month?: string
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      income_sources: {
        Row: {
          account_id: string | null
          active: boolean
          created_at: string
          deleted_at: string | null
          id: string
          is_primary: boolean
          name: string
          pay_day_of_month: number | null
          typical_amount: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_primary?: boolean
          name: string
          pay_day_of_month?: number | null
          typical_amount?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          pay_day_of_month?: number | null
          typical_amount?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_sources_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      installments: {
        Row: {
          account_id: string | null
          active: boolean
          created_at: string
          deleted_at: string | null
          id: string
          monthly_amount: number | null
          name: string
          principal: number | null
          remaining: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          monthly_amount?: number | null
          name: string
          principal?: number | null
          remaining: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          monthly_amount?: number | null
          name?: string
          principal?: number | null
          remaining?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          alert_duplicate_subscriptions: boolean
          alert_salary_day_rollover: boolean
          category_warn_at: number
          created_at: string
          currency_code: string
          currency_symbol: string
          daily_savings_reminder_at: string | null
          income_shape: Database["public"]["Enums"]["income_shape"]
          locale: string
          minor_units: number
          pay_day_of_month: number | null
          schema_version: number
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_duplicate_subscriptions?: boolean
          alert_salary_day_rollover?: boolean
          category_warn_at?: number
          created_at?: string
          currency_code?: string
          currency_symbol?: string
          daily_savings_reminder_at?: string | null
          income_shape?: Database["public"]["Enums"]["income_shape"]
          locale?: string
          minor_units?: number
          pay_day_of_month?: number | null
          schema_version?: number
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_duplicate_subscriptions?: boolean
          alert_salary_day_rollover?: boolean
          category_warn_at?: number
          created_at?: string
          currency_code?: string
          currency_symbol?: string
          daily_savings_reminder_at?: string | null
          income_shape?: Database["public"]["Enums"]["income_shape"]
          locale?: string
          minor_units?: number
          pay_day_of_month?: number | null
          schema_version?: number
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      savings_deposits: {
        Row: {
          amount: number
          created_at: string
          deleted_at: string | null
          deposit_date: string
          goal_id: string
          id: string
          updated_at: string
          user_id: string
          via: string
        }
        Insert: {
          amount: number
          created_at?: string
          deleted_at?: string | null
          deposit_date: string
          goal_id: string
          id?: string
          updated_at?: string
          user_id: string
          via?: string
        }
        Update: {
          amount?: number
          created_at?: string
          deleted_at?: string | null
          deposit_date?: string
          goal_id?: string
          id?: string
          updated_at?: string
          user_id?: string
          via?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_deposits_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_goals: {
        Row: {
          account_id: string | null
          active: boolean
          amount_per_period: number
          cadence: Database["public"]["Enums"]["savings_cadence"]
          color: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          target_amount: number | null
          target_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          active?: boolean
          amount_per_period: number
          cadence?: Database["public"]["Enums"]["savings_cadence"]
          color?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          target_amount?: number | null
          target_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          active?: boolean
          amount_per_period?: number
          cadence?: Database["public"]["Enums"]["savings_cadence"]
          color?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          target_amount?: number | null
          target_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_goals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      sinking_funds: {
        Row: {
          accrued: number
          active: boolean
          created_at: string
          deleted_at: string | null
          due_month: string
          id: string
          months_to_spread: number
          name: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          accrued?: number
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          due_month: string
          id?: string
          months_to_spread?: number
          name: string
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          accrued?: number
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          due_month?: string
          id?: string
          months_to_spread?: number
          name?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          category_id: string | null
          created_at: string
          dedupe_key: string | null
          deleted_at: string | null
          description: string
          id: string
          kind: Database["public"]["Enums"]["tx_kind"]
          needs_review: boolean
          occurred_at: string
          raw_text: string | null
          reclassified_from: string | null
          source: Database["public"]["Enums"]["tx_source"]
          to_account_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          category_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          deleted_at?: string | null
          description?: string
          id?: string
          kind?: Database["public"]["Enums"]["tx_kind"]
          needs_review?: boolean
          occurred_at?: string
          raw_text?: string | null
          reclassified_from?: string | null
          source?: Database["public"]["Enums"]["tx_source"]
          to_account_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          category_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          deleted_at?: string | null
          description?: string
          id?: string
          kind?: Database["public"]["Enums"]["tx_kind"]
          needs_review?: boolean
          occurred_at?: string
          raw_text?: string | null
          reclassified_from?: string | null
          source?: Database["public"]["Enums"]["tx_source"]
          to_account_id?: string | null
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
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      account_kind: "cash" | "card" | "savings" | "wallet" | "other"
      commitment_kind:
        | "rent"
        | "loan"
        | "insurance"
        | "salary_paid"
        | "allowance"
        | "utility"
        | "rotating_fund"
        | "education"
        | "other"
      income_shape:
        | "fixed_salary"
        | "variable"
        | "allowance"
        | "multiple"
        | "none"
      savings_cadence: "daily" | "weekly" | "monthly"
      tx_kind: "expense" | "income" | "transfer"
      tx_source: "manual" | "recurring"
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

export const Constants = {
  public: {
    Enums: {
      account_kind: ["cash", "card", "savings", "wallet", "other"],
      commitment_kind: [
        "rent",
        "loan",
        "insurance",
        "salary_paid",
        "allowance",
        "utility",
        "rotating_fund",
        "education",
        "other",
      ],
      income_shape: [
        "fixed_salary",
        "variable",
        "allowance",
        "multiple",
        "none",
      ],
      savings_cadence: ["daily", "weekly", "monthly"],
      tx_kind: ["expense", "income", "transfer"],
      tx_source: ["manual", "recurring"],
    },
  },
} as const
