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
      alerts: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_type: string
          platform_id: string | null
          rejection_reason: string | null
          requested_at: string
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["alert_status"]
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_type: string
          platform_id?: string | null
          rejection_reason?: string | null
          requested_at?: string
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_type?: string
          platform_id?: string | null
          rejection_reason?: string | null
          requested_at?: string
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      community_items: {
        Row: {
          content: string | null
          created_at: string | null
          critical_reason: string | null
          critical_type: Database["public"]["Enums"]["critical_type"] | null
          dislikes: number | null
          id: string
          is_cleanbot: boolean | null
          is_relevant: boolean | null
          likes: number | null
          link: string
          nid: string | null
          platform_id: string
          published_at: string | null
          sentiment: string | null
          session_id: string | null
          title: string
          views: number | null
          workspace_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          critical_reason?: string | null
          critical_type?: Database["public"]["Enums"]["critical_type"] | null
          dislikes?: number | null
          id?: string
          is_cleanbot?: boolean | null
          is_relevant?: boolean | null
          likes?: number | null
          link: string
          nid?: string | null
          platform_id: string
          published_at?: string | null
          sentiment?: string | null
          session_id?: string | null
          title: string
          views?: number | null
          workspace_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          critical_reason?: string | null
          critical_type?: Database["public"]["Enums"]["critical_type"] | null
          dislikes?: number | null
          id?: string
          is_cleanbot?: boolean | null
          is_relevant?: boolean | null
          likes?: number | null
          link?: string
          nid?: string | null
          platform_id?: string
          published_at?: string | null
          sentiment?: string | null
          session_id?: string | null
          title?: string
          views?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_items_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      content_blacklist: {
        Row: {
          created_at: string | null
          id: string
          platform_id: string
          reason: string | null
          type: string
          value: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          platform_id: string
          reason?: string | null
          type: string
          value: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          platform_id?: string
          reason?: string | null
          type?: string
          value?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_blacklist_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_platform_stats: {
        Row: {
          content_count: number
          daily_snapshot_id: string
          failed_reason: Database["public"]["Enums"]["failed_reason"] | null
          id: string
          mood_summary: string | null
          negative_count: number
          neutral_count: number
          platform_id: string
          positive_count: number
          retry_count: number
          sir_score: number | null
          status: Database["public"]["Enums"]["crawl_status"]
        }
        Insert: {
          content_count?: number
          daily_snapshot_id: string
          failed_reason?: Database["public"]["Enums"]["failed_reason"] | null
          id?: string
          mood_summary?: string | null
          negative_count?: number
          neutral_count?: number
          platform_id: string
          positive_count?: number
          retry_count?: number
          sir_score?: number | null
          status?: Database["public"]["Enums"]["crawl_status"]
        }
        Update: {
          content_count?: number
          daily_snapshot_id?: string
          failed_reason?: Database["public"]["Enums"]["failed_reason"] | null
          id?: string
          mood_summary?: string | null
          negative_count?: number
          neutral_count?: number
          platform_id?: string
          positive_count?: number
          retry_count?: number
          sir_score?: number | null
          status?: Database["public"]["Enums"]["crawl_status"]
        }
        Relationships: [
          {
            foreignKeyName: "daily_platform_stats_daily_snapshot_id_fkey"
            columns: ["daily_snapshot_id"]
            isOneToOne: false
            referencedRelation: "daily_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_platform_stats_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_snapshots: {
        Row: {
          date: string
          id: string
          is_carried: boolean
          leading_momentum_3d: number | null
          leading_momentum_z: number | null
          leading_sir: number | null
          sir_score: number | null
          workspace_id: string
        }
        Insert: {
          date: string
          id?: string
          is_carried?: boolean
          leading_momentum_3d?: number | null
          leading_momentum_z?: number | null
          leading_sir?: number | null
          sir_score?: number | null
          workspace_id: string
        }
        Update: {
          date?: string
          id?: string
          is_carried?: boolean
          leading_momentum_3d?: number | null
          leading_momentum_z?: number | null
          leading_sir?: number | null
          sir_score?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      kakao_tokens: {
        Row: {
          access_expires_at: string
          access_token: string
          id: string
          refresh_expires_at: string
          refresh_token: string
          updated_at: string
        }
        Insert: {
          access_expires_at: string
          access_token: string
          id?: string
          refresh_expires_at: string
          refresh_token: string
          updated_at?: string
        }
        Update: {
          access_expires_at?: string
          access_token?: string
          id?: string
          refresh_expires_at?: string
          refresh_token?: string
          updated_at?: string
        }
        Relationships: []
      }
      monitoring_ai_analyses: {
        Row: {
          cache_read_tokens: number
          content: string
          created_at: string
          generated_kst_date: string
          id: string
          input_tokens: number
          model: string
          output_tokens: number
          period_end: string
          period_start: string
          requested_by: string | null
          workspace_id: string
        }
        Insert: {
          cache_read_tokens?: number
          content: string
          created_at?: string
          generated_kst_date: string
          id?: string
          input_tokens?: number
          model: string
          output_tokens?: number
          period_end: string
          period_start: string
          requested_by?: string | null
          workspace_id: string
        }
        Update: {
          cache_read_tokens?: number
          content?: string
          created_at?: string
          generated_kst_date?: string
          id?: string
          input_tokens?: number
          model?: string
          output_tokens?: number
          period_end?: string
          period_start?: string
          requested_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_ai_analyses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_search_trends_cache: {
        Row: {
          end_date: string
          generated_kst_date: string
          keyword: string
          points: Json
          start_date: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          end_date: string
          generated_kst_date: string
          keyword: string
          points: Json
          start_date: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          end_date?: string
          generated_kst_date?: string
          keyword?: string
          points?: Json
          start_date?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_search_trends_cache_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      news_clusters: {
        Row: {
          article_count: number
          created_at: string
          id: string
          is_critical: boolean
          is_relevant: boolean | null
          representative_title: string
          sentiment: string | null
          session_id: string | null
          summary: string | null
          workspace_id: string
        }
        Insert: {
          article_count?: number
          created_at?: string
          id?: string
          is_critical?: boolean
          is_relevant?: boolean | null
          representative_title: string
          sentiment?: string | null
          session_id?: string | null
          summary?: string | null
          workspace_id: string
        }
        Update: {
          article_count?: number
          created_at?: string
          id?: string
          is_critical?: boolean
          is_relevant?: boolean | null
          representative_title?: string
          sentiment?: string | null
          session_id?: string | null
          summary?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_clusters_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_clusters_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      news_items: {
        Row: {
          cluster_id: string | null
          content: string | null
          created_at: string
          critical_reason: string | null
          critical_type: Database["public"]["Enums"]["critical_type"] | null
          id: string
          is_relevant: boolean | null
          link: string
          platform_id: string
          published_at: string | null
          sentiment: string | null
          session_id: string | null
          source: string | null
          summary: string | null
          title: string
          workspace_id: string
        }
        Insert: {
          cluster_id?: string | null
          content?: string | null
          created_at?: string
          critical_reason?: string | null
          critical_type?: Database["public"]["Enums"]["critical_type"] | null
          id?: string
          is_relevant?: boolean | null
          link: string
          platform_id: string
          published_at?: string | null
          sentiment?: string | null
          session_id?: string | null
          source?: string | null
          summary?: string | null
          title: string
          workspace_id: string
        }
        Update: {
          cluster_id?: string | null
          content?: string | null
          created_at?: string
          critical_reason?: string | null
          critical_type?: Database["public"]["Enums"]["critical_type"] | null
          id?: string
          is_relevant?: boolean | null
          link?: string
          platform_id?: string
          published_at?: string | null
          sentiment?: string | null
          session_id?: string | null
          source?: string | null
          summary?: string | null
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_items_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "news_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_items_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_runs: {
        Row: {
          created_at: string
          error_message: string | null
          error_stage: string | null
          finished_at: string | null
          id: string
          item_count: number | null
          report_id: string | null
          report_type: string
          risk_count: number | null
          sir_score: number | null
          started_at: string
          status: string
          triggered_by: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          error_stage?: string | null
          finished_at?: string | null
          id?: string
          item_count?: number | null
          report_id?: string | null
          report_type: string
          risk_count?: number | null
          sir_score?: number | null
          started_at?: string
          status?: string
          triggered_by?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          error_stage?: string | null
          finished_at?: string | null
          id?: string
          item_count?: number | null
          report_id?: string | null
          report_type?: string
          risk_count?: number | null
          sir_score?: number | null
          started_at?: string
          status?: string
          triggered_by?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_runs_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      platforms: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          label: string
        }
        Insert: {
          category: string
          created_at?: string
          id: string
          is_active?: boolean
          label: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          avg_sir_score: number | null
          created_at: string
          created_by: string | null
          generated_at: string | null
          id: string
          period_end: string
          period_start: string
          sir_score: number | null
          status: Database["public"]["Enums"]["report_status"] | null
          type: Database["public"]["Enums"]["report_type"]
          workspace_id: string
        }
        Insert: {
          avg_sir_score?: number | null
          created_at?: string
          created_by?: string | null
          generated_at?: string | null
          id?: string
          period_end: string
          period_start: string
          sir_score?: number | null
          status?: Database["public"]["Enums"]["report_status"] | null
          type?: Database["public"]["Enums"]["report_type"]
          workspace_id: string
        }
        Update: {
          avg_sir_score?: number | null
          created_at?: string
          created_by?: string | null
          generated_at?: string | null
          id?: string
          period_end?: string
          period_start?: string
          sir_score?: number | null
          status?: Database["public"]["Enums"]["report_status"] | null
          type?: Database["public"]["Enums"]["report_type"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_notice_reads: {
        Row: {
          latest_seen_risk_at: string
          profile_id: string
          seen_at: string
          workspace_id: string
        }
        Insert: {
          latest_seen_risk_at: string
          profile_id: string
          seen_at?: string
          workspace_id: string
        }
        Update: {
          latest_seen_risk_at?: string
          profile_id?: string
          seen_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_notice_reads_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_notice_reads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_reports: {
        Row: {
          admin_note: string | null
          created_at: string | null
          critical_type: Database["public"]["Enums"]["critical_type"]
          evidence: string
          file_urls: string[]
          id: string
          link: string
          metadata_purged_at: string | null
          platform_id: string
          reason: string
          report_id: string
          requested_at: string | null
          resolved_at: string | null
          source_id: string
          source_table: string
          status: string
          status_changed_at: string
          title: string
          workspace_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string | null
          critical_type: Database["public"]["Enums"]["critical_type"]
          evidence: string
          file_urls?: string[]
          id?: string
          link: string
          metadata_purged_at?: string | null
          platform_id: string
          reason: string
          report_id: string
          requested_at?: string | null
          resolved_at?: string | null
          source_id: string
          source_table: string
          status?: string
          status_changed_at?: string
          title: string
          workspace_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string | null
          critical_type?: Database["public"]["Enums"]["critical_type"]
          evidence?: string
          file_urls?: string[]
          id?: string
          link?: string
          metadata_purged_at?: string | null
          platform_id?: string
          reason?: string
          report_id?: string
          requested_at?: string | null
          resolved_at?: string | null
          source_id?: string
          source_table?: string
          status?: string
          status_changed_at?: string
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_reports_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_reports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      search_trends: {
        Row: {
          created_at: string
          id: string
          provider: string
          report_id: string
          trend_data: Json
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          provider: string
          report_id: string
          trend_data: Json
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          provider?: string
          report_id?: string
          trend_data?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_trends_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_trends_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      session_strategies: {
        Row: {
          all_strategy: Json | null
          category: string
          created_at: string
          error_message: string | null
          failed_reason: Database["public"]["Enums"]["failed_reason"] | null
          id: string
          input_tokens: number
          output_tokens: number
          prompt_version: string | null
          report_id: string | null
          session_id: string | null
          status: Database["public"]["Enums"]["crawl_status"]
          strategy: Json | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          all_strategy?: Json | null
          category: string
          created_at?: string
          error_message?: string | null
          failed_reason?: Database["public"]["Enums"]["failed_reason"] | null
          id?: string
          input_tokens?: number
          output_tokens?: number
          prompt_version?: string | null
          report_id?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["crawl_status"]
          strategy?: Json | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          all_strategy?: Json | null
          category?: string
          created_at?: string
          error_message?: string | null
          failed_reason?: Database["public"]["Enums"]["failed_reason"] | null
          id?: string
          input_tokens?: number
          output_tokens?: number
          prompt_version?: string | null
          report_id?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["crawl_status"]
          strategy?: Json | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_strategies_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_strategies_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_strategies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          error_message: string | null
          failed_reason: Database["public"]["Enums"]["failed_reason"] | null
          id: string
          input_tokens: number
          mood: string | null
          next_retry_at: string | null
          output_tokens: number
          platform_id: string | null
          prompt_version: string | null
          report_id: string | null
          retry_count: number
          sir_score: number | null
          status: Database["public"]["Enums"]["crawl_status"]
          total_items: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          failed_reason?: Database["public"]["Enums"]["failed_reason"] | null
          id?: string
          input_tokens?: number
          mood?: string | null
          next_retry_at?: string | null
          output_tokens?: number
          platform_id?: string | null
          prompt_version?: string | null
          report_id?: string | null
          retry_count?: number
          sir_score?: number | null
          status?: Database["public"]["Enums"]["crawl_status"]
          total_items?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          failed_reason?: Database["public"]["Enums"]["failed_reason"] | null
          id?: string
          input_tokens?: number
          mood?: string | null
          next_retry_at?: string | null
          output_tokens?: number
          platform_id?: string | null
          prompt_version?: string | null
          report_id?: string | null
          retry_count?: number
          sir_score?: number | null
          status?: Database["public"]["Enums"]["crawl_status"]
          total_items?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sns_items: {
        Row: {
          author: string | null
          comments: number | null
          content: string | null
          created_at: string | null
          critical_reason: string | null
          critical_type: Database["public"]["Enums"]["critical_type"] | null
          id: string
          impact_score: number | null
          is_relevant: boolean | null
          link: string
          metadata_purged_at: string | null
          platform_id: string
          published_at: string | null
          sentiment: string | null
          session_id: string | null
          summary: string | null
          title: string
          views: number | null
          workspace_id: string
        }
        Insert: {
          author?: string | null
          comments?: number | null
          content?: string | null
          created_at?: string | null
          critical_reason?: string | null
          critical_type?: Database["public"]["Enums"]["critical_type"] | null
          id?: string
          impact_score?: number | null
          is_relevant?: boolean | null
          link: string
          metadata_purged_at?: string | null
          platform_id: string
          published_at?: string | null
          sentiment?: string | null
          session_id?: string | null
          summary?: string | null
          title: string
          views?: number | null
          workspace_id: string
        }
        Update: {
          author?: string | null
          comments?: number | null
          content?: string | null
          created_at?: string | null
          critical_reason?: string | null
          critical_type?: Database["public"]["Enums"]["critical_type"] | null
          id?: string
          impact_score?: number | null
          is_relevant?: boolean | null
          link?: string
          metadata_purged_at?: string | null
          platform_id?: string
          published_at?: string | null
          sentiment?: string | null
          session_id?: string | null
          summary?: string | null
          title?: string
          views?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sns_items_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sns_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sns_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_prices: {
        Row: {
          close_price: number
          created_at: string | null
          date: string
          high_price: number
          id: string
          low_price: number
          open_price: number
          volume: number | null
          workspace_id: string
        }
        Insert: {
          close_price: number
          created_at?: string | null
          date: string
          high_price: number
          id?: string
          low_price: number
          open_price: number
          volume?: number | null
          workspace_id: string
        }
        Update: {
          close_price?: number
          created_at?: string | null
          date?: string
          high_price?: number
          id?: string
          low_price?: number
          open_price?: number
          volume?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_prices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          created_by: string | null
          ended_at: string
          has_armor: boolean | null
          has_booster: boolean | null
          has_daily: boolean | null
          id: string
          reason: string | null
          started_at: string
          tier: Database["public"]["Enums"]["service_tier"]
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ended_at: string
          has_armor?: boolean | null
          has_booster?: boolean | null
          has_daily?: boolean | null
          id?: string
          reason?: string | null
          started_at?: string
          tier: Database["public"]["Enums"]["service_tier"]
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ended_at?: string
          has_armor?: boolean | null
          has_booster?: boolean | null
          has_daily?: boolean | null
          id?: string
          reason?: string | null
          started_at?: string
          tier?: Database["public"]["Enums"]["service_tier"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      support_inquiries: {
        Row: {
          answer_content: string | null
          answered_at: string | null
          answered_by: string | null
          category: string
          content: string
          created_at: string
          id: string
          requester_id: string
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          answer_content?: string | null
          answered_at?: string | null
          answered_by?: string | null
          category: string
          content: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          answer_content?: string | null
          answered_at?: string | null
          answered_by?: string | null
          category?: string
          content?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_inquiries_answered_by_fkey"
            columns: ["answered_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_inquiries_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_inquiries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          company_name: string
          created_at: string
          email: string
          id: string
          privacy_agreed_at: string | null
          privacy_agreed_version: string | null
          role: Database["public"]["Enums"]["profile_role"]
          terms_agreed_at: string | null
          terms_agreed_version: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_name: string
          created_at?: string
          email: string
          id: string
          privacy_agreed_at?: string | null
          privacy_agreed_version?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
          terms_agreed_at?: string | null
          terms_agreed_version?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_name?: string
          created_at?: string
          email?: string
          id?: string
          privacy_agreed_at?: string | null
          privacy_agreed_version?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
          terms_agreed_at?: string | null
          terms_agreed_version?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          role: Database["public"]["Enums"]["workspace_member_role"]
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          role?: Database["public"]["Enums"]["workspace_member_role"]
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          role?: Database["public"]["Enums"]["workspace_member_role"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_platforms: {
        Row: {
          platform_id: string
          workspace_id: string
        }
        Insert: {
          platform_id: string
          workspace_id: string
        }
        Update: {
          platform_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_platforms_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_platforms_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_profiles: {
        Row: {
          business_summary: string | null
          id: string
          industry: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          business_summary?: string | null
          id?: string
          industry?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          business_summary?: string | null
          id?: string
          industry?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          company_name: string
          created_at: string
          id: string
          last_charged_at: string | null
          monthly_quota: number
          shard_id: number | null
          sir_score: number | null
          ticker: string
          token_balance: number
          updated_at: string
        }
        Insert: {
          company_name: string
          created_at?: string
          id?: string
          last_charged_at?: string | null
          monthly_quota?: number
          shard_id?: number | null
          sir_score?: number | null
          ticker: string
          token_balance?: number
          updated_at?: string
        }
        Update: {
          company_name?: string
          created_at?: string
          id?: string
          last_charged_at?: string | null
          monthly_quota?: number
          shard_id?: number | null
          sir_score?: number | null
          ticker?: string
          token_balance?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      all_items: {
        Row: {
          created_at: string | null
          critical_reason: string | null
          critical_type: Database["public"]["Enums"]["critical_type"] | null
          id: string | null
          link: string | null
          published_at: string | null
          sentiment: string | null
          session_id: string | null
          source: string | null
          summary: string | null
          title: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _assert_admin_for_subscriptions: { Args: never; Returns: undefined }
      answer_support_inquiry: {
        Args: { p_answer_content: string; p_inquiry_id: string }
        Returns: {
          answer_content: string | null
          answered_at: string | null
          answered_by: string | null
          category: string
          content: string
          created_at: string
          id: string
          requester_id: string
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "support_inquiries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      auto_reject_stale_risk_reports: { Args: never; Returns: Json }
      can_read_workspace: { Args: { ws_id: string }; Returns: boolean }
      cancel_subscription: {
        Args: { p_cancel_at?: string; p_workspace_id: string }
        Returns: string
      }
      change_subscription_tier: {
        Args: {
          p_effective_at?: string
          p_new_tier: Database["public"]["Enums"]["service_tier"]
          p_workspace_id: string
        }
        Returns: string
      }
      charge_monthly_ai_tokens: { Args: never; Returns: number }
      cleanup_analyzed_content: { Args: never; Returns: undefined }
      cleanup_zombie_pipeline_state: { Args: never; Returns: Json }
      correct_subscription: {
        Args: {
          p_ended_at?: string
          p_started_at?: string
          p_subscription_id: string
          p_tier?: Database["public"]["Enums"]["service_tier"]
        }
        Returns: string
      }
      create_user_workspace_bundle: {
        Args: {
          p_business_summary: string
          p_company_name: string
          p_ended_at: string
          p_industry: string
          p_started_at: string
          p_ticker: string
          p_tier: Database["public"]["Enums"]["service_tier"]
          p_user_id: string
        }
        Returns: Json
      }
      cron_silent_fail_check: { Args: never; Returns: undefined }
      daily_sentiment_counts: {
        Args: { day_end: string; day_start: string; ws_id: string }
        Returns: {
          cnt: number
          platform_id: string
          sentiment: string
        }[]
      }
      decrement_workspace_tokens: {
        Args: { p_amount: number; p_workspace_id: string }
        Returns: number
      }
      delete_scheduled_subscription: {
        Args: { p_subscription_id: string }
        Returns: string
      }
      delete_sns_items_by_links: {
        Args: { p_links: string[]; p_session_id: string }
        Returns: number
      }
      extend_subscription: {
        Args: { p_new_ended_at: string; p_workspace_id: string }
        Returns: string
      }
      get_sir_ranking: {
        Args: { p_report_id?: string; p_workspace_id: string }
        Returns: Json
      }
      get_user_landing: {
        Args: { p_user_id: string }
        Returns: {
          report_id: string
          role: string
          workspace_id: string
        }[]
      }
      initialized_workspaces: {
        Args: { ws_ids: string[] }
        Returns: {
          workspace_id: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      is_support_admin_for_workspace: {
        Args: { ws_id: string }
        Returns: boolean
      }
      pause_subscription: {
        Args: { p_pause_at?: string; p_workspace_id: string }
        Returns: string
      }
      purge_expired_youtube_metadata: { Args: never; Returns: number }
      renew_subscription: {
        Args: {
          p_new_ended_at: string
          p_new_started_at: string
          p_new_tier: Database["public"]["Enums"]["service_tier"]
          p_workspace_id: string
        }
        Returns: string
      }
      resume_subscription: {
        Args: {
          p_new_ended_at: string
          p_new_started_at: string
          p_new_tier: Database["public"]["Enums"]["service_tier"]
          p_workspace_id: string
        }
        Returns: string
      }
      session_sentiment_counts: {
        Args: { s_id: string }
        Returns: {
          cnt: number
          platform_id: string
          sentiment: string
        }[]
      }
      subscription_status: { Args: { ws_id: string }; Returns: string }
      try_start_pipeline_run: {
        Args: {
          p_report_id: string
          p_report_type: string
          p_triggered_by?: string
          p_workspace_id: string
        }
        Returns: string
      }
      user_has_workspace_access: { Args: { ws_id: string }; Returns: boolean }
      workspace_sentiment_counts: {
        Args: { ws_id: string }
        Returns: {
          cnt: number
          platform_id: string
          sentiment: string
        }[]
      }
    }
    Enums: {
      alert_status: "pending" | "in_progress" | "deleted" | "rejected"
      crawl_status:
        | "pending"
        | "crawling"
        | "pending_analysis"
        | "analyzing"
        | "done"
        | "failed"
      critical_type: "defamation" | "insult" | "rumor" | "spam"
      critical_type_new: "defamation" | "insult" | "rumor" | "spam"
      failed_reason:
        | "collect"
        | "save"
        | "analyze"
        | "calculate"
        | "generate"
        | "health"
      profile_role: "super_admin" | "user" | "admin"
      report_status: "draft" | "published"
      report_type: "initial" | "weekly" | "daily"
      service_tier:
        | "white"
        | "red"
        | "blue"
        | "black"
        | "white_plus"
        | "red_plus"
        | "blue_plus"
        | "black_plus"
      session_type: "initial_30d" | "weekly" | "daily"
      workspace_member_role: "super_admin" | "admin" | "user"
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
      alert_status: ["pending", "in_progress", "deleted", "rejected"],
      crawl_status: [
        "pending",
        "crawling",
        "pending_analysis",
        "analyzing",
        "done",
        "failed",
      ],
      critical_type: ["defamation", "insult", "rumor", "spam"],
      critical_type_new: ["defamation", "insult", "rumor", "spam"],
      failed_reason: [
        "collect",
        "save",
        "analyze",
        "calculate",
        "generate",
        "health",
      ],
      profile_role: ["super_admin", "user", "admin"],
      report_status: ["draft", "published"],
      report_type: ["initial", "weekly", "daily"],
      service_tier: [
        "white",
        "red",
        "blue",
        "black",
        "white_plus",
        "red_plus",
        "blue_plus",
        "black_plus",
      ],
      session_type: ["initial_30d", "weekly", "daily"],
      workspace_member_role: ["super_admin", "admin", "user"],
    },
  },
} as const
