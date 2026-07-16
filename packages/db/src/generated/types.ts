/**
 * Supabase `Database` type — hand-written to mirror the §4 schema and stay
 * consistent with packages/core/src/schemas.ts. This is the shape the generated
 * Supabase client is parameterised by (`SupabaseClient<Database>`).
 *
 * Regenerate with: supabase gen types typescript --linked
 *
 * Conventions matching Supabase's generator:
 *  - Row     = a selected row (all columns present, DB defaults resolved).
 *  - Insert  = payload for `.insert()` — columns with a DB default or that are
 *              nullable are optional; `null` allowed where the column is nullable.
 *  - Update  = payload for `.update()` — every column optional.
 *  - `jsonb`/`json` columns are typed as `Json`.
 *  - `timestamptz` / `date` render as ISO `string` (store UTC, render Warsaw §4).
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      // ─── venues (multi-tenancy root, §4) ────────────────────────────────
      venues: {
        Row: {
          id: string;
          created_at: string;
          name: string;
          slug: string;
          city: string | null;
          plan: string; // 'free' | 'pro' | 'suite'
          settings: Json; // venues.settings (§4.1)
          sms_balance_grosz: number;
          locale: string; // 'pl' | 'en'
        };
        Insert: {
          id?: string;
          created_at?: string;
          name: string;
          slug: string;
          city?: string | null;
          plan?: string;
          settings?: Json;
          sms_balance_grosz?: number;
          locale?: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          name?: string;
          slug?: string;
          city?: string | null;
          plan?: string;
          settings?: Json;
          sms_balance_grosz?: number;
          locale?: string;
        };
      };

      // ─── memberships (staff = auth.users + venue, §4) ────────────────────
      memberships: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          venue_id: string;
          role: string; // 'owner' | 'manager' | 'staff'
          display_name: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id: string;
          venue_id: string;
          role: string;
          display_name?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string;
          venue_id?: string;
          role?: string;
          display_name?: string | null;
        };
      };

      // ─── guests (venue-scoped, minimal, purgeable, §4/§11) ───────────────
      guests: {
        Row: {
          id: string;
          created_at: string;
          venue_id: string;
          first_name: string | null;
          phone_e164: string | null;
          email: string | null;
          marketing_consent_at: string | null;
          purge_after: string; // date
        };
        Insert: {
          id?: string;
          created_at?: string;
          venue_id: string;
          first_name?: string | null;
          phone_e164?: string | null;
          email?: string | null;
          marketing_consent_at?: string | null;
          purge_after: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          venue_id?: string;
          first_name?: string | null;
          phone_e164?: string | null;
          email?: string | null;
          marketing_consent_at?: string | null;
          purge_after?: string;
        };
      };

      // ─── visits (the core table, §4/§5) ──────────────────────────────────
      visits: {
        Row: {
          id: string;
          created_at: string;
          venue_id: string;
          guest_id: string | null;
          type: string; // 'walk_in' | 'reservation'
          status: string; // §5 state machine
          party_size: number;
          display_name: string | null;
          public_token: string;
          ticket_no: number;
          rank: number;
          quote_minutes: number;
          quote_source: string; // 'auto' | 'manual'
          notified_at: string | null;
          heads_up_sent_at: string | null;
          hold_expires_at: string | null;
          on_way_at: string | null;
          seated_at: string | null;
          ended_at: string | null;
          ended_reason: string | null;
          reservation_at: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          venue_id: string;
          guest_id?: string | null;
          type?: string;
          status?: string;
          party_size: number;
          display_name?: string | null;
          public_token: string;
          ticket_no: number;
          rank: number;
          quote_minutes: number;
          quote_source?: string;
          notified_at?: string | null;
          heads_up_sent_at?: string | null;
          hold_expires_at?: string | null;
          on_way_at?: string | null;
          seated_at?: string | null;
          ended_at?: string | null;
          ended_reason?: string | null;
          reservation_at?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          venue_id?: string;
          guest_id?: string | null;
          type?: string;
          status?: string;
          party_size?: number;
          display_name?: string | null;
          public_token?: string;
          ticket_no?: number;
          rank?: number;
          quote_minutes?: number;
          quote_source?: string;
          notified_at?: string | null;
          heads_up_sent_at?: string | null;
          hold_expires_at?: string | null;
          on_way_at?: string | null;
          seated_at?: string | null;
          ended_at?: string | null;
          ended_reason?: string | null;
          reservation_at?: string | null;
          notes?: string | null;
        };
      };

      // ─── visit_events (append-only, §4) ──────────────────────────────────
      visit_events: {
        Row: {
          id: string;
          created_at: string;
          visit_id: string;
          venue_id: string;
          actor: string; // 'staff:<user_id>' | 'guest' | 'system'
          event: string; // VisitEvent | 'undo:<event>'
          meta: Json;
        };
        Insert: {
          id?: string;
          created_at?: string;
          visit_id: string;
          venue_id: string;
          actor: string;
          event: string;
          meta?: Json;
        };
        Update: {
          id?: string;
          created_at?: string;
          visit_id?: string;
          venue_id?: string;
          actor?: string;
          event?: string;
          meta?: Json;
        };
      };

      // ─── notifications (outbound + cost accounting, §4/§7) ───────────────
      notifications: {
        Row: {
          id: string;
          created_at: string;
          visit_id: string;
          venue_id: string;
          channel: string; // 'sms' | 'email'
          template_key: string; // 'joined' | 'heads_up' | 'table_ready' | 'renotify'
          to_addr: string;
          body: string;
          segments: number | null;
          cost_grosz: number | null;
          status: string; // 'queued' | 'sent' | 'delivered' | 'failed'
          provider_id: string | null;
          sent_at: string | null;
          error: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          visit_id: string;
          venue_id: string;
          channel: string;
          template_key: string;
          to_addr: string;
          body: string;
          segments?: number | null;
          cost_grosz?: number | null;
          status?: string;
          provider_id?: string | null;
          sent_at?: string | null;
          error?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          visit_id?: string;
          venue_id?: string;
          channel?: string;
          template_key?: string;
          to_addr?: string;
          body?: string;
          segments?: number | null;
          cost_grosz?: number | null;
          status?: string;
          provider_id?: string | null;
          sent_at?: string | null;
          error?: string | null;
        };
      };

      // ─── notification_jobs (pg_cron sweep queue, §7.6) ───────────────────
      notification_jobs: {
        Row: {
          id: string;
          created_at: string;
          visit_id: string;
          template_key: string;
          channel: string;
          run_after: string;
          attempts: number;
          locked_at: string | null;
          done_at: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          visit_id: string;
          template_key: string;
          channel: string;
          run_after?: string;
          attempts?: number;
          locked_at?: string | null;
          done_at?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          visit_id?: string;
          template_key?: string;
          channel?: string;
          run_after?: string;
          attempts?: number;
          locked_at?: string | null;
          done_at?: string | null;
        };
      };

      // ─── message_templates (per-venue, editable, §4/§7.2) ────────────────
      message_templates: {
        Row: {
          id: string;
          created_at: string;
          venue_id: string;
          key: string; // TemplateKey
          locale: string; // 'pl' | 'en'
          body: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          venue_id: string;
          key: string;
          locale?: string;
          body: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          venue_id?: string;
          key?: string;
          locale?: string;
          body?: string;
        };
      };
    };

    Views: Record<string, never>;

    // ─── RPCs (§4.3, §5) ───────────────────────────────────────────────────
    Functions: {
      /** Create a walk-in visit atomically: allocate ticket_no (advisory lock),
       *  rank, public_token, compute quote, insert `created` event (§4.3, §5 #1). */
      create_visit: {
        Args: {
          p_venue_id: string;
          p_party_size: number;
          p_display_name?: string | null;
          p_first_name?: string | null;
          p_quote_minutes?: number | null;
          p_quote_source?: string;
          p_type?: string;
          p_notes?: string | null;
        };
        Returns: Database['public']['Tables']['visits']['Row'];
      };
      /** Apply a state-machine transition to a visit, enforcing legality
       *  (throws 409 invalid_transition) and writing the matching event (§5). */
      set_visit_status: {
        Args: {
          p_visit_id: string;
          p_intent: string; // TransitionIntent
          p_actor?: string;
        };
        Returns: Database['public']['Tables']['visits']['Row'];
      };
    };

    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// ─── Row/Insert/Update convenience aliases ─────────────────────────────────
type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update'];
