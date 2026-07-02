/**
 * TypeScript database types matching supabase/migrations. Kept in the
 * generated-types shape (`Database["public"]["Tables"][...]`) so a future
 * `supabase gen types typescript` can replace this file without code changes.
 */

type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          default_mode: string;
          default_answer_length: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          default_mode?: string;
          default_answer_length?: string;
        };
        Update: {
          display_name?: string | null;
          avatar_url?: string | null;
          default_mode?: string;
          default_answer_length?: string;
        };
        Relationships: [];
      };
      anonymous_sessions: {
        Row: {
          id: string;
          fingerprint_hash: string | null;
          search_count: number;
          last_search_at: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          fingerprint_hash?: string | null;
          search_count?: number;
          last_search_at?: string | null;
        };
        Update: {
          search_count?: number;
          last_search_at?: string | null;
        };
        Relationships: [];
      };
      spaces: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          description: string;
          custom_instructions: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          description?: string;
          custom_instructions?: string;
        };
        Update: {
          name?: string;
          description?: string;
          custom_instructions?: string;
        };
        Relationships: [];
      };
      space_members: {
        Row: {
          space_id: string;
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: { space_id: string; user_id: string; role?: string };
        Update: { role?: string };
        Relationships: [];
      };
      threads: {
        Row: {
          id: string;
          user_id: string | null;
          anonymous_session_id: string | null;
          space_id: string | null;
          title: string;
          search_mode: string;
          answer_length: string;
          is_saved: boolean;
          is_public: boolean;
          share_token: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          anonymous_session_id?: string | null;
          space_id?: string | null;
          title: string;
          search_mode?: string;
          answer_length?: string;
          is_saved?: boolean;
          is_public?: boolean;
          share_token?: string | null;
        };
        Update: {
          space_id?: string | null;
          title?: string;
          is_saved?: boolean;
          is_public?: boolean;
          share_token?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          thread_id: string;
          role: string;
          content: string;
          status: string;
          model: string | null;
          token_usage: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          role: string;
          content?: string;
          status?: string;
          model?: string | null;
          token_usage?: Json | null;
        };
        Update: {
          content?: string;
          status?: string;
          model?: string | null;
          token_usage?: Json | null;
        };
        Relationships: [];
      };
      search_runs: {
        Row: {
          id: string;
          thread_id: string;
          message_id: string | null;
          provider: string;
          mode: string;
          queries: Json;
          status: string;
          duration_ms: number | null;
          usage_metadata: Json | null;
          error_code: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          message_id?: string | null;
          provider: string;
          mode: string;
          queries?: Json;
          status?: string;
        };
        Update: {
          message_id?: string | null;
          queries?: Json;
          status?: string;
          duration_ms?: number | null;
          usage_metadata?: Json | null;
          error_code?: string | null;
        };
        Relationships: [];
      };
      sources: {
        Row: {
          id: string;
          search_run_id: string;
          citation_number: number;
          url: string;
          canonical_url: string;
          domain: string;
          title: string;
          snippet: string;
          content: string | null;
          author: string | null;
          published_at: string | null;
          retrieved_at: string;
          favicon_url: string | null;
          relevance_score: number;
          quality_score: number;
          metadata: Json;
        };
        Insert: {
          id?: string;
          search_run_id: string;
          citation_number: number;
          url: string;
          canonical_url: string;
          domain: string;
          title: string;
          snippet?: string;
          content?: string | null;
          author?: string | null;
          published_at?: string | null;
          retrieved_at?: string;
          favicon_url?: string | null;
          relevance_score?: number;
          quality_score?: number;
          metadata?: Json;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
